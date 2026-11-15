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

// Manipulate here: add solid keywords when ml-tagged packaged solids slip through
const SOLID_FOOD_PATTERN =
  /\b(nugget|nuggets|chicken|tenders|wings|produce|apple|banana|orange|potato|tomato|lettuce|broccoli|carrot|onion|grape|berry|berries|frozen|snack|chips|crisp|crisps|cracker|crackers|cookie|cookies|candy|bar|bars|cereal|granola|popcorn|pretzel|pretzels|pizza|bread|bagel|muffin|cake|brownie|doritos|oreo|klondike|ice\s*cream\s*bar|tortilla|nacho|cheese\s*stick|fish\s*stick|patty|meatball|sausage|bacon|ham|turkey|beef|pork|lamb|tofu|tempeh|seitan|yogurt\s*cup|pudding\s*cup|ramen|noodle|pasta|rice|oatmeal|granola)\b/i;

const LIQUID_FOOD_PATTERN =
  /\b(soda|cola|coke|pepsi|sprite|juice|lemonade|tea|coffee|latte|mocha|frappuccino|smoothie|shake|milk|water|beverage|drink|beer|wine|liquor|soup\s*broth|broth|stock)\b/i;

const SOLID_CATEGORY_PATTERN =
  /:en:snacks|:en:chips|:en:crisps|:en:cookies|:en:candies|:en:crackers|:en:frozen|:en:meals|:en:nuggets|:en:chicken|:en:fruits|:en:vegetables|:en:produce|:en:ice-creams|:en:frozen-desserts|snacks|frozen|nuggets|produce/i;

const USDA_LIQUID_FALLBACK_PATTERN =
  /\b(soda|cola|juice|tea|coffee|milk|water|beverage|drink|shake|smoothie|beer|wine)\b/i;

// ===== HELPER FUNCTIONS =====

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

/**
 * Read one top-level field when the food object exists.
 * @param {object|null|undefined} food
 * @param {string} fieldName
 * @returns {*}
 */
function readFoodField(food, fieldName) {
  if (!food) return undefined;
  return food[fieldName];
}

/**
 * Categories string from food.metadata.categories when metadata exists.
 * @param {object|null|undefined} food
 * @returns {*}
 */
function readMetadataCategories(food) {
  if (!food) return undefined;
  const metadata = food.metadata;
  if (!metadata) return undefined;
  return metadata.categories;
}

/**
 * Join name / brand / description / categories into one lowercase haystack for liquid/solid tests.
 * @param {object|null|undefined} food
 * @returns {string}
 */
