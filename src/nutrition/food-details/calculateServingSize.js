/**
 * serving Math
 *
 * Purpose: serving Math — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: PER_100G_SOURCES, MAX_SANE_KCAL_PER_100, isPer100gSource, resolveServingGrams, resolveServingFactor, nutrientTotalForGrams, caloriesForGrams, scaleMacroForGrams
 *
 * @file-header
 */
/**
 * Shared serving / gram math for barcode and per-100g food sources.
 * calories and macros on openfoodfacts + usda barcode hits are per 100 g (or 100 ml).
 */

const PER_100G_SOURCES = new Set(['openfoodfacts', 'usda']);

/** Max plausible kcal per 100 g — catches bad OFF crowdsourced *_serving derivations. */
const MAX_SANE_KCAL_PER_100 = 1000;

/** Cooked/staple cup densities (g per cup). Default 240 ≈ water. */
const CUP_GRAMS_BY_FOOD = [
  { re: /\brice\b/i, cooked: 158, dry: 185 },
  { re: /\b(pasta|spaghetti|noodle|macaroni)\b/i, cooked: 140, dry: 105 },
  { re: /\b(oat|oatmeal|porridge)\b/i, cooked: 234, dry: 80 },
  { re: /\bquinoa\b/i, cooked: 185, dry: 170 },
  { re: /\b(milk|water|juice|broth|stock)\b/i, cooked: 240, dry: 240 },
  { re: /\b(peanut\s*butter|almond\s*butter)\b/i, cooked: 258, dry: 258 },
  { re: /\bflour\b/i, cooked: 120, dry: 120 },
  { re: /\bsugar\b/i, cooked: 200, dry: 200 },
  { re: /\b(spinach|lettuce)\b/i, cooked: 180, dry: 30 },
  { re: /\bbroccoli\b/i, cooked: 156, dry: 91 },
];

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isPer100gSource(source) {
  return PER_100G_SOURCES.has(String(source || '').toLowerCase());
}

function normalizeDataBasis(basis) {
  const b = String(basis || '').toLowerCase().trim();
  if (b === 'logged_total' || b === 'logged_totals') return 'logged_totals';
  if (b === 'label_serving' || b === 'per_serving') return 'label_serving';
  if (b === 'per_100g' || b === 'per_100') return 'per_100g';
  return b || null;
}

function isLoggedTotalsBasis(foodOrBasis) {
  const basis = typeof foodOrBasis === 'string'
    ? foodOrBasis
    : foodOrBasis?.dataBasis;
  return normalizeDataBasis(basis) === 'logged_totals';
}

/** FatSecret / Serper / manual / confirmed logs store label or portion totals, not per-100g. */
function isLabelServingBasis(food) {
  const basis = normalizeDataBasis(food?.dataBasis);
  if (basis === 'label_serving' || basis === 'logged_totals') return true;
  if (basis === 'per_100g') return false;
  return !isPer100gSource(food?.source);
}

/**
 * Grams for a household volume unit. Uses density when food name is known.
 * tbsp/tsp use ~15g/5g (approx); peanut butter tbsp ~16g when detected.
 */
function gramsForVolumeUnit(value, unit, foodName = '') {
  const n = num(value);
  if (n <= 0) return 0;
  const name = String(foodName || '');
  const u = String(unit || '').toLowerCase();
  if (u === 'ml') return n;
  if (u === 'oz') return n * 28.3495;
  if (u === 'tsp') return n * 5;
  if (u === 'tbsp') {
    if (/\b(peanut\s*butter|almond\s*butter|nut\s*butter)\b/i.test(name)) return n * 16;
    return n * 15;
  }
  if (u === 'cups' || u === 'cup') {
    const dry = /\b(dry|uncooked|raw)\b/i.test(name);
    for (const row of CUP_GRAMS_BY_FOOD) {
      if (row.re.test(name)) return n * (dry ? row.dry : row.cooked);
    }
    return n * 240;
  }
  return 0;
}

/** True when P×4 + C×4 + F×9 disagrees with calories by more than tolerance. */
function macrosDisagreeWithCalories(macros, { toleranceCal = 50 } = {}) {
  const cal = num(macros?.calories ?? macros?.nf_calories);
  const p = num(macros?.protein ?? macros?.nf_protein);
  const c = num(macros?.carbs ?? macros?.nf_total_carbohydrate);
  const f = num(macros?.fat ?? macros?.nf_total_fat);
  if (cal < 40) return false;
  const fromMacros = p * 4 + c * 4 + f * 9;
  if (fromMacros < 12) return cal >= 80;
  return Math.abs(fromMacros - cal) > toleranceCal;
}

