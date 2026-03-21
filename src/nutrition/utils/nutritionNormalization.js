/**
 * Nutrition portion normalization for Open Food Facts and other sources.
 * Parses product.quantity (e.g. "500 ml", "16.9 fl oz", "340 g") and computes
 * default serving amount + total calories so full packages (e.g. Pepsi bottle) log correctly.
 */

const OZ_TO_GRAMS = 28.3495;
const FL_OZ_TO_ML = 29.5735;

/**
 * Parse a quantity string (e.g. "500 ml", "16.9 fl oz", "12 oz", "340 g") into a numeric value.
 * @param {string} quantityString - e.g. "500 ml", "16.9 fl oz", "340 g"
 * @returns {{ value: number, isLiquid: boolean } | null} - value in grams (solids) or ml (liquids); null if unparseable
 */
function parseQuantityToGramsOrMl(quantityString) {
  if (quantityString == null || typeof quantityString !== 'string') return null;
  const s = quantityString.trim().toLowerCase();
  if (!s) return null;

  const num = (str) => {
    const n = parseFloat(str.replace(',', '.'));
    return Number.isNaN(n) ? null : n;
  };

  // ml (e.g. "500 ml", "500ml")
  let m = s.match(/(\d+(?:[.,]\d+)?)\s*ml/);
  if (m) {
    const v = num(m[1]);
    return v != null && v > 0 ? { value: Math.round(v), isLiquid: true } : null;
  }
  // L (e.g. "1.5 L", "1.5l")
  m = s.match(/(\d+(?:[.,]\d+)?)\s*l(?:itre)?s?/);
  if (m) {
    const v = num(m[1]);
    return v != null && v > 0 ? { value: Math.round(v * 1000), isLiquid: true } : null;
  }
  // fl oz (e.g. "16.9 fl oz", "12 fl. oz.")
  m = s.match(/(\d+(?:[.,]\d+)?)\s*(?:fl\.?\s*oz\.?|fluid\s*oz)/);
  if (m) {
    const v = num(m[1]);
    return v != null && v > 0 ? { value: Math.round(v * FL_OZ_TO_ML), isLiquid: true } : null;
  }
  // oz (e.g. "12 oz") - treat as fluid oz for liquids; we'll use isLiquid from context. For solids we use oz -> g.
  m = s.match(/(\d+(?:[.,]\d+)?)\s*oz/);
  if (m) {
    const v = num(m[1]);
    if (v != null && v > 0) {
      // If string had "fl" or "fluid" we already handled it. Plain "oz" is often weight (grams).
      return { value: Math.round(v * OZ_TO_GRAMS), isLiquid: false };
    }
  }
  // g / gram(s) (e.g. "340 g", "39g")
  m = s.match(/(\d+(?:[.,]\d+)?)\s*g(?:ram)?s?/);
  if (m) {
    const v = num(m[1]);
    return v != null && v > 0 ? { value: Math.round(v), isLiquid: false } : null;
  }
  // Fallback: just digits (e.g. "500" -> assume grams for solids)
  m = s.match(/(\d+(?:[.,]\d+)?)/);
  if (m) {
    const v = num(m[1]);
    return v != null && v > 0 ? { value: Math.round(v), isLiquid: false } : null;
  }
  return null;
}

/**
 * Safe numeric value for OFF nutriments.
 * @param {*} v
 * @returns {number}
 */
function num(v) {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return typeof n === 'number' && !Number.isNaN(n) ? n : 0;
}

/**
 * Safe numeric or null.
 * @param {*} v
 * @returns {number|null}
 */
function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return typeof n === 'number' && !Number.isNaN(n) ? n : null;
}

/**
 * Get kcal per 100g or 100ml from OFF nutriments (handles kJ fallback).
 * @param {object} nut - product.nutriments
 * @param {object} p - product (for legacy top-level fields)
 * @param {boolean} per100ml - if true, use _100ml fields
 * @returns {number}
 */
function getKcalPer100(nut, p, per100ml) {
  const suffix = per100ml ? '_100ml' : '_100g';
  const kcalKey = `energy-kcal${suffix}`;
  const kjKey = `energy${suffix}`;
  let kcal = nut[kcalKey] ?? p?.[`energy_kcal${suffix}`];
  if (kcal == null || Number.isNaN(Number(kcal))) {
    const kj = nut[kjKey] ?? p?.[`energy${suffix}`];
    kcal = (kj != null && kj !== '') ? Number(kj) / 4.184 : 0;
  }
  return num(kcal);
}

