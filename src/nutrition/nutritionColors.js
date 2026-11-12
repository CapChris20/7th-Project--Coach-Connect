// Nutrition accent gradients aligned to Design Law nb tokens.
// Flow: macro / calorie ramps for bars and chips → label lookup for rings.
// Used by daily log, nutrition facts, nutrition settings, trainer nutrition tab.
// NEVER green. Gradients are accents only.

import { BRAND_NAV_ICON_GRADIENT } from '../look-and-feel/brandColors';
import { gradients, brandColors } from './food-cards/foodCardColors';

// ===== NAMED CONSTANTS =====

/** Calorie total accent */
export const NUT_CALORIES_GRADIENT = gradients.calories;

/** Primary nutrition action accent */
export const NUT_ACTION_GRADIENT = brandColors.orangePink;

/** Section headers match nav accent */
export const NUT_SECTION_GRADIENT = BRAND_NAV_ICON_GRADIENT;

// ===== HELPER FUNCTIONS =====

function buildMacroGradients() {
  return {
    protein: gradients.protein,
    carbs: gradients.carbs,
    fat: gradients.fat,
  };
}

function buildMacroRingGradients() {
  return {
    Protein: gradients.protein,
    Carbs: gradients.carbs,
    Fat: gradients.fat,
    Fiber: brandColors.goldPink,
    Sugar: brandColors.orangePink,
    Sodium: brandColors.cyanPurple,
    Potassium: brandColors.orangePurple,
  };
}

function knownNutrientGradient(label) {
  return NUT_MACRO_RING_GRADIENTS[label];
}

function hasKnownNutrientGradient(label) {
  return knownNutrientGradient(label) != null;
}

export const NUT_MACRO_GRADIENTS = buildMacroGradients();
export const NUT_MACRO_RING_GRADIENTS = buildMacroRingGradients();
export const NUT_FOOD_MACRO_BAR_GRADIENTS = buildMacroGradients();

/**
 * Gradient for a nutrient ring label. Unknown labels use calories accent.
 * @param {string} label
 * @returns {Array}
 */
export function gradientForNutrientLabel(label) {
  if (hasKnownNutrientGradient(label)) return knownNutrientGradient(label);
  return NUT_CALORIES_GRADIENT;
}
