// Maps search / barcode rows into log-ready food records (macros + serving keys).
// Flow: flatten API row → ml-on-solid guard → barcode finalize → storage shape.
// Used by ConfirmFoodPopup, barcode confirm, and daily log writer. CommonJS.
// Read order: constants → mains (normalizeFoodForLog / normalizeFoodItem) → PLUMBING.
// KEEP food-card keys: name, food_name, brand, servingGrams, dataBasis, calories, …

const { finalizeBarcodeFood, isPer100gSource } = require('../food-details/servingSizeMath');
const { applyFoodCardPresentation } = require('../food-search/tidyFoodTitles');

// ===== NAMED CONSTANTS =====

const SOURCE_SERVER = 'server';
const SOURCE_OPEN_FOOD_FACTS = 'openfoodfacts';
const SOURCE_USDA = 'usda';
const SOURCE_FATSECRET = 'fatsecret';
const DATA_BASIS_LABEL_SERVING = 'label_serving';
const DATA_BASIS_LOGGED_TOTALS = 'logged_totals';
const UNIT_ML = 'ml';
const UNIT_MILLILITERS = 'milliliters';
const UNIT_FL_OZ = 'fl oz';
const UNIT_GRAMS = 'grams';
const DEFAULT_FOOD_NAME = 'Unknown Food';
const DEFAULT_SERVING_UNIT = 'serving';
const DEFAULT_SERVING_GRAMS = 100;
const DEFAULT_SERVING_SIZE = 1;
// Manipulate here: solids falsely tagged ml stay grams unless servingGrams is this small or less
const LIQUID_SERVING_GRAMS_MAX = 500;
const NUTRIENT_ROUND_FACTOR = 10;

// ===== HELPER FUNCTIONS =====

// Manipulate here: add solid keywords when ml-tagged packaged solids slip through
const SOLID_FOOD_PATTERN =
  /\b(nugget|nuggets|chicken|tenders|wings|produce|apple|banana|orange|potato|tomato|lettuce|broccoli|carrot|onion|grape|berry|berries|frozen|snack|chips|crisp|crisps|cracker|crackers|cookie|cookies|candy|bar|bars|cereal|granola|popcorn|pretzel|pretzels|pizza|bread|bagel|muffin|cake|brownie|doritos|oreo|klondike|ice\s*cream\s*bar|tortilla|nacho|cheese\s*stick|fish\s*stick|patty|meatball|sausage|bacon|ham|turkey|beef|pork|lamb|tofu|tempeh|seitan|yogurt\s*cup|pudding\s*cup|ramen|noodle|pasta|rice|oatmeal|granola)\b/i;

const LIQUID_FOOD_PATTERN =
  /\b(soda|cola|coke|pepsi|sprite|juice|lemonade|tea|coffee|latte|mocha|frappuccino|smoothie|shake|milk|water|beverage|drink|beer|wine|liquor|soup\s*broth|broth|stock)\b/i;

const SOLID_CATEGORY_PATTERN =
  /:en:snacks|:en:chips|:en:crisps|:en:cookies|:en:candies|:en:crackers|:en:frozen|:en:meals|:en:nuggets|:en:chicken|:en:fruits|:en:vegetables|:en:produce|:en:ice-creams|:en:frozen-desserts|snacks|frozen|nuggets|produce/i;

const USDA_LIQUID_FALLBACK_PATTERN =
  /\b(soda|cola|juice|tea|coffee|milk|water|beverage|drink|shake|smoothie|beer|wine)\b/i;

function toFiniteNumber(value) {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) return numericValue;
  return 0;
}

function roundOrNull(value) {
  if (value == null || value === '') return null;
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return null;
  return Math.round(numericValue * NUTRIENT_ROUND_FACTOR) / NUTRIENT_ROUND_FACTOR;
}

function foodTextHaystack(food) {
  const pieces = [
    food?.name,
    food?.food_name,
    food?.brand,
    food?.brand_name,
    food?.description,
    food?.categories,
    food?.metadata?.categories,
  ];
  const presentPieces = [];
  for (let index = 0; index < pieces.length; index += 1) {
    if (pieces[index]) presentPieces.push(pieces[index]);
  }
  return presentPieces.join(' ').toLowerCase();
}

function isBarcodeOrUsdaSource(source) {
  if (source === SOURCE_OPEN_FOOD_FACTS) return true;
  if (source === SOURCE_USDA) return true;
  if (source === SOURCE_FATSECRET) return true;
  return false;
}

module.exports = {
  SOLID_FOOD_PATTERN,
  LIQUID_FOOD_PATTERN,
  isLiquidFood,
  usdaDescriptionLooksLiquid,
  servingUnitGuard,
  mapSearchRowToFoodShape,
  normalizeFoodForLog,
  normalizeFoodItem,
};

