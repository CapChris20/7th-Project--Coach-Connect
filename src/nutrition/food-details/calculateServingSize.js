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

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isPer100gSource(source) {
  return PER_100G_SOURCES.has(String(source || '').toLowerCase());
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

/** Factor to multiply per-100g nutrient values (grams / 100). */
function resolveServingFactor(food) {
  return resolveServingGrams(food) / 100;
}

function nutrientTotalForGrams(per100Value, grams) {
  return num(per100Value) * (num(grams) / 100);
}

function caloriesForGrams(food, grams) {
  const g = num(grams) > 0 ? num(grams) : resolveServingGrams(food);
  const per100 = num(food?.calories) || num(food?.kcalPer100Unit);
  return Math.round(nutrientTotalForGrams(per100, g));
}

function scaleMacroForGrams(per100Value, grams) {
  return Math.round(nutrientTotalForGrams(per100Value, grams) * 10) / 10;
}

/**
 * Normalize barcode / per-100g food payloads so servingSize is always grams/100.
 */
function finalizeBarcodeFood(food) {
  if (!food || !isPer100gSource(food.source)) return food;

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
  isPer100gSource,
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
