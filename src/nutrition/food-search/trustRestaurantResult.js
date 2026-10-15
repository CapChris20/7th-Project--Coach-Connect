// Decides whether a restaurant web-search card is trustworthy enough to show.
// Flow: check macros vs calories → drop ingredient-only rows → prefer a single serving over a combo.
// Used by the server search helpers and food ranking. CommonJS so the food tests can require() it.

const {
  significantQueryTokens,
  countTokenHits,
  hasUnrequestedFoodFamilyMismatch,
  rowNameBrandText,
} = require('../food-search/rankFoodResults');
const {
  servingConflictsWithFood,
  inferFoodServingCategory,
} = require('../food-search/guessServingLabel');

// ===== NAMED CONSTANTS =====

const AUTHORITY_SOURCE_RE =
  /fatsecret|eatthismuch|myfooddiary|calorieking|sparkpeople|verywell\s*fit|nutritionix|menu\s+with\s+nutrition|nutrition\s+facts|calories\s+in\s+/i;

const TRUSTED_DB_SOURCES = new Set([
  'fatsecret',
  'fatSecret',
  'usda',
  'usdafdc',
  'usdaFdc',
  'openfoodfacts',
  'openFoodFacts',
  'calorieking',
  'calorieKing',
  'fastfoodnutrition',
  'fastFoodNutrition',
  'foodfacto',
  'foodFacto',
  'trusted_catalog',
]);

const WEAK_WEB_SOURCES = new Set(['serper', 'mixed', 'web']);

const NOISE_SOURCE_RE =
  /reddit|tiktok|pinterest|instagram|homemade|copycat|diy\b|blog\b|permanent\s+rotation|just\s+earned|knockoff|meal\s+prep\s+idea|menu\s*items?|breadmenu|gs1|tracker/i;

const COMBO_MEAL_RE =
  /\b(combo\b|value meal|kids meal|happy meal|meal\b.*\b(fries|drink)|with fries|with drink|includes fries|includes drink)\b/i;

const SKINNY_LIGHT_RE =
  /\b(skinny|nonfat|non-fat|sugar free|sugar-free|light\b(?!\s*mayo)|diet\b)\b/i;

const WITH_CHEESE_RE = /\bwith cheese\b/i;

const DISTINGUISHING_TOKENS = new Set([
  'max',
  'deluxe',
  'spicy',
  'baconator',
  'double',
  'impossible',
  'blackened',
  'ultimate',
  'original',
  'classic',
  'grande',
  'large',
  'medium',
  'small',
]);

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

const SIZE_MODIFIER_WORDS = [
  'large',
  'small',
  'medium',
  'regular',
  'mini',
  'grande',
  'venti',
  'tall',
  'personal',
  'family',
];

const FULL_ITEM_MENU_QUERY_RE =
  /\b(burger|cheeseburger|hamburger|sandwich|burrito|pizza|sub\b|hoagie|wrap|quesadilla|taco|bowl|footlong|panini)\b/i;

const MULTI_SERVING_PATTERNS = [
  { re: /\b([2-9])\s*slices?\b/i, mult: (match) => parseInt(match[1], 10) },
  { re: /\b([2-9])\s*pieces?\b/i, mult: (match) => parseInt(match[1], 10) },
  { re: /\b([2-9])\s*pcs?\b/i, mult: (match) => parseInt(match[1], 10) },
  { re: /\b([2-9])\s*pack\b/i, mult: (match) => parseInt(match[1], 10) },
  { re: /\b([2-9])\s*count\b/i, mult: (match) => parseInt(match[1], 10) },
  { re: /(?:¼|1\/4)\s*pizza/i, mult: () => 4 },
  { re: /(?:½|1\/2)\s*pizza/i, mult: () => 2 },
  { re: /(?:⅓|1\/3)\s*pizza/i, mult: () => 3 },
];

// ===== HELPER FUNCTIONS =====