function foodTextHaystack(food) {
  const pieces = [
    readFoodField(food, 'name'),
    readFoodField(food, 'food_name'),
    readFoodField(food, 'brand'),
    readFoodField(food, 'brand_name'),
    readFoodField(food, 'description'),
    readFoodField(food, 'categories'),
    readMetadataCategories(food),
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

/**
 * Pick calories from camelCase or Nutritionix nf_calories.
 * @param {object} item
 * @returns {number}
 */
function readCaloriesFromItem(item) {
  if (item.calories != null) return toFiniteNumber(item.calories);
  return toFiniteNumber(item.nf_calories);
}

function readProteinFromItem(item) {
  if (item.protein != null) return toFiniteNumber(item.protein);
  return toFiniteNumber(item.nf_protein);
}

function readCarbsFromItem(item) {
  if (item.carbs != null) return toFiniteNumber(item.carbs);
  return toFiniteNumber(item.nf_total_carbohydrate);
}

function readFatFromItem(item) {
  if (item.fat != null) return toFiniteNumber(item.fat);
  return toFiniteNumber(item.nf_total_fat);
}

function readFiberFromItem(item) {
  if (item.fiber != null) return roundOrNull(item.fiber);
  return roundOrNull(item.nf_dietary_fiber);
}

function readSugarFromItem(item) {
  if (item.sugar != null) return roundOrNull(item.sugar);
  return roundOrNull(item.nf_sugars);
}

function readSodiumFromItem(item) {
  if (item.sodium != null) return roundOrNull(item.sodium);
  return roundOrNull(item.nf_sodium);
}

function readSaturatedFatFromItem(item) {
  if (item.saturatedFat != null) return roundOrNull(item.saturatedFat);
  return roundOrNull(item.saturated_fat);
}

function readTransFatFromItem(item) {
  if (item.transFat != null) return roundOrNull(item.transFat);
  return roundOrNull(item.trans_fat);
}

/**
 * Serving grams from any of the frozen alias keys; 0 when all missing.
 * @param {object} item
 * @returns {number}
 */
function readRawServingGrams(item) {
  if (item.servingGrams) return toFiniteNumber(item.servingGrams);
  if (item.serving_weight_grams) return toFiniteNumber(item.serving_weight_grams);
  if (item.serving_grams) return toFiniteNumber(item.serving_grams);
  if (item.servingAmount) return toFiniteNumber(item.servingAmount);
  return 0;
}

/**
 * Serving unit string from camelCase / snake / USDA unit field.
 * @param {object} item
 * @returns {string}
 */
function readServingUnitFromItem(item) {
  if (item.servingUnit) return item.servingUnit;
  if (item.serving_unit) return item.serving_unit;
  if (item.servingSizeUnit) return item.servingSizeUnit;
  return DEFAULT_SERVING_UNIT;
}

/**
 * Serving size / qty from any frozen alias; default 1.
 * @param {object} item
 * @returns {*}
 */
function readServingSizeFromItem(item) {
  if (item.servingSize != null) return item.servingSize;
  if (item.serving_qty != null) return item.serving_qty;
  if (item.serving_size != null) return item.serving_size;
  return DEFAULT_SERVING_SIZE;
}

/**
 * Display serving label from any of the frozen label aliases.
 * @param {object} item
 * @returns {string|null}
 */
function readServingLabelFromItem(item) {
  if (item.serving_label) return item.serving_label;
  if (item.servingLabel) return item.servingLabel;
  if (item.householdServingFullText) return item.householdServingFullText;
  return null;
}

/**
 * Portion text for the card — prefers portion_text, then label aliases.
 * @param {object} item
 * @returns {string|null}
 */
function readPortionTextFromItem(item) {
  if (item.portion_text) return item.portion_text;
  if (item.serving_label) return item.serving_label;
  if (item.servingLabel) return item.servingLabel;
  return null;
}

/**
 * Food display name from name / food_name / description.
 * @param {object} item
 * @returns {string}
 */
function readFoodNameFromItem(item) {
  if (item.name) return item.name;
  if (item.food_name) return item.food_name;
  if (item.description) return item.description;
  return DEFAULT_FOOD_NAME;
}

/**
 * Brand from any of the frozen brand aliases.
 * @param {object} item
 * @returns {string}
 */
function readBrandFromItem(item) {
  if (item.brand) return item.brand;
  if (item.brand_name) return item.brand_name;
  if (item.brand_owner) return item.brand_owner;
  if (item.brandOwner) return item.brandOwner;
  return '';
}

/**
 * Id from id / fdcId / barcode code.
 * @param {object} item
 * @returns {*}
 */
function readIdFromItem(item) {
  if (item.id) return item.id;
  if (item.fdcId) return item.fdcId;
  if (item.code) return item.code;
  return null;
}

/**
 * Serving unit lowercased for liquid/solid guard (empty when food missing).
 * @param {object|null|undefined} food
 * @returns {string}
 */
function readServingUnitLower(food) {
  const fromCamel = readFoodField(food, 'servingUnit');
  if (fromCamel) return String(fromCamel).toLowerCase();
  const fromSnake = readFoodField(food, 'serving_unit');
  if (fromSnake) return String(fromSnake).toLowerCase();
  return '';
}

/**
 * brand_name for the presented card — prefer tidy brand, else original snake alias.
 * @param {object} presentedCard
 * @param {object} item
 * @returns {string}
 */
function brandNameForPresentedCard(presentedCard, item) {
  if (presentedCard.brand) return presentedCard.brand;
  const originalBrandName = readFoodField(item, 'brand_name');
  if (originalBrandName) return originalBrandName;
  return '';
}

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
  let servingGramsForCard = mappedShape.servingGrams;
  if (!servingGramsForCard) {
    servingGramsForCard = DEFAULT_SERVING_GRAMS;
  }
  return {
    ...presentedCard,
    brand_name: brandNameForPresentedCard(presentedCard, item),
    serving_grams: servingGramsForCard,
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
  const rawServingGrams = readRawServingGrams(item);
  let servingGramsOrDefault = rawServingGrams;
  if (!(rawServingGrams > 0)) {
    servingGramsOrDefault = DEFAULT_SERVING_GRAMS;
  }

  // 2. One card with both camelCase display fields and frozen snake aliases where needed.
  const baseFoodCard = {
    id: readIdFromItem(item),
    name: readFoodNameFromItem(item),
    brand: readBrandFromItem(item),
    calories: readCaloriesFromItem(item),
    protein: readProteinFromItem(item),
    carbs: readCarbsFromItem(item),
    fat: readFatFromItem(item),
    fiber: readFiberFromItem(item),
    sugar: readSugarFromItem(item),
    sodium: readSodiumFromItem(item),
    potassium: roundOrNull(item.potassium),
    cholesterol: roundOrNull(item.cholesterol),
    saturatedFat: readSaturatedFatFromItem(item),
    transFat: readTransFatFromItem(item),
    source: sourceLower,
    dataBasis: item.dataBasis || null,
    labelServingGrams: item.labelServingGrams || null,
    servingUnit: readServingUnitFromItem(item),
    servingGrams: servingGramsOrDefault,
    servingAmount: item.servingAmount || servingGramsOrDefault,
    servingSize: readServingSizeFromItem(item),
    kcalPer100Unit: item.kcalPer100Unit || null,
    barcodeConfidence: item.barcodeConfidence || null,
    needsVerification: item.needsVerification || null,
    nutrition_unverified: Boolean(item.nutrition_unverified),
    multiServingFallback: Boolean(item.multiServingFallback),
    servingMultiplier: item.servingMultiplier != null ? item.servingMultiplier : null,
    serving_label: readServingLabelFromItem(item),
    portion_text: readPortionTextFromItem(item),
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

  const fromCamel = food.servingUnit;
  const fromSnake = food.serving_unit;
  let servingUnitLower = UNIT_GRAMS;
  if (fromCamel) {
    servingUnitLower = String(fromCamel).toLowerCase();
  } else if (fromSnake) {
    servingUnitLower = String(fromSnake).toLowerCase();
  }

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

  const servingUnitLower = readServingUnitLower(food);
  const unitIsFluid =
    servingUnitLower === UNIT_ML ||
    servingUnitLower === UNIT_MILLILITERS ||
    servingUnitLower === UNIT_FL_OZ;
  if (!unitIsFluid) return false;

  const servingGrams = toFiniteNumber(readFoodField(food, 'servingGrams'));
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
