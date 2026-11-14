// Turns an Open Food Facts product into the food object the daily log expects.
// Flow: read package quantity → decide ml vs grams → prefer label “per serving” → scale to per-100.
// Used by barcode lookup and OFF search. Food keys stay id / name / brand. Zero calories must survive via ??.
// Read order: constants → small helpers → main recipes → PLUMBING → exports.

// ===== NAMED CONSTANTS =====

const OUNCES_TO_GRAMS = 28.3495;
const FLUID_OUNCES_TO_ML = 29.5735;
const MILLILITERS_PER_LITER = 1000;
const DEFAULT_AMOUNT_PER_HUNDRED = 100;
const TYPICAL_CAN_SERVING_ML = 355;
const MAX_SERVING_AMOUNT = 10000;
const KILOJOULES_PER_KILOCALORIE = 4.184;
const SODIUM_MG_PER_GRAM_OF_SALT = 400;
const UNKNOWN_FOOD_NAME = 'Unknown';
const SOURCE_OPEN_FOOD_FACTS = 'openfoodfacts';
const SERVING_UNIT_ML = 'ml';
const SERVING_UNIT_GRAMS = 'grams';

// Manipulate here: OFF taxonomy tags that mean “this is a drink” (per-100ml keys).
const BEVERAGE_TAXONOMY_PATTERN = /:en:beverages|:en:sodas|:en:colas|:en:carbonated|:en:soft-drinks|:en:waters|:en:juices|:en:iced-teas|:en:energy-drinks|:en:sports-drinks|:en:alcoholic-beverages|:en:beers|:en:wines|:en:spirits|:en:plant-milk|:en:fruit-juices|carbonated drinks|beverages and beverages preparations/i;
const AMOUNT_CAPTURE_PATTERN = /(\d+(?:[.,]\d+)?)/;
const MILLILITER_QUANTITY_PATTERN = /(\d+(?:[.,]\d+)?)\s*ml/;
const LITER_QUANTITY_PATTERN = /(\d+(?:[.,]\d+)?)\s*l(?:itre)?s?/;
const FLUID_OUNCE_QUANTITY_PATTERN = /(\d+(?:[.,]\d+)?)\s*(?:fl\.?\s*oz\.?|fluid\s*oz)/;
const OUNCE_QUANTITY_PATTERN = /(\d+(?:[.,]\d+)?)\s*oz/;
const GRAM_QUANTITY_PATTERN = /(\d+(?:[.,]\d+)?)\s*g(?:ram)?s?/;
const GRAMS_INSIDE_SERVING_SIZE_PATTERN = /(\d+(?:[.,]\d+)?)\s*g/i;
const LEADING_DIGITS_PATTERN = /(\d+)/;

// ===== HELPER FUNCTIONS =====

/**
 * Parse a leading number that may use a comma decimal ("16,9").
 * @param {string} amountText
 * @returns {number|null}
 */
function parseLeadingAmount(amountText) {
  const parsedAmount = parseFloat(String(amountText).replace(',', '.'));
  if (Number.isNaN(parsedAmount)) return null;
  return parsedAmount;
}

/**
 * Round a positive amount; null when missing, NaN, or not above zero.
 * @param {number|null} amount
 * @returns {number|null}
 */
function positiveRoundedAmount(amount) {
  if (amount == null || Number.isNaN(amount) || amount <= 0) return null;
  return Math.round(amount);
}

/**
 * Match a unit regex on the quantity string and convert to { value, isLiquid }.
 * vocab: undefined = pattern did not match (try next unit); null = matched but number unusable.
 * @param {string} quantityText
 * @param {RegExp} pattern
 * @param {(amount: number) => number} convertToCanonical
 * @param {boolean} isLiquid
 * @returns {{ value: number, isLiquid: boolean }|null|undefined}
 */
function tryParseQuantityWithPattern(quantityText, pattern, convertToCanonical, isLiquid) {
  const matchResult = quantityText.match(pattern);
  if (!matchResult) return undefined;
  const rawAmount = parseLeadingAmount(matchResult[1]);
  const roundedAmount = positiveRoundedAmount(convertToCanonical(rawAmount));
  if (roundedAmount == null) return null;
  return {
    value: roundedAmount,
    isLiquid
  };
}

