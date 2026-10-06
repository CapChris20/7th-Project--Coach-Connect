// One display name for a food, used by search, confirm, the daily log, and read-back.
// Flow: clean junk suffixes → drop a repeated brand → title-case, or shorten USDA descriptions.
// Used by: food search and the log writer. CommonJS on purpose so the food tests can require() it.

const {
  stripRetailerSuffix,
  stripTrademarkSymbols,
  normalizeBrandLabel,
  resolveFoodBrandLabel,
} = require('../food-details/tidyBrandName');
const {
  stripLegacyFoodTitleDecorations,
  isJunkFoodTitle,
  formatUserQueryAsFoodName,
} = require('./tidyFoodTitles');

// ===== NAMED CONSTANTS =====

const POSSESSIVE_WORD_RE = /^[a-z]+'s$/i;
const KNOWN_UPPERCASE_BRANDS = new Set(['in-n-out', 'bbq', 'rxbar']);
const MOSTLY_UPPERCASE_RATIO = 0.65;
const MIN_LETTERS_FOR_UPPERCASE_CHECK = 4;
const USDA_DESCRIPTION_MAX_LENGTH = 72;
const USDA_DESCRIPTION_CUT_LENGTH = 69;
const USDA_TAIL_PART_LIMIT = 2;
const FALLBACK_FOOD_NAME = 'Food';
const USDA_SOURCES = new Set(['usda', 'usdafdc']);

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} text
 * @returns {string}
 */
