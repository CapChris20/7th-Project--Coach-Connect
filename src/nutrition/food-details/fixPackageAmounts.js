// Turns an Open Food Facts product into the food object the log expects: serving amount + per-100 macros.
// Flow: parse package quantity → decide ml vs grams → prefer Nutrition-Facts "per serving" → scale to per-100.
// Used by: barcode / OFF search. Keep food record keys name/brand. Zero calories must survive via ??.

// ===== NAMED CONSTANTS =====

const OZ_TO_GRAMS = 28.3495;
const FL_OZ_TO_ML = 29.5735;
const ML_PER_LITER = 1000;
const DEFAULT_PER_100 = 100;
const CAN_SERVING_ML = 355;
const MAX_SERVING_AMOUNT = 10000;
const KJ_PER_KCAL = 4.184;
const SODIUM_MG_PER_GRAM_SALT = 400;
const UNKNOWN_FOOD_NAME = 'Unknown';
const SOURCE_OPEN_FOOD_FACTS = 'openfoodfacts';
const SERVING_UNIT_ML = 'ml';
const SERVING_UNIT_GRAMS = 'grams';

const BEVERAGE_TAXONOMY_RE =
  /:en:beverages|:en:sodas|:en:colas|:en:carbonated|:en:soft-drinks|:en:waters|:en:juices|:en:iced-teas|:en:energy-drinks|:en:sports-drinks|:en:alcoholic-beverages|:en:beers|:en:wines|:en:spirits|:en:plant-milk|:en:fruit-juices|carbonated drinks|beverages and beverages preparations/i;

const AMOUNT_CAPTURE_RE = /(\d+(?:[.,]\d+)?)/;
const ML_QUANTITY_RE = /(\d+(?:[.,]\d+)?)\s*ml/;
const LITER_QUANTITY_RE = /(\d+(?:[.,]\d+)?)\s*l(?:itre)?s?/;
const FL_OZ_QUANTITY_RE = /(\d+(?:[.,]\d+)?)\s*(?:fl\.?\s*oz\.?|fluid\s*oz)/;
const OZ_QUANTITY_RE = /(\d+(?:[.,]\d+)?)\s*oz/;
const GRAM_QUANTITY_RE = /(\d+(?:[.,]\d+)?)\s*g(?:ram)?s?/;
const SERVING_GRAMS_IN_SIZE_RE = /(\d+(?:[.,]\d+)?)\s*g/i;
const LEADING_DIGITS_RE = /(\d+)/;

// ===== HELPER FUNCTIONS =====

/**
 * Parse a leading number that may use a comma decimal ("16,9").
 * @param {string} amountText
 * @returns {number|null}
 */