/**
 * Coerce any OFF nutriment field to a finite number, else 0.
 * Export name `num` is frozen — callers across search/barcode use it.
 * @param {*} value
 * @returns {number}
 */
function num(value) {
  if (value == null || value === '') return 0;
  const numericValue = Number(value);
  if (typeof numericValue === 'number' && !Number.isNaN(numericValue)) return numericValue;
  return 0;
}

/**
 * Same as num, but empty/missing stays null so callers can tell “not provided.”
 * @param {*} value
 * @returns {number|null}
 */
function numOrNull(value) {
  if (value == null || value === '') return null;
  const numericValue = Number(value);
  if (typeof numericValue === 'number' && !Number.isNaN(numericValue)) return numericValue;
  return null;
}

/**
 * Pick the per-100ml or per-100g OFF field for one nutrient.
 * vocab: ?? keeps a real 0 when the preferred key is missing but the other exists.
 * @param {object} nutriments
 * @param {boolean} usePerHundredMilliliters
 * @param {string} fieldPerHundredMl
 * @param {string} fieldPerHundredGrams
 * @returns {*}
 */
function nutrientFieldPerHundred(nutriments, usePerHundredMilliliters, fieldPerHundredMl, fieldPerHundredGrams) {
  if (usePerHundredMilliliters) {
    return nutriments[fieldPerHundredMl] ?? nutriments[fieldPerHundredGrams];
  }
  return nutriments[fieldPerHundredGrams];
}

/**
 * Scale a “per serving” OFF value back to per-100 of the same unit.
 * @param {*} servingValue
 * @param {number} servingAmount
 * @returns {number|null}
 */
function perHundredFromServingValue(servingValue, servingAmount) {
  if (servingValue == null || servingValue === '') return null;
  const numericValue = Number(servingValue);
  if (Number.isNaN(numericValue) || servingAmount <= 0) return null;
  return numericValue / servingAmount * DEFAULT_AMOUNT_PER_HUNDRED;
}

/**
 * Prefer the Nutrition-Facts “per serving” number when OFF has one.
 * @param {number|null} fromServing
 * @param {number|null} fallbackPerHundred
 * @param {boolean} [requirePositive]
 * @returns {number|null}
 */
function preferServingScaledPerHundred(fromServing, fallbackPerHundred, requirePositive) {
  if (fromServing == null) return fallbackPerHundred;
  if (requirePositive && !(fromServing > 0)) return fallbackPerHundred;
  return fromServing;
}

/**
 * Read one macro/micro: crowd per-100 first, then upgrade from `_serving` when present.
 * @param {object} nutriments
 * @param {boolean} nutrientsArePerHundredMl
 * @param {string} fieldPerHundredMl
 * @param {string} fieldPerHundredGrams
 * @param {*} servingFieldValue
 * @param {number} servingAmount
 * @param {{ allowNull?: boolean, requirePositiveServing?: boolean }} [options]
 * @returns {number|null}
 */
function nutrientPerHundredPreferringServing(nutriments, nutrientsArePerHundredMl, fieldPerHundredMl, fieldPerHundredGrams, servingFieldValue, servingAmount, options = {}) {
  const rawCrowdValue = nutrientFieldPerHundred(nutriments, nutrientsArePerHundredMl, fieldPerHundredMl, fieldPerHundredGrams);
  let perHundred;
  if (options.allowNull) {
    perHundred = numOrNull(rawCrowdValue);
  } else {
    perHundred = num(rawCrowdValue);
  }
  perHundred = preferServingScaledPerHundred(perHundredFromServingValue(servingFieldValue, servingAmount), perHundred, options.requirePositiveServing);
  return perHundred;
}

// ===== MAIN FUNCTION =====

/**
 * Build the food-card shape the log writer expects from one OFF product.
 * Flow: 1 parse pack  2 drink vs solid  3 serving amount  4 kcal  5 macros/micros  6 return card
 * @param {object} product
 * @returns {object|null}
 */
