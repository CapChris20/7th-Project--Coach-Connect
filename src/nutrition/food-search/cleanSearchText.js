// Shared food normalization + serving-unit guards for search, barcode, and logging.
// Flow: map a search/barcode row → fix ml-on-solids → present the title → store a log-ready record.
// Used by food search, barcode confirm, and the daily log writer. Keep require() (CommonJS).

const { finalizeBarcodeFood, isPer100gSource } = require('../food-details/servingSizeMath');
const { applyFoodCardPresentation } = require('../food-search/tidyFoodTitles');

// ===== NAMED CONSTANTS =====

const SOLID_FOOD_PATTERN =
  /\b(nugget|nuggets|chicken|tenders|wings|produce|apple|banana|orange|potato|tomato|lettuce|broccoli|carrot|onion|grape|berry|berries|frozen|snack|chips|crisp|crisps|cracker|crackers|cookie|cookies|candy|bar|bars|cereal|granola|popcorn|pretzel|pretzels|pizza|bread|bagel|muffin|cake|brownie|doritos|oreo|klondike|ice\s*cream\s*bar|tortilla|nacho|cheese\s*stick|fish\s*stick|patty|meatball|sausage|bacon|ham|turkey|beef|pork|lamb|tofu|tempeh|seitan|yogurt\s*cup|pudding\s*cup|ramen|noodle|pasta|rice|oatmeal|granola)\b/i;

const LIQUID_FOOD_PATTERN =
  /\b(soda|cola|coke|pepsi|sprite|juice|lemonade|tea|coffee|latte|mocha|frappuccino|smoothie|shake|milk|water|beverage|drink|beer|wine|liquor|soup\s*broth|broth|stock)\b/i;

const SOLID_CATEGORY_PATTERN =
  /:en:snacks|:en:chips|:en:crisps|:en:cookies|:en:candies|:en:crackers|:en:frozen|:en:meals|:en:nuggets|:en:chicken|:en:fruits|:en:vegetables|:en:produce|:en:ice-creams|:en:frozen-desserts|snacks|frozen|nuggets|produce/i;

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
const LIQUID_SERVING_GRAMS_MAX = 500;
const NUTRIENT_ROUND_FACTOR = 10;
const USDA_LIQUID_FALLBACK_PATTERN =
  /\b(soda|cola|juice|tea|coffee|milk|water|beverage|drink|shake|smoothie|beer|wine)\b/i;

// ===== HELPER FUNCTIONS =====

/**
 * Non-numeric junk becomes 0 so a missing calorie field cannot NaN the log.
 * @param {*} value
 * @returns {number}
 */
function toFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

/**
 * Name + brand + category text used to guess solid vs liquid.
 * @param {object} food
 * @returns {string}
 */
