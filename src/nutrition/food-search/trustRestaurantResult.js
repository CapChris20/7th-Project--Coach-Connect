// Decides whether a restaurant web-search card is trustworthy enough to show.
// Flow: filter usable rows → drop ingredient rows → prefer one serving → rank for display.
// Used by server search helpers and food ranking. CommonJS so food tests can require() it.
// Read order: constants → helpers → main rank recipe → PLUMBING score / macro gates.

const {
  significantQueryTokens,
  countTokenHits,
  hasUnrequestedFoodFamilyMismatch,
  rowNameBrandText
} = require('../food-search/rankFoodResults');
const {
  servingConflictsWithFood,
  inferFoodServingCategory
} = require('../food-search/guessServingLabel');

// ===== NAMED CONSTANTS =====

const AUTHORITY_SOURCE_RE = /fatsecret|eatthismuch|myfooddiary|calorieking|sparkpeople|verywell\s*fit|nutritionix|menu\s+with\s+nutrition|nutrition\s+facts|calories\s+in\s+/i;
const TRUSTED_DB_SOURCES = new Set(['fatsecret', 'fatSecret', 'usda', 'usdafdc', 'usdaFdc', 'openfoodfacts', 'openFoodFacts', 'calorieking', 'calorieKing', 'fastfoodnutrition', 'fastFoodNutrition', 'foodfacto', 'foodFacto', 'trusted_catalog']);
const WEAK_WEB_SOURCES = new Set(['serper', 'mixed', 'web']);
const NOISE_SOURCE_RE = /reddit|tiktok|pinterest|instagram|homemade|copycat|diy\b|blog\b|permanent\s+rotation|just\s+earned|knockoff|meal\s+prep\s+idea|menu\s*items?|breadmenu|gs1|tracker/i;
const COMBO_MEAL_RE = /\b(combo\b|value meal|kids meal|happy meal|meal\b.*\b(fries|drink)|with fries|with drink|includes fries|includes drink)\b/i;
const SKINNY_LIGHT_RE = /\b(skinny|nonfat|non-fat|sugar free|sugar-free|light\b(?!\s*mayo)|diet\b)\b/i;
const WITH_CHEESE_RE = /\bwith cheese\b/i;
const DISTINGUISHING_TOKENS = new Set(['max', 'deluxe', 'spicy', 'baconator', 'double', 'impossible', 'blackened', 'ultimate', 'original', 'classic', 'grande', 'large', 'medium', 'small']);
const MIN_MACRO_CONSISTENCY_TO_USE = 50;
const RELAXED_MACRO_CONSISTENCY = 40;
const MAX_PLAUSIBLE_CALORIES = 3500;
const RICH_FOOD_MIN_CALORIES = 150;
const ZERO_PROTEIN_CALORIES = 250;
const SUSPECT_MACRO_CALORIES = 400;
const EMPTY_CARB_PROTEIN_CALORIES = 300;
const LOW_CAL_DRINK_MAX = 80;
const MULTI_SERVING_MAX = 16;
const FALLBACK_ROW_CAP = 8;
const UNVERIFIED_CONSISTENCY = 65;
const KCAL_PER_PROTEIN_OR_CARB = 4;
const KCAL_PER_FAT = 9;
const NUGGET_10_COMBO_CALORIES = 650;
const NUGGET_10_TYPICAL_MIN = 350;
const NUGGET_10_TYPICAL_MAX = 520;
const WHOPPER_TYPICAL_MIN = 620;
const WHOPPER_TYPICAL_MAX = 720;
const WHOPPER_HEAVY_CALORIES = 760;
const BACONATOR_TYPICAL_MIN = 880;
const BACONATOR_TYPICAL_MAX = 950;
const STARBUCKS_TYPICAL_MIN = 180;
const STARBUCKS_TYPICAL_MAX = 350;
const BLIZZARD_TYPICAL_MIN = 720;
const BLIZZARD_TYPICAL_MAX = 900;
const BLIZZARD_HEAVY_CALORIES = 980;
const ORANGE_CHICKEN_TYPICAL_MIN = 430;
const ORANGE_CHICKEN_TYPICAL_MAX = 540;
const ORANGE_CHICKEN_HEAVY_CALORIES = 600;
const SERVING_CONFLICT_PENALTY = 400;
const HIGH_CAL_MACRO_RATIO = 1.55;
const TINY_MACRO_CALORIES = 15;
const MIN_CALORIES_NEEDING_MACROS = 80;
const MIN_CALORIES_NEEDING_CONSISTENCY = 120;
const MIN_MACROS_WHEN_CALORIES = 20;
const MIN_CALORIES_FOR_CONSISTENCY_SCORE = 25;
const MIN_MACRO_CALS_FOR_CONSISTENCY_SCORE = 12;
const CONSISTENCY_RATIO_PERFECT_LOW = 0.58;
const CONSISTENCY_RATIO_PERFECT_HIGH = 1.12;
const CONSISTENCY_RATIO_GOOD_LOW = 0.42;
const CONSISTENCY_RATIO_GOOD_HIGH = 1.3;
const CONSISTENCY_RATIO_OK_LOW = 0.3;
const CONSISTENCY_RATIO_OK_HIGH = 1.45;
const CONSISTENCY_SCORE_PERFECT = 100;
const CONSISTENCY_SCORE_GOOD = 65;
const CONSISTENCY_SCORE_OK = 30;
const CONSISTENCY_SCORE_WEAK = 5;
const ORGANIC_HIT_NEED_FOUR_RATIO = 0.5;
const ORGANIC_HIT_NEED_FOUR_FLOOR = 2;
const ORGANIC_HIT_NEED_TWO = 2;
const ORGANIC_HIT_NEED_ONE = 1;
const PIKE_PLACE_MAX_CALORIES = 25;
const SIZE_MODIFIER_WORDS = ['large', 'small', 'medium', 'regular', 'mini', 'grande', 'venti', 'tall', 'personal', 'family'];
const FULL_ITEM_MENU_QUERY_RE = /\b(burger|cheeseburger|hamburger|sandwich|burrito|pizza|sub\b|hoagie|wrap|quesadilla|taco|bowl|footlong|panini)\b/i;
const MULTI_SERVING_PATTERNS = [{
  pattern: /\b([2-9])\s*slices?\b/i,
  readMultiplier: match => parseInt(match[1], 10)
}, {
  pattern: /\b([2-9])\s*pieces?\b/i,
  readMultiplier: match => parseInt(match[1], 10)
}, {
  pattern: /\b([2-9])\s*pcs?\b/i,
  readMultiplier: match => parseInt(match[1], 10)
}, {
  pattern: /\b([2-9])\s*pack\b/i,
  readMultiplier: match => parseInt(match[1], 10)
}, {
  pattern: /\b([2-9])\s*count\b/i,
  readMultiplier: match => parseInt(match[1], 10)
}, {
  pattern: /(?:¼|1\/4)\s*pizza/i,
  readMultiplier: () => 4
}, {
  pattern: /(?:½|1\/2)\s*pizza/i,
  readMultiplier: () => 2
}, {
  pattern: /(?:⅓|1\/3)\s*pizza/i,
  readMultiplier: () => 3
}];

