/**
 * Barcode result guards + multi-source merge (prefer label-serving FatSecret/OFF over USDA per-100g).
 */
const { finalizeBarcodeFood } = require('../../src/nutrition/food-details/calculateServingSize');
const { isUsableBarcodeFood } = require('../../src/nutrition/barcode/validateBarcodeFood');

const LIQUID_UNITS = new Set(['ml', 'milliliter', 'milliliters', 'fl oz', 'fluid ounce']);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isLiquidFood(food) {
  const name = String(food?.name || food?.food_name || '').toLowerCase();
  if (/\b(nuggets?|chips?|crackers?|cookies?|bars?|chicken|beef|pork|meat|bread)\b/.test(name)) {
    return false;
  }
  const unit = String(food?.servingUnit || food?.serving_unit || '').toLowerCase();
  if (LIQUID_UNITS.has(unit)) return true;
  return /\b(juice|soda|drink|beverage|water|milk)\b/.test(name);
}

function roundMacro(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.round(v * 10) / 10;
}

/** Score candidates — label-serving branded DBs beat USDA per-100g when both exist (e.g. Chomps 100 vs 90 cal). */
function scoreBarcodeCandidate(food) {
  if (!food || !isUsableBarcodeFood(food)) return -999;

  let score = 0;
  const source = String(food.source || '').toLowerCase();
  const basis = String(food.dataBasis || '').toLowerCase();

  if (food.verified === true || source === 'verified_cache') score += 200;
  if (source === 'fatsecret') score += 40;
  if (source === 'openfoodfacts') score += 35;
  if (source === 'usda') score += 25;

  if (basis === 'label_serving') score += 35;
  else if (basis === 'per_100g') score += 8;
  else if (basis === 'logged_total') score += 30;

  const cal = num(food.calories ?? food.nf_calories);
  const protein = num(food.protein ?? food.nf_protein);
  const carbs = num(food.carbs ?? food.nf_total_carbohydrate);
  const fat = num(food.fat ?? food.nf_total_fat);

  if (cal > 0) score += 12;
  if (protein > 0) score += 4;
  if (carbs > 0 || fat > 0) score += 3;
  if (num(food.servingGrams) > 0) score += 2;

  return score;
}

function pickBestBarcodeCandidate(candidates) {
  const list = (candidates || []).filter(Boolean);
  if (!list.length) return null;
  const ranked = list
    .map((food) => ({ food, score: scoreBarcodeCandidate(food) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked[0]?.food || null;
}

function guardBarcodeResult(raw) {
  if (!raw || typeof raw !== 'object') return null;

  let food = { ...raw };
  if (isLiquidFood(food) && food.servingUnit !== 'ml') {
    food.servingUnit = 'ml';
  } else if (!isLiquidFood(food) && String(food.servingUnit || '').toLowerCase() === 'ml') {
    food.servingUnit = 'g';
  }

  food = finalizeBarcodeFood(food) || food;

  const fields = ['protein', 'carbs', 'fat', 'fiber', 'sodium', 'sugar', 'nf_protein', 'nf_total_carbohydrate', 'nf_total_fat'];
  for (const key of fields) {
    if (food[key] != null) food[key] = roundMacro(food[key]);
  }

  if (food.nf_calories != null) food.nf_calories = Math.round(Number(food.nf_calories));
  if (food.calories != null) food.calories = Math.round(Number(food.calories));

  return food;
}

module.exports = {
  guardBarcodeResult,
  isLiquidFood,
  scoreBarcodeCandidate,
  pickBestBarcodeCandidate,
};