/**
 * Resolve logged/scanned amount in grams (or ml for beverages).
 */
function resolveServingGrams(food) {
  const grams = num(food?.servingGrams) || num(food?.servingAmount);
  if (grams > 0) return Math.min(10000, Math.max(1, Math.round(grams)));
  const factor = num(food?.servingSize);
  if (factor > 0 && factor <= 2) return Math.min(10000, Math.max(1, Math.round(factor * 100)));
  return 100;
}

/** Factor to multiply nutrient values for a chosen gram amount. */
function resolveServingFactor(food) {
  const grams = resolveServingGrams(food);
  if (isLabelServingBasis(food)) return 1;
  return grams / 100;
}

function nutrientTotalForGrams(per100Value, grams) {
  return num(per100Value) * (num(grams) / 100);
}

function caloriesForGrams(food, grams) {
  const g = num(grams) > 0 ? num(grams) : resolveServingGrams(food);
  if (isLabelServingBasis(food)) {
    const baseG = resolveServingGrams(food) || 100;
    const labelCals = num(food?.calories) || num(food?.nf_calories) || num(food?.kcalPer100Unit);
    return Math.round(labelCals * (g / baseG));
  }
  const per100 = num(food?.calories) || num(food?.kcalPer100Unit);
  return Math.round(nutrientTotalForGrams(per100, g));
}

function scaleMacroForGrams(per100OrLabelValue, grams, food = null) {
  if (food && isLabelServingBasis(food)) {
    const baseG = resolveServingGrams(food) || 100;
    return Math.round(num(per100OrLabelValue) * (num(grams) / baseG) * 10) / 10;
  }
  return Math.round(nutrientTotalForGrams(per100OrLabelValue, grams) * 10) / 10;
}

/**
 * Normalize barcode / per-100g food payloads so servingSize is always grams/100.
 * Skip foods already stored as label or logged portion totals.
 */
function finalizeBarcodeFood(food) {
  if (!food || !isPer100gSource(food.source)) return food;
  if (isLabelServingBasis(food)) return food;

  const grams = resolveServingGrams(food);
  let per100Kcal = num(food.calories) || num(food.kcalPer100Unit);

  if (per100Kcal > MAX_SANE_KCAL_PER_100) {
    const fallback = num(food.kcalPer100Unit);
    if (fallback > 0 && fallback <= MAX_SANE_KCAL_PER_100) {
      per100Kcal = fallback;
    } else {
      per100Kcal = MAX_SANE_KCAL_PER_100;
    }
  }

  return {
    ...food,
    dataBasis: food.dataBasis || 'per_100g',
    calories: per100Kcal,
    kcalPer100Unit: per100Kcal || food.kcalPer100Unit,
    servingGrams: grams,
    servingAmount: grams,
    servingSize: grams / 100,
  };
}

function scaleNutritionByServings(macros, servings) {
  const s = Number(servings);
  if (!Number.isFinite(s) || s <= 0) return { ...macros, servings: 0 };
  return {
    calories: Math.round((num(macros?.calories) * s) * 10) / 10,
    protein: Math.round((num(macros?.protein) * s) * 10) / 10,
    carbs: Math.round((num(macros?.carbs) * s) * 10) / 10,
    fat: Math.round((num(macros?.fat) * s) * 10) / 10,
    servings: s,
  };
}

function totalGramsFromServing(qty, gramsPerServing) {
  const q = Number(qty);
  const g = Number(gramsPerServing);
  if (!Number.isFinite(q) || !Number.isFinite(g)) return 0;
  return Math.round(q * g);
}

function parseServingQtyInput(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  const fraction = v.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const top = Number(fraction[1]);
    const bottom = Number(fraction[2]);
    if (bottom === 0) return null;
    return top / bottom;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

module.exports = {
  PER_100G_SOURCES,
  MAX_SANE_KCAL_PER_100,
  CUP_GRAMS_BY_FOOD,
  isPer100gSource,
  normalizeDataBasis,
  isLoggedTotalsBasis,
  isLabelServingBasis,
  gramsForVolumeUnit,
  macrosDisagreeWithCalories,
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