// ===== HELPER FUNCTIONS =====

function escapeRegExp(textToEscape) {
  return String(textToEscape).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function macroCalories(proteinGrams, carbGrams, fatGrams) {
  return KCAL_PER_PROTEIN_OR_CARB * (Number(proteinGrams) || 0) + KCAL_PER_PROTEIN_OR_CARB * (Number(carbGrams) || 0) + KCAL_PER_FAT * (Number(fatGrams) || 0);
}
function getRowMacros(row) {
  return {
    // vocab/symbol: ?? keeps 0 calories; || would treat 0 as missing
    calories: Number((row == null ? void 0 : row.nf_calories) ?? (row == null ? void 0 : row.calories)) || 0,
    protein: Number((row == null ? void 0 : row.nf_protein) ?? (row == null ? void 0 : row.protein)) || 0,
    carbs: Number((row == null ? void 0 : row.nf_total_carbohydrate) ?? (row == null ? void 0 : row.carbs)) || 0,
    fat: Number((row == null ? void 0 : row.nf_total_fat) ?? (row == null ? void 0 : row.fat)) || 0
  };
}
function getRowText(row) {
  return `${(row == null ? void 0 : row.food_name) || (row == null ? void 0 : row.name) || ''} ${(row == null ? void 0 : row.brand_name) || (row == null ? void 0 : row.brand) || ''} ${(row == null ? void 0 : row.serving_label) || (row == null ? void 0 : row.serving_unit) || ''}`;
}
function querySizeModifiers(query) {
  const queryLower = String(query || '').toLowerCase();
  const matchedSizes = [];
  for (const sizeWord of SIZE_MODIFIER_WORDS) {
    const sizePattern = new RegExp(`\\b${escapeRegExp(sizeWord)}\\b`, 'i');
    if (sizePattern.test(queryLower)) matchedSizes.push(sizeWord);
  }
  return matchedSizes;
}
function queryWantsPattern(query, pattern) {
  return pattern.test(String(query || '').toLowerCase());
}
function isLowCalBeverageRow(macros, userQuery, rowText) {
  const calories = Number(macros == null ? void 0 : macros.calories) || 0;
  if (calories <= 0 || calories > LOW_CAL_DRINK_MAX) return false;
  const combinedQueryAndRowText = `${userQuery} ${rowText}`.toLowerCase();
  return /\b(coffee|tea|espresso|americano|pike|cold brew|diet|zero)\b/.test(combinedQueryAndRowText);
}
function isRetailCoffeeProduct(row, userQuery) {
  const rowText = getRowText(row).toLowerCase();
  const queryLower = String(userQuery || '').toLowerCase();
  if (!/\bstarbucks\b/.test(queryLower)) return false;
  if (!/\b(grande|venti|tall|iced|latte|macchiato|mocha|coffee|pike)\b/.test(queryLower)) {
    return false;
  }
  return /\b(keurig|k-cup|k cup|ground coffee|whole bean|bagged|pods|pack of|roast ground)\b/.test(rowText);
}
function isArticleNutritionRoundup(row) {
  const rowText = getRowText(row).toLowerCase();
  return /\b(lineup|breakdown|full nutrition|all menu|complete guide|every item)\b/.test(rowText);
}
function expectsRichMacros(userQuery, rowText) {
  const combinedQueryAndRowText = `${userQuery} ${rowText}`.toLowerCase();
  return /\b(burger|cheeseburger|hamburger|sandwich|whopper|big mac|quarter pounder|pizza|slice|pepperoni|nugget|tender|wing|burrito|bowl|sub\b|biscuit|baconator|frosty|blizzard|orange chicken|crazy bread|breadstick|garlic bread|cheesy bread|roast beef|patty|footlong|quesadilla|mac and cheese|fried rice|lo mein|chicken|turkey|beef|steak|pork|salmon|shrimp|fish|meatball|sausage|bacon)\b/.test(combinedQueryAndRowText);
}
function firstMatchingMultiServing(rowText) {
  for (const entry of MULTI_SERVING_PATTERNS) {
    const match = rowText.match(entry.pattern);
    if (!match) continue;
    const multiplier = entry.readMultiplier(match);
    if (multiplier >= 2 && multiplier <= MULTI_SERVING_MAX) {
      return {
        isMulti: true,
        multiplier
      };
    }
  }
  return {
    isMulti: false,
    multiplier: 1
  };
}
function getMultiServingInfo(row) {
  return firstMatchingMultiServing(getRowText(row).toLowerCase());
}
function partitionSingleVsMultiServing(rows) {
  const singles = [];
  const multis = [];
  for (const row of rows || []) {
    if (getMultiServingInfo(row).isMulti) {
      multis.push(row);
    } else {
      singles.push(row);
    }
  }
  return {
    singles,
    multis
  };
}
function organicHitNeed(tokens) {
  if (tokens.length >= 4) {
    return Math.max(ORGANIC_HIT_NEED_FOUR_FLOOR, Math.ceil(tokens.length * ORGANIC_HIT_NEED_FOUR_RATIO));
  }
  if (tokens.length >= 2) return ORGANIC_HIT_NEED_TWO;
  return ORGANIC_HIT_NEED_ONE;
}
function unaskedSizePenalty(sizeWord) {
  if (sizeWord === 'large' || sizeWord === 'grande' || sizeWord === 'venti') return -28;
  if (sizeWord === 'small' || sizeWord === 'mini') return -12;
  return 0;
}
function scoreOneSizeWord(rowText, sizeWord, sizesWanted) {
  const sizePattern = new RegExp(`\\b${escapeRegExp(sizeWord)}\\b`, 'i');
  const hasSize = sizePattern.test(rowText);
  if (sizesWanted.includes(sizeWord)) {
    if (hasSize) {
      return 18;
    }
    return 0;
  }
  if (!hasSize) return 0;
  return unaskedSizePenalty(sizeWord);
}
function singleSliceBonus(rowText) {
  if (/\b1\s*slice\b|\bone\s*slice\b|\bper\s*slice\b/i.test(rowText)) return 28;
  if (/\bslice\b/i.test(rowText) && !/\b[2-9]\s*slice/i.test(rowText)) return 12;
  return 0;
}

// ===== MAIN FUNCTION =====

/**
 * Keep Serper rows that pass macro consistency and serving gates.
 * @param {object[]} rows
 * @param {string} userQuery
 * @returns {object[]}
 */
function filterUsableSerperRows(rows, userQuery) {
  const list = Array.isArray(rows) ? rows : [];
  const keptRows = [];
  for (const row of list) {
    if (!rowFailsUsableFilter(row, userQuery)) {
      keptRows.push(row);
    }
  }
  return keptRows;
}

/**
 * Sort restaurant Serper rows for display — strict pool first, relaxed fallback second.
 * @param {object[]} rows
 * @param {string} userQuery
 * @returns {object[]}
 */
function rankSerperFoodResultRows(rows, userQuery) {
  const list = Array.isArray(rows) ? rows : [];

  // 1. Keep rows that pass macro consistency and serving gates.
  let strictRows = filterUsableSerperRows(list, userQuery);
  strictRows = filterComponentIngredientRows(strictRows, userQuery);
  if (strictRows.length > 0) {
    const {
      pool,
      applyMultiAdjust
    } = buildPool(strictRows);
    return rankList(pool, false, applyMultiAdjust, userQuery);
  }

  // 2. No strict hits — best-effort rows with a relaxed macro floor.
  const relaxedRows = collectRelaxedUsableRows(list, userQuery);
  if (relaxedRows.length > 0) {
    console.warn('[Food Search] Serper rows below consistency threshold — returning best-effort unverified:', userQuery);
    const {
      pool,
      applyMultiAdjust
    } = buildPool(relaxedRows);
    const cappedPool = pool.slice(0, FALLBACK_ROW_CAP);
    return rankList(cappedPool, true, applyMultiAdjust, userQuery);
  }

  // 3. Nothing usable.
  return [];
}

// ===== PLUMBING — skip unless debugging =====

function collectRelaxedUsableRows(list, userQuery) {
  const relaxedRows = [];
  for (const row of list) {
    if (isRetailCoffeeProduct(row, userQuery)) continue;
    const macros = getRowMacros(row);
    const caloriesPositive = macros.calories > 0;
    const plausibleRelaxed = isPlausibleRestaurantNutritionRow(macros, {
      relaxed: true
    });
    if (caloriesPositive && plausibleRelaxed) {
      relaxedRows.push(row);
    }
  }
  return filterComponentIngredientRows(relaxedRows, userQuery);
}
function comboAndNuggetScore(rowText, queryLower, macros) {
  let score = 0;
  if (COMBO_MEAL_RE.test(rowText)) score -= 95;
  if (/\bmeal\b/i.test(rowText) && !/\bmeal\b/i.test(queryLower)) score -= 70;
  const wantsTenNuggets = /\b10\s*(piece|pc|pcs)\b/i.test(queryLower) && /\bnugget/i.test(queryLower);
  if (!wantsTenNuggets) return score;
  if (macros.calories > NUGGET_10_COMBO_CALORIES) score -= 75;
  if (macros.calories >= NUGGET_10_TYPICAL_MIN && macros.calories <= NUGGET_10_TYPICAL_MAX) {
    score += 45;
  }
  if (/\bnugget/i.test(rowText) && !COMBO_MEAL_RE.test(rowText)) score += 25;
  return score;
}
function burgerChainScore(rowText, queryLower, macros) {
  let score = 0;
  const wantsPlainWhopper = /\bwhopper\b/i.test(queryLower) && !/\bcheese\b/i.test(queryLower) && !/\bimpossible\b/i.test(queryLower);
  if (wantsPlainWhopper) {
    if (WITH_CHEESE_RE.test(rowText)) score -= 65;
    const inWhopperBand = macros.calories >= WHOPPER_TYPICAL_MIN && macros.calories <= WHOPPER_TYPICAL_MAX && !WITH_CHEESE_RE.test(rowText);
    if (inWhopperBand) score += 45;
    if (macros.calories >= WHOPPER_HEAVY_CALORIES) score -= 35;
  }
  const wantsBaconator = /\bbaconator\b/i.test(queryLower) && !/\btriple\b/i.test(queryLower);
  if (wantsBaconator) {
    const inBaconatorBand = macros.calories >= BACONATOR_TYPICAL_MIN && macros.calories <= BACONATOR_TYPICAL_MAX && !/\btriple\b/i.test(rowText);
    if (inBaconatorBand) score += 40;
  }
  return score;
}
function drinkChainScore(rowText, queryLower, macros) {
  let score = 0;
  const wantsStarbucksDrink = /\bstarbucks\b/i.test(queryLower) && /\b(macchiato|latte|mocha|frappuccino|coffee|pike)\b/i.test(queryLower);
  if (wantsStarbucksDrink) {
    if (SKINNY_LIGHT_RE.test(rowText) && !queryWantsPattern(queryLower, SKINNY_LIGHT_RE)) {
      score -= 80;
    }
    const inStarbucksBand = !SKINNY_LIGHT_RE.test(rowText) && macros.calories >= STARBUCKS_TYPICAL_MIN && macros.calories <= STARBUCKS_TYPICAL_MAX;
    if (inStarbucksBand) score += 28;
    if (/\bkeurig\b|\bk-cup\b|\bground\b/i.test(rowText)) score -= 90;
    const pikeNearZero = /\bpike\b/i.test(queryLower) && /\bnutrition\b/i.test(rowText) && macros.calories > 0 && macros.calories <= PIKE_PLACE_MAX_CALORIES;
    if (pikeNearZero) score += 50;
  }
  const wantsBlizzard = /\b(dairy queen|dq)\b/i.test(queryLower) && /\bblizzard\b/i.test(queryLower);
  if (wantsBlizzard) {
    if (/\blarge\b/i.test(rowText) && !/\blarge\b/i.test(queryLower)) score -= 50;
    if (/\bmedium\b/i.test(rowText) && !/\b(small|large|mini)\b/i.test(queryLower)) {
      score += 35;
    }
    if (macros.calories >= BLIZZARD_TYPICAL_MIN && macros.calories <= BLIZZARD_TYPICAL_MAX) {
      score += 20;
    }
    if (macros.calories > BLIZZARD_HEAVY_CALORIES) score -= 35;
  }
  return score;
}
function orangeChickenScore(rowText, queryLower, macros) {
  if (!(/\bpanda\b/i.test(queryLower) && /\borange chicken\b/i.test(queryLower))) {
    return 0;
  }
  let score = 0;
  if (COMBO_MEAL_RE.test(rowText) || /\bplate\b|\bcombo\b|\bmeal\b/i.test(rowText)) {
    score -= 55;
  }
  const inOrangeBand = macros.calories >= ORANGE_CHICKEN_TYPICAL_MIN && macros.calories <= ORANGE_CHICKEN_TYPICAL_MAX && !COMBO_MEAL_RE.test(rowText);
  if (inOrangeBand) score += 22;
  if (macros.calories > ORANGE_CHICKEN_HEAVY_CALORIES) score -= 20;
  return score;
}
function sizeModifierScore(rowText, userQuery) {
  let score = 0;
  const sizesWanted = querySizeModifiers(userQuery);
  for (const sizeWord of SIZE_MODIFIER_WORDS) {
    score += scoreOneSizeWord(rowText, sizeWord, sizesWanted);
  }
  if (sizesWanted.length === 0 && /\b(medium|regular|grande)\b/i.test(rowText)) {
    score += 10;
  }
  return score;
}
function distinguishingTokenScore(rowText, userQuery) {
  let score = 0;
  const tokens = significantQueryTokens(userQuery);
  for (const token of tokens) {
    if (!DISTINGUISHING_TOKENS.has(token)) continue;
    const tokenPattern = new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i');
    if (tokenPattern.test(rowText)) score += 38;else score -= 30;
  }
  return score;
}
function sourceAndFamilyScore(row, userQuery, rowText, macros) {
  let score = 0;
  const servingLabel = row.serving_label || row.serving_unit || '';
  if (servingConflictsWithFood({
    userQuery,
    foodName: row.food_name || row.name,
    restaurant: row.brand_name || row.brand || row.restaurant,
    servingLabel
  })) {
    score -= SERVING_CONFLICT_PENALTY;
  }
  if (hasImplausibleZeroMacros(macros, userQuery, rowText)) score -= 120;
  const sourceLower = String(row.source || '').toLowerCase();
  if (sourceLower === 'nutrition_consensus') score += 70;else if (TRUSTED_DB_SOURCES.has(row.source) || TRUSTED_DB_SOURCES.has(sourceLower)) {
    score += 55;
  }
  if (WEAK_WEB_SOURCES.has(sourceLower) || WEAK_WEB_SOURCES.has(row.source)) {
    score -= 25;
  }
  const queryCategory = inferFoodServingCategory(userQuery, '', '');
  const rowCategory = inferFoodServingCategory('', rowText, '');
  if (queryCategory !== 'generic' && rowCategory !== 'generic' && queryCategory !== rowCategory) {
    score -= 85;
  }
  if (hasUnrequestedFoodFamilyMismatch(rowNameBrandText(row), userQuery)) {
    score -= 200;
  }
  return score;
}
function sliceVersusMultiScore(row) {
  if (getMultiServingInfo(row).isMulti) return -90;
  return singleSliceBonus(getRowText(row).toLowerCase());
}
function compareRankedRows(left, right) {
  if (right._sort !== left._sort) return right._sort - left._sort;
  const leftName = String(left.row.food_name || left.row.name || '').toLowerCase();
  const rightName = String(right.row.food_name || right.row.name || '').toLowerCase();
  if (leftName !== rightName) return leftName.localeCompare(rightName);
  return getRowMacros(left.row).calories - getRowMacros(right.row).calories;
}
function brandTokenBonus(row, userQuery) {
  const tokens = significantQueryTokens(userQuery);
  if (tokens.length < 2) return 0;
  const rowText = getRowText(row).toLowerCase();
  const brandishTokens = tokens.slice(0, Math.min(2, tokens.length));
  let bonus = 0;
  for (const token of brandishTokens) {
    if (rowText.includes(token.replace(/-/g, ' ')) || rowText.includes(token)) {
      bonus += 14;
    }
  }
  return bonus;
}
function rowFailsUsableFilter(row, userQuery) {
  if (isRetailCoffeeProduct(row, userQuery)) return true;
  const macros = getRowMacros(row);
  const rowText = getRowText(row);
  if (servingConflictsWithFood({
    userQuery,
    foodName: row.food_name || row.name,
    restaurant: row.brand_name || row.brand || row.restaurant,
    servingLabel: row.serving_label || row.serving_unit || ''
  })) {
    return true;
  }
  if (hasUnrequestedFoodFamilyMismatch(rowNameBrandText(row), userQuery)) return true;
  if (isLowCalBeverageRow(macros, userQuery, rowText)) return false;
  if (macroCalorieConsistencyScore(macros) < MIN_MACRO_CONSISTENCY_TO_USE) return true;
  if (!isPlausibleRestaurantNutritionRow(macros)) return true;
  if (hasImplausibleZeroMacros(macros, userQuery, getRowText(row))) return true;
  return false;
}
function buildPool(candidates) {
  const {
    singles,
    multis
  } = partitionSingleVsMultiServing(candidates);
  const onlyMultiServings = singles.length === 0 && multis.length > 0;
  let pool = candidates;
  if (singles.length > 0) {
    pool = singles;
  } else if (onlyMultiServings) {
    pool = multis;
  }
  return {
    pool,
    applyMultiAdjust: onlyMultiServings
  };
}
function markRankedRow(row, consistency, unverifiedDefault, applyMultiAdjust, userQuery) {
  let rowAfterMultiAdjust = row;
  if (applyMultiAdjust && getMultiServingInfo(row).isMulti) {
    rowAfterMultiAdjust = applyMultiServingFallback(row);
  }
  const {
    _organicScore,
    ...rest
  } = rowAfterMultiAdjust;
  const macros = getRowMacros(rowAfterMultiAdjust);
  const rowText = getRowText(rowAfterMultiAdjust);
  const lowCalDrink = isLowCalBeverageRow(macros, userQuery, rowText);
  const markedUnverified = unverifiedDefault || Boolean(rowAfterMultiAdjust.multiServingFallback) || !lowCalDrink && consistency < UNVERIFIED_CONSISTENCY || Boolean(row.nutrition_unverified);
  return {
    ...rest,
    nutrition_unverified: markedUnverified
  };
}
function rankList(candidates, unverifiedDefault, applyMultiAdjust, userQuery) {
  const scoredRows = [];
  for (const row of candidates) {
    scoredRows.push({
      row,
      _sort: scoreSerperFoodResultRow(row, userQuery),
      _consistency: macroCalorieConsistencyScore(getRowMacros(row))
    });
  }
  scoredRows.sort(compareRankedRows);
  const rankedRows = [];
  for (const {
    row,
    _consistency
  } of scoredRows) {
    rankedRows.push(markRankedRow(row, _consistency, unverifiedDefault, applyMultiAdjust, userQuery));
  }
  return rankedRows;
}

/** Sub-component / ingredient rows (internally consistent but not the full menu item). */
function isComponentIngredientRow(row, userQuery) {
  const rowText = getRowText(row).toLowerCase();
  if (/\bproteins\s/.test(rowText) || /^proteins\s/i.test(rowText)) return true;
  if (rowText.includes('sub components')) return true;
  if (rowText.includes('meats protein')) return true;
  if (/\b(patty|bun|sauce|cheese|meat|protein)\s+only\b/.test(rowText)) return true;
  if (/\badd[\s-]?on\b/.test(rowText)) return true;
  if (rowText.includes('ingredient')) return true;
  if (FULL_ITEM_MENU_QUERY_RE.test(String(userQuery || '')) && rowText.includes('toppings')) {
    return true;
  }
  return false;
}
function filterComponentIngredientRows(rows, userQuery) {
  const list = Array.isArray(rows) ? rows : [];
  const filtered = [];
  for (const row of list) {
    if (!isComponentIngredientRow(row, userQuery)) {
      filtered.push(row);
    }
  }
  if (filtered.length > 0) return filtered;
  return list;
}
function applyMultiServingFallback(row) {
  const {
    isMulti,
    multiplier
  } = getMultiServingInfo(row);
  if (!isMulti || multiplier <= 1) return row;
  const macros = getRowMacros(row);
  const perServingLabel = row.serving_label || row.serving_unit || '';
  let estimatedLabel;
  if (perServingLabel) {
    estimatedLabel = `~1 serving (from ${multiplier}× ${perServingLabel})`;
  } else {
    estimatedLabel = `~1 serving (est. from ${multiplier}× portion)`;
  }
  return {
    ...row,
    nf_calories: Math.round(macros.calories / multiplier),
    calories: Math.round(macros.calories / multiplier),
    nf_protein: Math.round(macros.protein / multiplier),
    protein: Math.round(macros.protein / multiplier),
    nf_total_carbohydrate: Math.round(macros.carbs / multiplier),
    carbs: Math.round(macros.carbs / multiplier),
    nf_total_fat: Math.round(macros.fat / multiplier),
    fat: Math.round(macros.fat / multiplier),
    serving_label: estimatedLabel,
    multiServingFallback: true,
    servingMultiplier: multiplier,
    nutrition_unverified: true
  };
}
function isPlausibleRestaurantNutritionRow(macros, {
  relaxed = false
} = {}) {
  const calories = Number(macros == null ? void 0 : macros.calories) || 0;
  const protein = Number(macros == null ? void 0 : macros.protein) || 0;
  const carbs = Number(macros == null ? void 0 : macros.carbs) || 0;
  const fat = Number(macros == null ? void 0 : macros.fat) || 0;
  if (calories <= 0 || calories > MAX_PLAUSIBLE_CALORIES) return false;
  const fromMacros = macroCalories(protein, carbs, fat);
  const consistency = macroCalorieConsistencyScore(macros);
  let minConsistency;
  if (relaxed) {
    minConsistency = RELAXED_MACRO_CONSISTENCY;
  } else {
    minConsistency = MIN_MACRO_CONSISTENCY_TO_USE;
  }
  if (protein === 0 && carbs === 0 && fat === 0 && calories > 0) return false;
  if (fromMacros > 40 && calories > 0 && fromMacros / calories > HIGH_CAL_MACRO_RATIO) {
    return false;
  }
  if (fromMacros < TINY_MACRO_CALORIES) {
    if (calories >= MIN_CALORIES_NEEDING_MACROS) return false;
    return protein > 0 || carbs > 0 || fat > 0;
  }
  if (calories >= MIN_CALORIES_NEEDING_CONSISTENCY && consistency < minConsistency) {
    return false;
  }
  if (calories >= MIN_CALORIES_NEEDING_MACROS && fromMacros < MIN_MACROS_WHEN_CALORIES) {
    return false;
  }
  return true;
}
function hasImplausibleZeroMacros(macros, userQuery, rowText) {
  const calories = Number(macros == null ? void 0 : macros.calories) || 0;
  const protein = Number(macros == null ? void 0 : macros.protein) || 0;
  const carbs = Number(macros == null ? void 0 : macros.carbs) || 0;
  const fat = Number(macros == null ? void 0 : macros.fat) || 0;
  if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return true;
  if (calories < RICH_FOOD_MIN_CALORIES) return false;
  if (!expectsRichMacros(userQuery, rowText)) return false;
  if (calories >= ZERO_PROTEIN_CALORIES && protein === 0) return true;
  if (calories >= SUSPECT_MACRO_CALORIES && protein < 5 && carbs < 5 && fat > 0) {
    return true;
  }
  if (calories >= EMPTY_CARB_PROTEIN_CALORIES && protein === 0 && carbs === 0) {
    return true;
  }
  return false;
}
function mediumSizePreferenceScore(rowText, queryLower) {
  if (!/\bmedium\b/i.test(queryLower)) return 0;
  let score = 0;
  if (/\bmedium\b/i.test(rowText)) score += 55;
  if (/\bsmall\b/i.test(rowText) && !/\bmedium\b/i.test(rowText)) score -= 70;
  if (/\blarge\b/i.test(rowText)) score -= 45;
  return score;
}
function variantPreferenceScore(row, userQuery) {
  const rowText = getRowText(row).toLowerCase();
  const queryLower = String(userQuery || '').toLowerCase();
  const macros = getRowMacros(row);
  let score = 0;
  score += comboAndNuggetScore(rowText, queryLower, macros);
  score += burgerChainScore(rowText, queryLower, macros);
  score += drinkChainScore(rowText, queryLower, macros);
  score += orangeChickenScore(rowText, queryLower, macros);
  score += sizeModifierScore(rowText, userQuery);
  score += distinguishingTokenScore(rowText, userQuery);
  if (/\btriple\b/i.test(rowText) && !/\btriple\b/i.test(queryLower)) score -= 55;
  if (/\bdouble\b/i.test(rowText) && !/\bdouble\b/i.test(queryLower) && /\bbaconator\b/i.test(queryLower)) {
    score -= 40;
  }
  score += mediumSizePreferenceScore(rowText, queryLower);
  if (isArticleNutritionRoundup(row)) score -= 70;
  score += sourceAndFamilyScore(row, userQuery, rowText, macros);
  score += sliceVersusMultiScore(row);
  if (isComponentIngredientRow(row, userQuery)) score -= 200;
  return score;
}

/** How well a Google organic hit matches the user's menu query (generic). */
function scoreOrganicNutritionHit(hit, userQuery) {
  const hitText = `${hit.title || ''} ${hit.snippet || ''} ${hit.link || ''}`;
  const hitTextLower = hitText.toLowerCase();
  const tokens = significantQueryTokens(userQuery);
  if (tokens.length === 0) return 0;
  let score = 0;
  const hits = countTokenHits(hitText, tokens);
  const need = organicHitNeed(tokens);
  if (hits >= tokens.length) score += 75;else if (hits >= need) score += 35 + hits * 10;else score -= 55;
  if (AUTHORITY_SOURCE_RE.test(hitTextLower)) score += 32;
  if (/\[pdf\]/i.test(hit.title || '') && /\bnutrition|allergen|calories?\b/i.test(hitTextLower)) {
    score += 28;
  }
  if (NOISE_SOURCE_RE.test(hitTextLower)) score -= 110;
  if (/\b\d{2,4}\s*cal/i.test(hitTextLower)) score += 12;
  if (/\b\d+\s*g\s*(protein|carb|fat)\b/i.test(hitTextLower) || /\b(protein|carbs?|fat)[:\s.]+\s*\d/i.test(hitTextLower)) {
    score += 18;
  }
  for (const sizeWord of querySizeModifiers(userQuery)) {
    const sizePattern = new RegExp(`\\b${escapeRegExp(sizeWord)}\\b`, 'i');
    if (sizePattern.test(hitTextLower)) score += 16;else score -= 10;
  }
  if (COMBO_MEAL_RE.test(hitTextLower) && !/\bcombo\b/i.test(String(userQuery || '').toLowerCase())) {
    score -= 25;
  }
  if (/\bpike\b/i.test(String(userQuery || '').toLowerCase())) {
    if (/\bnutrition\b/i.test(hitTextLower) && !/\bkeurig|ground|k-cup\b/i.test(hitTextLower)) {
      score += 20;
    }
    if (/\bkeurig|ground coffee|k-cup\b/i.test(hitTextLower)) score -= 40;
  }
  return score;
}

/** 4-4-9 macro calories vs stated calories — core accuracy gate for restaurant rows. */
function macroCalorieConsistencyScore(macros) {
  const calories = Number(macros == null ? void 0 : macros.calories) || 0;
  const protein = Number(macros == null ? void 0 : macros.protein) || 0;
  const carbs = Number(macros == null ? void 0 : macros.carbs) || 0;
  const fat = Number(macros == null ? void 0 : macros.fat) || 0;
  const caloriesFromMacros = macroCalories(protein, carbs, fat);
  if (calories < MIN_CALORIES_FOR_CONSISTENCY_SCORE || caloriesFromMacros < MIN_MACRO_CALS_FOR_CONSISTENCY_SCORE) {
    return 0;
  }
  const ratio = caloriesFromMacros / calories;
  if (ratio >= CONSISTENCY_RATIO_PERFECT_LOW && ratio <= CONSISTENCY_RATIO_PERFECT_HIGH) {
    return CONSISTENCY_SCORE_PERFECT;
  }
  if (ratio >= CONSISTENCY_RATIO_GOOD_LOW && ratio <= CONSISTENCY_RATIO_GOOD_HIGH) {
    return CONSISTENCY_SCORE_GOOD;
  }
  if (ratio >= CONSISTENCY_RATIO_OK_LOW && ratio <= CONSISTENCY_RATIO_OK_HIGH) {
    return CONSISTENCY_SCORE_OK;
  }
  return CONSISTENCY_SCORE_WEAK;
}
function scoreSerperFoodResultRow(row, userQuery) {
  const rowText = getRowText(row).toLowerCase();
  const tokens = significantQueryTokens(userQuery);
  const macros = getRowMacros(row);
  const consistency = macroCalorieConsistencyScore(macros);
  let score = Number(row._organicScore) || 0;
  score += countTokenHits(rowText, tokens) * 12;
  score += consistency;
  score += variantPreferenceScore(row, userQuery);
  score += brandTokenBonus(row, userQuery);
  if (row.serving_label) score += 8;
  if (NOISE_SOURCE_RE.test(rowText)) score -= 80;
  if (consistency < MIN_MACRO_CONSISTENCY_TO_USE) score -= 200;
  if (hasImplausibleZeroMacros(macros, userQuery, rowText)) score -= 250;
  return score;
}
module.exports = {
  MIN_MACRO_CONSISTENCY_TO_USE,
  scoreOrganicNutritionHit,
  macroCalorieConsistencyScore,
  isPlausibleRestaurantNutritionRow,
  hasImplausibleZeroMacros,
  isComponentIngredientRow,
  filterComponentIngredientRows,
  getMultiServingInfo,
  applyMultiServingFallback,
  scoreSerperFoodResultRow,
  rankSerperFoodResultRows,
  filterUsableSerperRows,
  AUTHORITY_SOURCE_RE,
  NOISE_SOURCE_RE,
  TRUSTED_DB_SOURCES,
  WEAK_WEB_SOURCES
};
