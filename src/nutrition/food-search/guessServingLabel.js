// DISPLAY-ONLY serving line for food cards (1 slice, 10 pc nuggets, Grande).
// Flow: guess the food family from the typed text → reject a mismatched scraper label → fall back to a family default.
// Used by food search titles and restaurant ranking. NEVER returns or mutates calories/macros.
// Read order: constants → MAIN recipes → PLUMBING conflict / page-text helpers.

// ===== NAMED CONSTANTS =====

const TWO_STICK_CALORIES_MAX = 400;
const TWO_STICK_CALORIES_MIN = 300;
const MULTI_BREAD_CALORIES_MIN = 700;
const MIN_PAGE_TEXT_LENGTH = 8;
const DEFAULT_SERVING_LABEL = '1 serving';
const SERPER_ESTIMATED_SERVING = 'Estimated serving — adjust after adding';
const GENERIC_CATEGORY = 'generic';

// ===== HELPER FUNCTIONS =====
// Conflict matrices + page-text scrapers live under PLUMBING; mains call them by name.

// ===== MAIN FUNCTION =====

/**
 * Query-first category. Incidental words in scraper titles must not flip family
 * (e.g. "wing" in "buffalo wing pizza" → pizza when query says pizza).
 * @param {string} [userQuery]
 * @param {string} [foodName]
 * @param {string} [restaurant]
 * @returns {string}
 */
/**
 * True when primary (or combined when query empty) matches a bread family phrase.
 * Bare "bread" only counts when the rest of the text is not another meal family.
 * @param {string} queryText
 * @param {string} primary
 * @param {string} combined
 * @returns {boolean}
 */
function textLooksLikeBreadFamily(queryText, primary, combined) {
  const breadPhraseRe =
    /\b(crazy\s*bread|breadsticks?|cheesy\s+bread|garlic\s+(cheese\s+)?bread|cheese\s+bread|cheese\s*sticks?|cheesesticks?|garlic\s+parmesan)\b/;
  const breadWordRe = /\b(breadstick|bread)\b/;
  const otherMealRe = /\b(pizza|burger|sandwich|nugget|wing|bowl|burrito)\b/;

  if (breadPhraseRe.test(primary)) return true;
  if (!queryText && breadPhraseRe.test(combined)) return true;

  const breadWordInPrimary = breadWordRe.test(primary);
  const breadWordInCombinedOnly = !queryText && breadWordRe.test(combined);
  if (!breadWordInPrimary && !breadWordInCombinedOnly) return false;
  if (otherMealRe.test(combined)) return false;
  return true;
}

function inferFoodServingCategory(userQuery = '', foodName = '', restaurant = '') {
  const queryText = collapseWhitespace(userQuery).toLowerCase();
  const name = collapseWhitespace(foodName).toLowerCase();
  const place = collapseWhitespace(restaurant).toLowerCase();
  let primary = queryText;
  if (!primary) {
    primary = `${name} ${place}`;
  }
  const combined = collapseWhitespace(`${queryText} ${name} ${place}`).toLowerCase();
  if (!combined) return GENERIC_CATEGORY;

  let hasPizza = /\bpizza\b/.test(primary);
  if (!hasPizza && !queryText) {
    hasPizza = /\bpizza\b/.test(combined);
  }
  if (hasPizza) return 'pizza';
  if (queryOrCombinedMatches(primary, combined, /\b(mcnuggets?|mc\s*nuggets?|chicken\s*nuggets?|nuggets?)\b/)) {
    return 'nugget';
  }
  if (queryOrCombinedMatches(primary, combined, /\b(wings?|boneless\s+wings?)\b/)) return 'wing';
  if (queryOrCombinedMatches(primary, combined, /\b(tenders?|chicken\s+fingers?|strips?)\b/)) return 'tender';
  if (textLooksLikeBreadFamily(queryText, primary, combined)) return 'bread';
  if (queryOrCombinedMatches(primary, combined, /\b(burger|cheeseburger|hamburger|whopper|big\s*mac|quarter\s*pounder|baconator|slider)\b/)) {
    return 'burger';
  }
  if (queryOrCombinedMatches(primary, combined, /\b(bowl|salad)\b/)) return 'bowl';
  if (queryOrCombinedMatches(primary, combined, /\b(burrito)\b/)) return 'burrito';
  if (queryOrCombinedMatches(primary, combined, /\b(quesadilla)\b/)) return 'quesadilla';
  if (queryOrCombinedMatches(primary, combined, /\b(taco)\b/)) return 'taco';
  if (queryOrCombinedMatches(primary, combined, /\b(sandwich|wrap|sub|hoagie|panini|melt)\b/)) return 'sandwich';
  if (queryOrCombinedMatches(primary, combined, /\b(fries|fry)\b/)) return 'fries';
  if (queryOrCombinedMatches(primary, combined, /\b(frosty|shake|smoothie|latte|mocha|frappuccino|coffee|soda|cola|coke|drink|beverage|lemonade)\b/)) {
    return 'beverage';
  }
  return GENERIC_CATEGORY;
}

