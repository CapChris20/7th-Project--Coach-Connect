// Infers a human-readable serving line for every food card (1 slice, 10 pc nuggets, Grande).
// Flow: guess the food family from the typed text → reject a mismatched scraper label → fall back to a family default.
// Used by food search titles and restaurant ranking. CommonJS so the food tests can require() it.

// ===== NAMED CONSTANTS =====

const TWO_STICK_CALORIES_MAX = 400;
const TWO_STICK_CALORIES_MIN = 300;
const MULTI_BREAD_CALORIES_MIN = 700;
const MIN_PAGE_TEXT_LENGTH = 8;
const DEFAULT_SERVING_LABEL = '1 serving';
const SERPER_ESTIMATED_SERVING = 'Estimated serving — adjust after adding';
const GENERIC_CATEGORY = 'generic';

// ===== HELPER FUNCTIONS =====

function normalizeSpace(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

/** Labels too vague to show on a menu card. */
function isWeakServingLabel(label) {
  const labelText = normalizeSpace(label).toLowerCase();
  if (!labelText) return true;
  if (/^(per\s+)?100\s*g(?:rams?)?$/.test(labelText)) return true;
  if (/^100\s*g(?:rams?)?\s*(serving)?$/.test(labelText)) return true;
  if (/^per\s+100\s*g/.test(labelText)) return true;
  if (/^~\s*1\s+serving\b/.test(labelText)) return true;
  if (/^(1\s+)?serving$/.test(labelText)) return true;
  if (/^1$/.test(labelText)) return true;
  if (/^(1\s+)?portion$/.test(labelText)) return true;
  if (/^package$|^pack$/.test(labelText)) return true;
  if (/^each$/.test(labelText)) return true;
  if (/^grams?$/.test(labelText)) return true;
  if (/^per\s+serving$/.test(labelText)) return true;
  return false;
}

function titleCaseSize(word) {
  const sizeWord = String(word || '').toLowerCase();
  if (!sizeWord) return '';
  return sizeWord.charAt(0).toUpperCase() + sizeWord.slice(1);
}

function extractCount(text, re) {
  const match = String(text || '').match(re);
  return match ? match[1] : null;
}

function primaryOrCombinedHas(queryText, combined, pattern) {
  if (pattern.test(queryText)) return true;
  if (!queryText && pattern.test(combined)) return true;
  return false;
}

function labelLooksLikeNuggetOrWing(label) {
  const labelText = normalizeSpace(label).toLowerCase();
  return /\b(nuggets?|mcnuggets?|wings?|tenders?|chicken\s+fingers?|buff\b|buffalo)\b/.test(labelText);
}

function labelLooksLikeBread(label) {
  const labelText = normalizeSpace(label).toLowerCase();
  return /\b(breadstick|bread\s*stick|crazy\s*bread|garlic\s+bread|cheesy\s+bread|cheese\s*sticks?|cheesesticks?)\b/.test(
    labelText,
  );
}

function labelLooksLikePizzaSlice(label) {
  const labelText = normalizeSpace(label).toLowerCase();
  return /\b(slice|slices|whole\s+pizza|half\s+pizza|pizza)\b/.test(labelText);
}

function labelLooksLikeSandwich(label) {
  const labelText = normalizeSpace(label).toLowerCase();
  return /\b(sandwich|burger|wrap|sub\b|hoagie)\b/.test(labelText);
}

function labelLooksLikePieceCountJunk(label) {
  const labelText = normalizeSpace(label).toLowerCase();
  if (/\b\d+\s*(pc|pcs|piece|pieces)\b/.test(labelText) && !/\b(nugget|wing|tender|stick|breadstick|strip)\b/.test(labelText)) {
    return true;
  }
  return false;
}

function labelHasBarePcCount(label) {
  const labelText = normalizeSpace(label).toLowerCase();
  return /\b\d+\s*(pc|pcs|piece|pieces)\b/.test(labelText);
}

function breadServingConflicts(label, labelLower) {
  if (labelLooksLikeNuggetOrWing(label) || labelLooksLikePieceCountJunk(label)) return true;
  if (labelHasBarePcCount(label) && !/\b(stick|breadstick|bread)\b/.test(labelLower)) return true;
  if (/\b(whole\s+pizza|pizza\s+meal|pizza\s+combo)\b/.test(labelLower)) return true;
  if (/\b(burger|sandwich|bowl|burrito|taco)\b/.test(labelLower) && !/\b(stick|bread)\b/.test(labelLower)) return true;
  return false;
}

function nuggetServingConflicts(label, labelLower) {
  if (labelLooksLikeBread(label) && !/\bnugget/i.test(labelLower)) return true;
  if (/\bwings?\b/.test(labelLower) && !/\bnugget/i.test(labelLower)) return true;
  if (labelLooksLikeSandwich(label) || (labelLooksLikePizzaSlice(label) && !/\bnugget/i.test(labelLower))) return true;
  return false;
}

function wingOrTenderServingConflicts(label, labelLower) {
  if (labelLooksLikeBread(label)) return true;
  if (/\bnuggets?\b/.test(labelLower) && !/\bwing/i.test(labelLower)) return true;
  if (labelLooksLikeSandwich(label) || labelLooksLikePizzaSlice(label)) return true;
  if (labelLooksLikePieceCountJunk(label)) return true;
  return false;
}

function pizzaServingConflicts(label) {
  if (labelLooksLikeNuggetOrWing(label)) return true;
  if (labelLooksLikeBread(label)) return true;
  if (labelHasBarePcCount(label)) return true;
  if (labelLooksLikeSandwich(label)) return true;
  return false;
}

function burgerOrSandwichServingConflicts(label, labelLower) {
  if (labelLooksLikeNuggetOrWing(label)) return true;
  if (labelLooksLikeBread(label)) return true;
  if (/\b\d+\s*slices?\b/.test(labelLower) || /\b1\s+slice\b/.test(labelLower)) return true;
  if (labelHasBarePcCount(label)) return true;
  return false;
}

function tacoServingConflicts(label, labelLower) {
  if (labelLooksLikeNuggetOrWing(label)) return true;
  if (labelLooksLikeBread(label)) return true;
  if (/\b(burrito|quesadilla|bowl)\b/.test(labelLower)) return true;
  if (/\b\d+\s*slices?\b/.test(labelLower)) return true;
  if (labelHasBarePcCount(label)) return true;
  return false;
}

function burritoServingConflicts(label, labelLower) {
  if (labelLooksLikeNuggetOrWing(label)) return true;
  if (labelLooksLikeBread(label)) return true;
  if (/\b(taco|quesadilla)\b/.test(labelLower) && !/\bburrito\b/.test(labelLower)) return true;
  if (/\b\d+\s*slices?\b/.test(labelLower)) return true;
  if (labelHasBarePcCount(label)) return true;
  return false;
}

function bowlOrMexicanServingConflicts(label, labelLower) {
  if (labelLooksLikeNuggetOrWing(label)) return true;
  if (labelLooksLikeBread(label)) return true;
  if (/\b\d+\s*slices?\b/.test(labelLower)) return true;
  if (labelHasBarePcCount(label)) return true;
  return false;
}

function friesServingConflicts(label) {
  if (labelLooksLikeNuggetOrWing(label) || labelLooksLikeBread(label) || labelLooksLikeSandwich(label)) return true;
  if (labelHasBarePcCount(label)) return true;
  return false;
}

function beverageServingConflicts(label, labelLower) {
  if (labelLooksLikeNuggetOrWing(label) || labelLooksLikeBread(label) || labelLooksLikeSandwich(label)) return true;
  if (labelHasBarePcCount(label) || /\bslice\b/.test(labelLower)) return true;
  return false;
}

function conflictForCategory(category, label, labelLower) {
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
  if (labelLooksLikePieceCountJunk(label)) return true;
  return false;
}

function defaultBreadServingLabel(userQuery = '', foodName = '', calories = null) {
  const combined = normalizeSpace(`${userQuery} ${foodName}`).toLowerCase();
  const calorieCount = Number(calories) || 0;
  const isCheeseStick =
    /\bcheese\s*sticks?|cheesesticks?\b/.test(combined) && !/\bbreadsticks?\b/.test(combined);
  const isBreadstick = /\b(crazy\s*bread|breadsticks?|garlic\s+parmesan\s+bread|garlic\s+bread|cheesy\s+bread)\b/.test(
    combined,
  );

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

function nuggetLabelFromQuery(combined) {
  const pieceCount =
    extractCount(combined, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/) ||
    extractCount(combined, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\s*(?:chicken\s*)?nugget/) ||
    extractCount(combined, /\b(\d+)\s*pc\b/) ||
    extractCount(combined, /\b(\d+)pc\b/);
  if (pieceCount) return `${pieceCount} pc nuggets`;
  return 'nuggets (1 serving)';
}

function pizzaLabelFromQuery(combined) {
  if (/\b(whole|entire|full)\s+(pizza)?\b/i.test(combined)) return 'Whole pizza';
  if (/\bhalf\s+(a\s+)?pizza\b/i.test(combined)) return 'Half pizza';
  const slices = extractCount(combined, /\b(\d+)\s*slices?\b/);
  if (slices) return `${slices} slice${slices === '1' ? '' : 's'}`;
  if (/\bslice\b/i.test(combined)) return '1 slice';
  return '1 slice';
}

function wingLabelFromQuery(combined) {
  const pieceCount =
    extractCount(combined, /\b(\d+)\s*wings?\b/) ||
    extractCount(combined, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/);
  if (pieceCount) return `${pieceCount} wings`;
  return 'wings (1 serving)';
}

function tenderLabelFromQuery(combined) {
  const pieceCount = extractCount(combined, /\b(\d+)\s*(?:pc|pcs|piece|pieces|tenders?)\b/);
  if (pieceCount) return `${pieceCount} tenders`;
  return 'tenders (1 serving)';
}

function beverageLabelFromQuery(combined, size) {
  const ounces = extractCount(combined, /\b(\d+)\s*(?:fl\s*)?oz\b/);
  if (ounces) return `${ounces} fl oz`;
  if (/\bfrosty\b/.test(combined)) return size ? titleCaseSize(size) : '1 medium';
  return size ? titleCaseSize(size) : '1 medium';
}

function genericLabelFromQuery(combined, size) {
  if (/\b(frosty|shake|smoothie|latte|mocha|frappuccino|coffee|soda|cola|drink|beverage|lemonade)\b/i.test(combined)) {
    const ounces = extractCount(combined, /\b(\d+)\s*(?:fl\s*)?oz\b/);
    if (ounces) return `${ounces} fl oz`;
    return size ? titleCaseSize(size) : '1 medium';
  }
  if (/\b(chips|crisps|crackers|pretzel|popcorn|snack|doritos|cheetos|lays|pringles)\b/i.test(combined)) {
    return DEFAULT_SERVING_LABEL;
  }
  if (/\b(egg|eggs)\b/i.test(combined)) {
    const eggSize = extractCount(combined, /\b(large|medium|small|extra\s+large)\s+egg/);
    if (eggSize) return `1 ${eggSize} egg`;
    return '1 egg';
  }
  if (/\b(apple|banana|orange|avocado|potato)\b/i.test(combined)) return '1 medium';
  if (/\b(chicken\s+breast|salmon|steak|pork\s+chop)\b/i.test(combined)) return DEFAULT_SERVING_LABEL;
  if (size && /\b(combo|meal)\b/i.test(combined)) return `${titleCaseSize(size)} combo`;
  return null;
}

function labelFromCategory(category, combined, size, userQuery, foodName, calories) {
  if (category === 'bread') return defaultBreadServingLabel(userQuery, foodName, calories);
  if (category === 'nugget') return nuggetLabelFromQuery(combined);
  if (category === 'pizza') return pizzaLabelFromQuery(combined);
  if (category === 'wing') return wingLabelFromQuery(combined);
  if (category === 'tender') return tenderLabelFromQuery(combined);
  if (category === 'burger' || category === 'sandwich') return '1 sandwich';
  if (category === 'bowl') return '1 bowl';
  if (category === 'taco') return '1 taco';
  if (category === 'burrito') return '1 burrito';
  if (category === 'quesadilla') return '1 quesadilla';
  if (category === 'fries') return size ? `${titleCaseSize(size)} fries` : 'Medium fries';
  if (category === 'beverage') return beverageLabelFromQuery(combined, size);
  return genericLabelFromQuery(combined, size);
}

function usableScraperLabel(raw, foodContext) {
  const label = normalizeSpace(raw);
  if (!label || isWeakServingLabel(label)) return null;
  if (servingConflictsWithFood({ ...foodContext, servingLabel: label })) return null;
  return label;
}

function pieceCountLabelFromPageText(category, pageLower) {
  if (category !== 'nugget' && category !== 'wing' && category !== 'tender') return null;
  if (!/\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/i.test(pageLower)) return null;
  const pieceCount = extractCount(pageLower, /\b(\d+)\s*(?:pc|pcs|piece|pieces)\b/);
  if (pieceCount && category === 'nugget' && /\bnugget/i.test(pageLower)) return `${pieceCount} pc nuggets`;
  if (pieceCount && category === 'wing' && /\bwing/i.test(pageLower)) return `${pieceCount} wings`;
  if (pieceCount && category === 'tender' && /\b(tender|strip)/i.test(pageLower)) return `${pieceCount} tenders`;
  return null;
}

function breadLabelFromPageText(pageText, pageLower) {
  if (/\bfull\s+order\b|\bentire\s+order\b/i.test(pageLower)) {
    const stick = pageText.match(/(\d+)\s*sticks?\b/i);
    if (stick) return `Full order (${stick[1]} sticks)`;
    return 'Full order';
  }
  if (/\b(\d+)\s*(?:bread)?sticks?\b/i.test(pageLower) && !/\bnugget|wing/i.test(pageLower)) {
    const stickCount = extractCount(pageLower, /\b(\d+)\s*(?:bread)?sticks?\b/);
    if (stickCount && Number(stickCount) >= 2) return `${stickCount}-piece order`;
  }
  if (/\b1\s+breadstick\b|\bone\s+breadstick\b|\bper\s+breadstick\b/i.test(pageLower)) {
    return '1 breadstick';
  }
  return null;
}

function pizzaLabelFromPageText(pageText, pageLower) {
  if (/\b1\s+slice\b|\bper\s+slice\b|\bone\s+slice\b/i.test(pageLower)) return '1 slice';
  if (/\b(\d+)\s*slices?\b/i.test(pageLower)) {
    const sliceCount = extractCount(pageLower, /\b(\d+)\s*slices?\b/);
    if (sliceCount) return `${sliceCount} slice${sliceCount === '1' ? '' : 's'}`;
  }
  if (/\bwhole\s+pizza\b|\bentire\s+pizza\b/i.test(pageLower)) return 'Whole pizza';
  return null;
}

function collectServingCandidates(opts, foodContext) {
  const candidates = [];
  for (const raw of [opts.scraperLabel, extractServingLabelFromPageText(opts.pageText || '', foodContext)]) {
    const label = usableScraperLabel(raw, foodContext);
    if (label) candidates.push(label);
  }
  const fromStructure = servingLabelFromQueryStructure(
    opts.userQuery,
    foodContext.foodName,
    opts.restaurant,
    opts.calories,
  );
  if (fromStructure) candidates.push(fromStructure);
  return candidates;
}

// ===== MAIN FUNCTION =====

/**
 * Query-first category. Incidental words in scraper titles must not flip family
 * (e.g. "wing" in "buffalo wing pizza" → pizza when query says pizza).
 * @param {string} [userQuery]
 * @param {string} [foodName]
 * @param {string} [restaurant]
 * @returns {string}
 */
function inferFoodServingCategory(userQuery = '', foodName = '', restaurant = '') {
  const queryText = normalizeSpace(userQuery).toLowerCase();
  const name = normalizeSpace(foodName).toLowerCase();
  const place = normalizeSpace(restaurant).toLowerCase();
  const primary = queryText || `${name} ${place}`;
  const combined = normalizeSpace(`${queryText} ${name} ${place}`).toLowerCase();
  if (!combined) return GENERIC_CATEGORY;

  const hasPizza = /\bpizza\b/.test(primary) || (!queryText && /\bpizza\b/.test(combined));
  if (hasPizza) return 'pizza';

  if (primaryOrCombinedHas(primary, combined, /\b(mcnuggets?|mc\s*nuggets?|chicken\s*nuggets?|nuggets?)\b/)) {
    return 'nugget';
  }
  if (primaryOrCombinedHas(primary, combined, /\b(wings?|boneless\s+wings?)\b/)) return 'wing';
  if (primaryOrCombinedHas(primary, combined, /\b(tenders?|chicken\s+fingers?|strips?)\b/)) return 'tender';

  const breadRe =
    /\b(crazy\s*bread|breadsticks?|cheesy\s+bread|garlic\s+(cheese\s+)?bread|cheese\s+bread|cheese\s*sticks?|cheesesticks?|garlic\s+parmesan)\b/;
  const breadWordRe = /\b(breadstick|bread)\b/;
  if (
    breadRe.test(primary) ||
    (!queryText && breadRe.test(combined)) ||
    ((breadWordRe.test(primary) || (!queryText && breadWordRe.test(combined))) &&
      !/\b(pizza|burger|sandwich|nugget|wing|bowl|burrito)\b/.test(combined))
  ) {
    return 'bread';
  }

  if (primaryOrCombinedHas(primary, combined, /\b(burger|cheeseburger|hamburger|whopper|big\s*mac|quarter\s*pounder|baconator|slider)\b/)) {
    return 'burger';
  }
  if (primaryOrCombinedHas(primary, combined, /\b(bowl|salad)\b/)) return 'bowl';
  if (primaryOrCombinedHas(primary, combined, /\b(burrito)\b/)) return 'burrito';
  if (primaryOrCombinedHas(primary, combined, /\b(quesadilla)\b/)) return 'quesadilla';
  if (primaryOrCombinedHas(primary, combined, /\b(taco)\b/)) return 'taco';
  if (primaryOrCombinedHas(primary, combined, /\b(sandwich|wrap|sub|hoagie|panini|melt)\b/)) return 'sandwich';
  if (primaryOrCombinedHas(primary, combined, /\b(fries|fry)\b/)) return 'fries';
  if (primaryOrCombinedHas(primary, combined, /\b(frosty|shake|smoothie|latte|mocha|frappuccino|coffee|soda|cola|coke|drink|beverage|lemonade)\b/)) {
    return 'beverage';
  }
  return GENERIC_CATEGORY;
}

/**
 * Cross-family conflict matrix — hard reject wrong serving language for ANY food family.
 * @param {{ userQuery?: string, foodName?: string, restaurant?: string, servingLabel?: string }} opts
 * @returns {boolean}
 */
function servingConflictsWithFood({ userQuery = '', foodName = '', restaurant = '', servingLabel = '' } = {}) {
  const label = normalizeSpace(servingLabel);
  if (!label || isWeakServingLabel(label)) return false;
  const category = inferFoodServingCategory(userQuery, foodName, restaurant);
  return conflictForCategory(category, label, label.toLowerCase());
}

/** High-cal bread/breadstick macros sold as a single stick/piece → treat as multi/order. */
function looksLikeMultiBreadOrder(calories, label, category) {
  if (category !== 'bread') return false;
  const calorieCount = Number(calories) || 0;
  if (calorieCount < MULTI_BREAD_CALORIES_MIN) return false;
  const labelText = normalizeSpace(label).toLowerCase();
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
  const combined = normalizeSpace(`${userQuery} ${foodName} ${restaurant}`).toLowerCase();
  if (!combined || combined.length < 2) return null;
  const size = extractCount(combined, /\b(small|medium|large|grande|venti|tall|regular)\b/);
  const category = inferFoodServingCategory(userQuery, foodName, restaurant);
  return labelFromCategory(category, combined, size, userQuery, foodName, calories);
}

/** Pull serving language from scraper page text when present. */
function extractServingLabelFromPageText(text, foodContext = {}) {
  const pageText = normalizeSpace(String(text || '').replace(/\u00a0/g, ' '));
  if (pageText.length < MIN_PAGE_TEXT_LENGTH) return null;
  const pageLower = pageText.toLowerCase();
  const category = inferFoodServingCategory(
    foodContext.userQuery,
    foodContext.foodName,
    foodContext.restaurant,
  );

  const servingSizeMatch = pageText.match(/serving\s+size[:\s]+([^\n.;]{3,90})/i);
  const servingSizeLabel = servingSizeMatch ? usableScraperLabel(servingSizeMatch[1], foodContext) : null;
  if (servingSizeLabel) return servingSizeLabel;

  const perMatch = pageText.match(/there are\s+[^.]{0,40}?\bper\s+([^.(]{3,60})/i);
  if (perMatch && !isWeakServingLabel(perMatch[1])) {
    const line = normalizeSpace(perMatch[1]);
    if (!servingConflictsWithFood({ ...foodContext, servingLabel: line })) return line;
  }

  const pieceLabel = pieceCountLabelFromPageText(category, pageLower);
  if (pieceLabel) return pieceLabel;
  if (category === 'bread') return breadLabelFromPageText(pageText, pageLower);
  if (category === 'pizza' || /\bpizza/i.test(pageLower)) return pizzaLabelFromPageText(pageText, pageLower);
  return null;
}

function finalizeServingLabel(label, { userQuery, foodName, restaurant, calories } = {}) {
  let out = normalizeSpace(label);
  const category = inferFoodServingCategory(userQuery, foodName, restaurant);

  if (!out || isWeakServingLabel(out) || servingConflictsWithFood({ userQuery, foodName, restaurant, servingLabel: out })) {
    out = servingLabelFromQueryStructure(userQuery, foodName, restaurant, calories) || DEFAULT_SERVING_LABEL;
  }

  if (looksLikeMultiBreadOrder(calories, out, category)) {
    return {
      label: 'Full order (multi-serving)',
      nutrition_unverified: true,
      multiServingFallback: true,
    };
  }

  return { label: out, nutrition_unverified: false, multiServingFallback: false };
}

/**
 * Best serving label for a search row — scraper only when it matches food type, else structure.
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
  calories = null,
} = {}) {
  const name = foodName || displayName;
  const foodContext = { userQuery, foodName: name, restaurant };
  const candidates = collectServingCandidates(
    { scraperLabel, pageText, userQuery, restaurant, calories },
    foodContext,
  );
  const finalized = finalizeServingLabel(candidates[0] || DEFAULT_SERVING_LABEL, {
    userQuery,
    foodName: name,
    restaurant,
    calories,
  });
  return finalized.label;
}

/** Same as resolveFoodServingLabel but also returns multi/unverified flags for presentation. */
function resolveFoodServingLabelDetailed(opts = {}) {
  const name = opts.foodName || opts.displayName || '';
  const foodContext = {
    userQuery: opts.userQuery || '',
    foodName: name,
    restaurant: opts.restaurant || '',
  };
  const candidates = collectServingCandidates(opts, foodContext);
  return finalizeServingLabel(candidates[0] || DEFAULT_SERVING_LABEL, {
    ...foodContext,
    calories: opts.calories,
  });
}

/** UI line under the food title on search cards — single authority for display. */
function formatServingDisplayLine(item, userQuery = '') {
  const foodName = item?.food_name || item?.name;
  const restaurant = item?.restaurant || item?.brand_name || item?.brand;
  const calories = item?.nf_calories ?? item?.calories;
  const existing = normalizeSpace(
    item?.serving_label || item?.servingLabel || item?.portion_text || '',
  );
  if (
    existing &&
    !isWeakServingLabel(existing) &&
    !servingConflictsWithFood({ userQuery, foodName, restaurant, servingLabel: existing })
  ) {
    return finalizeServingLabel(existing, { userQuery, foodName, restaurant, calories }).label;
  }

  const resolved = resolveFoodServingLabel({
    userQuery,
    foodName,
    restaurant,
    scraperLabel: item?.serving_label || item?.servingLabel || item?.portion_text,
    pageText: item?.metadata?.sourceResult?.url || '',
    calories,
  });
  if (resolved && !isWeakServingLabel(resolved)) return resolved;

  const unit = normalizeSpace(item?.serving_unit || item?.servingUnit || '');
  if (
    unit &&
    !isWeakServingLabel(unit) &&
    !/^(grams?|g|ml)$/i.test(unit) &&
    !servingConflictsWithFood({ userQuery, foodName, restaurant, servingLabel: unit })
  ) {
    const qty = item?.serving_size ?? item?.serving_qty ?? 1;
    return qty > 1 ? `${qty} ${unit}` : unit;
  }

  if (item?.source === 'serper' || item?.source === 'mixed') {
    return SERPER_ESTIMATED_SERVING;
  }

  return resolved || DEFAULT_SERVING_LABEL;
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
  looksLikeMultiBreadOrder,
};
