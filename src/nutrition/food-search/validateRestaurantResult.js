/**
 * restaurant Serper Quality
 *
 * Purpose: restaurant Serper Quality — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: MIN_MACRO_CONSISTENCY_TO_USE, scoreOrganicNutritionHit, macroCalorieConsistencyScore, isPlausibleRestaurantNutritionRow, hasImplausibleZeroMacros, isComponentIngredientRow, filterComponentIngredientRows, getMultiServingInfo
 *
 * @file-header
 */
/**
 * Generic Serper quality for restaurant / menu-item searches (no per-chain hardcoding).
 * Used by server nutritionSearchHelpers + food search ranking.
 */
const {
  significantQueryTokens,
  countTokenHits,
} = require('../food-search/rankFoodSearchResults');

const AUTHORITY_SOURCE_RE =
  /fatsecret|eatthismuch|myfooddiary|calorieking|sparkpeople|verywell\s*fit|nutritionix|menu\s+with\s+nutrition|nutrition\s+facts|calories\s+in\s+/i;

const NOISE_SOURCE_RE =
  /reddit|tiktok|pinterest|instagram|homemade|copycat|diy\b|blog\b|permanent\s+rotation|just\s+earned|knockoff|meal\s+prep\s+idea/i;

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

function escapeRe(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function macroCalories(p, c, f) {
  return 4 * (Number(p) || 0) + 4 * (Number(c) || 0) + 9 * (Number(f) || 0);
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
  const q = String(query || '').toLowerCase();
  return SIZE_MODIFIER_WORDS.filter((w) => new RegExp(`\\b${escapeRe(w)}\\b`, 'i').test(q));
}

function queryWantsPattern(query, re) {
  return re.test(String(query || '').toLowerCase());
}

function isLowCalBeverageRow(macros, userQuery, rowText) {
  const cal = Number(macros?.calories) || 0;
  if (cal <= 0 || cal > 80) return false;
  const t = `${userQuery} ${rowText}`.toLowerCase();
  return /\b(coffee|tea|espresso|americano|pike|cold brew|diet|zero)\b/.test(t);
}

function isRetailCoffeeProduct(row, userQuery) {
  const text = getRowText(row).toLowerCase();
  const q = String(userQuery || '').toLowerCase();
  if (!/\bstarbucks\b/.test(q)) return false;
  if (!/\b(grande|venti|tall|iced|latte|macchiato|mocha|coffee|pike)\b/.test(q)) return false;
  return /\b(keurig|k-cup|k cup|ground coffee|whole bean|bagged|pods|pack of|roast ground)\b/.test(text);
}

function isArticleNutritionRoundup(row) {
  const text = getRowText(row).toLowerCase();
  return /\b(lineup|breakdown|full nutrition|all menu|complete guide|every item)\b/.test(text);
}

const FULL_ITEM_MENU_QUERY_RE =
  /\b(burger|cheeseburger|hamburger|sandwich|burrito|pizza|sub\b|hoagie|wrap|quesadilla|taco|bowl|footlong|panini)\b/i;

const MULTI_SERVING_PATTERNS = [
  { re: /\b([2-9])\s*slices?\b/i, mult: (m) => parseInt(m[1], 10) },
  { re: /\b([2-9])\s*pieces?\b/i, mult: (m) => parseInt(m[1], 10) },
  { re: /\b([2-9])\s*pcs?\b/i, mult: (m) => parseInt(m[1], 10) },
  { re: /\b([2-9])\s*pack\b/i, mult: (m) => parseInt(m[1], 10) },
  { re: /\b([2-9])\s*count\b/i, mult: (m) => parseInt(m[1], 10) },
  { re: /(?:¼|1\/4)\s*pizza/i, mult: () => 4 },
  { re: /(?:½|1\/2)\s*pizza/i, mult: () => 2 },
  { re: /(?:⅓|1\/3)\s*pizza/i, mult: () => 3 },
];

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
  const text = getRowText(row).toLowerCase();
  for (const { re, mult } of MULTI_SERVING_PATTERNS) {
    const m = text.match(re);
    if (m) {
      const n = mult(m);
      if (n >= 2 && n <= 16) return { isMulti: true, multiplier: n };
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

function applyMultiServingFallback(row) {
  const { isMulti, multiplier } = getMultiServingInfo(row);
  if (!isMulti || multiplier <= 1) return row;

  const macros = getRowMacros(row);
  const div = multiplier;
  const perServingLabel = row.serving_label || row.serving_unit || '';
  const estLabel = perServingLabel
    ? `~1 serving (from ${multiplier}× ${perServingLabel})`
    : `~1 serving (est. from ${multiplier}× portion)`;

  return {
    ...row,
    nf_calories: Math.round(macros.calories / div),
    calories: Math.round(macros.calories / div),
    nf_protein: Math.round(macros.protein / div),
    protein: Math.round(macros.protein / div),
    nf_total_carbohydrate: Math.round(macros.carbs / div),
    carbs: Math.round(macros.carbs / div),
    nf_total_fat: Math.round(macros.fat / div),
    fat: Math.round(macros.fat / div),
    serving_label: estLabel,
    multiServingFallback: true,
    servingMultiplier: multiplier,
    nutrition_unverified: true,
  };
}

function compareRankedRows(a, b) {
  if (b._sort !== a._sort) return b._sort - a._sort;
  const an = String(a.row.food_name || a.row.name || '').toLowerCase();
  const bn = String(b.row.food_name || b.row.name || '').toLowerCase();
  if (an !== bn) return an.localeCompare(bn);
  return getRowMacros(a.row).calories - getRowMacros(b.row).calories;
}

/** Rich-protein dishes where 0g protein on a high-cal row is almost always a bad parse. */
function expectsRichMacros(userQuery, rowText) {
  const t = `${userQuery} ${rowText}`.toLowerCase();
  return /\b(burger|cheeseburger|hamburger|sandwich|whopper|big mac|quarter pounder|pizza|slice|pepperoni|nugget|tender|wing|burrito|bowl|sub\b|biscuit|baconator|frosty|blizzard|orange chicken|crazy bread|roast beef|patty|footlong|quesadilla|mac and cheese|fried rice|lo mein)\b/.test(
    t,
  );
}

function hasImplausibleZeroMacros(macros, userQuery, rowText) {
  const cal = Number(macros?.calories) || 0;
  const p = Number(macros?.protein) || 0;
  const c = Number(macros?.carbs) || 0;
  const f = Number(macros?.fat) || 0;
  if (cal < 150) return false;
  if (!expectsRichMacros(userQuery, rowText)) return false;

  if (cal >= 250 && p === 0) return true;
  if (cal >= 400 && p < 5 && c < 5 && f > 0) return true;
  if (cal >= 300 && p === 0 && c === 0) return true;
  return false;
}

/** Prefer standalone items, standard sizes, and query-specific variants. */
function variantPreferenceScore(row, userQuery) {
  const text = getRowText(row).toLowerCase();
  const q = String(userQuery || '').toLowerCase();
  const macros = getRowMacros(row);
  let score = 0;

  if (COMBO_MEAL_RE.test(text)) score -= 95;
  if (/\bmeal\b/i.test(text) && !/\bmeal\b/i.test(q)) score -= 70;

  if (/\b10\s*(piece|pc|pcs)\b/i.test(q) && /\bnugget/i.test(q)) {
    if (macros.calories > 650) score -= 75;
    if (macros.calories >= 350 && macros.calories <= 520) score += 45;
    if (/\bnugget/i.test(text) && !COMBO_MEAL_RE.test(text)) score += 25;
  }

  if (/\bwhopper\b/i.test(q) && !/\bcheese\b/i.test(q) && !/\bimpossible\b/i.test(q)) {
    if (WITH_CHEESE_RE.test(text)) score -= 65;
    if (macros.calories >= 620 && macros.calories <= 720 && !WITH_CHEESE_RE.test(text)) score += 45;
    if (macros.calories >= 760) score -= 35;
  }

  if (/\bbaconator\b/i.test(q) && !/\btriple\b/i.test(q)) {
    if (macros.calories >= 880 && macros.calories <= 950 && !/\btriple\b/i.test(text)) score += 40;
  }

  if (/\bstarbucks\b/i.test(q) && /\b(macchiato|latte|mocha|frappuccino|coffee|pike)\b/i.test(q)) {
    if (SKINNY_LIGHT_RE.test(text) && !queryWantsPattern(q, SKINNY_LIGHT_RE)) score -= 80;
    if (!SKINNY_LIGHT_RE.test(text) && macros.calories >= 180 && macros.calories <= 350) score += 28;
    if (/\bkeurig\b|\bk-cup\b|\bground\b/i.test(text)) score -= 90;
    if (/\bpike\b/i.test(q) && /\bnutrition\b/i.test(text) && macros.calories > 0 && macros.calories <= 25) {
      score += 50;
    }
  }

  if (/\b(dairy queen|dq)\b/i.test(q) && /\bblizzard\b/i.test(q)) {
    if (/\blarge\b/i.test(text) && !/\blarge\b/i.test(q)) score -= 50;
    if (/\bmedium\b/i.test(text) && !/\b(small|large|mini)\b/i.test(q)) score += 35;
    if (macros.calories >= 720 && macros.calories <= 900) score += 20;
    if (macros.calories > 980) score -= 35;
  }

  if (/\bpanda\b/i.test(q) && /\borange chicken\b/i.test(q)) {
    if (COMBO_MEAL_RE.test(text) || /\bplate\b|\bcombo\b|\bmeal\b/i.test(text)) score -= 55;
    if (macros.calories >= 430 && macros.calories <= 540 && !COMBO_MEAL_RE.test(text)) score += 22;
    if (macros.calories > 600) score -= 20;
  }

  const sizesWanted = querySizeModifiers(userQuery);
  for (const sz of SIZE_MODIFIER_WORDS) {
    if (sizesWanted.includes(sz)) {
      if (new RegExp(`\\b${escapeRe(sz)}\\b`, 'i').test(text)) score += 18;
      continue;
    }
    if (new RegExp(`\\b${escapeRe(sz)}\\b`, 'i').test(text)) {
      if (sz === 'large' || sz === 'grande' || sz === 'venti') score -= 28;
      if (sz === 'small' || sz === 'mini') score -= 12;
    }
  }
  if (sizesWanted.length === 0 && /\b(medium|regular|grande)\b/i.test(text)) score += 10;

  const tokens = significantQueryTokens(userQuery);
  for (const t of tokens) {
    if (!DISTINGUISHING_TOKENS.has(t)) continue;
    if (new RegExp(`\\b${escapeRe(t)}\\b`, 'i').test(text)) score += 38;
    else score -= 30;
  }

  if (/\btriple\b/i.test(text) && !/\btriple\b/i.test(q)) score -= 55;
  if (/\bdouble\b/i.test(text) && !/\bdouble\b/i.test(q) && /\bbaconator\b/i.test(q)) score -= 40;

  if (/\bmedium\b/i.test(q)) {
    if (/\bmedium\b/i.test(text)) score += 55;
    if (/\bsmall\b/i.test(text) && !/\bmedium\b/i.test(text)) score -= 70;
    if (/\blarge\b/i.test(text)) score -= 45;
  }

  if (isArticleNutritionRoundup(row)) score -= 70;

  if (!getMultiServingInfo(row).isMulti) {
    const text = getRowText(row).toLowerCase();
    if (/\b1\s*slice\b|\bone\s*slice\b|\bper\s*slice\b/i.test(text)) score += 28;
    else if (/\bslice\b/i.test(text) && !/\b[2-9]\s*slice/i.test(text)) score += 12;
  } else {
    score -= 90;
  }

  if (isComponentIngredientRow(row, userQuery)) score -= 200;

  return score;
}

/** How well a Google organic hit matches the user's menu query (generic). */
function scoreOrganicNutritionHit(hit, userQuery) {
  const text = `${hit.title || ''} ${hit.snippet || ''} ${hit.link || ''}`;
  const low = text.toLowerCase();
  const tokens = significantQueryTokens(userQuery);
  let score = 0;

  if (tokens.length === 0) return 0;

  const hits = countTokenHits(text, tokens);
  const need =
    tokens.length >= 4
      ? Math.max(2, Math.ceil(tokens.length * 0.5))
      : tokens.length >= 2
        ? 2
        : 1;

  if (hits >= tokens.length) score += 75;
  else if (hits >= need) score += 35 + hits * 10;
  else score -= 55;

  if (AUTHORITY_SOURCE_RE.test(low)) score += 32;
  if (/\[pdf\]/i.test(hit.title || '') && /\bnutrition|allergen|calories?\b/i.test(low)) score += 28;
  if (NOISE_SOURCE_RE.test(low)) score -= 110;

  if (/\b\d{2,4}\s*cal/i.test(low)) score += 12;
  if (/\b\d+\s*g\s*(protein|carb|fat)\b/i.test(low) || /\b(protein|carbs?|fat)[:\s.]+\s*\d/i.test(low)) {
    score += 18;
  }

  for (const sz of querySizeModifiers(userQuery)) {
    if (new RegExp(`\\b${escapeRe(sz)}\\b`, 'i').test(low)) score += 16;
    else score -= 10;
  }

  if (COMBO_MEAL_RE.test(low) && !/\bcombo\b/i.test(String(userQuery || '').toLowerCase())) score -= 25;

  if (/\bpike\b/i.test(String(userQuery || '').toLowerCase())) {
    if (/\bnutrition\b/i.test(low) && !/\bkeurig|ground|k-cup\b/i.test(low)) score += 20;
    if (/\bkeurig|ground coffee|k-cup\b/i.test(low)) score -= 40;
  }

  return score;
}

/** 4-4-9 macro calories vs stated calories — core accuracy gate for restaurant rows. */
function macroCalorieConsistencyScore(macros) {
  const cal = Number(macros?.calories) || 0;
  const p = Number(macros?.protein) || 0;
  const c = Number(macros?.carbs) || 0;
  const f = Number(macros?.fat) || 0;
  const mc = macroCalories(p, c, f);
  if (cal < 25 || mc < 12) return 0;
  const ratio = mc / cal;
  if (ratio >= 0.58 && ratio <= 1.12) return 100;
  if (ratio >= 0.42 && ratio <= 1.3) return 65;
  if (ratio >= 0.3 && ratio <= 1.45) return 30;
  return 5;
}

/**
 * Stricter plausibility for restaurant Serper rows (calories + macros must agree).
 */
function isPlausibleRestaurantNutritionRow(macros, { relaxed = false } = {}) {
  const cal = Number(macros?.calories) || 0;
  const p = Number(macros?.protein) || 0;
  const c = Number(macros?.carbs) || 0;
  const f = Number(macros?.fat) || 0;
  if (cal <= 0 || cal > 3500) return false;

  const mc = macroCalories(p, c, f);
  const consistency = macroCalorieConsistencyScore(macros);
  const minConsistency = relaxed ? 40 : MIN_MACRO_CONSISTENCY_TO_USE;

  if (mc < 15) {
    if (cal >= 80) return false;
    return p > 0 || c > 0 || f > 0;
  }

  if (cal >= 120 && consistency < minConsistency) return false;
  if (cal >= 80 && mc < 20) return false;
  return true;
}

function brandTokenBonus(row, userQuery) {
  const tokens = significantQueryTokens(userQuery);
  if (tokens.length < 2) return 0;
  const text = getRowText(row).toLowerCase();
  const brandish = tokens.slice(0, Math.min(2, tokens.length));
  let bonus = 0;
  for (const t of brandish) {
    if (text.includes(t.replace(/-/g, ' ')) || text.includes(t)) bonus += 14;
  }
  return bonus;
}

/** Final sort key for Serper food cards returned to the app. */
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
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (isRetailCoffeeProduct(row, userQuery)) return false;
    const macros = getRowMacros(row);
    const rowText = getRowText(row);
    if (isLowCalBeverageRow(macros, userQuery, rowText)) return true;
    const consistency = macroCalorieConsistencyScore(macros);
    if (consistency < MIN_MACRO_CONSISTENCY_TO_USE) return false;
    if (!isPlausibleRestaurantNutritionRow(macros)) return false;
    if (hasImplausibleZeroMacros(macros, userQuery, getRowText(row))) return false;
    return true;
  });
}

