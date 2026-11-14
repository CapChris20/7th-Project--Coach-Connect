// Gram and serving math for barcode rows, Open Food Facts, and USDA per-100g data.
// Flow: decide label-serving vs per-100g → grams for the portion → scale kcal/macros → sanitize barcode payloads.
// Used by food confirm, daily log save, and FoodItem. CommonJS so Metro can require() it.
// Read order: constants → main recipes → PLUMBING numeric helpers → module.exports.

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
// Manipulate here: cap kcal/100g — catches bad OFF crowdsourced *_serving derivations
const MAX_SANE_KCAL_PER_100 = 1000;
const TENTHS = 10;
const LABEL_SERVING_FACTOR = 1;

const FRACTION_INPUT_PATTERN = /^(\d+)\s*\/\s*(\d+)$/;

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging gram clamps / kcal caps.

function numericOrZero(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function clampServingGrams(grams) {
  const rounded = Math.round(grams);
  const cappedHigh = Math.min(MAX_SERVING_GRAMS, rounded);
  return Math.max(MIN_SERVING_GRAMS, cappedHigh);
}

function roundToTenths(nutrientValue) {
  return Math.round(numericOrZero(nutrientValue) * TENTHS) / TENTHS;
}

function clampPer100Calories(food) {
  let per100Kcal = numericOrZero(food.calories) || numericOrZero(food.kcalPer100Unit);

  if (per100Kcal <= MAX_SANE_KCAL_PER_100) return per100Kcal;

  const fallbackKcal = numericOrZero(food.kcalPer100Unit);
  if (fallbackKcal > 0 && fallbackKcal <= MAX_SANE_KCAL_PER_100) {
    return fallbackKcal;
  }
  return MAX_SANE_KCAL_PER_100;
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

// ===== MAIN FUNCTION =====
// Exported recipes — numbered steps. Numeric plumbing is below.

/**
 * True when this food's calories/macros are stored per 100 g (or 100 ml), not per package serving.
 * @param {string} source
 * @returns {boolean}
 */
// vocab: per-100g source = Open Food Facts / USDA store numbers per 100 g/ml
function isPer100gSource(source) {
  const sourceKey = String(source || '').toLowerCase();
  return PER_100G_SOURCES.has(sourceKey);
}

/**
 * True when the card already holds label-serving totals (FatSecret / Serper / manual).
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
 * Pick how many grams one “serving” is for this food.
 * Flow: 1. explicit grams  2. tiny servingSize as portions of 100 g  3. default 100 g
 * @param {object} food
 * @returns {number}
 */
function resolveServingGrams(food) {
  // 1. Prefer explicit gram fields from the scanner or editor.
  const gramsFromFood =
    numericOrZero(food?.servingGrams) || numericOrZero(food?.servingAmount);
  if (gramsFromFood > 0) return clampServingGrams(gramsFromFood);

  // 2. Tiny servingSize (e.g. 1.5) means “portions of 100 g” on some cards.
  const portionFactor = numericOrZero(food?.servingSize);
  const looksLikePortionOfHundred =
    portionFactor > 0 && portionFactor <= MAX_PORTION_FACTOR_FOR_GRAMS_GUESS;
  if (looksLikePortionOfHundred) {
    return clampServingGrams(portionFactor * GRAMS_PER_100);
  }

  // 3. Safe default for per-100g foods with no gram fields.
  return GRAMS_PER_100;
}

/**
 * How many “100 g units” this serving is (1 for label-serving foods).
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
 * @param {number} per100Value
 * @param {number} grams
 * @returns {number}
 */
function nutrientTotalForGrams(per100Value, grams) {
  const perHundred = numericOrZero(per100Value);
  const gramAmount = numericOrZero(grams);
  return perHundred * (gramAmount / GRAMS_PER_100);
}

/**
 * Calories for a gram amount — label-serving scales from the package total; else per-100g.
 * @param {object} food
 * @param {number} grams
 * @returns {number}
 */
function caloriesForGrams(food, grams) {
  const typedGrams = numericOrZero(grams);
  const gramAmount = typedGrams > 0 ? typedGrams : resolveServingGrams(food);

  if (isLabelServingBasis(food)) {
    const baseGrams = resolveServingGrams(food) || GRAMS_PER_100;
    const labelCalories =
      numericOrZero(food?.calories) ||
      numericOrZero(food?.nf_calories) ||
      numericOrZero(food?.kcalPer100Unit);
    return Math.round(labelCalories * (gramAmount / baseGrams));
  }

  const per100Calories = numericOrZero(food?.calories) || numericOrZero(food?.kcalPer100Unit);
  return Math.round(nutrientTotalForGrams(per100Calories, gramAmount));
}

/**
 * Scale one macro to grams (label-serving or per-100g). Returns one decimal place.
 * @param {number} per100OrLabelValue
 * @param {number} grams
 * @param {object|null} [food]
 * @returns {number}
 */
function scaleMacroForGrams(per100OrLabelValue, grams, food = null) {
  if (food && isLabelServingBasis(food)) {
    const baseGrams = resolveServingGrams(food) || GRAMS_PER_100;
    const scaled =
      numericOrZero(per100OrLabelValue) * (numericOrZero(grams) / baseGrams);
    return roundToTenths(scaled);
  }
  return roundToTenths(nutrientTotalForGrams(per100OrLabelValue, grams));
}

/**
 * Clamp absurd barcode kcal/100g and stamp servingGrams / servingSize for logging.
 * @param {object} food
 * @returns {object}
 */
function finalizeBarcodeFood(food) {
  if (!food || !isPer100gSource(food.source)) return food;

  const grams = resolveServingGrams(food);
  const sanePer100Kcal = clampPer100Calories(food);

  return {
    ...food,
    calories: sanePer100Kcal,
    kcalPer100Unit: sanePer100Kcal || food.kcalPer100Unit,
    servingGrams: grams,
    servingAmount: grams,
    servingSize: grams / GRAMS_PER_100,
  };
}

/**
 * Multiply a macros bag by how many servings the user chose.
 * @param {object} macros
 * @param {number} servings
 * @returns {object}
 */
function scaleNutritionByServings(macros, servings) {
  const servingCount = Number(servings);
  if (!Number.isFinite(servingCount) || servingCount <= 0) {
    return { ...macros, servings: 0 };
  }
  return {
    calories: roundToTenths(numericOrZero(macros?.calories) * servingCount),
    protein: roundToTenths(numericOrZero(macros?.protein) * servingCount),
    carbs: roundToTenths(numericOrZero(macros?.carbs) * servingCount),
    fat: roundToTenths(numericOrZero(macros?.fat) * servingCount),
    servings: servingCount,
  };
}

/**
 * Total grams = quantity × grams-per-serving (0 when either side is junk).
 * @param {number|string} qty
 * @param {number|string} gramsPerServing
 * @returns {number}
 */
function totalGramsFromServing(qty, gramsPerServing) {
  const quantity = Number(qty);
  const grams = Number(gramsPerServing);
  if (!Number.isFinite(quantity) || !Number.isFinite(grams)) return 0;
  return Math.round(quantity * grams);
}

/**
 * Parse “1.5” or “1/2” serving input from the edit sheet. null = not a number.
 * @param {string|number} value
 * @returns {number|null}
 */
function parseServingQtyInput(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;

  const fractionMatch = trimmed.match(FRACTION_INPUT_PATTERN);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    if (denominator === 0) return null;
    return numerator / denominator;
  }

  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue)) return null;
  return numericValue;
}

