// GS1 barcode helpers: validate, pad to GTIN-14, list variants, classify prefixes.
// Flow: digits only → length + check digit → GTIN-14 → variants / prefix class.
// Used by barcode lookup (P4). Pure — no network. Does not strip all leading zeros for compare.

// ===== NAMED CONSTANTS =====

const ALLOWED_LENGTHS = new Set([8, 12, 13, 14]);

// ===== MAIN RECIPES =====

/**
 * Keep only digit characters.
 * @param {string|number} barcode
 * @returns {string}
 */
function digitsOnly(barcode) {
  return String(barcode || '').replace(/\D/g, '');
}

/**
 * GS1 mod-10 check digit for a body that does not yet include the check digit.
 * @param {string} bodyDigits
 * @returns {number}
 */
function gs1CheckDigit(bodyDigits) {
  const body = String(bodyDigits || '');
  let sum = 0;
  for (let index = 0; index < body.length; index += 1) {
    const fromRight = body.length - index;
    // vocab: GS1 weights alternate 3,1 from the right
    const weight = fromRight % 2 === 1 ? 3 : 1;
    sum += Number(body[index]) * weight;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * True when the full digit string (including check digit) passes GS1 mod-10.
 * @param {string} digits
 * @returns {boolean}
 */
function hasValidCheckDigit(digits) {
  const clean = digitsOnly(digits);
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const check = Number(clean.slice(-1));
  return gs1CheckDigit(body) === check;
}

/**
 * Validate before any network call.
 * @param {string|number} barcode
 * @returns {{ ok: boolean, reason: string|null, digits: string }}
 */
function validateGtin(barcode) {
  // 1. Digits only.
  const digits = digitsOnly(barcode);
  if (!digits) {
    return { ok: false, reason: 'empty', digits: '' };
  }

  // 2. Allowed retail lengths only.
  if (!ALLOWED_LENGTHS.has(digits.length)) {
    return { ok: false, reason: 'bad_length', digits };
  }

  // 3. Check digit must match.
  if (!hasValidCheckDigit(digits)) {
    return { ok: false, reason: 'bad_check_digit', digits };
  }

  return { ok: true, reason: null, digits };
}

/**
 * Left-pad to GTIN-14. Does not strip zeros.
 * @param {string|number} barcode
 * @returns {string}
 */
function toGtin14(barcode) {
  const digits = digitsOnly(barcode);
  if (!digits) return '';
  if (digits.length > 14) return digits.slice(-14);
  return digits.padStart(14, '0');
}

/**
 * Expand one scanned code into the GTIN forms sources might store.
 * Includes UPC-E → UPC-A when the scan is 8 digits with number system 0/1.
 * @param {string|number} barcode
 * @returns {string[]}
 */
function gtinVariants(barcode) {
  const digits = digitsOnly(barcode);
  if (!digits) return [];

  const variants = new Set([digits]);

  // 1. Pad forms used by OFF / USDA / FatSecret.
  if (digits.length <= 12) variants.add(digits.padStart(12, '0'));
  if (digits.length <= 13) variants.add(digits.padStart(13, '0'));
  if (digits.length <= 14) variants.add(digits.padStart(14, '0'));

  // 2. UPC-E (8 digits) → UPC-A (12 digits), then re-pad.
  if (digits.length === 8) {
    const upcA = expandUpcEToUpcA(digits);
    if (upcA) {
      variants.add(upcA);
      variants.add(upcA.padStart(13, '0'));
      variants.add(upcA.padStart(14, '0'));
    }
  }

  // 3. Stable order for identical output across runs.
  return [...variants].sort((left, right) => {
    if (left.length !== right.length) return left.length - right.length;
    return left.localeCompare(right);
  });
}

/**
 * Classify a GTIN for lookup policy. Not a product lookup when restricted.
 * @param {string|number} barcode
 * @returns {{ kind: string, lookupAllowed: boolean, detail: object }}
 */
function classifyGtinPrefix(barcode) {
  const gtin14 = toGtin14(barcode);
  if (!gtin14 || gtin14.length !== 14) {
    return { kind: 'invalid', lookupAllowed: false, detail: { gtin14 } };
  }

  // vocab: EAN-13 / UPC-A sit in the rightmost 13 / 12 digits of GTIN-14
  const ean13 = gtin14.slice(1);
  const upcA = gtin14.slice(2);
  const numberSystem = upcA[0] || '';

  // 1. ISBN bookland — not a grocery product barcode.
  if (ean13.startsWith('978') || ean13.startsWith('979')) {
    return {
      kind: 'isbn',
      lookupAllowed: false,
      detail: { gtin14, ean13, prefix: ean13.slice(0, 3) },
    };
  }

  // 2. Coupon / restricted — GS1 company prefixes starting 99 on UPC/EAN.
  if (upcA.startsWith('99') || ean13.startsWith('99')) {
    return {
      kind: 'coupon',
      lookupAllowed: false,
      detail: { gtin14, upcA, prefix: '99' },
    };
  }

  // 3. Variable-weight / store scale (US number system 2).
  if (numberSystem === '2') {
    return {
      kind: 'variable_weight',
      lookupAllowed: false,
      detail: {
        gtin14,
        upcA,
        numberSystem: '2',
        itemPlu: upcA.slice(1, 6),
      },
    };
  }

  // 4. Other in-store / restricted circulation (number system 4).
  if (numberSystem === '4') {
    return {
      kind: 'in_store',
      lookupAllowed: false,
      detail: { gtin14, upcA, numberSystem: '4' },
    };
  }

  // 5. Normal manufacturer GTIN — product lookup allowed.
  return {
    kind: 'product',
    lookupAllowed: true,
    detail: { gtin14, ean13, upcA, numberSystem },
  };
}

module.exports = {
  ALLOWED_LENGTHS,
  digitsOnly,
  gs1CheckDigit,
  hasValidCheckDigit,
  validateGtin,
  toGtin14,
  gtinVariants,
  classifyGtinPrefix,
  expandUpcEToUpcA,
};

// ===== PLUMBING — skip unless debugging =====

/**
 * Expand UPC-E (8 digits: number system + 6 payload + check) to UPC-A (12).
 * Returns null when the pattern is not a compressible UPC-E form.
 * @param {string} upcE
 * @returns {string|null}
 */
function expandUpcEToUpcA(upcE) {
  const digits = digitsOnly(upcE);
  if (digits.length !== 8) return null;

  const numberSystem = digits[0];
  if (numberSystem !== '0' && numberSystem !== '1') return null;

  const check = digits[7];
  const d1 = digits[1];
  const d2 = digits[2];
  const d3 = digits[3];
  const d4 = digits[4];
  const d5 = digits[5];
  const d6 = digits[6];

  let manufacturer;
  let product;

  // GS1 UPC-E expansion by the last payload digit.
  if (d6 === '0' || d6 === '1' || d6 === '2') {
    manufacturer = `${d1}${d2}${d6}00`;
    product = `00${d3}${d4}${d5}`;
  } else if (d6 === '3') {
    manufacturer = `${d1}${d2}${d3}00`;
    product = `000${d4}${d5}`;
  } else if (d6 === '4') {
    manufacturer = `${d1}${d2}${d3}${d4}0`;
    product = `0000${d5}`;
  } else {
    manufacturer = `${d1}${d2}${d3}${d4}${d5}`;
    product = `0000${d6}`;
  }

  const upcABody = `${numberSystem}${manufacturer}${product}`;
  // Recompute check from the expanded body; the UPC-E check should match.
  const expectedCheck = String(gs1CheckDigit(upcABody));
  if (expectedCheck !== check) return null;
  return `${upcABody}${check}`;
}
