// Shared serving / gram math for barcode and per-100g food sources.
// Flow: detect per-100g vs label-serving → resolve grams → scale calories and macros → sanitize barcode payloads.
// Used by: food search confirm, daily log save, and FoodItem calorie math. CommonJS so Metro can require() it.

// ===== NAMED CONSTANTS =====

const SOURCE_OPENFOODFACTS = 'openfoodfacts';
const SOURCE_USDA = 'usda';
const PER_100G_SOURCES = new Set([SOURCE_OPENFOODFACTS, SOURCE_USDA]);

const DATA_BASIS_LABEL_SERVING = 'label_serving';
const DATA_BASIS_PER_SERVING = 'per_serving';
const DATA_BASIS_PER_100G = 'per_100g';
const DATA_BASIS_PER_100 = 'per_100';

const GRAMS_PER_100 = 100;
const MAX_SERVING_GRAMS = 10000;
const MIN_SERVING_GRAMS = 1;
const MAX_PORTION_FACTOR_FOR_GRAMS_GUESS = 2;
/** Max plausible kcal per 100 g — catches bad Open Food Facts crowdsourced *_serving derivations. */
const MAX_SANE_KCAL_PER_100 = 1000;
const TENTHS = 10;
const LABEL_SERVING_FACTOR = 1;

const FRACTION_INPUT_PATTERN = /^(\d+)\s*\/\s*(\d+)$/;

// ===== HELPER FUNCTIONS =====

/**
 * Coerce to a finite number, or 0 when the value is junk.
 * @param {*} rawValue
 * @returns {number}
 */