// ===== MAIN FUNCTION =====

/**
 * Turn any food card into the storage shape the daily log writer expects.
 * Flow: 1. pick path by dataBasis  2. guard ml-on-solid  3. readable storage title
 * @param {object|null|undefined} food
 * @returns {object|null|undefined}
 */
function normalizeFoodForLog(food) {
  if (!food) return food;

  // vocab: normalizeFoodRecordForStorage = readableFoodTitle helper (title/brand tidy for Firestore)
  const { normalizeFoodRecordForStorage } = require('./readableFoodTitle');

  // 1. Recent-log totals already match what the user logged — only guard the unit.
  const cameFromRecentLog =
    food.dataBasis === DATA_BASIS_LOGGED_TOTALS || food.fromRecentLog;
  if (cameFromRecentLog) {
    const guardedRecent = servingUnitGuard({
      ...food,
      dataBasis: DATA_BASIS_LOGGED_TOTALS,
    });
    return normalizeFoodRecordForStorage(guardedRecent);
  }

  // 2. Label / per-100g sources: map the row first (barcode finalize may run inside).
  const isLabelOrPerHundred =
    food.dataBasis === DATA_BASIS_LABEL_SERVING || isPer100gSource(food.source);
  if (isLabelOrPerHundred) {
    const mappedLabelFood = mapSearchRowToFoodShape(food);
    return normalizeFoodRecordForStorage(mappedLabelFood);
  }

  // 3. Everyone else: map + ml-on-solid guard, then storage title.
  const mappedAndGuarded = servingUnitGuard(mapSearchRowToFoodShape(food));
  return normalizeFoodRecordForStorage(mappedAndGuarded);
}

/**
 * Search-hit shape for the results list + confirm sheet (presentation + frozen keys).
 * Flow: 1. map macros/serving  2. tidy title for the typed query  3. freeze brand_name / serving_grams
 * @param {object} item
 * @param {string} [searchQuery]
 * @returns {object}
 */
function normalizeFoodItem(item, searchQuery) {
  // 1. Flatten camelCase + snake_case API keys into one card.
  const mappedShape = mapSearchRowToFoodShape(item) || {};

  // 2. Tidy the visible title/brand for the typed query (Serper / mixed sources).
  // vocab: applyFoodCardPresentation = title cleaner used by search cards
  const presentedCard = applyFoodCardPresentation(
    {
      ...item,
      ...mappedShape,
      name: mappedShape.name,
      food_name: mappedShape.name,
    },
    searchQuery,
  );

  // 3. Keep brand_name + serving_grams letters frozen for ConfirmFoodPopup / logFood.
  return {
    ...presentedCard,
    brand_name: presentedCard.brand || item?.brand_name || '',
    serving_grams: mappedShape.servingGrams || DEFAULT_SERVING_GRAMS,
  };
}

/**
 * Flatten one API / barcode / recent row into the shared food-card shape.
 * Flow: 1. read grams  2. build base card  3. barcode finalize or unit guard
 * @param {object|null|undefined} item
 * @returns {object|null}
 */
