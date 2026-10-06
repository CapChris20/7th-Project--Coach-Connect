// Labels and scaled macros for a barcode scan result.
// Flow: grams the user picked → calories and macros at that amount; source and confidence → short labels.
// Used by the barcode result card.

const { caloriesForGrams, scaleMacroForGrams } = require('../food-details/servingSizeMath');

// ===== NAMED CONSTANTS =====

const DEFAULT_SERVING_GRAMS = 100;
const SOURCE_LABELS = {
  usda: 'USDA',
  openfoodfacts: 'OpenFoodFacts',
  fatsecret: 'FatSecret',
};
const CONFIDENCE_LABELS = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

// ===== HELPER FUNCTIONS =====

function gramsToUse(food, grams) {
  const requestedGrams = Number(grams);
  if (requestedGrams > 0) return requestedGrams;
  const servingGrams = Number(food?.servingGrams);
  return servingGrams > 0 ? servingGrams : DEFAULT_SERVING_GRAMS;
}

// ===== MAIN FUNCTION =====

/**
 * Calories and macros for a scanned food at a gram amount.
 * @param {object} food
 * @param {number} grams
 * @returns {{ calories: number, protein: number, carbs: number, fat: number }}
 */
function macrosAtGrams(food, grams) {
  const amountInGrams = gramsToUse(food, grams);
  return {
    calories: caloriesForGrams(food, amountInGrams),
    protein: scaleMacroForGrams(food?.protein, amountInGrams, food),
    carbs: scaleMacroForGrams(food?.carbs, amountInGrams, food),
    fat: scaleMacroForGrams(food?.fat, amountInGrams, food),
  };
}

/**
 * Short source name shown under a barcode result.
 * @param {string} source
 * @returns {string}
 */
function barcodeSourceLabel(source) {
  const sourceKey = String(source || '').toLowerCase();
  if (!sourceKey) return 'Unknown source';
  return SOURCE_LABELS[sourceKey] || sourceKey;
}

/**
 * Short confidence line. A result that still needs a human check always says so.
 * @param {string} confidence
 * @param {boolean} needsVerification
 * @returns {string}
 */
function barcodeConfidenceLabel(confidence, needsVerification) {
  if (needsVerification) return 'Needs verification';
  const confidenceKey = String(confidence || '').toLowerCase();
  return CONFIDENCE_LABELS[confidenceKey] || 'Confidence unknown';
}

module.exports = {
  macrosAtGrams,
  barcodeSourceLabel,
  barcodeConfidenceLabel,
};
