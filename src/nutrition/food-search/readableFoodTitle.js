// One display name for a food, used by search, confirm, the daily log, and read-back.
// Flow: clean junk suffixes → drop a repeated brand → title-case, or shorten USDA descriptions.
// Used by food search and the log writer. CommonJS so food tests can require() it.
// Read order: constants → small helpers → mains → PLUMBING title-case / USDA / brand strip.

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
const SHORT_ALL_CAPS_TOKEN_RE = /^[A-Z0-9&'-]{1,5}$/;
const SPECIAL_SHORT_TITLE_WORDS = new Set(['inn', 'bbq', 'ii']);

// ===== HELPER FUNCTIONS =====

/**
 * Collapse odd unicode spaces into a single normal space.
 * @param {string} text
 * @returns {string}
 */
function collapseWhitespace(text) {
  // vocab: NFKC = unicode normalize so fancy spaces / lookalikes become plain ASCII-ish
  const normalizedText = String(text || '').normalize('NFKC');
  const withoutNbsp = normalizedText.replace(/\u00A0/g, ' ');
  const singleSpaced = withoutNbsp.replace(/\s+/g, ' ');
  return singleSpaced.trim();
}

/**
 * A comma piece that is the same food as one we already kept, or a shorter version of it.
 * @param {string} keptPart
 * @param {string} nextPart
 * @returns {boolean}
 */
function commaPartsOverlap(keptPart, nextPart) {
  const keptLower = keptPart.toLowerCase();
  const nextLower = nextPart.toLowerCase();
  return keptLower.startsWith(nextLower) || nextLower.startsWith(keptLower);
}

/**
 * Keep the longer of two overlapping comma segments; otherwise append.
 * @param {string[]} keptParts
 * @param {string} nextPart
 * @returns {void}
 */
function mergeOrPushCommaPart(keptParts, nextPart) {
  const overlapIndex = keptParts.findIndex((previousPart) =>
    commaPartsOverlap(previousPart, nextPart),
  );
  if (overlapIndex < 0) {
    keptParts.push(nextPart);
    return;
  }
  if (nextPart.length > keptParts[overlapIndex].length) {
    keptParts[overlapIndex] = nextPart;
  }
}

/**
 * Drop calorie / nutrition tails glued onto scraped titles.
 * @param {string} foodName
 * @returns {string}
 */
function stripCalorieSuffixes(foodName) {
  let cleanedName = String(foodName || '');
  cleanedName = cleanedName.replace(/:\s*calories.*$/i, '');
  cleanedName = cleanedName.replace(/\s*[•·]\s*\d+\s+slice.*$/i, '');
  cleanedName = cleanedName.replace(/\s*[-–]\s*nutrition.*$/i, '');
  return cleanedName.trim();
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
  if (fromQueryOrBrand && !isJunkFoodTitle(fromQueryOrBrand)) {
    return fromQueryOrBrand;
  }
  return formatUserQueryAsFoodName(userQuery) || FALLBACK_FOOD_NAME;
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
  if (titleLower.startsWith(`${brandLower} `)) {
    return titleText.slice(brandText.length).trim();
  }
  if (titleLower.startsWith(`${brandLower},`)) {
    return titleText.slice(brandText.length + 1).trim();
  }
  if (titleLower.startsWith(`${brandLower}-`)) {
    return titleText.slice(brandText.length + 1).trim();
  }
  if (titleLower.startsWith(`${brandLower}'s `)) {
    return titleText.slice(brandText.length + 3).trim();
  }
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
  const strippedTitle = stripMatchingBrandPrefix(titleText, brandText);
  if (strippedTitle == null) return titleText;
  return strippedTitle;
}

/**
 * Strip retailer / trademark / calorie junk before title-casing.
 * @param {string} foodName
 * @returns {string}
 */
function cleanRawFoodName(foodName) {
  let cleanedName = collapseWhitespace(foodName);
  cleanedName = stripCalorieSuffixes(
    stripLegacyFoodTitleDecorations(stripRetailerSuffix(cleanedName)),
  );
  cleanedName = stripTrademarkSymbols(cleanedName);
  return collapseRepeatedNameSegments(cleanedName);
}

/**
 * Apply USDA shortening or smart title-case based on source.
 * @param {string} rawName
 * @param {string} sourceName
 * @returns {string}
 */
function formatNameForSource(rawName, sourceName) {
  if (USDA_SOURCES.has(sourceName)) {
    return shortenUsdaDescription(rawName);
  }
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

  // 1. Strip retailer / trademark / calorie junk from the scraped title.
  let displayName = cleanRawFoodName(name);

  // 2. Junk titles get replaced with what the user typed (or a safe fallback).
  if (isJunkFoodTitle(displayName)) {
    displayName = replacementForJunkTitle(userQuery, brand, displayName);
  }

  // 3. When the caller already sent a brand field, do not repeat it at the start of the name.
  if (explicitBrand) {
    displayName = stripBrandPrefixFromTitle(displayName, explicitBrand);
  }

  // 4. Title-case for most sources; USDA FDC descriptions get shortened first.
  displayName = formatNameForSource(displayName, sourceName);
  displayName = collapseWhitespace(displayName);
  if (!displayName) {
    displayName = formatUserQueryAsFoodName(userQuery) || FALLBACK_FOOD_NAME;
  }

  // 5. Fill in brand when the row did not carry one.
  const resolvedBrand = explicitBrand || resolveFoodBrandLabel(displayName, '');
  return {
    name: displayName,
    brand: normalizeBrandLabel(resolvedBrand),
  };
}

/**
 * Normalize a full food/log object before a Firestore write or the history cache.
 * Field letters stay name / food_name / brand / brand_name.
 * @param {object} food
 * @param {string} userQuery
 * @returns {object}
 */
function normalizeFoodRecordForStorage(food, userQuery = '') {
  if (!food || typeof food !== 'object') return food;

  // 1. Run the same title pass the search UI uses.
  const { name, brand } = readableFoodTitle({
    name: food.name || food.food_name,
    brand: food.brand || food.brand_name,
    // vocab/symbol: ?. = only read .source when metadata exists
    source: food.source || food.metadata?.source,
    userQuery,
  });

  // 2. Write both legacy and modern name/brand keys so older readers still work.
  return {
    ...food,
    name,
    food_name: name,
    brand,
    brand_name: brand,
  };
}

// ===== PLUMBING — skip unless debugging =====

/** "Real Chocolate Chip Cookies, Real Chocolate Chip" → "Real Chocolate Chip Cookies" */
function collapseRepeatedNameSegments(name) {
  const parts = String(name || '')
    .split(/\s*,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return name;

  const keptParts = [];
  for (const part of parts) {
    mergeOrPushCommaPart(keptParts, part);
  }
  if (keptParts.length === 0) return name;
  return keptParts.join(', ');
}

/**
 * USDA descriptions arrive in ALL CAPS. Those get a full title-case, not a light touch.
 * @param {string} text
 * @returns {boolean}
 */
function isMostlyUppercase(text) {
  const lettersOnly = String(text || '').replace(/[^A-Za-z]/g, '');
  if (lettersOnly.length < MIN_LETTERS_FOR_UPPERCASE_CHECK) return false;
  const uppercaseCount = lettersOnly.replace(/[^A-Z]/g, '').length;
  return uppercaseCount / lettersOnly.length >= MOSTLY_UPPERCASE_RATIO;
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
  if (!SPECIAL_SHORT_TITLE_WORDS.has(lowerWord)) return null;
  return rawWord.charAt(0).toUpperCase() + rawWord.slice(1).toLowerCase();
}

/**
 * Title-case one hyphenated token by casing each segment.
 * @param {string} rawWord
 * @param {boolean} forceFull
 * @returns {string}
 */
function titleCaseHyphenatedWord(rawWord, forceFull) {
  const loudHyphenBrand = knownUppercaseBrand(rawWord.toLowerCase(), rawWord);
  if (loudHyphenBrand) return loudHyphenBrand;
  const segments = rawWord.split('-');
  const casedSegments = [];
  for (const segment of segments) {
    casedSegments.push(titleCaseToken(segment, { forceFull }));
  }
  return casedSegments.join('-');
}

/**
 * Title-case a possessive token: McDonald's → keep 's lower after the first piece.
 * @param {string} rawWord
 * @param {boolean} forceFull
 * @returns {string}
 */
function titleCaseApostropheWord(rawWord, forceFull) {
  const segments = rawWord.split("'");
  const casedSegments = [];
  for (let index = 0; index < segments.length; index += 1) {
    if (index === 0) {
      casedSegments.push(titleCaseToken(segments[index], { forceFull }));
    } else {
      casedSegments.push(segments[index].toLowerCase());
    }
  }
  return casedSegments.join("'");
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

  // Keep short shouty tokens (BBQ, RX, II) unless USDA forced a full re-case.
  if (!forceFull && SHORT_ALL_CAPS_TOKEN_RE.test(rawWord)) return rawWord;

  const special = specialShortTitleWord(lowerWord, rawWord);
  if (special) return special;

  if (rawWord.includes('-')) {
    return titleCaseHyphenatedWord(rawWord, forceFull);
  }

  if (rawWord.includes("'")) {
    return titleCaseApostropheWord(rawWord, forceFull);
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
  const words = collapsed.split(/\s+/);
  const casedWords = [];
  for (const word of words) {
    casedWords.push(titleCaseToken(word, { forceFull }));
  }
  return casedWords.join(' ');
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
  if (cutAtWord) return cutAtWord;
  return description.slice(0, USDA_DESCRIPTION_CUT_LENGTH);
}

/**
 * Keep the head comma part plus a short useful tail (drop broiler/raw filler).
 * @param {string[]} parts
 * @returns {string}
 */
function joinUsdaHeadAndUsefulTail(parts) {
  if (parts.length < 2) return parts.join(', ');
  const head = parts[0];
  const usefulTail = [];
  for (let index = 1; index < parts.length; index += 1) {
    if (isUsdaFillerPart(parts[index])) continue;
    usefulTail.push(parts[index]);
    if (usefulTail.length >= USDA_TAIL_PART_LIMIT) break;
  }
  return [head, ...usefulTail].join(', ');
}

/** Shorten USDA FDC descriptions for cards while keeping the food type. */
function shortenUsdaDescription(name) {
  let description = collapseWhitespace(name);
  if (!description) return description;

  const parts = description.split(/\s*,\s*/).filter(Boolean);
  description = joinUsdaHeadAndUsefulTail(parts);
  description = truncateUsdaDescription(description);
  return smartTitleCase(description);
}

module.exports = {
  readableFoodTitle,
  normalizeFoodRecordForStorage,
  collapseRepeatedNameSegments,
  smartTitleCase,
  shortenUsdaDescription,
  collapseWhitespace,
};
