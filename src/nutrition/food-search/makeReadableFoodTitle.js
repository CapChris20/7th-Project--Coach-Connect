/**
 * Canonical food display names — one pipeline for search, confirm, log, and read-back.
 */
const {
  stripRetailerSuffix,
  stripTrademarkSymbols,
  normalizeBrandLabel,
  resolveFoodBrandLabel,
} = require('../food-details/cleanFoodBrandName');
const {
  stripLegacyFoodTitleDecorations,
  isJunkFoodTitle,
  formatUserQueryAsFoodName,
} = require('./cleanFoodCardLabels');

const POSSESSIVE_WORD_RE = /^[a-z]+'s$/i;
const KNOWN_UPPERCASE_BRANDS = new Set(['in-n-out', 'bbq', 'rxbar']);

function collapseWhitespace(s) {
  return String(s || '')
    .normalize('NFKC')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Real Chocolate Chip Cookies, Real Chocolate Chip" → "Real Chocolate Chip Cookies" */
function collapseRepeatedNameSegments(name) {
  const parts = String(name || '')
    .split(/\s*,\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return name;

  const kept = [];
  for (const part of parts) {
    const overlapIdx = kept.findIndex((prev) => {
      const prevL = prev.toLowerCase();
      const partL = part.toLowerCase();
      return prevL.startsWith(partL) || partL.startsWith(prevL);
    });
    if (overlapIdx >= 0) {
      if (part.length > kept[overlapIdx].length) kept[overlapIdx] = part;
      continue;
    }
    kept.push(part);
  }
  return kept.length ? kept.join(', ') : name;
}

function isMostlyUppercase(s) {
  const letters = String(s || '').replace(/[^A-Za-z]/g, '');
  if (letters.length < 4) return false;
  const upper = letters.replace(/[^A-Z]/g, '').length;
  return upper / letters.length >= 0.65;
}

function titleCasePossessive(word) {
  return String(word || '').toLowerCase().replace(/(^|[\s-])\w/g, (m) => m.toUpperCase());
}

function titleCaseToken(word, { forceFull = false } = {}) {
  const raw = String(word || '');
  if (!raw) return raw;
  const lower = raw.toLowerCase();

  if (KNOWN_UPPERCASE_BRANDS.has(lower)) {
    return lower === 'in-n-out' ? 'IN-N-OUT' : raw.toUpperCase();
  }
  if (POSSESSIVE_WORD_RE.test(raw) || POSSESSIVE_WORD_RE.test(lower)) {
    return titleCasePossessive(raw);
  }
  if (!forceFull && /^[A-Z0-9&'-]{1,5}$/.test(raw)) return raw;
  if (lower === 'inn' || lower === 'bbq' || lower === 'ii') {
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  }
  if (raw.includes('-')) {
    const whole = raw.toLowerCase();
    if (KNOWN_UPPERCASE_BRANDS.has(whole)) {
      return whole === 'in-n-out' ? 'IN-N-OUT' : raw.toUpperCase();
    }
    return raw
      .split('-')
      .map((seg) => titleCaseToken(seg, { forceFull }))
      .join('-');
  }
  if (raw.includes("'")) {
    return raw
      .split("'")
      .map((seg, i) => (i === 0 ? titleCaseToken(seg, { forceFull }) : seg.toLowerCase()))
      .join("'");
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function smartTitleCase(name) {
  const s = collapseWhitespace(name);
  if (!s) return s;
  const forceFull = isMostlyUppercase(s);
  return s
    .split(/\s+/)
    .map((w) => titleCaseToken(w, { forceFull }))
    .join(' ');
}

/** Shorten USDA FDC descriptions for cards while keeping the food type. */
function shortenUsdaDescription(name) {
  let s = collapseWhitespace(name);
  if (!s) return s;

  const parts = s.split(/\s*,\s*/).filter(Boolean);
  if (parts.length >= 2) {
    const head = parts[0];
    const tail = parts
      .slice(1)
      .filter((p) => !/^(broiler or fryers?|fryers?|raw|fresh|frozen)$/i.test(p.trim()))
      .slice(0, 2);
    s = [head, ...tail].join(', ');
  }

  if (s.length > 72) {
    const cut = s.slice(0, 69).replace(/\s+\S*$/, '');
    s = cut || s.slice(0, 69);
  }
  return smartTitleCase(s);
}

function stripBrandPrefixFromTitle(title, brand) {
  const b = stripTrademarkSymbols(String(brand || '').trim());
  const t = stripTrademarkSymbols(String(title || '').trim());
  if (!b || !t) return t;

  const bl = b.toLowerCase();
  const tl = t.toLowerCase();
  if (tl === bl) return t;
  if (tl.startsWith(`${bl} `)) return t.slice(b.length).trim();
  if (tl.startsWith(`${bl},`)) return t.slice(b.length + 1).trim();
  if (tl.startsWith(`${bl}-`)) return t.slice(b.length + 1).trim();
  if (tl.startsWith(`${bl}'s `)) return t.slice(b.length + 3).trim();
  return t;
}

function stripCalorieSuffixes(name) {
  return String(name || '')
    .replace(/:\s*calories.*$/i, '')
    .replace(/\s*[•·]\s*\d+\s+slice.*$/i, '')
    .replace(/\s*[-–]\s*nutrition.*$/i, '')
    .trim();
}

/**
 * @param {object} opts
 * @param {string} opts.name
 * @param {string} [opts.brand]
 * @param {string} [opts.source]
 * @param {string} [opts.userQuery] — search query fallback when raw name is junk
 * @returns {{ name: string, brand: string }}
 */
function makeReadableFoodTitle({
  name,
  brand = '',
  source = '',
  userQuery = '',
} = {}) {
  const src = String(source || '').toLowerCase();
  const explicitBrand = normalizeBrandLabel(brand);

  let raw = collapseWhitespace(name);
  raw = stripCalorieSuffixes(stripLegacyFoodTitleDecorations(stripRetailerSuffix(raw)));
  raw = stripTrademarkSymbols(raw);
  raw = collapseRepeatedNameSegments(raw);

  if (isJunkFoodTitle(raw)) {
    const fb = formatUserQueryAsFoodName(userQuery || brand || raw);
    raw = fb && !isJunkFoodTitle(fb) ? fb : formatUserQueryAsFoodName(userQuery) || 'Food';
  }

  // Only strip brand from title when caller supplied a brand field (barcode / packaged).
  if (explicitBrand) {
    raw = stripBrandPrefixFromTitle(raw, explicitBrand);
  }

  if (src === 'usda' || src === 'usdafdc') {
    raw = shortenUsdaDescription(raw);
  } else {
    raw = smartTitleCase(raw);
  }

  raw = collapseWhitespace(raw);
  if (!raw) {
    raw = formatUserQueryAsFoodName(userQuery) || 'Food';
  }

  const resolvedBrand = explicitBrand || resolveFoodBrandLabel(raw, '');

  return {
    name: raw,
    brand: normalizeBrandLabel(resolvedBrand),
  };
}

/** Normalize a full food/log object before Firestore write or history cache. */
function normalizeFoodRecordForStorage(food, userQuery = '') {
  if (!food || typeof food !== 'object') return food;
  const { name, brand } = makeReadableFoodTitle({
    name: food.name || food.food_name,
    brand: food.brand || food.brand_name,
    source: food.source || food.metadata?.source,
    userQuery,
  });
  return {
    ...food,
    name,
    food_name: name,
    brand,
    brand_name: brand,
  };
}

module.exports = {
  makeReadableFoodTitle,
  normalizeFoodRecordForStorage,
  collapseRepeatedNameSegments,
  smartTitleCase,
  shortenUsdaDescription,
  collapseWhitespace,
};
