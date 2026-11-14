// Nutrition accent gradients aligned to Design Law nb tokens.
// Flow: import food-card ramps → build macro maps → look up a ring gradient by label.
// Used by daily log, nutrition facts, settings, trainer nutrition tab. NEVER green.
// Read order: constants → helpers → main lookup.

import { BRAND_NAV_ICON_GRADIENT } from '../look-and-feel/brandColors';
import { gradients, brandColors } from './food-cards/foodCardColors';

// ===== NAMED CONSTANTS =====

/** Calorie total accent — bars and default ring fallback */
export const NUT_CALORIES_GRADIENT = gradients.calories;

/** Primary nutrition action accent */
export const NUT_ACTION_GRADIENT = brandColors.orangePink;

/** Section headers match nav accent */
export const NUT_SECTION_GRADIENT = BRAND_NAV_ICON_GRADIENT;

/** Daily-log macro bar fills (protein / carbs / fat) */
export const NUT_MACRO_GRADIENTS = {
  protein: gradients.protein,
  carbs: gradients.carbs,
  fat: gradients.fat,
};

/** Same triple as macro bars — food cards reuse the bar shape */
export const NUT_FOOD_MACRO_BAR_GRADIENTS = NUT_MACRO_GRADIENTS;

// Manipulate here: ring label → gradient (keys must match nutrient display labels)
export const NUT_MACRO_RING_GRADIENTS = {
  Protein: gradients.protein,
  Carbs: gradients.carbs,
  Fat: gradients.fat,
  Fiber: brandColors.goldPink,
  Sugar: brandColors.orangePink,
  Sodium: brandColors.cyanPurple,
  Potassium: brandColors.orangePurple,
};

// ===== HELPER FUNCTIONS =====

/**
 * True when the ring map has an exact label key (own property, not prototype).
 * @param {string} nutrientLabel
 * @returns {boolean}
 */
function ringMapHasExactLabel(nutrientLabel) {
  // vocab: hasOwnProperty = only keys on this object, not inherited ones
  return Object.prototype.hasOwnProperty.call(NUT_MACRO_RING_GRADIENTS, nutrientLabel);
}

/**
 * Look up ring stops for a label, or null when the label is unknown.
 * @param {string} nutrientLabel
 * @returns {string[]|null}
 */
function ringGradientStopsOrNull(nutrientLabel) {
  if (!ringMapHasExactLabel(nutrientLabel)) return null;
  return NUT_MACRO_RING_GRADIENTS[nutrientLabel];
}

// ===== MAIN FUNCTION =====

/**
 * Gradient stops for a nutrient ring label. Unknown labels fall back to calories accent.
 * @param {string} label
 * @returns {string[]}
 */
export function gradientForNutrientLabel(label) {
  const nutrientLabel = String(label || '');

  // 1. Exact label hit on the ring map (Protein / Carbs / Fat / Fiber / …).
  const matchedRingStops = ringGradientStopsOrNull(nutrientLabel);
  if (matchedRingStops) {
    return matchedRingStops;
  }

  // 2. Safe default so rings never render empty / undefined stops.
  return NUT_CALORIES_GRADIENT;
}