function escapeRe(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function macroCalories(proteinGrams, carbGrams, fatGrams) {
  return (
    KCAL_PER_PROTEIN_OR_CARB * (Number(proteinGrams) || 0) +
    KCAL_PER_PROTEIN_OR_CARB * (Number(carbGrams) || 0) +
    KCAL_PER_FAT * (Number(fatGrams) || 0)
  );
}

function getRowMacros(row) {
  return {
    calories: Number(row?.nf_calories ?? row?.calories) || 0,
    protein: Number(row?.nf_protein ?? row?.protein) || 0,
    carbs: Number(row?.nf_total_carbohydrate ?? row?.carbs) || 0,
    fat: Number(row?.nf_total_fat ?? row?.fat) || 0,
  };
}

function getRowText(row) {
  return `${row?.food_name || row?.name || ''} ${row?.brand_name || row?.brand || ''} ${row?.serving_label || row?.serving_unit || ''}`;
}

function querySizeModifiers(query) {
  const queryLower = String(query || '').toLowerCase();
  return SIZE_MODIFIER_WORDS.filter((word) => new RegExp(`\\b${escapeRe(word)}\\b`, 'i').test(queryLower));
}

function queryWantsPattern(query, re) {
  return re.test(String(query || '').toLowerCase());
}

function isLowCalBeverageRow(macros, userQuery, rowText) {
  const calories = Number(macros?.calories) || 0;
  if (calories <= 0 || calories > LOW_CAL_DRINK_MAX) return false;
  const hay = `${userQuery} ${rowText}`.toLowerCase();
  return /\b(coffee|tea|espresso|americano|pike|cold brew|diet|zero)\b/.test(hay);
}

function isRetailCoffeeProduct(row, userQuery) {
  const text = getRowText(row).toLowerCase();
  const queryLower = String(userQuery || '').toLowerCase();
  if (!/\bstarbucks\b/.test(queryLower)) return false;
  if (!/\b(grande|venti|tall|iced|latte|macchiato|mocha|coffee|pike)\b/.test(queryLower)) return false;
  return /\b(keurig|k-cup|k cup|ground coffee|whole bean|bagged|pods|pack of|roast ground)\b/.test(text);
}

function isArticleNutritionRoundup(row) {
  const text = getRowText(row).toLowerCase();
  return /\b(lineup|breakdown|full nutrition|all menu|complete guide|every item)\b/.test(text);
}

function expectsRichMacros(userQuery, rowText) {
  const hay = `${userQuery} ${rowText}`.toLowerCase();
  return /\b(burger|cheeseburger|hamburger|sandwich|whopper|big mac|quarter pounder|pizza|slice|pepperoni|nugget|tender|wing|burrito|bowl|sub\b|biscuit|baconator|frosty|blizzard|orange chicken|crazy bread|breadstick|garlic bread|cheesy bread|roast beef|patty|footlong|quesadilla|mac and cheese|fried rice|lo mein|chicken|turkey|beef|steak|pork|salmon|shrimp|fish|meatball|sausage|bacon)\b/.test(
    hay,
  );
}

function comboAndNuggetScore(text, queryLower, macros) {
  let score = 0;
  if (COMBO_MEAL_RE.test(text)) score -= 95;
  if (/\bmeal\b/i.test(text) && !/\bmeal\b/i.test(queryLower)) score -= 70;
  if (/\b10\s*(piece|pc|pcs)\b/i.test(queryLower) && /\bnugget/i.test(queryLower)) {
    if (macros.calories > NUGGET_10_COMBO_CALORIES) score -= 75;
    if (macros.calories >= NUGGET_10_TYPICAL_MIN && macros.calories <= NUGGET_10_TYPICAL_MAX) score += 45;
    if (/\bnugget/i.test(text) && !COMBO_MEAL_RE.test(text)) score += 25;
  }
  return score;
}

function burgerChainScore(text, queryLower, macros) {
  let score = 0;
  if (/\bwhopper\b/i.test(queryLower) && !/\bcheese\b/i.test(queryLower) && !/\bimpossible\b/i.test(queryLower)) {
    if (WITH_CHEESE_RE.test(text)) score -= 65;
    if (macros.calories >= WHOPPER_TYPICAL_MIN && macros.calories <= WHOPPER_TYPICAL_MAX && !WITH_CHEESE_RE.test(text)) {
      score += 45;
    }
    if (macros.calories >= WHOPPER_HEAVY_CALORIES) score -= 35;
  }
  if (/\bbaconator\b/i.test(queryLower) && !/\btriple\b/i.test(queryLower)) {
    if (macros.calories >= BACONATOR_TYPICAL_MIN && macros.calories <= BACONATOR_TYPICAL_MAX && !/\btriple\b/i.test(text)) {
      score += 40;
    }
  }
  return score;
}

function drinkChainScore(text, queryLower, macros) {
  let score = 0;
  if (/\bstarbucks\b/i.test(queryLower) && /\b(macchiato|latte|mocha|frappuccino|coffee|pike)\b/i.test(queryLower)) {
    if (SKINNY_LIGHT_RE.test(text) && !queryWantsPattern(queryLower, SKINNY_LIGHT_RE)) score -= 80;
    if (!SKINNY_LIGHT_RE.test(text) && macros.calories >= STARBUCKS_TYPICAL_MIN && macros.calories <= STARBUCKS_TYPICAL_MAX) {
      score += 28;
    }
    if (/\bkeurig\b|\bk-cup\b|\bground\b/i.test(text)) score -= 90;
    if (/\bpike\b/i.test(queryLower) && /\bnutrition\b/i.test(text) && macros.calories > 0 && macros.calories <= 25) {
      score += 50;
    }
  }
  if (/\b(dairy queen|dq)\b/i.test(queryLower) && /\bblizzard\b/i.test(queryLower)) {
    if (/\blarge\b/i.test(text) && !/\blarge\b/i.test(queryLower)) score -= 50;
    if (/\bmedium\b/i.test(text) && !/\b(small|large|mini)\b/i.test(queryLower)) score += 35;
    if (macros.calories >= BLIZZARD_TYPICAL_MIN && macros.calories <= BLIZZARD_TYPICAL_MAX) score += 20;
    if (macros.calories > BLIZZARD_HEAVY_CALORIES) score -= 35;
  }
  return score;
}

function orangeChickenScore(text, queryLower, macros) {
  if (!(/\bpanda\b/i.test(queryLower) && /\borange chicken\b/i.test(queryLower))) return 0;
  let score = 0;
  if (COMBO_MEAL_RE.test(text) || /\bplate\b|\bcombo\b|\bmeal\b/i.test(text)) score -= 55;
  if (macros.calories >= ORANGE_CHICKEN_TYPICAL_MIN && macros.calories <= ORANGE_CHICKEN_TYPICAL_MAX && !COMBO_MEAL_RE.test(text)) {
    score += 22;
  }
  if (macros.calories > ORANGE_CHICKEN_HEAVY_CALORIES) score -= 20;
  return score;
}

function unaskedSizePenalty(sizeWord) {
  if (sizeWord === 'large' || sizeWord === 'grande' || sizeWord === 'venti') return -28;
  if (sizeWord === 'small' || sizeWord === 'mini') return -12;
  return 0;
}

function scoreOneSizeWord(text, sizeWord, sizesWanted) {
  const hasSize = new RegExp(`\\b${escapeRe(sizeWord)}\\b`, 'i').test(text);
  if (sizesWanted.includes(sizeWord)) return hasSize ? 18 : 0;
  if (!hasSize) return 0;
  return unaskedSizePenalty(sizeWord);
}

function sizeModifierScore(text, userQuery) {
  let score = 0;
  const sizesWanted = querySizeModifiers(userQuery);
  for (const sizeWord of SIZE_MODIFIER_WORDS) {
    score += scoreOneSizeWord(text, sizeWord, sizesWanted);
  }
  if (sizesWanted.length === 0 && /\b(medium|regular|grande)\b/i.test(text)) score += 10;
  return score;
}

function distinguishingTokenScore(text, userQuery) {
  let score = 0;
  const tokens = significantQueryTokens(userQuery);
  for (const token of tokens) {
    if (!DISTINGUISHING_TOKENS.has(token)) continue;
    if (new RegExp(`\\b${escapeRe(token)}\\b`, 'i').test(text)) score += 38;
    else score -= 30;
  }
  return score;
}

function sourceAndFamilyScore(row, userQuery, text, macros) {
  let score = 0;
  const servingLabel = row.serving_label || row.serving_unit || '';
  if (
    servingConflictsWithFood({
      userQuery,
      foodName: row.food_name || row.name,
      restaurant: row.brand_name || row.brand || row.restaurant,
      servingLabel,
    })
  ) {
    score -= SERVING_CONFLICT_PENALTY;
  }
  if (hasImplausibleZeroMacros(macros, userQuery, text)) score -= 120;
  const sourceLower = String(row.source || '').toLowerCase();
  if (sourceLower === 'nutrition_consensus') score += 70;
  else if (TRUSTED_DB_SOURCES.has(row.source) || TRUSTED_DB_SOURCES.has(sourceLower)) score += 55;
  if (WEAK_WEB_SOURCES.has(sourceLower) || WEAK_WEB_SOURCES.has(row.source)) score -= 25;

  const queryCategory = inferFoodServingCategory(userQuery, '', '');
  const rowCategory = inferFoodServingCategory('', text, '');
  if (queryCategory !== 'generic' && rowCategory !== 'generic' && queryCategory !== rowCategory) {
    score -= 85;
  }
  if (hasUnrequestedFoodFamilyMismatch(rowNameBrandText(row), userQuery)) {
    score -= 200;
  }
  return score;
}

function singleSliceBonus(text) {
  if (/\b1\s*slice\b|\bone\s*slice\b|\bper\s*slice\b/i.test(text)) return 28;
  if (/\bslice\b/i.test(text) && !/\b[2-9]\s*slice/i.test(text)) return 12;
  return 0;
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

function firstMatchingMultiServing(text) {
  for (const { re, mult } of MULTI_SERVING_PATTERNS) {
    const match = text.match(re);
    if (!match) continue;
    const multiplier = mult(match);
    if (multiplier >= 2 && multiplier <= MULTI_SERVING_MAX) {
      return { isMulti: true, multiplier };
    }
  }
  return { isMulti: false, multiplier: 1 };
}

function partitionSingleVsMultiServing(rows) {
  const singles = [];
  const multis = [];
  for (const row of rows || []) {
    if (getMultiServingInfo(row).isMulti) multis.push(row);
    else singles.push(row);
  }
  return { singles, multis };
}

function brandTokenBonus(row, userQuery) {
  const tokens = significantQueryTokens(userQuery);
  if (tokens.length < 2) return 0;
  const text = getRowText(row).toLowerCase();
  const brandish = tokens.slice(0, Math.min(2, tokens.length));
  let bonus = 0;
  for (const token of brandish) {
    if (text.includes(token.replace(/-/g, ' ')) || text.includes(token)) bonus += 14;
  }
  return bonus;
}

function organicHitNeed(tokens) {
  if (tokens.length >= 4) return Math.max(2, Math.ceil(tokens.length * 0.5));
  if (tokens.length >= 2) return 2;
  return 1;
}

function rowFailsUsableFilter(row, userQuery) {
  if (isRetailCoffeeProduct(row, userQuery)) return true;
  const macros = getRowMacros(row);
  const rowText = getRowText(row);
  if (
    servingConflictsWithFood({
      userQuery,
      foodName: row.food_name || row.name,
      restaurant: row.brand_name || row.brand || row.restaurant,
      servingLabel: row.serving_label || row.serving_unit || '',
    })
  ) {
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
  const { singles, multis } = partitionSingleVsMultiServing(candidates);
  const useMultiOnly = singles.length === 0 && multis.length > 0;
  return {
    pool: useMultiOnly ? multis : singles.length > 0 ? singles : candidates,
    applyMultiAdjust: useMultiOnly,
  };
}

function markRankedRow(row, consistency, unverifiedDefault, applyMultiAdjust, userQuery) {
  let out = row;
  if (applyMultiAdjust && getMultiServingInfo(row).isMulti) {
    out = applyMultiServingFallback(row);
  }
  const { _organicScore, ...rest } = out;
  const macros = getRowMacros(out);
  const rowText = getRowText(out);
  const lowCalDrink = isLowCalBeverageRow(macros, userQuery, rowText);
  return {
    ...rest,
    nutrition_unverified:
      unverifiedDefault ||
      Boolean(out.multiServingFallback) ||
      (!lowCalDrink && consistency < UNVERIFIED_CONSISTENCY) ||
      Boolean(row.nutrition_unverified),
  };
}

function rankList(candidates, unverifiedDefault, applyMultiAdjust, userQuery) {
  const sorted = candidates
    .map((row) => ({
      row,
      _sort: scoreSerperFoodResultRow(row, userQuery),
      _consistency: macroCalorieConsistencyScore(getRowMacros(row)),
    }))
    .sort(compareRankedRows);

  return sorted.map(({ row, _consistency }) =>
    markRankedRow(row, _consistency, unverifiedDefault, applyMultiAdjust, userQuery),
  );
}

// ===== MAIN FUNCTION =====

/** Sub-component / ingredient rows (internally consistent but not the full menu item). */
function isComponentIngredientRow(row, userQuery) {
  const text = getRowText(row).toLowerCase();
  if (/\bproteins\s/.test(text) || /^proteins\s/i.test(text)) return true;
  if (text.includes('sub components')) return true;
  if (text.includes('meats protein')) return true;
  if (/\b(patty|bun|sauce|cheese|meat|protein)\s+only\b/.test(text)) return true;
  if (/\badd[\s-]?on\b/.test(text)) return true;
  if (text.includes('ingredient')) return true;
  if (FULL_ITEM_MENU_QUERY_RE.test(String(userQuery || '')) && text.includes('toppings')) return true;
  return false;
}

function filterComponentIngredientRows(rows, userQuery) {
  const list = Array.isArray(rows) ? rows : [];
  const filtered = list.filter((row) => !isComponentIngredientRow(row, userQuery));
  return filtered.length > 0 ? filtered : list;
}

function getMultiServingInfo(row) {
  return firstMatchingMultiServing(getRowText(row).toLowerCase());
}

function applyMultiServingFallback(row) {
  const { isMulti, multiplier } = getMultiServingInfo(row);
  if (!isMulti || multiplier <= 1) return row;

  const macros = getRowMacros(row);
  const perServingLabel = row.serving_label || row.serving_unit || '';
  const estLabel = perServingLabel
    ? `~1 serving (from ${multiplier}× ${perServingLabel})`
    : `~1 serving (est. from ${multiplier}× portion)`;

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
    serving_label: estLabel,
    multiServingFallback: true,
    servingMultiplier: multiplier,
    nutrition_unverified: true,
  };
}

function isPlausibleRestaurantNutritionRow(macros, { relaxed = false } = {}) {
  const calories = Number(macros?.calories) || 0;
  const protein = Number(macros?.protein) || 0;
  const carbs = Number(macros?.carbs) || 0;
  const fat = Number(macros?.fat) || 0;
  if (calories <= 0 || calories > MAX_PLAUSIBLE_CALORIES) return false;

  const fromMacros = macroCalories(protein, carbs, fat);
  const consistency = macroCalorieConsistencyScore(macros);
  const minConsistency = relaxed ? RELAXED_MACRO_CONSISTENCY : MIN_MACRO_CONSISTENCY_TO_USE;

  if (protein === 0 && carbs === 0 && fat === 0 && calories > 0) return false;
  if (fromMacros > 40 && calories > 0 && fromMacros / calories > HIGH_CAL_MACRO_RATIO) return false;

  if (fromMacros < TINY_MACRO_CALORIES) {
    if (calories >= MIN_CALORIES_NEEDING_MACROS) return false;
    return protein > 0 || carbs > 0 || fat > 0;
  }

  if (calories >= MIN_CALORIES_NEEDING_CONSISTENCY && consistency < minConsistency) return false;
  if (calories >= MIN_CALORIES_NEEDING_MACROS && fromMacros < MIN_MACROS_WHEN_CALORIES) return false;
  return true;
}

function hasImplausibleZeroMacros(macros, userQuery, rowText) {
  const calories = Number(macros?.calories) || 0;
  const protein = Number(macros?.protein) || 0;
  const carbs = Number(macros?.carbs) || 0;
  const fat = Number(macros?.fat) || 0;
  if (calories <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return true;
  if (calories < RICH_FOOD_MIN_CALORIES) return false;
  if (!expectsRichMacros(userQuery, rowText)) return false;

  if (calories >= ZERO_PROTEIN_CALORIES && protein === 0) return true;
  if (calories >= SUSPECT_MACRO_CALORIES && protein < 5 && carbs < 5 && fat > 0) return true;
  if (calories >= EMPTY_CARB_PROTEIN_CALORIES && protein === 0 && carbs === 0) return true;
  return false;
}

function variantPreferenceScore(row, userQuery) {
  const text = getRowText(row).toLowerCase();
  const queryLower = String(userQuery || '').toLowerCase();
  const macros = getRowMacros(row);
  let score = 0;

  score += comboAndNuggetScore(text, queryLower, macros);
  score += burgerChainScore(text, queryLower, macros);
  score += drinkChainScore(text, queryLower, macros);
  score += orangeChickenScore(text, queryLower, macros);
  score += sizeModifierScore(text, userQuery);
  score += distinguishingTokenScore(text, userQuery);

  if (/\btriple\b/i.test(text) && !/\btriple\b/i.test(queryLower)) score -= 55;
  if (/\bdouble\b/i.test(text) && !/\bdouble\b/i.test(queryLower) && /\bbaconator\b/i.test(queryLower)) score -= 40;
  if (/\bmedium\b/i.test(queryLower)) {
    if (/\bmedium\b/i.test(text)) score += 55;
    if (/\bsmall\b/i.test(text) && !/\bmedium\b/i.test(text)) score -= 70;
    if (/\blarge\b/i.test(text)) score -= 45;
  }
  if (isArticleNutritionRoundup(row)) score -= 70;
  score += sourceAndFamilyScore(row, userQuery, text, macros);
  score += sliceVersusMultiScore(row);
  if (isComponentIngredientRow(row, userQuery)) score -= 200;
  return score;
}

/** How well a Google organic hit matches the user's menu query (generic). */
function scoreOrganicNutritionHit(hit, userQuery) {
  const text = `${hit.title || ''} ${hit.snippet || ''} ${hit.link || ''}`;
  const textLower = text.toLowerCase();
  const tokens = significantQueryTokens(userQuery);
  let score = 0;

  if (tokens.length === 0) return 0;

  const hits = countTokenHits(text, tokens);
  const need = organicHitNeed(tokens);

  if (hits >= tokens.length) score += 75;
  else if (hits >= need) score += 35 + hits * 10;
  else score -= 55;

  if (AUTHORITY_SOURCE_RE.test(textLower)) score += 32;
  if (/\[pdf\]/i.test(hit.title || '') && /\bnutrition|allergen|calories?\b/i.test(textLower)) score += 28;
  if (NOISE_SOURCE_RE.test(textLower)) score -= 110;

  if (/\b\d{2,4}\s*cal/i.test(textLower)) score += 12;
  if (/\b\d+\s*g\s*(protein|carb|fat)\b/i.test(textLower) || /\b(protein|carbs?|fat)[:\s.]+\s*\d/i.test(textLower)) {
    score += 18;
  }

  for (const sizeWord of querySizeModifiers(userQuery)) {
    if (new RegExp(`\\b${escapeRe(sizeWord)}\\b`, 'i').test(textLower)) score += 16;
    else score -= 10;
  }

  if (COMBO_MEAL_RE.test(textLower) && !/\bcombo\b/i.test(String(userQuery || '').toLowerCase())) score -= 25;

  if (/\bpike\b/i.test(String(userQuery || '').toLowerCase())) {
    if (/\bnutrition\b/i.test(textLower) && !/\bkeurig|ground|k-cup\b/i.test(textLower)) score += 20;
    if (/\bkeurig|ground coffee|k-cup\b/i.test(textLower)) score -= 40;
  }

  return score;
}

/** 4-4-9 macro calories vs stated calories — core accuracy gate for restaurant rows. */
function macroCalorieConsistencyScore(macros) {
  const calories = Number(macros?.calories) || 0;
  const protein = Number(macros?.protein) || 0;
  const carbs = Number(macros?.carbs) || 0;
  const fat = Number(macros?.fat) || 0;
  const fromMacros = macroCalories(protein, carbs, fat);
  if (calories < 25 || fromMacros < 12) return 0;
  const ratio = fromMacros / calories;
  if (ratio >= 0.58 && ratio <= 1.12) return 100;
  if (ratio >= 0.42 && ratio <= 1.3) return 65;
  if (ratio >= 0.3 && ratio <= 1.45) return 30;
  return 5;
}

function scoreSerperFoodResultRow(row, userQuery) {
  const text = getRowText(row).toLowerCase();
  const tokens = significantQueryTokens(userQuery);
  const macros = getRowMacros(row);
  const consistency = macroCalorieConsistencyScore(macros);

  let score = Number(row._organicScore) || 0;
  score += countTokenHits(text, tokens) * 12;
  score += consistency;
  score += variantPreferenceScore(row, userQuery);
  score += brandTokenBonus(row, userQuery);

  if (row.serving_label) score += 8;
  if (NOISE_SOURCE_RE.test(text)) score -= 80;

  if (consistency < MIN_MACRO_CONSISTENCY_TO_USE) score -= 200;
  if (hasImplausibleZeroMacros(macros, userQuery, text)) score -= 250;

  return score;
}

function filterUsableSerperRows(rows, userQuery) {
  return (Array.isArray(rows) ? rows : []).filter((row) => !rowFailsUsableFilter(row, userQuery));
}

function rankSerperFoodResultRows(rows, userQuery) {
  const list = Array.isArray(rows) ? rows : [];
  let usable = filterUsableSerperRows(list, userQuery);
  usable = filterComponentIngredientRows(usable, userQuery);

  if (usable.length > 0) {
    const { pool, applyMultiAdjust } = buildPool(usable);
    return rankList(pool, false, applyMultiAdjust, userQuery);
  }

  let fallback = list.filter((row) => {
    if (isRetailCoffeeProduct(row, userQuery)) return false;
    const macros = getRowMacros(row);
    return macros.calories > 0 && isPlausibleRestaurantNutritionRow(macros, { relaxed: true });
  });
  fallback = filterComponentIngredientRows(fallback, userQuery);

  if (fallback.length > 0) {
    console.warn(
      '[Food Search] Serper rows below consistency threshold — returning best-effort unverified:',
      userQuery,
    );
    const { pool, applyMultiAdjust } = buildPool(fallback);
    return rankList(pool.slice(0, FALLBACK_ROW_CAP), true, applyMultiAdjust, userQuery);
  }

  return [];
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
  WEAK_WEB_SOURCES,
};