function normalizeOpenFoodFactsProduct(product) {
  if (!product || !product.code) return null;

  // 1. Read OFF nutriments and parse the printed package quantity string.
  const nutriments = product.nutriments || {};
  const quantityString = (product.quantity || '').toString().trim();
  const parsedPackage = parseQuantityToGramsOrMl(quantityString);

  // 2. Drinks use per-100ml keys; solids use per-100g.
  const productIsBeverage = productLooksLikeBeverage(product, parsedPackage);
  const nutrientsArePerHundredMl = productIsBeverage;

  // 3. Default serving amount: ml for drinks, grams from OFF serving fields for solids.
  let defaultServingAmount = DEFAULT_AMOUNT_PER_HUNDRED;
  if (nutrientsArePerHundredMl) {
    defaultServingAmount = beverageServingAmountMl(product, parsedPackage, productIsBeverage);
  } else {
    defaultServingAmount = gramsFromOpenFoodFactsServingFields(product);
  }
  const servingAmount = Math.min(MAX_SERVING_AMOUNT, Math.max(1, defaultServingAmount));
  let servingUnit;
  if (nutrientsArePerHundredMl) {
    servingUnit = SERVING_UNIT_ML;
  } else {
    servingUnit = SERVING_UNIT_GRAMS;
  }
  const servingScale = servingAmount / DEFAULT_AMOUNT_PER_HUNDRED;

  // 4. Calories per 100 (same unit as step 2), preferring label “per serving” when OFF has it.
  let kilocaloriesPerHundred;
  if (nutrientsArePerHundredMl) {
    kilocaloriesPerHundred = getKcalPer100(nutriments, product, true) || getKcalPer100(nutriments, product, false);
  } else {
    kilocaloriesPerHundred = getKcalPer100(nutriments, product, false);
  }
  kilocaloriesPerHundred = preferServingScaledPerHundred(perHundredFromServingValue(nutriments['energy-kcal_serving'], servingAmount), kilocaloriesPerHundred, true);

  // 5. Macros and micros — crowd per-100 first, then upgrade from `_serving` fields when present.
  const proteinPerHundred = nutrientPerHundredPreferringServing(nutriments, nutrientsArePerHundredMl, 'proteins_100ml', 'proteins_100g', nutriments.proteins_serving, servingAmount);
  const carbsPerHundred = nutrientPerHundredPreferringServing(nutriments, nutrientsArePerHundredMl, 'carbohydrates_100ml', 'carbohydrates_100g', nutriments.carbohydrates_serving, servingAmount);
  const fatPerHundred = nutrientPerHundredPreferringServing(nutriments, nutrientsArePerHundredMl, 'fat_100ml', 'fat_100g', nutriments.fat_serving, servingAmount);
  const sugarPerHundred = nutrientPerHundredPreferringServing(nutriments, nutrientsArePerHundredMl, 'sugars_100ml', 'sugars_100g', nutriments.sugars_serving, servingAmount, {
    allowNull: true
  });

  // Sodium: crowd sodium_* first; if missing, derive from salt grams × 400 mg/g; then prefer `_serving`.
  // Order matches the prior recipe so salt fills before the serving upgrade runs.
  const sodiumRaw = nutrientFieldPerHundred(nutriments, nutrientsArePerHundredMl, 'sodium_100ml', 'sodium_100g');
  const saltRaw = nutrientFieldPerHundred(nutriments, nutrientsArePerHundredMl, 'salt_100ml', 'salt_100g');
  let sodiumPerHundred = numOrNull(sodiumRaw);
  if (sodiumPerHundred == null && saltRaw != null) {
    sodiumPerHundred = num(saltRaw) * SODIUM_MG_PER_GRAM_OF_SALT;
  }
  sodiumPerHundred = preferServingScaledPerHundred(perHundredFromServingValue(nutriments.sodium_serving, servingAmount), sodiumPerHundred);
  const fiberPerHundred = nutrientPerHundredPreferringServing(nutriments, nutrientsArePerHundredMl, 'fiber_100ml', 'fiber_100g', nutriments.fiber_serving, servingAmount, {
    allowNull: true
  });

  // 6. Food-card shape the log writer expects (id / name / brand keys frozen).
  return {
    id: product.code,
    name: product.product_name || UNKNOWN_FOOD_NAME,
    brand: product.brands || null,
    restaurant: null,
    calories: kilocaloriesPerHundred,
    protein: proteinPerHundred,
    carbs: carbsPerHundred,
    fat: fatPerHundred,
    fiber: fiberPerHundred,
    sodium: sodiumPerHundred,
    sugar: sugarPerHundred,
    servingSize: servingScale,
    servingUnit,
    servingGrams: servingAmount,
    source: SOURCE_OPEN_FOOD_FACTS,
    kcalPer100Unit: kilocaloriesPerHundred,
    servingAmount
  };
}

