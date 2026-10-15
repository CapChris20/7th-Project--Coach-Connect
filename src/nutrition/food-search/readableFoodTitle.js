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
const IN_N_OUT_DISPLAY = 'IN-N-OUT';

// ===== HELPER FUNCTIONS =====

/**
 * Collapse odd unicode spaces into a single normal space.
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

/**
 * Keep the longer of two overlapping comma segments.
 * @param {string[]} keptParts
 * @param {string} nextPart
 * @returns {void}
 */
function mergeOrPushPart(keptParts, nextPart) {
  const overlapIndex = keptParts.findIndex((previousPart) => partsOverlap(previousPart, nextPart));
  if (overlapIndex < 0) {
    keptParts.push(nextPart);
    return;
  }
  if (nextPart.length > keptParts[overlapIndex].length) {
    keptParts[overlapIndex] = nextPart;
  }
}

/** "Real Chocolate Chip Cookies, Real Chocolate Chip" → "Real Chocolate Chip Cookies" */
function collapseRepeatedNameSegments(name) {
  const parts = String(name || '')
    .split(/\s*,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return name;

  const keptParts = [];
  for (const part of parts) {
    mergeOrPushPart(keptParts, part);
  }
  return keptParts.length ? keptParts.join(', ') : name;
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
  return String(word || '')
    .toLowerCase()
    .replace(/(^|[\s-])\w/g, (match) => match.toUpperCase());
}

/**
 * Brands that stay loud even inside a title-cased name.
 * @param {string} lowerWord
 * @param {string} rawWord
 * @returns {string|null}
 */
function knownUppercaseBrand(lowerWord, rawWord) {
  if (!KNOWN_UPPERCASE_BRANDS.has(lowerWord)) return null;
  if (lowerWord === 'in-n-out') return IN_N_OUT_DISPLAY;
  return rawWord.toUpperCase();
}

/**
 * Short words that still need first-letter capital (inn / bbq / ii).
 * @param {string} lowerWord
 * @param {string} rawWord
 * @returns {string|null}
 */
function specialShortTitleWord(lowerWord, rawWord) {
  if (lowerWord === 'inn' || lowerWord === 'bbq' || lowerWord === 'ii') {
    return rawWord.charAt(0).toUpperCase() + rawWord.slice(1).toLowerCase();
  }
  return null;
}

/**
 * Title-case one token, preserving short ALL-CAPS brands when not forcing full case.
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

  const special = specialShortTitleWord(lowerWord, rawWord);
  if (special) return special;

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

/**
 * Title-case a full food name (force full when the source was ALL CAPS).
 * @param {string} name
 * @returns {string}
 */
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

/**
 * Cut a long USDA description at a word boundary near the limit.
 * @param {string} description
 * @returns {string}
 */
function truncateUsdaDescription(description) {
  if (description.length <= USDA_DESCRIPTION_MAX_LENGTH) return description;
  const cutAtWord = description.slice(0, USDA_DESCRIPTION_CUT_LENGTH).replace(/\s+\S*$/, '');
  return cutAtWord || description.slice(0, USDA_DESCRIPTION_CUT_LENGTH);
}

/** Shorten USDA FDC descriptions for cards while keeping the food type. */
function shortenUsdaDescription(name) {
  let description = collapseWhitespace(name);
  if (!description) return description;

  const parts = description.split(/\s*,\s*/).filter(Boolean);
  if (parts.length >= 2) {
    const head = parts[0];
    const tail = parts
      .slice(1)
      .filter((part) => !isUsdaFillerPart(part))
      .slice(0, USDA_TAIL_PART_LIMIT);
    description = [head, ...tail].join(', ');
  }

  description = truncateUsdaDescription(description);
  return smartTitleCase(description);
}

/**
 * Strip brand when the title starts with that brand (space, comma, hyphen, or 's).
 * @param {string} titleText
 * @param {string} brandText
 * @returns {string|null} stripped title, or null if no prefix matched
 */
function stripMatchingBrandPrefix(titleText, brandText) {
  const brandLower = brandText.toLowerCase();
  const titleLower = titleText.toLowerCase();
  if (titleLower === brandLower) return titleText;
  if (titleLower.startsWith(`${brandLower} `)) return titleText.slice(brandText.length).trim();
  if (titleLower.startsWith(`${brandLower},`)) return titleText.slice(brandText.length + 1).trim();
  if (titleLower.startsWith(`${brandLower}-`)) return titleText.slice(brandText.length + 1).trim();
  if (titleLower.startsWith(`${brandLower}'s `)) return titleText.slice(brandText.length + 3).trim();
  return null;
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
  const stripped = stripMatchingBrandPrefix(titleText, brandText);
  return stripped == null ? titleText : stripped;
}

/**
 * Drop calorie / nutrition tails glued onto scraped titles.
 * @param {string} name
 * @returns {string}
 */
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

/**
 * Strip retailer / trademark / calorie junk before title-casing.
 * @param {string} name
 * @returns {string}
 */
function cleanRawFoodName(name) {
  let rawName = collapseWhitespace(name);
  rawName = stripCalorieSuffixes(stripLegacyFoodTitleDecorations(stripRetailerSuffix(rawName)));
  rawName = stripTrademarkSymbols(rawName);
  return collapseRepeatedNameSegments(rawName);
}

/**
 * Apply USDA shortening or smart title-case based on source.
 * @param {string} rawName
 * @param {string} sourceName
 * @returns {string}
 */
function formatNameForSource(rawName, sourceName) {
  if (USDA_SOURCES.has(sourceName)) return shortenUsdaDescription(rawName);
  return smartTitleCase(rawName);
}

// ===== MAIN FUNCTION =====

/**
 * One clean display name + brand for a food card or log row.
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

  // 1. Strip retailer / trademark / calorie junk.
  let rawName = cleanRawFoodName(name);

  // 2. Replace junk titles with what the user typed.
  if (isJunkFoodTitle(rawName)) {
    rawName = replacementForJunkTitle(userQuery, brand, rawName);
  }

  // 3. Only strip the brand from the title when the caller already has a brand field.
  if (explicitBrand) {
    rawName = stripBrandPrefixFromTitle(rawName, explicitBrand);
  }

  // 4. Title-case (or shorten USDA descriptions).
  rawName = formatNameForSource(rawName, sourceName);
  rawName = collapseWhitespace(rawName);
  if (!rawName) {
    rawName = formatUserQueryAsFoodName(userQuery) || FALLBACK_FOOD_NAME;
  }

  // 5. Resolve brand if the caller did not pass one.
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