function numericOrZero(rawValue) {
  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

/**
 * Clamp a gram amount into 1–10000 so a typo cannot explode the log.
 * @param {number} grams
 * @returns {number}
 */
function clampServingGrams(grams) {
  return Math.min(MAX_SERVING_GRAMS, Math.max(MIN_SERVING_GRAMS, Math.round(grams)));
}

/**
 * One decimal place, the way food labels round macros.
 * @param {number} nutrientValue
 * @returns {number}
 */
function roundToTenths(nutrientValue) {
  return Math.round(nutrientValue * TENTHS) / TENTHS;
}

// ===== MAIN FUNCTION =====

/**
 * True when this food's calories/macros are stored per 100 g (or 100 ml), not per serving.
 * @param {string} source
 * @returns {boolean}
 */
function isPer100gSource(source) {
  return PER_100G_SOURCES.has(String(source || '').toLowerCase());
}

/**
 * FatSecret / Serper / manual often store label serving totals, not per-100g.
 * @param {object} food
 * @returns {boolean}
 */
function isLabelServingBasis(food) {
  const basis = String(food?.dataBasis || '').toLowerCase();
  if (basis === DATA_BASIS_LABEL_SERVING || basis === DATA_BASIS_PER_SERVING) return true;
  if (basis === DATA_BASIS_PER_100G || basis === DATA_BASIS_PER_100) return false;
  return !isPer100gSource(food?.source);
}

/**
 * Resolve logged/scanned amount in grams (or ml for beverages).
 * @param {object} food
 * @returns {number}
 */
function resolveServingGrams(food) {
  const grams = numericOrZero(food?.servingGrams) || numericOrZero(food?.servingAmount);
  if (grams > 0) return clampServingGrams(grams);
  const portionFactor = numericOrZero(food?.servingSize);
  if (portionFactor > 0 && portionFactor <= MAX_PORTION_FACTOR_FOR_GRAMS_GUESS) {
    return clampServingGrams(portionFactor * GRAMS_PER_100);
  }
  return GRAMS_PER_100;
}

/**
 * Factor to multiply nutrient values for a chosen gram amount.
 * Label-serving foods already store the full serving, so the factor stays 1.
 * @param {object} food
 * @returns {number}
 */
function resolveServingFactor(food) {
  const grams = resolveServingGrams(food);
  if (isLabelServingBasis(food)) return LABEL_SERVING_FACTOR;
  return grams / GRAMS_PER_100;
}

/**
 * Scale a per-100g nutrient to an arbitrary gram amount.
 * @param {*} per100Value
 * @param {*} grams
 * @returns {number}
 */
function nutrientTotalForGrams(per100Value, grams) {
  return numericOrZero(per100Value) * (numericOrZero(grams) / GRAMS_PER_100);
}

/**
 * Calories for this food at `grams`. Label-serving foods scale from the listed serving, not 100 g.
 * @param {object} food
 * @param {*} grams
 * @returns {number}
 */
function caloriesForGrams(food, grams) {
  const gramAmount = numericOrZero(grams) > 0 ? numericOrZero(grams) : resolveServingGrams(food);
  if (isLabelServingBasis(food)) {
    const baseGrams = resolveServingGrams(food) || GRAMS_PER_100;
    const labelCalories = numericOrZero(food?.calories) || numericOrZero(food?.nf_calories) || numericOrZero(food?.kcalPer100Unit);
    return Math.round(labelCalories * (gramAmount / baseGrams));
  }
  const per100Calories = numericOrZero(food?.calories) || numericOrZero(food?.kcalPer100Unit);
  return Math.round(nutrientTotalForGrams(per100Calories, gramAmount));
}

/**
 * Scale a macro (protein/carbs/fat) the same way as calories, rounded to one decimal.
 * @param {*} per100OrLabelValue
 * @param {*} grams
 * @param {object|null} [food]
 * @returns {number}
 */
function scaleMacroForGrams(per100OrLabelValue, grams, food = null) {
  if (food && isLabelServingBasis(food)) {
    const baseGrams = resolveServingGrams(food) || GRAMS_PER_100;
    return roundToTenths(numericOrZero(per100OrLabelValue) * (numericOrZero(grams) / baseGrams));
  }
  return roundToTenths(nutrientTotalForGrams(per100OrLabelValue, grams));
}

/**
 * Normalize barcode / per-100g food payloads so servingSize is always grams/100.
 * @param {object} food
 * @returns {object}
 */
function finalizeBarcodeFood(food) {
  if (!food || !isPer100gSource(food.source)) return food;

  const grams = resolveServingGrams(food);
  let per100Kcal = numericOrZero(food.calories) || numericOrZero(food.kcalPer100Unit);

  if (per100Kcal > MAX_SANE_KCAL_PER_100) {
    const fallbackKcal = numericOrZero(food.kcalPer100Unit);
    if (fallbackKcal > 0 && fallbackKcal <= MAX_SANE_KCAL_PER_100) {
      per100Kcal = fallbackKcal;
    } else {
      per100Kcal = MAX_SANE_KCAL_PER_100;
    }
  }

  return {
    ...food,
    calories: per100Kcal,
    kcalPer100Unit: per100Kcal || food.kcalPer100Unit,
    servingGrams: grams,
    servingAmount: grams,
    servingSize: grams / GRAMS_PER_100,
  };
}

/**
 * Multiply a macro bundle by a serving count. Zero/invalid servings return zeros with servings: 0.
 * @param {object} macros
 * @param {*} servings
 * @returns {object}
 */
function scaleNutritionByServings(macros, servings) {
  const servingCount = Number(servings);
  if (!Number.isFinite(servingCount) || servingCount <= 0) return { ...macros, servings: 0 };
  return {
    calories: roundToTenths(numericOrZero(macros?.calories) * servingCount),
    protein: roundToTenths(numericOrZero(macros?.protein) * servingCount),
    carbs: roundToTenths(numericOrZero(macros?.carbs) * servingCount),
    fat: roundToTenths(numericOrZero(macros?.fat) * servingCount),
    servings: servingCount,
  };
}

/**
 * Total grams = quantity × grams per serving.
 * @param {*} qty
 * @param {*} gramsPerServing
 * @returns {number}
 */
function totalGramsFromServing(qty, gramsPerServing) {
  const quantity = Number(qty);
  const grams = Number(gramsPerServing);
  if (!Number.isFinite(quantity) || !Number.isFinite(grams)) return 0;
  return Math.round(quantity * grams);
}

/**
 * Parse a serving quantity typed as "2", "1/2", or empty. Empty or 1/0 → null.
 * @param {*} value
 * @returns {number|null}
 */
function parseServingQtyInput(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const fraction = trimmed.match(FRACTION_INPUT_PATTERN);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return numerator / denominator;
  }
  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) ? numericValue : null;
}

module.exports = {
  PER_100G_SOURCES,
  MAX_SANE_KCAL_PER_100,
  isPer100gSource,
  isLabelServingBasis,
  resolveServingGrams,
  resolveServingFactor,
  nutrientTotalForGrams,
  caloriesForGrams,
  scaleMacroForGrams,
  finalizeBarcodeFood,
  scaleNutritionByServings,
  totalGramsFromServing,
  parseServingQtyInput,
};