/**
 * Parse a printed package quantity (“330 ml”, “12 fl oz”, “16 oz”) into grams or ml.
 * @param {string|null|undefined} quantityString
 * @returns {{ value: number, isLiquid: boolean }|null}
 */
function parseQuantityToGramsOrMl(quantityString) {
  if (quantityString == null || typeof quantityString !== 'string') return null;
  const quantityText = quantityString.trim().toLowerCase();
  if (!quantityText) return null;

  // 1. Explicit ml, liters, and US fluid ounces (always liquid).
  const fromMilliliters = tryParseQuantityWithPattern(quantityText, MILLILITER_QUANTITY_PATTERN, amount => amount, true);
  if (fromMilliliters !== undefined) return fromMilliliters;
  const fromLiters = tryParseQuantityWithPattern(quantityText, LITER_QUANTITY_PATTERN, amount => amount * MILLILITERS_PER_LITER, true);
  if (fromLiters !== undefined) return fromLiters;
  const fromFluidOunces = tryParseQuantityWithPattern(quantityText, FLUID_OUNCE_QUANTITY_PATTERN, amount => amount * FLUID_OUNCES_TO_ML, true);
  if (fromFluidOunces !== undefined) return fromFluidOunces;

  // 2. Plain “oz” is often weight — convert to grams, not ml.
  const ouncesMatch = quantityText.match(OUNCE_QUANTITY_PATTERN);
  if (ouncesMatch) {
    const ounceAmount = parseLeadingAmount(ouncesMatch[1]);
    if (ounceAmount != null && ounceAmount > 0) {
      return {
        value: Math.round(ounceAmount * OUNCES_TO_GRAMS),
        isLiquid: false
      };
    }
  }

  // 3. Grams, then a bare leading number (assume grams).
  const fromGrams = tryParseQuantityWithPattern(quantityText, GRAM_QUANTITY_PATTERN, amount => amount, false);
  if (fromGrams !== undefined) return fromGrams;
  const fromBareNumber = tryParseQuantityWithPattern(quantityText, AMOUNT_CAPTURE_PATTERN, amount => amount, false);
  if (fromBareNumber !== undefined) return fromBareNumber;
  return null;
}

/**
 * Calories per 100g or 100ml from OFF nutriments (falls back to kJ ÷ 4.184).
 * @param {object} nutriments
 * @param {object} product
 * @param {boolean} perHundredMilliliters
 * @returns {number}
 */
function getKcalPer100(nutriments, product, perHundredMilliliters) {
  let unitSuffix;
  if (perHundredMilliliters) {
    unitSuffix = '_100ml';
  } else {
    unitSuffix = '_100g';
  }
  const kilocalorieKey = `energy-kcal${unitSuffix}`;
  const kilojouleKey = `energy${unitSuffix}`;

  // vocab: ?? keeps a real 0 calorie value from the preferred field.
  let kilocalories = nutriments[kilocalorieKey] ?? product?.[`energy_kcal${unitSuffix}`];
  if (kilocalories == null || Number.isNaN(Number(kilocalories))) {
    const kilojoules = nutriments[kilojouleKey] ?? product?.[`energy${unitSuffix}`];
    if (kilojoules != null && kilojoules !== '') {
      kilocalories = Number(kilojoules) / KILOJOULES_PER_KILOCALORIE;
    } else {
      kilocalories = 0;
    }
  }
  return num(kilocalories);
}

