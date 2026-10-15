// Nutrition gradients shared by food cards, rings, and section headers.
// Flow: build the food-card palettes under nutrition names → look up a ring color by its label.
// Used by the daily log, nutrition facts, nutrition settings, and the trainer nutrition tab.

import { BRAND_NAV_ICON_GRADIENT } from '../look-and-feel/brandColors';
import { gradients, brandColors } from './food-cards/foodCardColors';

// ===== NAMED CONSTANTS =====

/** Dark orange to purple. The calorie total uses this. */
export const NUT_CALORIES_GRADIENT = gradients.calories;

/** Dark orange to pink. Primary nutrition actions use this. */
export const NUT_ACTION_GRADIENT = brandColors.orangePink;

// Section headers reuse the nav-icon gradient so nutrition matches the rest of the app.
export const NUT_SECTION_GRADIENT = BRAND_NAV_ICON_GRADIENT;

// ===== HELPER FUNCTIONS =====

/**
 * Lowercase macro keys for food cards (protein / carbs / fat).
 * @returns {{ protein: Array, carbs: Array, fat: Array }}
 */
function buildMacroGradients() {
  return {
    protein: gradients.protein,
    carbs: gradients.carbs,
    fat: gradients.fat,
  };
}

/**
 * Title-case labels for the daily-log nutrient rings.
 * @returns {object}
 */
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

/**
 * The ring map only knows the labeled nutrients. Anything else comes back undefined so the caller can fall back.
 * @param {string} label
 * @returns {Array|undefined}
 */
function knownNutrientGradient(label) {
  return NUT_MACRO_RING_GRADIENTS[label];
}

/**
 * True when the label is one of the known ring nutrients.
 * @param {string} label
 * @returns {boolean}
 */
function hasKnownNutrientGradient(label) {
  return knownNutrientGradient(label) != null;
}

// Food cards look up macros with lowercase keys. Those keys are part of the card API.
export const NUT_MACRO_GRADIENTS = buildMacroGradients();

// Ring labels are the words shown on screen (Protein, Carbs), so this map is title case.
export const NUT_MACRO_RING_GRADIENTS = buildMacroRingGradients();

// Macro bars on a food card use the same lowercase keys as NUT_MACRO_GRADIENTS.
export const NUT_FOOD_MACRO_BAR_GRADIENTS = buildMacroGradients();

// ===== MAIN FUNCTION =====

/**
 * Gradient for a nutrient ring label. Unknown labels use the calories gradient so the ring is never blank.
 * @param {string} label Display label such as Protein, Fiber, or a custom nutrient name.
 * @returns {Array}
 */
export function gradientForNutrientLabel(label) {
  if (hasKnownNutrientGradient(label)) return knownNutrientGradient(label);
  return NUT_CALORIES_GRADIENT;
}