function rankSerperFoodResultRows(rows, userQuery) {
  const list = Array.isArray(rows) ? rows : [];
  let usable = filterUsableSerperRows(list, userQuery);
  usable = filterComponentIngredientRows(usable, userQuery);

  const rankList = (candidates, unverifiedDefault, applyMultiAdjust) => {
    const sorted = candidates
      .map((row) => ({
        row,
        _sort: scoreSerperFoodResultRow(row, userQuery),
        _consistency: macroCalorieConsistencyScore(getRowMacros(row)),
      }))
      .sort(compareRankedRows);

    return sorted.map(({ row, _consistency }) => {
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
          (!lowCalDrink && _consistency < 65) ||
          Boolean(row.nutrition_unverified),
      };
    });
  };

  const buildPool = (candidates) => {
    const { singles, multis } = partitionSingleVsMultiServing(candidates);
    const useMultiOnly = singles.length === 0 && multis.length > 0;
    return {
      pool: useMultiOnly ? multis : singles.length > 0 ? singles : candidates,
      applyMultiAdjust: useMultiOnly,
    };
  };

  if (usable.length > 0) {
    const { pool, applyMultiAdjust } = buildPool(usable);
    return rankList(pool, false, applyMultiAdjust);
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
    return rankList(pool.slice(0, 8), true, applyMultiAdjust);
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
};