// PLUMBING — skip unless debugging quantity regex or OFF beverage heuristics.

/**
 * True when OFF taxonomy / pack unit / nutrition_data_per say this is a drink.
 * @param {object} product
 * @param {{ isLiquid?: boolean }|null} parsedPackage
 * @returns {boolean}
 */
function productLooksLikeBeverage(product, parsedPackage) {
  const quantitySaysSolid = parsedPackage?.isLiquid === false;
  const quantitySaysLiquid = parsedPackage?.isLiquid === true;
  const unitLower = String(product.product_quantity_unit || '').toLowerCase();
  const packSizedAsLiquid = unitLower === 'ml' || unitLower === 'cl' || unitLower === 'l';
  const categoryHaystack = (product.categories_hierarchy || []).join(' ').toLowerCase();
  const matchesBeverageTaxonomy = BEVERAGE_TAXONOMY_PATTERN.test(categoryHaystack);
  const nutritionDataPer = String(product.nutrition_data_per || '').toLowerCase();
  const labeledPerHundredMl = nutritionDataPer === '100ml';
  if (quantitySaysLiquid) return true;
  if (packSizedAsLiquid && !quantitySaysSolid) return true;
  if (matchesBeverageTaxonomy && !quantitySaysSolid) return true;
  if (labeledPerHundredMl && !quantitySaysSolid) return true;
  return false;
}

/**
 * Milliliters from product_quantity when the unit is explicitly ml.
 * @param {object} product
 * @returns {number|null}
 */
function millilitersFromProductQuantityField(product) {
  const unitText = String(product.product_quantity_unit || '').toLowerCase();
  if (product.product_quantity == null || unitText !== 'ml') return null;
  return positiveRoundedAmount(Number(product.product_quantity));
}

/**
 * Serving ml for a drink: parsed pack → product_quantity ml → typical can.
 * @param {object} product
 * @param {{ value?: number }|null} parsedPackage
 * @param {boolean} isBeverage
 * @returns {number}
 */
function beverageServingAmountMl(product, parsedPackage, isBeverage) {
  // vocab: ?? keeps a real 0 package value if OFF ever sends one.
  const parsedAmount = parsedPackage?.value ?? DEFAULT_AMOUNT_PER_HUNDRED;
  if (parsedAmount !== DEFAULT_AMOUNT_PER_HUNDRED) return parsedAmount;
  const packageMilliliters = millilitersFromProductQuantityField(product);
  if (packageMilliliters != null) return packageMilliliters;
  if (isBeverage) return TYPICAL_CAN_SERVING_ML;
  return parsedAmount;
}

/**
 * Grams from serving_quantity or digits inside serving_size text.
 * vocab: ?? on serving_quantity keeps a real 0 when OFF sends zero.
 * @param {object} product
 * @returns {number}
 */
function gramsFromOpenFoodFactsServingFields(product) {
  const servingQuantityIsNumber = product.serving_quantity != null && !Number.isNaN(Number(product.serving_quantity));
  let servingQuantityNumber;
  if (servingQuantityIsNumber) {
    servingQuantityNumber = Number(product.serving_quantity);
  } else {
    servingQuantityNumber = null;
  }
  const servingSizeText = (product.serving_size || '').toString();
  const gramsMatch = servingSizeText.match(GRAMS_INSIDE_SERVING_SIZE_PATTERN) || servingSizeText.match(LEADING_DIGITS_PATTERN);
  let gramsFromSizeText;
  if (gramsMatch) {
    gramsFromSizeText = parseFloat(gramsMatch[1].replace(',', '.'));
  } else {
    gramsFromSizeText = null;
  }
  const fromServingFields = servingQuantityNumber ?? gramsFromSizeText;
  if (fromServingFields != null && fromServingFields > 0) return Math.round(fromServingFields);
  return DEFAULT_AMOUNT_PER_HUNDRED;
}
module.exports = {
  parseQuantityToGramsOrMl,
  normalizeOpenFoodFactsProduct,
  getKcalPer100,
  num,
  numOrNull
};