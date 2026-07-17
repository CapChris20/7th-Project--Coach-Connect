/**
 * nutrition Normalization
 *
 * Purpose: nutrition Normalization — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: parseQuantityToGramsOrMl, normalizeOpenFoodFactsProduct, getKcalPer100, num, numOrNull
 *
 * @file-header
 */
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
 * - Parsed quantity -> defaultServingAmount (ml for drinks, grams for solids)
 * - totalCalories = (kcal_per_100_unit * defaultServingAmount) / 100
 * - servingUnit: ml only for beverages; grams for packaged foods (avoid mis-tagging snacks as drinks).
 * @param {object} product - Open Food Facts product (e.g. from API response product)
 * @returns {object|null} Normalized food object or null
 */
function normalizeOpenFoodFactsProduct(product) {
  if (!product || !product.code) return null;
  const p = product;
  const nut = p.nutriments || {};

  const quantityStr = (p.quantity || '').toString().trim();
  const parsed = parseQuantityToGramsOrMl(quantityStr);

  // Parser output only — old fallback regex matched "oz" / vague "drink" and misclassified solid foods as liquids.
  const explicitSolidFromQuantity = parsed?.isLiquid === false;
  const explicitLiquidFromQuantity = parsed?.isLiquid === true;

  const unitLower = String(p.product_quantity_unit || '').toLowerCase();
  const packSizedAsLiquid = unitLower === 'ml' || unitLower === 'cl' || unitLower === 'l';

  const catHaystack = (p.categories_hierarchy || []).join(' ').toLowerCase();
  const beverageTaxonomy = /:en:beverages|:en:sodas|:en:colas|:en:carbonated|:en:soft-drinks|:en:waters|:en:juices|:en:iced-teas|:en:energy-drinks|:en:sports-drinks|:en:alcoholic-beverages|:en:beers|:en:wines|:en:spirits|:en:plant-milk|:en:fruit-juices|carbonated drinks|beverages and beverages preparations/i.test(
    catHaystack
  );

  const nutDataPer = String(p.nutrition_data_per || '').toLowerCase();
  const labeledPer100ml = nutDataPer === '100ml';

  const isBeverage =
    explicitLiquidFromQuantity ||
    (packSizedAsLiquid && !explicitSolidFromQuantity) ||
    (beverageTaxonomy && !explicitSolidFromQuantity) ||
    (labeledPer100ml && !explicitSolidFromQuantity);

  const usePer100ml = isBeverage;

  let defaultServingAmount = 100;
  if (usePer100ml) {
    defaultServingAmount = parsed?.value ?? 100;
    if (defaultServingAmount === 100 && p.product_quantity != null && String(p.product_quantity_unit || '').toLowerCase() === 'ml') {
      const q = Number(p.product_quantity);
      if (!Number.isNaN(q) && q > 0) defaultServingAmount = Math.round(q);
    }
    // If OFF doesn't provide a package quantity, default to a realistic single serving.
    // 355ml ~= 12 fl oz can. Users can always adjust in the scanner "Adjust amount" step.
    if (defaultServingAmount === 100 && isBeverage) defaultServingAmount = 355;
  } else {
    // For solids, do NOT default to full package quantity unless OFF provides a serving size.
    // Using 100g keeps calories/macros consistent with per-100g data and avoids over-logging.
    defaultServingAmount = 100;
    const servingQ = p.serving_quantity != null && !Number.isNaN(Number(p.serving_quantity)) ? Number(p.serving_quantity) : null;
    const servingSizeStr = (p.serving_size || '').toString();
    const gMatch = servingSizeStr.match(/(\d+(?:[.,]\d+)?)\s*g/i) || servingSizeStr.match(/(\d+)/);
    const servingG = gMatch ? parseFloat(gMatch[1].replace(',', '.')) : null;
    const fromServing = servingQ ?? servingG;
    if (fromServing != null && fromServing > 0) defaultServingAmount = Math.round(fromServing);
  }
  const servingAmount = Math.min(10000, Math.max(1, defaultServingAmount));
  const servingUnit = usePer100ml ? 'ml' : 'grams';

  /**
   * When OFF has per-serving values (from the Nutrition Facts table), derive per-100g/ml from them.
   * Crowdsourced *_100g is often wrong; *_serving usually matches the printed label for one serving.
   */
  const sm = servingAmount;
  const per100FromServing = (servingVal) => {
    if (servingVal == null || servingVal === '') return null;
    const v = Number(servingVal);
    if (Number.isNaN(v) || sm <= 0) return null;
    return (v / sm) * 100;
  };

  let kcalPer100Unit = usePer100ml
    ? (getKcalPer100(nut, p, true) || getKcalPer100(nut, p, false))
    : getKcalPer100(nut, p, false);
  const kcalFromServing = per100FromServing(nut['energy-kcal_serving']);
  if (kcalFromServing != null && kcalFromServing > 0) kcalPer100Unit = kcalFromServing;

  const scale = servingAmount / 100;
  // Store per-100 values so addFoodLog can compute: totalCalories = calories * servingQuantity
  // For beverages, OFF often only has _100g; use _100ml ?? _100g when usePer100ml
  let proteinPer100 = num(usePer100ml ? (nut.proteins_100ml ?? nut.proteins_100g) : nut.proteins_100g);
  const proteinFromServing = per100FromServing(nut.proteins_serving);
  if (proteinFromServing != null) proteinPer100 = proteinFromServing;

  let carbsPer100 = num(usePer100ml ? (nut.carbohydrates_100ml ?? nut.carbohydrates_100g) : nut.carbohydrates_100g);
  const carbsFromServing = per100FromServing(nut.carbohydrates_serving);
  if (carbsFromServing != null) carbsPer100 = carbsFromServing;

  let fatPer100 = num(usePer100ml ? (nut.fat_100ml ?? nut.fat_100g) : nut.fat_100g);
  const fatFromServing = per100FromServing(nut.fat_serving);
  if (fatFromServing != null) fatPer100 = fatFromServing;

  let sugarPer100 = numOrNull(usePer100ml ? (nut.sugars_100ml ?? nut.sugars_100g) : nut.sugars_100g);
  const sugarFromServing = per100FromServing(nut.sugars_serving);
  if (sugarFromServing != null) sugarPer100 = sugarFromServing;

  const sodiumRaw = usePer100ml ? (nut.sodium_100ml ?? nut.sodium_100g) : nut.sodium_100g;
  const saltRaw = usePer100ml ? (nut.salt_100ml ?? nut.salt_100g) : nut.salt_100g;
  let sodiumPer100 = numOrNull(sodiumRaw);
  if (sodiumPer100 == null && saltRaw != null) sodiumPer100 = num(saltRaw) * 400;
  const sodiumFromServing = per100FromServing(nut.sodium_serving);
  if (sodiumFromServing != null) sodiumPer100 = sodiumFromServing;

  let fiberPer100 = numOrNull(usePer100ml ? (nut.fiber_100ml ?? nut.fiber_100g) : nut.fiber_100g);
  const fiberFromServing = per100FromServing(nut.fiber_serving);
  if (fiberFromServing != null) fiberPer100 = fiberFromServing;

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
    dataBasis: 'per_100g',
    kcalPer100Unit,
    servingAmount,
    // Crowdsourced OFF — confirm sheet should let users verify product identity
    needsVerification: true,
    barcodeConfidence: 'medium',
  };
}

module.exports = {
  parseQuantityToGramsOrMl,
  normalizeOpenFoodFactsProduct,
  getKcalPer100,
  num,
  numOrNull,
};
