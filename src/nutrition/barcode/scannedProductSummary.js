// Labels and scaled macros for a barcode scan result card.
// Flow: pick grams → scale calories and macros → human-readable source / confidence lines.
// Used by: ConfirmFoodPopup and the barcode result UI after lookup succeeds.
// Read order: constants → helpers → numbered recipes → module.exports.

const { caloriesForGrams, scaleMacroForGrams } = require('../food-details/servingSizeMath');

// ===== NAMED CONSTANTS =====

// Manipulate here: when neither caller grams nor servingGrams is set, scale as if 100g.
const DEFAULT_SERVING_GRAMS = 100;

const SOURCE_DISPLAY_LABELS = {
  usda: 'USDA',
  openfoodfacts: 'OpenFoodFacts',
  fatsecret: 'FatSecret',
};

const CONFIDENCE_DISPLAY_LABELS = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

const UNKNOWN_SOURCE_LABEL = 'Unknown source';
const UNKNOWN_CONFIDENCE_LABEL = 'Confidence unknown';
const NEEDS_VERIFICATION_LABEL = 'Needs verification';

// ===== HELPER FUNCTIONS =====

/**
 * Pick the gram amount used to scale macros for the confirm card.
 * @param {object|undefined} food
 * @param {number} grams
 * @returns {number}
 */
function resolveGramsAmountForScaling(food, grams) {
  const requestedGrams = Number(grams);
  if (requestedGrams > 0) return requestedGrams;

  const servingGramsOnFood = Number(food?.servingGrams);
  if (servingGramsOnFood > 0) return servingGramsOnFood;

  return DEFAULT_SERVING_GRAMS;
}

/**
 * Lowercase source key for the display-label map.
 * @param {string} source
 * @returns {string}
 */
function normalizedSourceKey(source) {
  return String(source || '').toLowerCase();
}

/**
 * Lowercase confidence key for the display-label map.
 * @param {string} confidence
 * @returns {string}
 */
function normalizedConfidenceKey(confidence) {
  return String(confidence || '').toLowerCase();
}

// ===== MAIN FUNCTION =====

/**
 * Calories and macros for a scanned food at a gram amount (barcode confirm row).
 * @param {object} food
 * @param {number} grams
 * @returns {{ calories: number, protein: number, carbs: number, fat: number }}
 */
function macrosAtGrams(food, grams) {
  // 1. Resolve how many grams we are scaling to (caller → serving → 100g default).
  const amountInGrams = resolveGramsAmountForScaling(food, grams);

  // 2. Scale each macro with the same serving-size math food-search cards use.
  // vocab: caloriesForGrams / scaleMacroForGrams live in servingSizeMath — keep those letters.
  return {
    calories: caloriesForGrams(food, amountInGrams),
    protein: scaleMacroForGrams(food?.protein, amountInGrams, food),
    carbs: scaleMacroForGrams(food?.carbs, amountInGrams, food),
    fat: scaleMacroForGrams(food?.fat, amountInGrams, food),
  };
}

/**
 * Short source name shown under a barcode result (USDA, OpenFoodFacts, …).
 * @param {string} source
 * @returns {string}
 */
function barcodeSourceLabel(source) {
  // 1. Empty source → fixed unknown label.
  const sourceKey = normalizedSourceKey(source);
  if (!sourceKey) return UNKNOWN_SOURCE_LABEL;

  // 2. Known keys get a pretty label; anything else shows the raw key.
  const prettyLabel = SOURCE_DISPLAY_LABELS[sourceKey];
  if (prettyLabel) return prettyLabel;
  return sourceKey;
}

/**
 * Short confidence line. Rows that still need a human check always say so.
 * @param {string} confidence
 * @param {boolean} needsVerification
 * @returns {string}
 */
function barcodeConfidenceLabel(confidence, needsVerification) {
  // 1. Human-check flag wins over any confidence string.
  if (needsVerification) return NEEDS_VERIFICATION_LABEL;

  // 2. Map high/medium/low; unknown keys fall back to a fixed phrase.
  const confidenceKey = normalizedConfidenceKey(confidence);
  const prettyLabel = CONFIDENCE_DISPLAY_LABELS[confidenceKey];
  if (prettyLabel) return prettyLabel;
  return UNKNOWN_CONFIDENCE_LABEL;
}

module.exports = {
  macrosAtGrams,
  barcodeSourceLabel,
  barcodeConfidenceLabel,
};