function foodTextHaystack(food) {
  return [
    food?.name,
    food?.food_name,
    food?.brand,
    food?.brand_name,
    food?.description,
    food?.categories,
    food?.metadata?.categories,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/**
 * One decimal place, or null when the source omitted the nutrient.
 * @param {*} value
 * @returns {number|null}
 */
function roundOrNull(value) {
  if (value == null || value === '') return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? Math.round(numericValue * NUTRIENT_ROUND_FACTOR) / NUTRIENT_ROUND_FACTOR
    : null;
}

function isBarcodeOrUsdaSource(source) {
  return source === SOURCE_OPEN_FOOD_FACTS || source === SOURCE_USDA || source === SOURCE_FATSECRET;
}

// ===== MAIN FUNCTION =====

/**
 * Solids win over liquids when both patterns match (chicken soup should not become ml).
 * @param {object} food
 * @returns {boolean}
 */
function isLiquidFood(food) {
  const haystack = foodTextHaystack(food);
  if (SOLID_FOOD_PATTERN.test(haystack) || SOLID_CATEGORY_PATTERN.test(haystack)) return false;
  if (LIQUID_FOOD_PATTERN.test(haystack)) return true;
  const unit = String(food?.servingUnit || food?.serving_unit || '').toLowerCase();
  if (unit === UNIT_ML || unit === UNIT_MILLILITERS || unit === UNIT_FL_OZ) {
    return LIQUID_FOOD_PATTERN.test(haystack) || toFiniteNumber(food?.servingGrams) <= LIQUID_SERVING_GRAMS_MAX;
  }
  return false;
}

/**
 * USDA descriptions are a separate, slightly wider liquid check than the logged-food haystack.
 * @param {string} description
 * @returns {boolean}
 */
function usdaDescriptionLooksLiquid(description) {
  const descriptionText = String(description || '').toLowerCase();
  if (SOLID_FOOD_PATTERN.test(descriptionText)) return false;
  return LIQUID_FOOD_PATTERN.test(descriptionText) || USDA_LIQUID_FALLBACK_PATTERN.test(descriptionText);
}

/**
 * Downgrade mis-tagged ml on solid foods; keep true beverages as ml.
 * @param {object} food
 * @returns {object}
 */
function servingUnitGuard(food) {
  if (!food) return food;
  const unit = String(food.servingUnit || food.serving_unit || UNIT_GRAMS).toLowerCase();
  if (unit !== UNIT_ML && unit !== UNIT_MILLILITERS) return food;
  if (isLiquidFood(food)) return food;
  return {
    ...food,
    servingUnit: UNIT_GRAMS,
    serving_unit: UNIT_GRAMS,
  };
}

/**
 * Flatten a search/barcode row into the FoodCard / log shape.
 * @param {object} item
 * @returns {object|null}
 */
function mapSearchRowToFoodShape(item) {
  if (!item) return null;
  const source = String(item.source || SOURCE_SERVER).toLowerCase();
  const servingGrams = toFiniteNumber(
    item.servingGrams || item.serving_weight_grams || item.serving_grams || item.servingAmount,
  );
  const servingG = servingGrams > 0 ? servingGrams : DEFAULT_SERVING_GRAMS;
  const base = {
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
    source,
    dataBasis: item.dataBasis || null,
    labelServingGrams: item.labelServingGrams || null,
    servingUnit: item.servingUnit || item.serving_unit || item.servingSizeUnit || DEFAULT_SERVING_UNIT,
    servingGrams: servingG,
    servingAmount: item.servingAmount || servingG,
    servingSize: item.servingSize ?? item.serving_qty ?? item.serving_size ?? DEFAULT_SERVING_SIZE,
    kcalPer100Unit: item.kcalPer100Unit || null,
    barcodeConfidence: item.barcodeConfidence || null,
    needsVerification: item.needsVerification || null,
    nutrition_unverified: Boolean(item.nutrition_unverified),
    multiServingFallback: Boolean(item.multiServingFallback),
    servingMultiplier: item.servingMultiplier ?? null,
    serving_label: item.serving_label || item.servingLabel || item.householdServingFullText || null,
    portion_text: item.portion_text || item.serving_label || item.servingLabel || null,
  };

  if (isBarcodeOrUsdaSource(source)) {
    if (base.dataBasis === DATA_BASIS_LABEL_SERVING) {
      return servingUnitGuard({
        ...base,
        servingSize: 1,
      });
    }
    const finalized = finalizeBarcodeFood({
      ...base,
      servingSize: servingG / DEFAULT_SERVING_GRAMS,
      servingGrams: servingG,
      servingAmount: servingG,
    });
    return servingUnitGuard(finalized);
  }

  return servingUnitGuard(base);
}

/**
 * Prepare a food for the daily log. Lazy-requires readableFoodTitle to avoid a circular import.
 * @param {object} food
 * @returns {object}
 */
function normalizeFoodForLog(food) {
  if (!food) return food;
  const { normalizeFoodRecordForStorage } = require('./readableFoodTitle');
  let normalizedFood;
  if (food.dataBasis === DATA_BASIS_LOGGED_TOTALS || food.fromRecentLog) {
    normalizedFood = servingUnitGuard({
      ...food,
      dataBasis: DATA_BASIS_LOGGED_TOTALS,
    });
  } else if (food.dataBasis === DATA_BASIS_LABEL_SERVING || isPer100gSource(food.source)) {
    normalizedFood = mapSearchRowToFoodShape(food);
  } else {
    normalizedFood = servingUnitGuard(mapSearchRowToFoodShape(food));
  }
  return normalizeFoodRecordForStorage(normalizedFood);
}

/**
 * Search-result row: map macros, then apply the display title for the current query.
 * @param {object} item
 * @param {string} searchQuery
 * @returns {object}
 */
function normalizeFoodItem(item, searchQuery) {
  const normalized = mapSearchRowToFoodShape(item) || {};
  const presented = applyFoodCardPresentation(
    {
      ...item,
      ...normalized,
      name: normalized.name,
      food_name: normalized.name,
    },
    searchQuery,
  );
  return {
    ...presented,
    brand_name: presented.brand || item?.brand_name || '',
    serving_grams: normalized.servingGrams || DEFAULT_SERVING_GRAMS,
  };
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