/**
 * Normalize an Open Food Facts product into a single normalized food object with:
 * - Parsed quantity -> defaultServingAmount (grams or ml)
 * - totalCalories = (kcal_per_100_unit * defaultServingAmount) / 100
 * - All macros scaled to serving, and kcal_per_100_unit / servingAmount stored for downstream.
 * @param {object} product - Open Food Facts product (e.g. from API response product)
 * @returns {object|null} Normalized food: { id, name, brand, calories, protein, carbs, fat, fiber, sodium, sugar, servingSize, servingUnit, servingGrams, source, kcalPer100Unit?, servingAmount? } or null
 */
function normalizeOpenFoodFactsProduct(product) {
  if (!product || !product.code) return null;
  const p = product;
  const nut = p.nutriments || {};

  const quantityStr = (p.quantity || '').toString().trim();
  const parsed = parseQuantityToGramsOrMl(quantityStr);
  const isLiquidFromQuantity = parsed?.isLiquid ?? /ml|fl oz|l\b|oz/i.test(quantityStr);
  const isBeverage =
    isLiquidFromQuantity ||
    (p.nutrition_data_per && String(p.nutrition_data_per).toLowerCase() === '100ml') ||
    (p.categories_hierarchy && p.categories_hierarchy.some((c) => /beverage|soda|cola|drink|eau|water/i.test(c)));
  const hasPer100ml = nut['energy-kcal_100ml'] != null || nut['energy_100ml'] != null;
  const usePer100ml = isBeverage;

  let defaultServingAmount = 100;
  if (usePer100ml) {
    defaultServingAmount = parsed?.value ?? 100;
    if (defaultServingAmount === 100 && p.product_quantity != null && String(p.product_quantity_unit || '').toLowerCase() === 'ml') {
      const q = Number(p.product_quantity);
      if (!Number.isNaN(q) && q > 0) defaultServingAmount = Math.round(q);
    }
    if (defaultServingAmount === 100 && isBeverage) defaultServingAmount = 500;
  } else {
    defaultServingAmount = parsed?.value ?? 100;
    const servingQ = p.serving_quantity != null && !Number.isNaN(Number(p.serving_quantity)) ? Number(p.serving_quantity) : null;
    const servingSizeStr = (p.serving_size || '').toString();
    const gMatch = servingSizeStr.match(/(\d+(?:[.,]\d+)?)\s*g/i) || servingSizeStr.match(/(\d+)/);
    const servingG = gMatch ? parseFloat(gMatch[1].replace(',', '.')) : null;
    const fromServing = servingQ ?? servingG;
    if (fromServing != null && fromServing > 0) defaultServingAmount = Math.round(fromServing);
  }
  const servingAmount = Math.min(10000, Math.max(1, defaultServingAmount));
  const servingUnit = usePer100ml ? 'ml' : 'grams';

  const kcalPer100Unit = usePer100ml
    ? (getKcalPer100(nut, p, true) || getKcalPer100(nut, p, false))
    : getKcalPer100(nut, p, false);

  const scale = servingAmount / 100;
  // Store per-100 values so addFoodLog can compute: totalCalories = calories * servingQuantity
  // For beverages, OFF often only has _100g; use _100ml ?? _100g when usePer100ml
  const proteinPer100 = num(usePer100ml ? (nut.proteins_100ml ?? nut.proteins_100g) : nut.proteins_100g);
  const carbsPer100 = num(usePer100ml ? (nut.carbohydrates_100ml ?? nut.carbohydrates_100g) : nut.carbohydrates_100g);
  const fatPer100 = num(usePer100ml ? (nut.fat_100ml ?? nut.fat_100g) : nut.fat_100g);
  const sugarPer100 = numOrNull(usePer100ml ? (nut.sugars_100ml ?? nut.sugars_100g) : nut.sugars_100g);
  const sodiumRaw = usePer100ml ? (nut.sodium_100ml ?? nut.sodium_100g) : nut.sodium_100g;
  const saltRaw = usePer100ml ? (nut.salt_100ml ?? nut.salt_100g) : nut.salt_100g;
  let sodiumPer100 = numOrNull(sodiumRaw);
  if (sodiumPer100 == null && saltRaw != null) sodiumPer100 = num(saltRaw) * 400;
  const fiberPer100 = numOrNull(usePer100ml ? (nut.fiber_100ml ?? nut.fiber_100g) : nut.fiber_100g);

  return {
    id: p.code,
    name: p.product_name || 'Unknown',
    brand: p.brands || null,
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
    source: 'openfoodfacts',
    kcalPer100Unit,
    servingAmount,
  };
}

module.exports = {
  parseQuantityToGramsOrMl,
  normalizeOpenFoodFactsProduct,
  getKcalPer100,
  num,
  numOrNull,
};