/**
 * Cross-family conflict matrix — hard reject wrong serving language for ANY food family.
 * @param {{ userQuery?: string, foodName?: string, restaurant?: string, servingLabel?: string }} opts
 * @returns {boolean}
 */
function servingConflictsWithFood({
  userQuery = '',
  foodName = '',
  restaurant = '',
  servingLabel = ''
} = {}) {
  const label = collapseWhitespace(servingLabel);
  if (!label || isWeakServingLabel(label)) return false;
  const category = inferFoodServingCategory(userQuery, foodName, restaurant);
  return servingConflictsForCategory(category, label, label.toLowerCase());
}

/** High-cal bread/breadstick macros sold as a single stick/piece → treat as multi/order. */
function looksLikeMultiBreadOrder(calories, label, category) {
  if (category !== 'bread') return false;
  const calorieCount = Number(calories) || 0;
  if (calorieCount < MULTI_BREAD_CALORIES_MIN) return false;
  const labelText = collapseWhitespace(label).toLowerCase();
  if (!labelText) return true;
  if (/\b(order|full\s+order|multi|pack|sticks?|pieces?)\b/.test(labelText) && !/^1\s+(piece|stick|breadstick)\b/.test(labelText)) {
    return false;
  }
  return /^1\s+(piece|stick|breadstick|serving)\b/.test(labelText) || /^(piece|stick|breadstick)$/.test(labelText);
}

/**
 * Infer a serving line from the user's query + food name (no scraper data).
 * @param {string} userQuery
 * @param {string} [foodName]
 * @param {string} [restaurant]
 * @param {number|null} [calories]
 * @returns {string|null}
 */
function servingLabelFromQueryStructure(userQuery, foodName = '', restaurant = '', calories = null) {
  const combined = collapseWhitespace(`${userQuery} ${foodName} ${restaurant}`).toLowerCase();
  if (!combined || combined.length < 2) return null;
  const size = firstRegexCapture(combined, /\b(small|medium|large|grande|venti|tall|regular)\b/);
  const category = inferFoodServingCategory(userQuery, foodName, restaurant);
  return defaultLabelForFoodCategory(category, combined, size, userQuery, foodName, calories);
}

