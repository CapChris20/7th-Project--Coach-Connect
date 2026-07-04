/**
 * Barcode result guards — cap insane per-100g calories and round macros.
 */
const { finalizeBarcodeFood } = require('../../src/nutrition/food-details/calculateServingSize');

const LIQUID_UNITS = new Set(['ml', 'milliliter', 'milliliters', 'fl oz', 'fluid ounce']);

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
};
