// Short consumer-facing brand labels from messy USDA / OFF / retailer strings.
// Flow: clean explicit brand field → else infer from title → hide duplicate subtitles on cards.
// Used by food detail, barcode lookup, and search rows. Regex rules are test-locked — behavior must match.
// Read order: constants → helpers → main recipes → PLUMBING strip/title-case → exports.

// ===== NAMED CONSTANTS =====

const SOURCE_LABEL_PATTERN = /^(via\s+)?(google|serper|duckduckgo|web)\s*search$/i;
const RETAILER_SUFFIX_PATTERN = /\s[-–|]\s*(Kroger|Walmart|Target|QFC|Safeway|Albertsons|HEB|ShopRite|Mariano'?s|Smith'?s|Harris Teeter|Instacart|Amazon(?: Fresh)?|Costco|Sam'?s Club)\b.*$/i;
const MANUFACTURER_PARENT_PATTERN = /^(General Mills|Kellogg(?:'?s)?|PepsiCo|Nestl[eé]|Unilever|Mondelez|Kraft Heinz|Conagra|Post Consumer Brands|Mars,? Incorporated|The Coca-Cola Company|Campbell(?:'?s)?)\b/i;
const PACKAGE_SIZE_SUFFIX_PATTERN = /\s[-–]\s*\d+(?:\.\d+)?\s*(?:oz|lb|g|ml)\b.*$/i;
const VIA_PREFIX_PATTERN = /^via\s+/i;
const CORPORATE_SUFFIX_PATTERN = /\b(inc|llc|ltd|corp|co)\.?$/i;
const POSSESSIVE_BRAND_PATTERN = /^([A-Za-z][A-Za-z0-9&\s.'-]*?'s)\b/;
const ALL_CAPS_SHORT_MAX_LENGTH = 6;
const KEEP_ALL_CAPS_WORD_MAX_LENGTH = 3;
const TITLE_TWO_CAPITAL_WORDS_MIN = 2;
const FIRST_WORD_MIN_LETTERS = 2;

// Manipulate here: add packaged brands that should beat parent-company prefixes in titles
const KNOWN_CONSUMER_BRANDS = ['Ghost', 'Optimum Nutrition', 'Dymatize', 'Quest', 'Kind', 'Clif', 'RXBAR', 'Premier Protein', 'Fairlife', 'Muscle Milk', 'Orgain', 'Alani Nu', 'C4', 'BSN', 'Cellucor', 'Lenny & Larry', 'Built Bar', 'One Bar', 'Pure Protein', 'Cinnamon Toast Crunch', 'Cheerios', 'Lucky Charms', 'Frosted Flakes', 'Nature Valley', 'Fiber One', 'Perdue', 'Purdue',
// common misspelling of Perdue — still detect as a packaged-brand query
'Tyson', 'Foster Farms', 'Applegate', 'Kellogg', "Kellogg's", 'General Mills'];
const RESTAURANT_TWO_WORD_PATTERN = /^(Taco Bell|Burger King|Pizza Hut|Dairy Queen|Jack in the Box|In-N-Out|Carl's Jr|Hardee's|Tim Hortons|Popeyes|Chick-fil-A|Raising Cane's|Five Guys|Shake Shack|Red Robin|Olive Garden|Buffalo Wild Wings|Cottage Inn)\b/i;

// ===== HELPER FUNCTIONS =====

/**
 * Escape a string so it is safe inside a RegExp.
 * @param {string} text
 * @returns {string}
 */
function escapeForRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Title-case a brand, keeping short ALL-CAPS tokens (C4, BSN).
 * @param {string} label
 * @returns {string}
 */
function titleCaseBrandLabel(label) {
  const rawLabel = stripTrademarkSymbols(String(label || '').trim());
  if (!rawLabel) return '';
  const isShortAllCaps = rawLabel === rawLabel.toUpperCase() && rawLabel.length <= ALL_CAPS_SHORT_MAX_LENGTH;
  if (isShortAllCaps) {
    return rawLabel.charAt(0) + rawLabel.slice(1).toLowerCase();
  }
  const words = rawLabel.split(/\s+/);
  const titledWords = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (!word) {
      titledWords.push(word);
      continue;
    }
    const keepAllCaps = word.length <= KEEP_ALL_CAPS_WORD_MAX_LENGTH && word === word.toUpperCase();
    if (keepAllCaps) {
      titledWords.push(word);
      continue;
    }
    titledWords.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }
  return titledWords.join(' ');
}

/**
 * First known consumer brand found as a whole word in the text.
 * @param {string} text
 * @returns {string}
 */
function findKnownConsumerBrandInText(text) {
  const haystack = stripTrademarkSymbols(String(text || ''));
  for (let index = 0; index < KNOWN_CONSUMER_BRANDS.length; index += 1) {
    const knownBrand = KNOWN_CONSUMER_BRANDS[index];
    const knownPattern = new RegExp(`\\b${escapeForRegExp(stripTrademarkSymbols(knownBrand))}\\b`, 'i');
    if (knownPattern.test(haystack)) return titleCaseBrandLabel(knownBrand);
  }
  return '';
}

/**
 * After a parent-company first word, take the third word as the consumer brand.
 * @param {string[]} words
 * @returns {string}
 */
function brandAfterParentCompanyPrefix(words) {
  if (words.length < TITLE_TWO_CAPITAL_WORDS_MIN) return '';
  if (!MANUFACTURER_PARENT_PATTERN.test(words[0])) return '';
  let thirdWord;
  if (words[2]) {
    thirdWord = stripTrademarkSymbols(words[2]);
  } else {
    thirdWord = '';
  }
  if (!thirdWord) return '';
  if (!/^[A-Za-z]/.test(thirdWord) || thirdWord.length <= FIRST_WORD_MIN_LETTERS) return '';
  return titleCaseBrandLabel(thirdWord);
}

/**
 * Two leading Capitalized words, unless they are a parent-company pair.
 * @param {string[]} words
 * @returns {string}
 */
function brandFromTwoCapitalWords(words) {
  if (words.length < TITLE_TWO_CAPITAL_WORDS_MIN) return '';
  if (!/^[A-Z]/.test(words[0]) || !/^[A-Z]/.test(words[1])) return '';
  const twoWordCandidate = `${words[0]} ${words[1]}`;
  if (!MANUFACTURER_PARENT_PATTERN.test(twoWordCandidate)) {
    return titleCaseBrandLabel(twoWordCandidate);
  }
  return titleCaseBrandLabel(words[0]);
}

/**
 * Fall back to the first capitalized / ALL-CAPS word.
 * @param {string[]} words
 * @returns {string}
 */
function brandFromFirstWord(words) {
  if (words.length < 1) return '';
  const firstWord = stripTrademarkSymbols(words[0]);
  if (/^[A-Z]{2,}$/.test(firstWord)) return titleCaseBrandLabel(firstWord);
  if (/^[A-Z]/.test(firstWord) && firstWord.length > FIRST_WORD_MIN_LETTERS) {
    return titleCaseBrandLabel(firstWord);
  }
  return '';
}

// ===== MAIN FUNCTION =====

/**
 * Prefer a real consumer brand field; otherwise infer from the food title.
 * @param {string} foodName
 * @param {string} brand
 * @returns {string}
 */
function resolveFoodBrandLabel(foodName, brand) {
  // 1. Normalize what the API gave us; bail to title inference when empty or a search-provider label.
  const cleanedBrand = normalizeBrandLabel(brand);
  if (!cleanedBrand || isSearchSourceLabel(cleanedBrand)) {
    return inferBrandFromFoodName(foodName);
  }

  // 2. Real consumer brand — use it unless it is only a parent company.
  if (!MANUFACTURER_PARENT_PATTERN.test(cleanedBrand)) {
    return cleanedBrand;
  }

  // 3. Parent company listed — prefer a consumer brand scraped from the product title.
  const inferredFromTitle = inferBrandFromFoodName(foodName);
  if (inferredFromTitle && !MANUFACTURER_PARENT_PATTERN.test(inferredFromTitle)) {
    return inferredFromTitle;
  }
  return cleanedBrand;
}

/**
 * Same as resolveFoodBrandLabel after stripping store suffixes from the title.
 * @param {string} foodName
 * @param {string} explicitBrand
 * @returns {string}
 */
function resolveBarcodeBrand(foodName, explicitBrand) {
  const titleWithoutStore = stripRetailerSuffix(foodName);
  return resolveFoodBrandLabel(titleWithoutStore, explicitBrand);
}

/**
 * Infer a brand from the product title when the brand field is empty or a parent company.
 * @param {string} foodName
 * @returns {string}
 */
function inferBrandFromFoodName(foodName) {
  const nameWithoutStore = stripRetailerSuffix(foodName);
  if (!nameWithoutStore || isSearchSourceLabel(nameWithoutStore)) return '';
  const consumerBrand = findKnownConsumerBrandInText(nameWithoutStore);
  if (consumerBrand) return consumerBrand;
  const possessiveMatch = nameWithoutStore.match(POSSESSIVE_BRAND_PATTERN);
  if (possessiveMatch) return titleCaseBrandLabel(possessiveMatch[1].trim());
  const restaurantMatch = nameWithoutStore.match(RESTAURANT_TWO_WORD_PATTERN);
  if (restaurantMatch) return restaurantMatch[1];
  const words = nameWithoutStore.split(/\s+/).filter(Boolean);
  const afterParent = brandAfterParentCompanyPrefix(words);
  if (afterParent) return afterParent;
  const twoCapitals = brandFromTwoCapitalWords(words);
  if (twoCapitals) return twoCapitals;
  return brandFromFirstWord(words);
}

/**
 * Pick one brand from a comma-separated OFF brands field.
 * @param {string} brands
 * @returns {string}
 */
function parseMultiBrandField(brands) {
  const rawBrands = String(brands || '').trim();
  if (!rawBrands) return '';
  const parts = rawBrands.split(',').map(part => normalizeBrandLabel(part)).filter(Boolean);
  if (!parts.length) return '';
  const knownConsumerBrand = parts.find(part => KNOWN_CONSUMER_BRANDS.some(known => part.toLowerCase() === known.toLowerCase()));
  if (knownConsumerBrand) return knownConsumerBrand;
  const nonParentBrand = parts.find(part => !MANUFACTURER_PARENT_PATTERN.test(part));
  if (nonParentBrand) return nonParentBrand;
  return parts[0];
}

/**
 * Clean one brand string: drop “via Google”, Inc/LLC, trademarks, title-case.
 * @param {string} brand
 * @returns {string}
 */
function normalizeBrandLabel(brand) {
  let brandText = String(brand || '').trim();
  if (!brandText || isSearchSourceLabel(brandText)) return '';
  brandText = brandText.split(',')[0].trim();
  brandText = brandText.replace(CORPORATE_SUFFIX_PATTERN, '').trim();
  brandText = stripTrademarkSymbols(brandText);
  brandText = titleCaseBrandLabel(brandText);
  return brandText;
}

/**
 * Barcode product title without store / package-size noise.
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
 * Hide the brand subtitle when the food name already starts with that brand.
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
  const nameStartsWithBrandWord = nameText.startsWith(`${brandLower} `) || nameText.startsWith(`${brandLower}'`) || nameText.startsWith(`${brandLower}-`);
  if (nameStartsWithBrandWord) return false;
  return true;
}

/**
 * Known consumer brand inside a search query, or null.
 * @param {string} query
 * @returns {string|null}
 */
function findConsumerBrandInQuery(query) {
  const hit = findKnownConsumerBrandInText(query);
  return hit || null;
}

// PLUMBING — skip unless debugging strip / source-label regex.

/**
 * True when the “brand” is actually a search-provider label (“via Google search”).
 * @param {string} brand
 * @returns {boolean}
 */
function isSearchSourceLabel(brand) {
  const brandText = String(brand || '').trim();
  if (!brandText) return false;
  if (SOURCE_LABEL_PATTERN.test(brandText)) return true;
  if (VIA_PREFIX_PATTERN.test(brandText)) return true;
  return false;
}

/**
 * Drop store suffixes (“ - Kroger”), pipe/middle-dot tails, and “ - 12 oz” package sizes.
 * @param {string} title
 * @returns {string}
 */
function stripRetailerSuffix(title) {
  let cleanedTitle = String(title || '').trim();
  if (!cleanedTitle) return cleanedTitle;
  cleanedTitle = cleanedTitle.split('|')[0].split(' · ')[0].trim();
  cleanedTitle = cleanedTitle.replace(RETAILER_SUFFIX_PATTERN, '').trim();
  cleanedTitle = cleanedTitle.replace(PACKAGE_SIZE_SUFFIX_PATTERN, '').trim();
  return cleanedTitle;
}

/**
 * Remove ™ ® © and collapse whitespace.
 * @param {string} text
 * @returns {string}
 */
function stripTrademarkSymbols(text) {
  return String(text || '').replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim();
}
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
  KNOWN_CONSUMER_BRANDS
};