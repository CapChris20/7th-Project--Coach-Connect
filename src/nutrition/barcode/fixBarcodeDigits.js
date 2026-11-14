// Turns a camera or typed barcode into clean digits the server can look up.
// Flow: strip non-digits → pad a truncated UPC-A → accept 8–14 as-is → pad short → trim long.
// Used by: BarcodeScannerScreen. Phone cameras often drop the leading zero on a UPC-A label.
// Read order: constants → helpers → numbered main.

// ===== NAMED CONSTANTS =====

// Manipulate here: UPC-A is twelve digits; eleven usually means the leading zero fell off.
const UPC_A_DIGIT_COUNT = 12;
const TRUNCATED_UPC_DIGIT_COUNT = 11;
// Manipulate here: grocery codes under 8 get zero-padded; over 14 get sliced (bad OCR).
const MIN_ACCEPTED_DIGIT_COUNT = 8;
const MAX_ACCEPTED_DIGIT_COUNT = 14;

// ===== HELPER FUNCTIONS =====

/**
 * Left-pad with zeros until the string is twelve digits long (UPC-A width).
 * @param {string} digitsOnly
 * @returns {string}
 */
function padDigitsWithLeadingZerosToUpcLength(digitsOnly) {
  // vocab: padStart = add characters on the left until the string reaches the target length
  return digitsOnly.padStart(UPC_A_DIGIT_COUNT, '0');
}

/**
 * Keep only 0–9 from camera or typed input.
 * @param {string} rawBarcodeText
 * @returns {string}
 */
function digitsOnlyFromRawBarcode(rawBarcodeText) {
  // vocab: /\D/g = “every non-digit character”; replace with '' strips them.
  return String(rawBarcodeText || '').replace(/\D/g, '');
}

// ===== MAIN FUNCTION =====

/**
 * Normalize camera or manual barcode digits before the server lookup.
 * @param {string} raw
 * @returns {string}
 */
export function fixBarcodeDigits(raw) {
  // 1. Keep only 0–9. Empty or missing input stays empty.
  const digitsOnly = digitsOnlyFromRawBarcode(raw);
  if (!digitsOnly) return '';

  const digitCount = digitsOnly.length;

  // 2. Eleven digits → almost always a UPC-A missing its leading zero. Pad back to twelve.
  const looksLikeTruncatedUpcA = digitCount === TRUNCATED_UPC_DIGIT_COUNT;
  if (looksLikeTruncatedUpcA) {
    return padDigitsWithLeadingZerosToUpcLength(digitsOnly);
  }

  // 3. Typical grocery lengths (8–14) are already usable — pass through unchanged.
  const countIsAtLeastMinimum = digitCount >= MIN_ACCEPTED_DIGIT_COUNT;
  const countIsWithinMaximum = digitCount <= MAX_ACCEPTED_DIGIT_COUNT;
  if (countIsAtLeastMinimum && countIsWithinMaximum) {
    return digitsOnly;
  }

  // 4. Very short reads (partial scan) get the same leading-zero pad as a truncated UPC.
  const countIsBelowMinimum = digitCount < MIN_ACCEPTED_DIGIT_COUNT;
  if (countIsBelowMinimum) {
    return padDigitsWithLeadingZerosToUpcLength(digitsOnly);
  }

  // 5. Oversized scans (bad OCR) — keep only the first fourteen digits.
  return digitsOnly.slice(0, MAX_ACCEPTED_DIGIT_COUNT);
}