function parseLeadingAmount(amountText) {
  const parsed = parseFloat(String(amountText).replace(',', '.'));
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * @param {number|null} amount
 * @returns {number|null}
 */
function positiveRounded(amount) {
  if (amount == null || Number.isNaN(amount) || amount <= 0) return null;
  return Math.round(amount);
}

/**
 * Match this unit and STOP (even if the number is unusable). `undefined` means "try the next unit".
 * Plain "oz" is the exception — it falls through — so it is handled separately below.
 * @param {string} quantityText
 * @param {RegExp} pattern
 * @param {function(number): number} toCanonical
 * @param {boolean} isLiquid
 * @returns {{ value: number, isLiquid: boolean }|null|undefined}
 */
function firstMatchingQuantity(quantityText, pattern, toCanonical, isLiquid) {
  const matchResult = quantityText.match(pattern);
  if (!matchResult) return undefined;
  const rounded = positiveRounded(toCanonical(parseLeadingAmount(matchResult[1])));
  if (rounded == null) return null;
  return { value: rounded, isLiquid };
}

/**
 * Parse a quantity string (e.g. "500 ml", "16.9 fl oz", "12 oz", "340 g") into grams or ml.
 * Sequential matchers (not nested) so each unit is one return.
 * @param {string} quantityString
 * @returns {{ value: number, isLiquid: boolean }|null}
 */
function parseQuantityToGramsOrMl(quantityString) {
  if (quantityString == null || typeof quantityString !== 'string') return null;
  const quantityText = quantityString.trim().toLowerCase();
  if (!quantityText) return null;

  const fromMl = firstMatchingQuantity(quantityText, ML_QUANTITY_RE, (amount) => amount, true);
  if (fromMl !== undefined) return fromMl;

  const fromLiters = firstMatchingQuantity(
    quantityText,
    LITER_QUANTITY_RE,
    (amount) => amount * ML_PER_LITER,
    true,
  );
  if (fromLiters !== undefined) return fromLiters;

  const fromFlOz = firstMatchingQuantity(
    quantityText,
    FL_OZ_QUANTITY_RE,
    (amount) => amount * FL_OZ_TO_ML,
    true,
  );
  if (fromFlOz !== undefined) return fromFlOz;

  // Plain "oz" often means weight. Invalid numbers fall through to grams / bare digits, unlike ml.
  const ouncesMatch = quantityText.match(OZ_QUANTITY_RE);
  if (ouncesMatch) {
    const ounces = parseLeadingAmount(ouncesMatch[1]);
    if (ounces != null && ounces > 0) {
      return { value: Math.round(ounces * OZ_TO_GRAMS), isLiquid: false };
    }
  }

  const fromGrams = firstMatchingQuantity(quantityText, GRAM_QUANTITY_RE, (amount) => amount, false);
  if (fromGrams !== undefined) return fromGrams;

  const fromBareNumber = firstMatchingQuantity(quantityText, AMOUNT_CAPTURE_RE, (amount) => amount, false);
  if (fromBareNumber !== undefined) return fromBareNumber;

  return null;
}

/**
 * Safe numeric value for OFF nutriments.
 * @param {*} value
 * @returns {number}
 */
function num(value) {
  if (value == null || value === '') return 0;
  const numericValue = Number(value);
  return typeof numericValue === 'number' && !Number.isNaN(numericValue) ? numericValue : 0;
}

/**
 * Safe numeric or null.
 * @param {*} value
 * @returns {number|null}
 */
function numOrNull(value) {
  if (value == null || value === '') return null;
  const numericValue = Number(value);
  return typeof numericValue === 'number' && !Number.isNaN(numericValue) ? numericValue : null;
}

/**
 * kcal per 100g or 100ml from OFF nutriments (handles kJ fallback).
 * vocab/symbol: ?? keeps a real 0 kcal reading instead of falling through to kJ.
 * @param {object} nutriments
 * @param {object} product
 * @param {boolean} per100ml
 * @returns {number}
 */
function getKcalPer100(nutriments, product, per100ml) {
  const suffix = per100ml ? '_100ml' : '_100g';
  const kcalKey = `energy-kcal${suffix}`;
  const kjKey = `energy${suffix}`;
  let kcal = nutriments[kcalKey] ?? product?.[`energy_kcal${suffix}`];
  if (kcal == null || Number.isNaN(Number(kcal))) {
    const kilojoules = nutriments[kjKey] ?? product?.[`energy${suffix}`];
    kcal = kilojoules != null && kilojoules !== '' ? Number(kilojoules) / KJ_PER_KCAL : 0;
  }
  return num(kcal);
}

/**
 * True when OFF (or the quantity string) says this is a drink. Solids tagged "oz" must not become ml.
 * @param {object} product
 * @param {object|null} parsed
 * @returns {boolean}
 */
function isOpenFoodFactsBeverage(product, parsed) {
  const explicitSolidFromQuantity = parsed?.isLiquid === false;
  const explicitLiquidFromQuantity = parsed?.isLiquid === true;
  const unitLower = String(product.product_quantity_unit || '').toLowerCase();
  const packSizedAsLiquid = unitLower === 'ml' || unitLower === 'cl' || unitLower === 'l';
  const categoryHaystack = (product.categories_hierarchy || []).join(' ').toLowerCase();
  const beverageTaxonomy = BEVERAGE_TAXONOMY_RE.test(categoryHaystack);
  const nutDataPer = String(product.nutrition_data_per || '').toLowerCase();
  const labeledPer100ml = nutDataPer === '100ml';

  if (explicitLiquidFromQuantity) return true;
  if (packSizedAsLiquid && !explicitSolidFromQuantity) return true;
  if (beverageTaxonomy && !explicitSolidFromQuantity) return true;
  if (labeledPer100ml && !explicitSolidFromQuantity) return true;
  return false;
}

/**
 * @param {object} product
 * @returns {number|null}
 */
function millilitersFromProductQuantity(product) {
  const unitText = String(product.product_quantity_unit || '').toLowerCase();
  if (product.product_quantity == null || unitText !== 'ml') return null;
  return positiveRounded(Number(product.product_quantity));
}

/**
 * Drink serving: parsed package size, else product_quantity ml, else a 12 fl oz can.
 * @param {object} product
 * @param {object|null} parsed
 * @param {boolean} isBeverage
 * @returns {number}
 */
function beverageServingAmount(product, parsed, isBeverage) {
  const parsedAmount = parsed?.value ?? DEFAULT_PER_100;
  if (parsedAmount !== DEFAULT_PER_100) return parsedAmount;

  const packageMl = millilitersFromProductQuantity(product);
  if (packageMl != null) return packageMl;

  if (isBeverage) return CAN_SERVING_ML;
  return parsedAmount;
}

/**
 * Solid serving: OFF serving_quantity / serving_size grams, else 100g (not the full package).
 * vocab/symbol: ?? prefers serving_quantity when it is present, even if it is 0.
 * @param {object} product
 * @returns {number}
 */
function gramsFromServingFields(product) {
  const servingQuantityNumber =
    product.serving_quantity != null && !Number.isNaN(Number(product.serving_quantity))
      ? Number(product.serving_quantity)
      : null;
  const servingSizeText = (product.serving_size || '').toString();
  const gramsMatch = servingSizeText.match(SERVING_GRAMS_IN_SIZE_RE) || servingSizeText.match(LEADING_DIGITS_RE);
  const gramsFromSizeText = gramsMatch ? parseFloat(gramsMatch[1].replace(',', '.')) : null;
  const fromServing = servingQuantityNumber ?? gramsFromSizeText;
  if (fromServing != null && fromServing > 0) return Math.round(fromServing);
  return DEFAULT_PER_100;
}

/**
 * Scale a "per serving" Nutrition Facts value up/down to per-100 of the same unit.
 * @param {*} servingVal
 * @param {number} servingAmount
 * @returns {number|null}
 */
function per100FromServing(servingVal, servingAmount) {
  if (servingVal == null || servingVal === '') return null;
  const numericValue = Number(servingVal);
  if (Number.isNaN(numericValue) || servingAmount <= 0) return null;
  return (numericValue / servingAmount) * DEFAULT_PER_100;
}

/**
 * Prefer the printed per-serving number when OFF has one; otherwise keep the per-100 crowd value.
 * @param {number|null} fromServing
 * @param {number} fallbackPer100
 * @param {boolean} [requirePositive]
 * @returns {number}
 */
function preferServingPer100(fromServing, fallbackPer100, requirePositive) {
  if (fromServing == null) return fallbackPer100;
  if (requirePositive && !(fromServing > 0)) return fallbackPer100;
  return fromServing;
}

/**
 * @param {object} nutriments
 * @param {boolean} usePer100ml
 * @param {string} field100ml
 * @param {string} field100g
 */
function per100Nutrient(nutriments, usePer100ml, field100ml, field100g) {
  return usePer100ml ? (nutriments[field100ml] ?? nutriments[field100g]) : nutriments[field100g];
}

/**
 * Normalize an Open Food Facts product into the food object the log writes.
 * @param {object} product
 * @returns {object|null}
 */
function normalizeOpenFoodFactsProduct(product) {
  if (!product || !product.code) return null;
  const nutriments = product.nutriments || {};

  const quantityStr = (product.quantity || '').toString().trim();
  const parsed = parseQuantityToGramsOrMl(quantityStr);
  const isBeverage = isOpenFoodFactsBeverage(product, parsed);
  const usePer100ml = isBeverage;

  let defaultServingAmount = DEFAULT_PER_100;
  if (usePer100ml) {
    defaultServingAmount = beverageServingAmount(product, parsed, isBeverage);
  } else {
    defaultServingAmount = gramsFromServingFields(product);
  }

  const servingAmount = Math.min(MAX_SERVING_AMOUNT, Math.max(1, defaultServingAmount));
  const servingUnit = usePer100ml ? SERVING_UNIT_ML : SERVING_UNIT_GRAMS;

  let kcalPer100Unit = usePer100ml
    ? getKcalPer100(nutriments, product, true) || getKcalPer100(nutriments, product, false)
    : getKcalPer100(nutriments, product, false);
  kcalPer100Unit = preferServingPer100(
    per100FromServing(nutriments['energy-kcal_serving'], servingAmount),
    kcalPer100Unit,
    true,
  );

  const scale = servingAmount / DEFAULT_PER_100;

  let proteinPer100 = num(per100Nutrient(nutriments, usePer100ml, 'proteins_100ml', 'proteins_100g'));
  proteinPer100 = preferServingPer100(per100FromServing(nutriments.proteins_serving, servingAmount), proteinPer100);

  let carbsPer100 = num(per100Nutrient(nutriments, usePer100ml, 'carbohydrates_100ml', 'carbohydrates_100g'));
  carbsPer100 = preferServingPer100(per100FromServing(nutriments.carbohydrates_serving, servingAmount), carbsPer100);

  let fatPer100 = num(per100Nutrient(nutriments, usePer100ml, 'fat_100ml', 'fat_100g'));
  fatPer100 = preferServingPer100(per100FromServing(nutriments.fat_serving, servingAmount), fatPer100);

  let sugarPer100 = numOrNull(per100Nutrient(nutriments, usePer100ml, 'sugars_100ml', 'sugars_100g'));
  sugarPer100 = preferServingPer100(per100FromServing(nutriments.sugars_serving, servingAmount), sugarPer100);

  const sodiumRaw = per100Nutrient(nutriments, usePer100ml, 'sodium_100ml', 'sodium_100g');
  const saltRaw = per100Nutrient(nutriments, usePer100ml, 'salt_100ml', 'salt_100g');
  let sodiumPer100 = numOrNull(sodiumRaw);
  if (sodiumPer100 == null && saltRaw != null) sodiumPer100 = num(saltRaw) * SODIUM_MG_PER_GRAM_SALT;
  sodiumPer100 = preferServingPer100(per100FromServing(nutriments.sodium_serving, servingAmount), sodiumPer100);

  let fiberPer100 = numOrNull(per100Nutrient(nutriments, usePer100ml, 'fiber_100ml', 'fiber_100g'));
  fiberPer100 = preferServingPer100(per100FromServing(nutriments.fiber_serving, servingAmount), fiberPer100);

  return {
    id: product.code,
    name: product.product_name || UNKNOWN_FOOD_NAME,
    brand: product.brands || null,
    restaurant: null,
    calories: kcalPer100Unit,
    protein: proteinPer100,
    carbs: carbsPer100,
    fat: fatPer100,
    fiber: fiberPer100,
    sodium: sodiumPer100,
    sugar: sugarPer100,
    servingSize: scale,
    servingUnit,
    servingGrams: servingAmount,
    source: SOURCE_OPEN_FOOD_FACTS,
    kcalPer100Unit,
    servingAmount,
  };
}

// ===== MAIN FUNCTION =====

// Public API: the five helpers barcode search and the server food routes import.

module.exports = {
  parseQuantityToGramsOrMl,
  normalizeOpenFoodFactsProduct,
  getKcalPer100,
  num,
  numOrNull,
};
