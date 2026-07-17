/**
 * barcode Display
 *
 * Purpose: barcode Display — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: macrosAtGrams, barcodeSourceLabel, barcodeConfidenceLabel
 *
 * @file-header
 */
const { caloriesForGrams, scaleMacroForGrams } = require('../food-details/calculateServingSize');

function macrosAtGrams(food, grams) {
  const g = Number(grams) > 0 ? Number(grams) : Number(food?.servingGrams || 100);
  return {
    calories: caloriesForGrams(food, g),
    protein: scaleMacroForGrams(food?.protein, g, food),
    carbs: scaleMacroForGrams(food?.carbs, g, food),
    fat: scaleMacroForGrams(food?.fat, g, food),
    fiber: scaleMacroForGrams(food?.fiber, g, food),
    sugar: scaleMacroForGrams(food?.sugar, g, food),
    sodium: scaleMacroForGrams(food?.sodium, g, food),
    potassium: scaleMacroForGrams(food?.potassium, g, food),
  };
}

function barcodeSourceLabel(source) {
  const s = String(source || '').toLowerCase();
  if (s === 'usda') return 'USDA';
  if (s === 'openfoodfacts') return 'OpenFoodFacts';
  if (s === 'fatsecret') return 'FatSecret';
  if (!s) return 'Unknown source';
  return s;
}

function barcodeConfidenceLabel(confidence, needsVerification) {
  if (needsVerification) return 'Needs verification';
  const c = String(confidence || '').toLowerCase();
  if (c === 'high') return 'High confidence';
  if (c === 'medium') return 'Medium confidence';
  if (c === 'low') return 'Low confidence';
  return 'Confidence unknown';
}

module.exports = {
  macrosAtGrams,
  barcodeSourceLabel,
  barcodeConfidenceLabel,
};
