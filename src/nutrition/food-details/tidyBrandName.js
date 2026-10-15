// Turns messy retailer / USDA / Open Food Facts brand strings into a short consumer-facing label.
// Flow: strip trademarks and store suffixes → drop parent-company prefixes → infer from the food title.
// Used by: food detail cards and barcode lookup. Matching rules must stay identical — tests cover them.

// ===== NAMED CONSTANTS =====

const SOURCE_LABEL_RE =
  /^(via\s+)?(google|serper|duckduckgo|web)\s*search$/i;

const RETAILER_SUFFIX_RE =
  /\s[-–|]\s*(Kroger|Walmart|Target|QFC|Safeway|Albertsons|HEB|ShopRite|Mariano'?s|Smith'?s|Harris Teeter|Instacart|Amazon(?: Fresh)?|Costco|Sam'?s Club)\b.*$/i;

const MANUFACTURER_PARENT_RE =
  /^(General Mills|Kellogg(?:'?s)?|PepsiCo|Nestl[eé]|Unilever|Mondelez|Kraft Heinz|Conagra|Post Consumer Brands|Mars,? Incorporated|The Coca-Cola Company|Campbell(?:'?s)?)\b/i;

const PACKAGE_SIZE_SUFFIX_RE = /\s[-–]\s*\d+(?:\.\d+)?\s*(?:oz|lb|g|ml)\b.*$/i;
const VIA_PREFIX_RE = /^via\s+/i;
const CORPORATE_SUFFIX_RE = /\b(inc|llc|ltd|corp|co)\.?$/i;
const POSSESSIVE_BRAND_RE = /^([A-Za-z][A-Za-z0-9&\s.'-]*?'s)\b/;
const ALL_CAPS_SHORT_MAX = 6;
const KEEP_ALL_CAPS_WORD_MAX = 3;
const TITLE_TWO_CAPITAL_WORDS_MIN = 2;
const FIRST_WORD_MIN_LETTERS = 2;

/** Consumer-facing brands that should win over parent-company prefixes in titles. */
const KNOWN_CONSUMER_BRANDS = [
  'Ghost',
  'Optimum Nutrition',
  'Dymatize',
  'Quest',
  'Kind',
  'Clif',
  'RXBAR',
  'Premier Protein',
  'Fairlife',
  'Muscle Milk',
  'Orgain',
  'Alani Nu',
  'C4',
  'BSN',
  'Cellucor',
  'Lenny & Larry',
  'Built Bar',
  'One Bar',
  'Pure Protein',
  'Cinnamon Toast Crunch',
  'Cheerios',
  'Lucky Charms',
  'Frosted Flakes',
  'Nature Valley',
  'Fiber One',
];

const RESTAURANT_TWO_WORD =
  /^(Taco Bell|Burger King|Pizza Hut|Dairy Queen|Jack in the Box|In-N-Out|Carl's Jr|Hardee's|Tim Hortons|Popeyes|Chick-fil-A|Raising Cane's|Five Guys|Shake Shack|Red Robin|Olive Garden|Buffalo Wild Wings|Cottage Inn)\b/i;

// ===== HELPER FUNCTIONS =====

/**
 * Escape a brand so it can sit inside a RegExp without treating C4's digits as syntax.
 * @param {string} text
 * @returns {string}
 */
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} text
 * @returns {string}
 */
function stripTrademarkSymbols(text) {
  return String(text || '').replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * True when a brand string is really a search-provider label, not a food brand.
 * @param {string} brand
 * @returns {boolean}
 */
function isSearchSourceLabel(brand) {
  const brandText = String(brand || '').trim();
  if (!brandText) return false;
  if (SOURCE_LABEL_RE.test(brandText)) return true;
  if (VIA_PREFIX_RE.test(brandText)) return true;
  return false;
}

/**
 * Remove store names and trailing junk from retailer search titles.
 * @param {string} title
 * @returns {string}
 */
function stripRetailerSuffix(title) {
  let cleanedTitle = String(title || '').trim();
  if (!cleanedTitle) return cleanedTitle;
  cleanedTitle = cleanedTitle.split('|')[0].split(' · ')[0].trim();
  cleanedTitle = cleanedTitle.replace(RETAILER_SUFFIX_RE, '').trim();
  cleanedTitle = cleanedTitle.replace(PACKAGE_SIZE_SUFFIX_RE, '').trim();
  return cleanedTitle;
}

/**
 * Title-case a brand, but keep short ALL-CAPS tokens (ON, C4) so they do not become "On".
 * @param {string} label
 * @returns {string}
 */
function titleCaseBrand(label) {
  const rawLabel = stripTrademarkSymbols(String(label || '').trim());
  if (!rawLabel) return '';
  if (rawLabel === rawLabel.toUpperCase() && rawLabel.length <= ALL_CAPS_SHORT_MAX) {
    return rawLabel.charAt(0) + rawLabel.slice(1).toLowerCase();
  }
  return rawLabel
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      if (word.length <= KEEP_ALL_CAPS_WORD_MAX && word === word.toUpperCase()) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Clean "GENERAL MILLS, INC." → "General Mills".
 * @param {string} brand
 * @returns {string}
 */
function normalizeBrandLabel(brand) {
  let brandText = String(brand || '').trim();
  if (!brandText || isSearchSourceLabel(brandText)) return '';

  brandText = brandText.split(',')[0].trim();
  brandText = brandText.replace(CORPORATE_SUFFIX_RE, '').trim();
  brandText = stripTrademarkSymbols(brandText);
  brandText = titleCaseBrand(brandText);
  return brandText;
}

/**
 * Pick the consumer brand from a comma list like "General Mills, Ghost, US".
 * @param {string} brands
 * @returns {string}
 */
function parseMultiBrandField(brands) {
  const rawBrands = String(brands || '').trim();
  if (!rawBrands) return '';

  const parts = rawBrands
    .split(',')
    .map((part) => normalizeBrandLabel(part))
    .filter(Boolean);

  if (!parts.length) return '';

  const consumerBrand = parts.find((part) =>
    KNOWN_CONSUMER_BRANDS.some((known) => part.toLowerCase() === known.toLowerCase()),
  );
  if (consumerBrand) return consumerBrand;

  const nonParentBrand = parts.find((part) => !MANUFACTURER_PARENT_RE.test(part));
  if (nonParentBrand) return nonParentBrand;

  return parts[0];
}

/**
 * @param {string} text
 * @returns {string}
 */
function findKnownConsumerBrand(text) {
  const haystack = stripTrademarkSymbols(String(text || ''));
  for (const known of KNOWN_CONSUMER_BRANDS) {
    const knownPattern = new RegExp(`\\b${escapeRegExp(stripTrademarkSymbols(known))}\\b`, 'i');
    if (knownPattern.test(haystack)) return titleCaseBrand(known);
  }
  return '';
}

/**
 * First word after a parent-company prefix, when it looks like a real brand token.
 * @param {string[]} words
 * @returns {string}
 */
function brandAfterParentCompanyPrefix(words) {
  if (words.length < TITLE_TWO_CAPITAL_WORDS_MIN) return '';
  if (!MANUFACTURER_PARENT_RE.test(words[0])) return '';
  const thirdWord = words[2] ? stripTrademarkSymbols(words[2]) : '';
  if (!thirdWord) return '';
  if (!/^[A-Za-z]/.test(thirdWord) || thirdWord.length <= FIRST_WORD_MIN_LETTERS) return '';
  return titleCaseBrand(thirdWord);
}

/**
 * Two leading Capitalized words, unless they are themselves a parent company.
 * @param {string[]} words
 * @returns {string}
 */
function brandFromTwoCapitalWords(words) {
  if (words.length < TITLE_TWO_CAPITAL_WORDS_MIN) return '';
  if (!/^[A-Z]/.test(words[0]) || !/^[A-Z]/.test(words[1])) return '';
  const candidate = `${words[0]} ${words[1]}`;
  if (!MANUFACTURER_PARENT_RE.test(candidate)) return titleCaseBrand(candidate);
  return titleCaseBrand(words[0]);
}

/**
 * Single leading token: ALLCAPS (GHOST) or a capitalized word longer than two letters.
 * @param {string[]} words
 * @returns {string}
 */
function brandFromFirstWord(words) {
  if (words.length < 1) return '';
  const firstWord = stripTrademarkSymbols(words[0]);
  if (/^[A-Z]{2,}$/.test(firstWord)) return titleCaseBrand(firstWord);
  if (/^[A-Z]/.test(firstWord) && firstWord.length > FIRST_WORD_MIN_LETTERS) {
    return titleCaseBrand(firstWord);
  }
  return '';
}

/**
 * Wendy's, Taco Bell, Ghost, etc. from product titles.
 * @param {string} foodName
 * @returns {string}
 */
function inferBrandFromFoodName(foodName) {
  const name = stripRetailerSuffix(foodName);
  if (!name || isSearchSourceLabel(name)) return '';

  const consumerBrand = findKnownConsumerBrand(name);
  if (consumerBrand) return consumerBrand;

  const possessive = name.match(POSSESSIVE_BRAND_RE);
  if (possessive) return titleCaseBrand(possessive[1].trim());

  const restaurantMatch = name.match(RESTAURANT_TWO_WORD);
  if (restaurantMatch) return restaurantMatch[1];

  const words = name.split(/\s+/).filter(Boolean);

  const afterParent = brandAfterParentCompanyPrefix(words);
  if (afterParent) return afterParent;

  const twoCapitals = brandFromTwoCapitalWords(words);
  if (twoCapitals) return twoCapitals;

  return brandFromFirstWord(words);
}

/**
 * When USDA lists a parent company as brandOwner, prefer a consumer brand inferred from the title.
 * Flattened to sequential returns so the parent-company check is not nested inside the usable-brand check.
 * @param {string} foodName
 * @param {string} brand
 * @returns {string}
 */
function resolveFoodBrandLabel(foodName, brand) {
  const cleanedBrand = normalizeBrandLabel(brand);
  if (!cleanedBrand || isSearchSourceLabel(cleanedBrand)) {
    return inferBrandFromFoodName(foodName);
  }
  if (!MANUFACTURER_PARENT_RE.test(cleanedBrand)) {
    return cleanedBrand;
  }
  const inferredFromTitle = inferBrandFromFoodName(foodName);
  if (inferredFromTitle && !MANUFACTURER_PARENT_RE.test(inferredFromTitle)) {
    return inferredFromTitle;
  }
  return cleanedBrand;
}

/**
 * Barcode / retailer titles — normalize brand and product name together.
 * @param {string} foodName
 * @param {string} explicitBrand
 * @returns {string}
 */
function resolveBarcodeBrand(foodName, explicitBrand) {
  return resolveFoodBrandLabel(stripRetailerSuffix(foodName), explicitBrand);
}

/**
 * @param {string} title
 * @param {string} barcode
 * @returns {string}
 */
function cleanBarcodeProductTitle(title, barcode) {
  const cleanedTitle = stripRetailerSuffix(title);
  if (!cleanedTitle) return `Product ${barcode || ''}`.trim();
  return cleanedTitle;
}

/**
 * Hide subtitle when it repeats the start of the food name (e.g. Wendy's under Wendy's Frosty).
 * @param {string} foodName
 * @param {string} brand
 * @returns {boolean}
 */
function shouldShowFoodBrandSubtitle(foodName, brand) {
  const brandText = String(brand || '').trim();
  if (!brandText) return false;
  const nameText = stripTrademarkSymbols(String(foodName || '').trim()).toLowerCase();
  if (!nameText) return true;
  const brandLower = stripTrademarkSymbols(brandText).toLowerCase();
  if (nameText === brandLower) return false;
  if (nameText.startsWith(`${brandLower} `) || nameText.startsWith(`${brandLower}'`) || nameText.startsWith(`${brandLower}-`)) {
    return false;
  }
  return true;
}

/**
 * @param {string} query
 * @returns {string|null}
 */
function findConsumerBrandInQuery(query) {
  const hit = findKnownConsumerBrand(query);
  return hit || null;
}

// ===== MAIN FUNCTION =====

// This file is a bag of brand helpers, not one pipeline. The exports below are the public API.

module.exports = {
  isSearchSourceLabel,
  stripRetailerSuffix,
  stripTrademarkSymbols,
  normalizeBrandLabel,
  parseMultiBrandField,
  resolveFoodBrandLabel,
  resolveBarcodeBrand,
  cleanBarcodeProductTitle,
  inferBrandFromFoodName,
  shouldShowFoodBrandSubtitle,
  findConsumerBrandInQuery,
  KNOWN_CONSUMER_BRANDS,
};