function collapseWhitespace(text) {
  return String(text || '')
    .normalize('NFKC')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A comma piece that is the same food as one we already kept, or a shorter version of it.
 * @param {string} keptPart
 * @param {string} nextPart
 * @returns {boolean}
 */
function partsOverlap(keptPart, nextPart) {
  const keptLower = keptPart.toLowerCase();
  const nextLower = nextPart.toLowerCase();
  return keptLower.startsWith(nextLower) || nextLower.startsWith(keptLower);
}

/** "Real Chocolate Chip Cookies, Real Chocolate Chip" → "Real Chocolate Chip Cookies" */
function collapseRepeatedNameSegments(name) {
  const parts = String(name || '')
    .split(/\s*,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return name;

  const kept = [];
  for (const part of parts) {
    const overlapIndex = kept.findIndex((previousPart) => partsOverlap(previousPart, part));
    if (overlapIndex < 0) {
      kept.push(part);
      continue;
    }
    if (part.length > kept[overlapIndex].length) kept[overlapIndex] = part;
  }
  return kept.length ? kept.join(', ') : name;
}

/**
 * USDA descriptions arrive in ALL CAPS. Those get a full title-case, not a light touch.
 * @param {string} text
 * @returns {boolean}
 */
function isMostlyUppercase(text) {
  const letters = String(text || '').replace(/[^A-Za-z]/g, '');
  if (letters.length < MIN_LETTERS_FOR_UPPERCASE_CHECK) return false;
  const uppercaseCount = letters.replace(/[^A-Z]/g, '').length;
  return uppercaseCount / letters.length >= MOSTLY_UPPERCASE_RATIO;
}

/**
 * @param {string} word
 * @returns {string}
 */
function titleCasePossessive(word) {
  return String(word || '').toLowerCase().replace(/(^|[\s-])\w/g, (match) => match.toUpperCase());
}

/**
 * Brands that stay loud even inside a title-cased name.
 * @param {string} lowerWord
 * @param {string} rawWord
 * @returns {string|null}
 */
function knownUppercaseBrand(lowerWord, rawWord) {
  if (!KNOWN_UPPERCASE_BRANDS.has(lowerWord)) return null;
  if (lowerWord === 'in-n-out') return 'IN-N-OUT';
  return rawWord.toUpperCase();
}

/**
 * @param {string} word
 * @param {{ forceFull?: boolean }} options
 * @returns {string}
 */
function titleCaseToken(word, { forceFull = false } = {}) {
  const rawWord = String(word || '');
  if (!rawWord) return rawWord;
  const lowerWord = rawWord.toLowerCase();

  const loudBrand = knownUppercaseBrand(lowerWord, rawWord);
  if (loudBrand) return loudBrand;
  if (POSSESSIVE_WORD_RE.test(rawWord) || POSSESSIVE_WORD_RE.test(lowerWord)) {
    return titleCasePossessive(rawWord);
  }
  if (!forceFull && /^[A-Z0-9&'-]{1,5}$/.test(rawWord)) return rawWord;
  if (lowerWord === 'inn' || lowerWord === 'bbq' || lowerWord === 'ii') {
    return rawWord.charAt(0).toUpperCase() + rawWord.slice(1).toLowerCase();
  }
  if (rawWord.includes('-')) {
    const loudHyphenBrand = knownUppercaseBrand(rawWord.toLowerCase(), rawWord);
    if (loudHyphenBrand) return loudHyphenBrand;
    return rawWord
      .split('-')
      .map((segment) => titleCaseToken(segment, { forceFull }))
      .join('-');
  }
  if (rawWord.includes("'")) {
    return rawWord
      .split("'")
      .map((segment, index) => (index === 0 ? titleCaseToken(segment, { forceFull }) : segment.toLowerCase()))
      .join("'");
  }
  return rawWord.charAt(0).toUpperCase() + rawWord.slice(1).toLowerCase();
}

function smartTitleCase(name) {
  const collapsed = collapseWhitespace(name);
  if (!collapsed) return collapsed;
  const forceFull = isMostlyUppercase(collapsed);
  return collapsed
    .split(/\s+/)
    .map((word) => titleCaseToken(word, { forceFull }))
    .join(' ');
}

/**
 * USDA cuts like "broiler or fryers" are not the food the card should lead with.
 * @param {string} part
 * @returns {boolean}
 */
function isUsdaFillerPart(part) {
  return /^(broiler or fryers?|fryers?|raw|fresh|frozen)$/i.test(part.trim());
}

/** Shorten USDA FDC descriptions for cards while keeping the food type. */
function shortenUsdaDescription(name) {
  let description = collapseWhitespace(name);
  if (!description) return description;

  const parts = description.split(/\s*,\s*/).filter(Boolean);
  if (parts.length >= 2) {
    const head = parts[0];
    const tail = parts.slice(1).filter((part) => !isUsdaFillerPart(part)).slice(0, USDA_TAIL_PART_LIMIT);
    description = [head, ...tail].join(', ');
  }

  if (description.length > USDA_DESCRIPTION_MAX_LENGTH) {
    const cutAtWord = description.slice(0, USDA_DESCRIPTION_CUT_LENGTH).replace(/\s+\S*$/, '');
    description = cutAtWord || description.slice(0, USDA_DESCRIPTION_CUT_LENGTH);
  }
  return smartTitleCase(description);
}

/**
 * "KIND Dark Chocolate" with brand KIND → "Dark Chocolate".
 * @param {string} title
 * @param {string} brand
 * @returns {string}
 */
function stripBrandPrefixFromTitle(title, brand) {
  const brandText = stripTrademarkSymbols(String(brand || '').trim());
  const titleText = stripTrademarkSymbols(String(title || '').trim());
  if (!brandText || !titleText) return titleText;

  const brandLower = brandText.toLowerCase();
  const titleLower = titleText.toLowerCase();
  if (titleLower === brandLower) return titleText;
  if (titleLower.startsWith(`${brandLower} `)) return titleText.slice(brandText.length).trim();
  if (titleLower.startsWith(`${brandLower},`)) return titleText.slice(brandText.length + 1).trim();
  if (titleLower.startsWith(`${brandLower}-`)) return titleText.slice(brandText.length + 1).trim();
  if (titleLower.startsWith(`${brandLower}'s `)) return titleText.slice(brandText.length + 3).trim();
  return titleText;
}

function stripCalorieSuffixes(name) {
  return String(name || '')
    .replace(/:\s*calories.*$/i, '')
    .replace(/\s*[•·]\s*\d+\s+slice.*$/i, '')
    .replace(/\s*[-–]\s*nutrition.*$/i, '')
    .trim();
}

/**
 * Search pages sometimes have no real food name. Fall back to what the user typed.
 * @param {string} userQuery
 * @param {string} brand
 * @param {string} rawName
 * @returns {string}
 */
function replacementForJunkTitle(userQuery, brand, rawName) {
  const fromQueryOrBrand = formatUserQueryAsFoodName(userQuery || brand || rawName);
  if (fromQueryOrBrand && !isJunkFoodTitle(fromQueryOrBrand)) return fromQueryOrBrand;
  return formatUserQueryAsFoodName(userQuery) || FALLBACK_FOOD_NAME;
}

// ===== MAIN FUNCTION =====

/**
 * @param {object} options
 * @param {string} options.name
 * @param {string} [options.brand]
 * @param {string} [options.source]
 * @param {string} [options.userQuery]
 * @returns {{ name: string, brand: string }}
 */
function readableFoodTitle({
  name,
  brand = '',
  source = '',
  userQuery = '',
} = {}) {
  const sourceName = String(source || '').toLowerCase();
  const explicitBrand = normalizeBrandLabel(brand);

  let rawName = collapseWhitespace(name);
  rawName = stripCalorieSuffixes(stripLegacyFoodTitleDecorations(stripRetailerSuffix(rawName)));
  rawName = stripTrademarkSymbols(rawName);
  rawName = collapseRepeatedNameSegments(rawName);

  if (isJunkFoodTitle(rawName)) {
    rawName = replacementForJunkTitle(userQuery, brand, rawName);
  }

  // Only strip the brand from the title when the caller already has a brand field (barcode / packaged).
  if (explicitBrand) {
    rawName = stripBrandPrefixFromTitle(rawName, explicitBrand);
  }

  if (USDA_SOURCES.has(sourceName)) {
    rawName = shortenUsdaDescription(rawName);
  } else {
    rawName = smartTitleCase(rawName);
  }

  rawName = collapseWhitespace(rawName);
  if (!rawName) {
    rawName = formatUserQueryAsFoodName(userQuery) || FALLBACK_FOOD_NAME;
  }

  const resolvedBrand = explicitBrand || resolveFoodBrandLabel(rawName, '');
  return {
    name: rawName,
    brand: normalizeBrandLabel(resolvedBrand),
  };
}

/**
 * Normalize a full food/log object before a Firestore write or the history cache.
 * @param {object} food
 * @param {string} userQuery
 * @returns {object}
 */
function normalizeFoodRecordForStorage(food, userQuery = '') {
  if (!food || typeof food !== 'object') return food;
  const { name, brand } = readableFoodTitle({
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
  readableFoodTitle,
  normalizeFoodRecordForStorage,
  collapseRepeatedNameSegments,
  smartTitleCase,
  shortenUsdaDescription,
  collapseWhitespace,
};