function mapSearchRowToFoodShape(item) {
  if (!item) return null;

  // 1. Serving grams — fall back to 100g when the API omitted weight.
  const sourceLower = String(item.source || SOURCE_SERVER).toLowerCase();
  const rawServingGrams = toFiniteNumber(
    item.servingGrams ||
      item.serving_weight_grams ||
      item.serving_grams ||
      item.servingAmount,
  );
  const servingGramsOrDefault =
    rawServingGrams > 0 ? rawServingGrams : DEFAULT_SERVING_GRAMS;

  // 2. One card with both camelCase display fields and frozen snake aliases where needed.
  const baseFoodCard = {
    id: item.id || item.fdcId || item.code || null,
    name: item.name || item.food_name || item.description || DEFAULT_FOOD_NAME,
    brand: item.brand || item.brand_name || item.brand_owner || item.brandOwner || '',
    calories: toFiniteNumber(item.calories ?? item.nf_calories),
    protein: toFiniteNumber(item.protein ?? item.nf_protein),
    carbs: toFiniteNumber(item.carbs ?? item.nf_total_carbohydrate),
    fat: toFiniteNumber(item.fat ?? item.nf_total_fat),
    fiber: roundOrNull(item.fiber ?? item.nf_dietary_fiber),
    sugar: roundOrNull(item.sugar ?? item.nf_sugars),
    sodium: roundOrNull(item.sodium ?? item.nf_sodium),
    potassium: roundOrNull(item.potassium),
    cholesterol: roundOrNull(item.cholesterol),
    saturatedFat: roundOrNull(item.saturatedFat ?? item.saturated_fat),
    transFat: roundOrNull(item.transFat ?? item.trans_fat),
    source: sourceLower,
    dataBasis: item.dataBasis || null,
    labelServingGrams: item.labelServingGrams || null,
    servingUnit:
      item.servingUnit || item.serving_unit || item.servingSizeUnit || DEFAULT_SERVING_UNIT,
    servingGrams: servingGramsOrDefault,
    servingAmount: item.servingAmount || servingGramsOrDefault,
    servingSize:
      item.servingSize ?? item.serving_qty ?? item.serving_size ?? DEFAULT_SERVING_SIZE,
    kcalPer100Unit: item.kcalPer100Unit || null,
    barcodeConfidence: item.barcodeConfidence || null,
    needsVerification: item.needsVerification || null,
    nutrition_unverified: Boolean(item.nutrition_unverified),
    multiServingFallback: Boolean(item.multiServingFallback),
    servingMultiplier: item.servingMultiplier ?? null,
    serving_label:
      item.serving_label || item.servingLabel || item.householdServingFullText || null,
    portion_text:
      item.portion_text || item.serving_label || item.servingLabel || null,
  };

  // 3a. Non-barcode sources: only fix ml tagged on solids.
  if (!isBarcodeOrUsdaSource(sourceLower)) {
    return servingUnitGuard(baseFoodCard);
  }

  // 3b. Label-serving barcode: one serving as logged on the package.
  if (baseFoodCard.dataBasis === DATA_BASIS_LABEL_SERVING) {
    return servingUnitGuard({
      ...baseFoodCard,
      servingSize: 1,
    });
  }

  // 3c. Per-100g barcode path — finalize then guard.
  // vocab: finalizeBarcodeFood = converts per-100g macros into the serving the label shows
  const finalizedBarcodeFood = finalizeBarcodeFood({
    ...baseFoodCard,
    servingSize: servingGramsOrDefault / DEFAULT_SERVING_GRAMS,
    servingGrams: servingGramsOrDefault,
    servingAmount: servingGramsOrDefault,
  });
  return servingUnitGuard(finalizedBarcodeFood);
}

/**
 * If a solid food was tagged ml/milliliters, force grams so the log does not scale as liquid.
 * @param {object|null|undefined} food
 * @returns {object|null|undefined}
 */
function servingUnitGuard(food) {
  if (!food) return food;

  const servingUnitLower = String(
    food.servingUnit || food.serving_unit || UNIT_GRAMS,
  ).toLowerCase();
  const unitLooksLikeMilliliters =
    servingUnitLower === UNIT_ML || servingUnitLower === UNIT_MILLILITERS;
  if (!unitLooksLikeMilliliters) return food;
  if (isLiquidFood(food)) return food;

  return {
    ...food,
    servingUnit: UNIT_GRAMS,
    serving_unit: UNIT_GRAMS,
  };
}

/**
 * True when name/brand/categories look like a drink (not nuggets falsely tagged ml).
 * @param {object} food
 * @returns {boolean}
 */
function isLiquidFood(food) {
  const nameBrandHaystack = foodTextHaystack(food);

  // Solids win first — chicken nuggets tagged "ml" must not stay liquid.
  if (SOLID_FOOD_PATTERN.test(nameBrandHaystack)) return false;
  if (SOLID_CATEGORY_PATTERN.test(nameBrandHaystack)) return false;
  if (LIQUID_FOOD_PATTERN.test(nameBrandHaystack)) return true;

  const servingUnitLower = String(
    food?.servingUnit || food?.serving_unit || '',
  ).toLowerCase();
  const unitIsFluid =
    servingUnitLower === UNIT_ML ||
    servingUnitLower === UNIT_MILLILITERS ||
    servingUnitLower === UNIT_FL_OZ;
  if (!unitIsFluid) return false;

  const servingGrams = toFiniteNumber(food?.servingGrams);
  const liquidNameOrSmallServe =
    LIQUID_FOOD_PATTERN.test(nameBrandHaystack) ||
    servingGrams <= LIQUID_SERVING_GRAMS_MAX;
  return liquidNameOrSmallServe;
}

/**
 * USDA description-only liquid check (no full food card).
 * @param {string} description
 * @returns {boolean}
 */
function usdaDescriptionLooksLiquid(description) {
  const descriptionLower = String(description || '').toLowerCase();
  if (SOLID_FOOD_PATTERN.test(descriptionLower)) return false;
  if (LIQUID_FOOD_PATTERN.test(descriptionLower)) return true;
  return USDA_LIQUID_FALLBACK_PATTERN.test(descriptionLower);
}

