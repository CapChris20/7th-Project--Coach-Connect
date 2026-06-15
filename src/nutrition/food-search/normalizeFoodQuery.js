/**
 * food Normalize
 *
 * Purpose: food Normalize — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: SOLID_FOOD_PATTERN, LIQUID_FOOD_PATTERN, isLiquidFood, usdaDescriptionLooksLiquid, servingUnitGuard, mapSearchRowToFoodShape, normalizeFoodForLog, normalizeFoodItem
 *
 * @file-header
 */
/**
 * Shared food normalization + serving unit guards for search, barcode, and logging.
 */
const { finalizeBarcodeFood, isPer100gSource } = require('../food-details/calculateServingSize');

const SOLID_FOOD_PATTERN =
  /\b(nugget|nuggets|chicken|tenders|wings|produce|apple|banana|orange|potato|tomato|lettuce|broccoli|carrot|onion|grape|berry|berries|frozen|snack|chips|crisp|crisps|cracker|crackers|cookie|cookies|candy|bar|bars|cereal|granola|popcorn|pretzel|pretzels|pizza|bread|bagel|muffin|cake|brownie|doritos|oreo|klondike|ice\s*cream\s*bar|tortilla|nacho|cheese\s*stick|fish\s*stick|patty|meatball|sausage|bacon|ham|turkey|beef|pork|lamb|tofu|tempeh|seitan|yogurt\s*cup|pudding\s*cup|ramen|noodle|pasta|rice|oatmeal|granola)\b/i;

const LIQUID_FOOD_PATTERN =
  /\b(soda|cola|coke|pepsi|sprite|juice|lemonade|tea|coffee|latte|mocha|frappuccino|smoothie|shake|milk|water|beverage|drink|beer|wine|liquor|soup\s*broth|broth|stock)\b/i;

const SOLID_CATEGORY_PATTERN =
  /:en:snacks|:en:chips|:en:crisps|:en:cookies|:en:candies|:en:crackers|:en:frozen|:en:meals|:en:nuggets|:en:chicken|:en:fruits|:en:vegetables|:en:produce|:en:ice-creams|:en:frozen-desserts|snacks|frozen|nuggets|produce/i;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

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

function isLiquidFood(food) {
  const hay = foodTextHaystack(food);
  if (SOLID_FOOD_PATTERN.test(hay) || SOLID_CATEGORY_PATTERN.test(hay)) return false;
  if (LIQUID_FOOD_PATTERN.test(hay)) return true;
  const unit = String(food?.servingUnit || food?.serving_unit || '').toLowerCase();
  if (unit === 'ml' || unit === 'milliliters' || unit === 'fl oz') {
    return LIQUID_FOOD_PATTERN.test(hay) || num(food?.servingGrams) <= 500;
  }
  return false;
}

function usdaDescriptionLooksLiquid(description) {
  const d = String(description || '').toLowerCase();
  if (SOLID_FOOD_PATTERN.test(d)) return false;
  return LIQUID_FOOD_PATTERN.test(d)
    || /\b(soda|cola|juice|tea|coffee|milk|water|beverage|drink|shake|smoothie|beer|wine)\b/i.test(d);
}

/**
 * Downgrade mis-tagged ml on solid foods; keep true beverages as ml.
 */
function servingUnitGuard(food) {
  if (!food) return food;
  const unit = String(food.servingUnit || food.serving_unit || 'grams').toLowerCase();
  if (unit !== 'ml' && unit !== 'milliliters') return food;
  if (isLiquidFood(food)) return food;
  return {
    ...food,
    servingUnit: 'grams',
    serving_unit: 'grams',
  };
}

function mapSearchRowToFoodShape(item) {
  if (!item) return null;
  const roundOrNull = (val) => {
    if (val == null || val === '') return null;
    const n = Number(val);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
  };
  const source = String(item.source || 'server').toLowerCase();
  const servingGrams = num(item.servingGrams || item.serving_weight_grams || item.serving_grams || item.servingAmount);
  const servingG = servingGrams > 0 ? servingGrams : 100;
  const base = {
    id: item.id || item.fdcId || item.code || null,
    name: item.name || item.food_name || item.description || 'Unknown Food',
    brand: item.brand || item.brand_name || item.brand_owner || item.brandOwner || '',
    calories: num(item.calories ?? item.nf_calories),
    protein: num(item.protein ?? item.nf_protein),
    carbs: num(item.carbs ?? item.nf_total_carbohydrate),
    fat: num(item.fat ?? item.nf_total_fat),
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
    servingUnit: item.servingUnit || item.serving_unit || item.servingSizeUnit || 'serving',
    servingGrams: servingG,
    servingAmount: item.servingAmount || servingG,
    servingSize: item.servingSize ?? item.serving_qty ?? item.serving_size ?? 1,
    kcalPer100Unit: item.kcalPer100Unit || null,
    barcodeConfidence: item.barcodeConfidence || null,
    needsVerification: item.needsVerification || null,
    nutrition_unverified: Boolean(item.nutrition_unverified),
    multiServingFallback: Boolean(item.multiServingFallback),
    servingMultiplier: item.servingMultiplier ?? null,
    serving_label: item.serving_label || item.servingLabel || item.householdServingFullText || null,
    portion_text: item.portion_text || item.serving_label || item.servingLabel || null,
    metadata: item.metadata && typeof item.metadata === 'object' ? item.metadata : item,
  };

  if (source === 'openfoodfacts' || source === 'usda' || source === 'fatsecret') {
    if (base.dataBasis === 'label_serving') {
      return servingUnitGuard({
        ...base,
        servingSize: 1,
      });
    }
    const finalized = finalizeBarcodeFood({
      ...base,
      servingSize: servingG / 100,
      servingGrams: servingG,
      servingAmount: servingG,
    });
    return servingUnitGuard(finalized);
  }

  return servingUnitGuard(base);
}

function normalizeFoodForLog(food) {
  if (!food) return food;
  if (food.dataBasis === 'logged_totals' || food.fromRecentLog) {
    return servingUnitGuard({
      ...food,
      dataBasis: 'logged_totals',
    });
  }
  if (food.dataBasis === 'label_serving' || isPer100gSource(food.source)) {
    return mapSearchRowToFoodShape(food);
  }
  return servingUnitGuard(mapSearchRowToFoodShape(food));
}

function normalizeFoodItem(item, searchQuery) {
  const normalized = mapSearchRowToFoodShape(item) || {};
  let cleanedName = normalized.name || '';
  if (String(item?.source || '').toLowerCase() === 'serper') {
    cleanedName = cleanedName.replace(/\s*-\s*.*$/, '').replace(/\bNutrition Facts\b/gi, '').trim();
    if (searchQuery && !cleanedName.toLowerCase().includes(String(searchQuery).toLowerCase())) {
      cleanedName = searchQuery;
    }
  }
  return {
    ...normalized,
    name: cleanedName || normalized.name || 'Unknown Food',
    food_name: cleanedName || normalized.name || 'Unknown Food',
    brand_name: normalized.brand || item?.brand_name || '',
    serving_grams: normalized.servingGrams || 100,
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