/** Pull serving language from scraper page text when present. */
function extractServingLabelFromPageText(text, foodContext = {}) {
  const pageText = collapseWhitespace(String(text || '').replace(/\u00a0/g, ' '));
  if (pageText.length < MIN_PAGE_TEXT_LENGTH) return null;
  const pageLower = pageText.toLowerCase();
  const category = inferFoodServingCategory(foodContext.userQuery, foodContext.foodName, foodContext.restaurant);
  const servingSizeMatch = pageText.match(/serving\s+size[:\s]+([^\n.;]{3,90})/i);
  let servingSizeLabel;
  if (servingSizeMatch) {
    servingSizeLabel = scraperLabelIfUsable(servingSizeMatch[1], foodContext);
  } else {
    servingSizeLabel = null;
  }
  if (servingSizeLabel) return servingSizeLabel;
  const perMatch = pageText.match(/there are\s+[^.]{0,40}?\bper\s+([^.(]{3,60})/i);
  if (perMatch && !isWeakServingLabel(perMatch[1])) {
    const line = collapseWhitespace(perMatch[1]);
    if (!servingConflictsWithFood({
      ...foodContext,
      servingLabel: line
    })) return line;
  }
  const pieceLabel = pieceCountServingFromPageText(category, pageLower);
  if (pieceLabel) return pieceLabel;
  if (category === 'bread') return breadServingFromPageText(pageText, pageLower);
  if (category === 'pizza' || /\bpizza/i.test(pageLower)) return pizzaServingFromPageText(pageText, pageLower);
  return null;
}
function finalizeServingLabelResult(label, {
  userQuery,
  foodName,
  restaurant,
  calories
} = {}) {
  let out = collapseWhitespace(label);
  const category = inferFoodServingCategory(userQuery, foodName, restaurant);
  if (!out || isWeakServingLabel(out) || servingConflictsWithFood({
    userQuery,
    foodName,
    restaurant,
    servingLabel: out
  })) {
    out = servingLabelFromQueryStructure(userQuery, foodName, restaurant, calories) || DEFAULT_SERVING_LABEL;
  }
  if (looksLikeMultiBreadOrder(calories, out, category)) {
    return {
      label: 'Full order (multi-serving)',
      nutrition_unverified: true,
      multiServingFallback: true
    };
  }
  return {
    label: out,
    nutrition_unverified: false,
    multiServingFallback: false
  };
}

/**
 * Best serving LABEL string for a search row — display only.
 * calories may inform which label text to pick; macros are never returned or written.
 * @param {object} [opts]
 * @returns {string}
 */
function resolveFoodServingLabel({
  userQuery = '',
  foodName = '',
  restaurant = '',
  scraperLabel = null,
  displayName = '',
  pageText = '',
  calories = null
} = {}) {
  // 1. Prefer the food_name field; displayName is only a fallback for search rows.
  const name = foodName || displayName;
  const foodContext = {
    userQuery,
    foodName: name,
    restaurant
  };

  // 2. Gather scraper label, page text, then query-structure fallback (first good wins).
  const candidates = gatherServingLabelCandidates({
    scraperLabel,
    pageText,
    userQuery,
    restaurant,
    calories
  }, foodContext);

  // 3. Finalize: reject weak/cross-family labels, apply multi-bread override when needed.
  //    Return value is label text only — never calories/protein/carbs/fat.
  const finalized = finalizeServingLabelResult(candidates[0] || DEFAULT_SERVING_LABEL, {
    userQuery,
    foodName: name,
    restaurant,
    calories
  });
  return finalized.label;
}

/**
 * Same as resolveFoodServingLabel but also returns multi/unverified flags for presentation.
 * DISPLAY-ONLY: return shape is { label, nutrition_unverified, multiServingFallback } only.
 */
function resolveFoodServingLabelDetailed(opts = {}) {
  const name = opts.foodName || opts.displayName || '';
  const foodContext = {
    userQuery: opts.userQuery || '',
    foodName: name,
    restaurant: opts.restaurant || ''
  };
  const candidates = gatherServingLabelCandidates(opts, foodContext);
  const finalized = finalizeServingLabelResult(candidates[0] || DEFAULT_SERVING_LABEL, {
    ...foodContext,
    calories: opts.calories
  });
  // Strip anything except display fields so callers cannot treat this as a macro source.
  return {
    label: finalized.label,
    nutrition_unverified: Boolean(finalized.nutrition_unverified),
    multiServingFallback: Boolean(finalized.multiServingFallback)
  };
}

/**
 * Read one field from a search-row item when the object exists.
 * @param {object|null|undefined} item
 * @param {string} fieldName
 * @returns {*}
 */
function readItemField(item, fieldName) {
  if (!item) return undefined;
  return item[fieldName];
}

/**
 * Food name for serving display — food_name first, then name.
 * @param {object|null|undefined} item
 * @returns {*}
 */
function foodNameFromSearchItem(item) {
  const fromFoodName = readItemField(item, 'food_name');
  if (fromFoodName) return fromFoodName;
  return readItemField(item, 'name');
}

/**
 * Restaurant / brand line for serving conflict checks.
 * @param {object|null|undefined} item
 * @returns {*}
 */
function restaurantFromSearchItem(item) {
  const fromRestaurant = readItemField(item, 'restaurant');
  if (fromRestaurant) return fromRestaurant;
  const fromBrandName = readItemField(item, 'brand_name');
  if (fromBrandName) return fromBrandName;
  return readItemField(item, 'brand');
}

/**
 * Calories for multi-bread heuristics — nf_calories first, then calories.
 * @param {object|null|undefined} item
 * @returns {*}
 */
function caloriesFromSearchItem(item) {
  if (!item) return undefined;
  if (item.nf_calories != null) return item.nf_calories;
  return item.calories;
}

/**
 * Existing serving label text from any frozen alias on the row.
 * @param {object|null|undefined} item
 * @returns {string}
 */
function existingServingLabelFromItem(item) {
  const fromServingLabel = readItemField(item, 'serving_label');
  if (fromServingLabel) return collapseWhitespace(fromServingLabel);
  const fromCamelLabel = readItemField(item, 'servingLabel');
  if (fromCamelLabel) return collapseWhitespace(fromCamelLabel);
  const fromPortion = readItemField(item, 'portion_text');
  if (fromPortion) return collapseWhitespace(fromPortion);
  return '';
}

/**
 * Scraper / row serving label before resolver (raw, not collapsed).
 * @param {object|null|undefined} item
 * @returns {*}
 */
function scraperLabelFromItem(item) {
  const fromServingLabel = readItemField(item, 'serving_label');
  if (fromServingLabel) return fromServingLabel;
  const fromCamelLabel = readItemField(item, 'servingLabel');
  if (fromCamelLabel) return fromCamelLabel;
  return readItemField(item, 'portion_text');
}

/**
 * Page URL from metadata.sourceResult.url when nested objects exist.
 * @param {object|null|undefined} item
 * @returns {string}
 */
function pageTextUrlFromItem(item) {
  if (!item) return '';
  const metadata = item.metadata;
  if (!metadata) return '';
  const sourceResult = metadata.sourceResult;
  if (!sourceResult) return '';
  if (!sourceResult.url) return '';
  return sourceResult.url;
}

/**
 * Serving unit string from snake or camel alias.
 * @param {object|null|undefined} item
 * @returns {string}
 */
function servingUnitFromItem(item) {
  const fromSnake = readItemField(item, 'serving_unit');
  if (fromSnake) return collapseWhitespace(fromSnake);
  const fromCamel = readItemField(item, 'servingUnit');
  if (fromCamel) return collapseWhitespace(fromCamel);
  return '';
}

/**
 * Serving qty for unit display — serving_size, then serving_qty, else 1.
 * @param {object|null|undefined} item
 * @returns {number}
 */
function servingQtyFromItem(item) {
  if (!item) return 1;
  if (item.serving_size != null) return item.serving_size;
  if (item.serving_qty != null) return item.serving_qty;
  return 1;
}

/** UI line under the food title on search cards — single authority for display. */
function formatServingDisplayLine(item, userQuery = '') {
  const foodName = foodNameFromSearchItem(item);
  const restaurant = restaurantFromSearchItem(item);
  const calories = caloriesFromSearchItem(item);
  const existing = existingServingLabelFromItem(item);

  // 1. Keep the row’s label when it already matches the food family.
  const existingConflicts = servingConflictsWithFood({
    userQuery,
    foodName,
    restaurant,
    servingLabel: existing,
  });
  if (existing && !isWeakServingLabel(existing) && !existingConflicts) {
    return finalizeServingLabelResult(existing, {
      userQuery,
      foodName,
      restaurant,
      calories,
    }).label;
  }

  // 2. Otherwise run the full resolver, then unit/qty, then Serper estimate copy.
  const resolved = resolveFoodServingLabel({
    userQuery,
    foodName,
    restaurant,
    scraperLabel: scraperLabelFromItem(item),
    pageText: pageTextUrlFromItem(item),
    calories,
  });
  if (resolved && !isWeakServingLabel(resolved)) return resolved;

  const unit = servingUnitFromItem(item);
  const unitConflicts = servingConflictsWithFood({
    userQuery,
    foodName,
    restaurant,
    servingLabel: unit,
  });
  const unitIsBareWeight = /^(grams?|g|ml)$/i.test(unit);
  if (unit && !isWeakServingLabel(unit) && !unitIsBareWeight && !unitConflicts) {
    const qty = servingQtyFromItem(item);
    if (qty > 1) return `${qty} ${unit}`;
    return unit;
  }

  const itemSource = readItemField(item, 'source');
  if (itemSource === 'serper' || itemSource === 'mixed') {
    return SERPER_ESTIMATED_SERVING;
  }
  if (resolved) return resolved;
  return DEFAULT_SERVING_LABEL;
}

// PLUMBING — skip unless debugging weak-label / conflict / page-text scrapers.

function collapseWhitespace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

/**
 * Labels too vague to show on a menu card (100g, “1 serving”, pack, each…).
 * @param {string} label
 * @returns {boolean}
 */
function isWeakServingLabel(label) {
  const labelText = collapseWhitespace(label).toLowerCase();
  if (!labelText) return true;
  const looksLikeHundredGrams = /^(per\s+)?100\s*g(?:rams?)?$/.test(labelText) || /^100\s*g(?:rams?)?\s*(serving)?$/.test(labelText) || /^per\s+100\s*g/.test(labelText);
  if (looksLikeHundredGrams) return true;
  const looksLikeGenericServing = /^~\s*1\s+serving\b/.test(labelText) || /^(1\s+)?serving$/.test(labelText) || /^1$/.test(labelText) || /^(1\s+)?portion$/.test(labelText) || /^per\s+serving$/.test(labelText);
  if (looksLikeGenericServing) return true;
  const looksLikePackageOnly = /^package$|^pack$/.test(labelText) || /^each$/.test(labelText) || /^grams?$/.test(labelText);
  if (looksLikePackageOnly) return true;
  return false;
}
function titleCaseSizeWord(word) {
  const sizeWord = String(word || '').toLowerCase();
  if (!sizeWord) return '';
  return sizeWord.charAt(0).toUpperCase() + sizeWord.slice(1);
}
function firstRegexCapture(text, re) {
  const match = String(text || '').match(re);
  if (match) {
    return match[1];
  }
  return null;
}
function queryOrCombinedMatches(queryText, combined, pattern) {
  if (pattern.test(queryText)) return true;
  if (!queryText && pattern.test(combined)) return true;
  return false;
}
function labelLooksLikeNuggetOrWingFamily(label) {
  const labelText = collapseWhitespace(label).toLowerCase();
  return /\b(nuggets?|mcnuggets?|wings?|tenders?|chicken\s+fingers?|buff\b|buffalo)\b/.test(labelText);
}
function labelLooksLikeBreadFamily(label) {
  const labelText = collapseWhitespace(label).toLowerCase();
  return /\b(breadstick|bread\s*stick|crazy\s*bread|garlic\s+bread|cheesy\s+bread|cheese\s*sticks?|cheesesticks?)\b/.test(labelText);
}
function labelLooksLikePizzaFamily(label) {
  const labelText = collapseWhitespace(label).toLowerCase();
  return /\b(slice|slices|whole\s+pizza|half\s+pizza|pizza)\b/.test(labelText);
}
function labelLooksLikeSandwichFamily(label) {
  const labelText = collapseWhitespace(label).toLowerCase();
  return /\b(sandwich|burger|wrap|sub\b|hoagie)\b/.test(labelText);
}
function labelLooksLikeBarePieceCount(label) {
  const labelText = collapseWhitespace(label).toLowerCase();
  if (/\b\d+\s*(pc|pcs|piece|pieces)\b/.test(labelText) && !/\b(nugget|wing|tender|stick|breadstick|strip)\b/.test(labelText)) {
    return true;
  }
  return false;
}
function labelHasBarePieceCount(label) {
  const labelText = collapseWhitespace(label).toLowerCase();
  return /\b\d+\s*(pc|pcs|piece|pieces)\b/.test(labelText);
}
function breadServingConflicts(label, labelLower) {
  if (labelLooksLikeNuggetOrWingFamily(label)) return true;
  if (labelLooksLikeBarePieceCount(label)) return true;
  const barePieceWithoutBreadWord = labelHasBarePieceCount(label) && !/\b(stick|breadstick|bread)\b/.test(labelLower);
  if (barePieceWithoutBreadWord) return true;
  if (/\b(whole\s+pizza|pizza\s+meal|pizza\s+combo)\b/.test(labelLower)) return true;
  const otherMealWithoutBreadWord = /\b(burger|sandwich|bowl|burrito|taco)\b/.test(labelLower) && !/\b(stick|bread)\b/.test(labelLower);
  if (otherMealWithoutBreadWord) return true;
  return false;
}
function nuggetServingConflicts(label, labelLower) {
  if (labelLooksLikeBreadFamily(label) && !/\bnugget/i.test(labelLower)) return true;
  if (/\bwings?\b/.test(labelLower) && !/\bnugget/i.test(labelLower)) return true;
  if (labelLooksLikeSandwichFamily(label) || labelLooksLikePizzaFamily(label) && !/\bnugget/i.test(labelLower)) return true;
  return false;
}
function wingOrTenderServingConflicts(label, labelLower) {
  if (labelLooksLikeBreadFamily(label)) return true;
  if (/\bnuggets?\b/.test(labelLower) && !/\bwing/i.test(labelLower)) return true;
  if (labelLooksLikeSandwichFamily(label) || labelLooksLikePizzaFamily(label)) return true;
  if (labelLooksLikeBarePieceCount(label)) return true;
  return false;
}
function pizzaServingConflicts(label) {
  if (labelLooksLikeNuggetOrWingFamily(label)) return true;
  if (labelLooksLikeBreadFamily(label)) return true;
  if (labelHasBarePieceCount(label)) return true;
  if (labelLooksLikeSandwichFamily(label)) return true;
  return false;
}
function burgerOrSandwichServingConflicts(label, labelLower) {
  if (labelLooksLikeNuggetOrWingFamily(label)) return true;
  if (labelLooksLikeBreadFamily(label)) return true;
  if (/\b\d+\s*slices?\b/.test(labelLower) || /\b1\s+slice\b/.test(labelLower)) return true;
  if (labelHasBarePieceCount(label)) return true;
  return false;
}
function tacoServingConflicts(label, labelLower) {
  if (labelLooksLikeNuggetOrWingFamily(label)) return true;
  if (labelLooksLikeBreadFamily(label)) return true;
  if (/\b(burrito|quesadilla|bowl)\b/.test(labelLower)) return true;
  if (/\b\d+\s*slices?\b/.test(labelLower)) return true;
  if (labelHasBarePieceCount(label)) return true;
  return false;
}
function burritoServingConflicts(label, labelLower) {
  if (labelLooksLikeNuggetOrWingFamily(label)) return true;
  if (labelLooksLikeBreadFamily(label)) return true;
  if (/\b(taco|quesadilla)\b/.test(labelLower) && !/\bburrito\b/.test(labelLower)) return true;
  if (/\b\d+\s*slices?\b/.test(labelLower)) return true;
  if (labelHasBarePieceCount(label)) return true;
  return false;
}
function bowlOrMexicanServingConflicts(label, labelLower) {
  if (labelLooksLikeNuggetOrWingFamily(label)) return true;
  if (labelLooksLikeBreadFamily(label)) return true;
  if (/\b\d+\s*slices?\b/.test(labelLower)) return true;
  if (labelHasBarePieceCount(label)) return true;
  return false;
}
function friesServingConflicts(label) {
  if (labelLooksLikeNuggetOrWingFamily(label) || labelLooksLikeBreadFamily(label) || labelLooksLikeSandwichFamily(label)) return true;
  if (labelHasBarePieceCount(label)) return true;
  return false;
}
function beverageServingConflicts(label, labelLower) {
  if (labelLooksLikeNuggetOrWingFamily(label) || labelLooksLikeBreadFamily(label) || labelLooksLikeSandwichFamily(label)) return true;
  if (labelHasBarePieceCount(label) || /\bslice\b/.test(labelLower)) return true;
  return false;
}
function servingConflictsForCategory(category, label, labelLower) {
  if (category === 'bread') return breadServingConflicts(label, labelLower);
  if (category === 'nugget') return nuggetServingConflicts(label, labelLower);
  if (category === 'wing' || category === 'tender') return wingOrTenderServingConflicts(label, labelLower);
  if (category === 'pizza') return pizzaServingConflicts(label);
  if (category === 'burger' || category === 'sandwich') return burgerOrSandwichServingConflicts(label, labelLower);
  if (category === 'taco') return tacoServingConflicts(label, labelLower);
  if (category === 'burrito') return burritoServingConflicts(label, labelLower);
  if (category === 'quesadilla' || category === 'bowl' || category === 'mexican') {
    return bowlOrMexicanServingConflicts(label, labelLower);
  }
  if (category === 'fries') return friesServingConflicts(label);
  if (category === 'beverage') return beverageServingConflicts(label, labelLower);
  if (labelLooksLikeBarePieceCount(label)) return true;
  return false;
}
function breadServingLabelFromQuery(userQuery = '', foodName = '', calories = null) {
  const combined = collapseWhitespace(`${userQuery} ${foodName}`).toLowerCase();
  const calorieCount = Number(calories) || 0;
  const isCheeseStick = /\bcheese\s*sticks?|cheesesticks?\b/.test(combined) && !/\bbreadsticks?\b/.test(combined);
  const isBreadstick = /\b(crazy\s*bread|breadsticks?|garlic\s+parmesan\s+bread|garlic\s+bread|cheesy\s+bread)\b/.test(combined);
  if (isCheeseStick) {
    if (calorieCount >= TWO_STICK_CALORIES_MIN && calorieCount <= TWO_STICK_CALORIES_MAX) return '2 cheese sticks';
    return '1 cheese stick';
  }
  if (isBreadstick || /\bbreadsticks?\b/.test(combined)) {
    if (calorieCount >= TWO_STICK_CALORIES_MIN && calorieCount <= TWO_STICK_CALORIES_MAX) return '2 breadsticks';
    if (/\bcrazy\s*bread\b/.test(combined)) return '1 breadstick';
    return '1 breadstick';
  }
  if (/\b(garlic|parmesan)\b/.test(combined) && /\bsticks?\b/.test(combined)) {
    if (calorieCount >= TWO_STICK_CALORIES_MIN && calorieCount <= TWO_STICK_CALORIES_MAX) return '2 cheese sticks';
    return '1 cheese stick';
  }
  return '1 piece';
}
function nuggetServingFromQuery(combined) {
  const pieceCount = firstRegexCapture(combined, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/) || firstRegexCapture(combined, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\s*(?:chicken\s*)?nugget/) || firstRegexCapture(combined, /\b(\d+)\s*pc\b/) || firstRegexCapture(combined, /\b(\d+)pc\b/);
  if (pieceCount) return `${pieceCount} pc nuggets`;
  return 'nuggets (1 serving)';
}
function pizzaServingFromQuery(combined) {
  if (/\b(whole|entire|full)\s+(pizza)?\b/i.test(combined)) return 'Whole pizza';
  if (/\bhalf\s+(a\s+)?pizza\b/i.test(combined)) return 'Half pizza';
  const slices = firstRegexCapture(combined, /\b(\d+)\s*slices?\b/);
  if (slices) return `${slices} slice${slices === '1' ? '' : 's'}`;
  if (/\bslice\b/i.test(combined)) return '1 slice';
  return '1 slice';
}
function wingServingFromQuery(combined) {
  const pieceCount = firstRegexCapture(combined, /\b(\d+)\s*wings?\b/) || firstRegexCapture(combined, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/);
  if (pieceCount) return `${pieceCount} wings`;
  return 'wings (1 serving)';
}
function tenderServingFromQuery(combined) {
  const pieceCount = firstRegexCapture(combined, /\b(\d+)\s*(?:pc|pcs|piece|pieces|tenders?)\b/);
  if (pieceCount) return `${pieceCount} tenders`;
  return 'tenders (1 serving)';
}
function beverageServingFromQuery(combined, size) {
  const ounces = firstRegexCapture(combined, /\b(\d+)\s*(?:fl\s*)?oz\b/);
  if (ounces) return `${ounces} fl oz`;
  if (/\bfrosty\b/.test(combined)) {
    if (size) {
      return titleCaseSizeWord(size);
    }
    return '1 medium';
  }
  if (size) {
    return titleCaseSizeWord(size);
  }
  return '1 medium';
}
function genericServingFromQuery(combined, size) {
  if (/\b(frosty|shake|smoothie|latte|mocha|frappuccino|coffee|soda|cola|drink|beverage|lemonade)\b/i.test(combined)) {
    const ounces = firstRegexCapture(combined, /\b(\d+)\s*(?:fl\s*)?oz\b/);
    if (ounces) return `${ounces} fl oz`;
    if (size) {
      return titleCaseSizeWord(size);
    }
    return '1 medium';
  }
  if (/\b(chips|crisps|crackers|pretzel|popcorn|snack|doritos|cheetos|lays|pringles)\b/i.test(combined)) {
    return DEFAULT_SERVING_LABEL;
  }
  if (/\b(egg|eggs)\b/i.test(combined)) {
    const eggSize = firstRegexCapture(combined, /\b(large|medium|small|extra\s+large)\s+egg/);
    if (eggSize) return `1 ${eggSize} egg`;
    return '1 egg';
  }
  if (/\b(apple|banana|orange|avocado|potato)\b/i.test(combined)) return '1 medium';
  if (/\b(chicken\s+breast|salmon|steak|pork\s+chop)\b/i.test(combined)) return DEFAULT_SERVING_LABEL;
  if (size && /\b(combo|meal)\b/i.test(combined)) return `${titleCaseSizeWord(size)} combo`;
  return null;
}
function defaultLabelForFoodCategory(category, combined, size, userQuery, foodName, calories) {
  if (category === 'bread') return breadServingLabelFromQuery(userQuery, foodName, calories);
  if (category === 'nugget') return nuggetServingFromQuery(combined);
  if (category === 'pizza') return pizzaServingFromQuery(combined);
  if (category === 'wing') return wingServingFromQuery(combined);
  if (category === 'tender') return tenderServingFromQuery(combined);
  if (category === 'burger' || category === 'sandwich') return '1 sandwich';
  if (category === 'bowl') return '1 bowl';
  if (category === 'taco') return '1 taco';
  if (category === 'burrito') return '1 burrito';
  if (category === 'quesadilla') return '1 quesadilla';
  if (category === 'fries') {
    if (size) {
      return `${titleCaseSizeWord(size)} fries`;
    }
    return 'Medium fries';
  }
  if (category === 'beverage') return beverageServingFromQuery(combined, size);
  return genericServingFromQuery(combined, size);
}
function scraperLabelIfUsable(raw, foodContext) {
  const label = collapseWhitespace(raw);
  if (!label || isWeakServingLabel(label)) return null;
  if (servingConflictsWithFood({
    ...foodContext,
    servingLabel: label
  })) return null;
  return label;
}
function pieceCountServingFromPageText(category, pageLower) {
  if (category !== 'nugget' && category !== 'wing' && category !== 'tender') return null;
  if (!/\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/i.test(pageLower)) return null;
  const pieceCount = firstRegexCapture(pageLower, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/);
  if (pieceCount && category === 'nugget' && /\bnugget/i.test(pageLower)) return `${pieceCount} pc nuggets`;
  if (pieceCount && category === 'wing' && /\bwing/i.test(pageLower)) return `${pieceCount} wings`;
  if (pieceCount && category === 'tender' && /\b(tender|strip)/i.test(pageLower)) return `${pieceCount} tenders`;
  return null;
}
function breadServingFromPageText(pageText, pageLower) {
  if (/\bfull\s+order\b|\bentire\s+order\b/i.test(pageLower)) {
    const stick = pageText.match(/(\d+)\s*sticks?\b/i);
    if (stick) return `Full order (${stick[1]} sticks)`;
    return 'Full order';
  }
  if (/\b(\d+)\s*(?:bread)?sticks?\b/i.test(pageLower) && !/\bnugget|wing/i.test(pageLower)) {
    const stickCount = firstRegexCapture(pageLower, /\b(\d+)\s*(?:bread)?sticks?\b/);
    if (stickCount && Number(stickCount) >= 2) return `${stickCount}-piece order`;
  }
  if (/\b1\s+breadstick\b|\bone\s+breadstick\b|\bper\s+breadstick\b/i.test(pageLower)) {
    return '1 breadstick';
  }
  return null;
}
function pizzaServingFromPageText(pageText, pageLower) {
  if (/\b1\s+slice\b|\bper\s+slice\b|\bone\s+slice\b/i.test(pageLower)) return '1 slice';
  if (/\b(\d+)\s*slices?\b/i.test(pageLower)) {
    const sliceCount = firstRegexCapture(pageLower, /\b(\d+)\s*slices?\b/);
    if (sliceCount) return `${sliceCount} slice${sliceCount === '1' ? '' : 's'}`;
  }
  if (/\bwhole\s+pizza\b|\bentire\s+pizza\b/i.test(pageLower)) return 'Whole pizza';
  return null;
}
function gatherServingLabelCandidates(opts, foodContext) {
  const candidates = [];
  const rawCandidates = [opts.scraperLabel, extractServingLabelFromPageText(opts.pageText || '', foodContext)];
  for (let index = 0; index < rawCandidates.length; index += 1) {
    const usableLabel = scraperLabelIfUsable(rawCandidates[index], foodContext);
    if (usableLabel) candidates.push(usableLabel);
  }
  const fromStructure = servingLabelFromQueryStructure(opts.userQuery, foodContext.foodName, opts.restaurant, opts.calories);
  if (fromStructure) candidates.push(fromStructure);
  return candidates;
}
module.exports = {
  isWeakServingLabel,
  servingLabelFromQueryStructure,
  extractServingLabelFromPageText,
  resolveFoodServingLabel,
  resolveFoodServingLabelDetailed,
  formatServingDisplayLine,
  inferFoodServingCategory,
  servingConflictsWithFood,
  looksLikeMultiBreadOrder
};