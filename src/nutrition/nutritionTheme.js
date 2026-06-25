/**
 * nutrition Theme
 *
 * Purpose: nutrition Theme — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: gradientForNutrientLabel, NUT_CALORIES_GRADIENT, NUT_ACTION_GRADIENT, NUT_MACRO_GRADIENTS, NUT_MACRO_RING_GRADIENTS, NUT_SECTION_GRADIENT, NUT_FOOD_MACRO_BAR_GRADIENTS
 *
 * @file-header
 */
import { BRAND_NAV_ICON_GRADIENT } from '../shared-ui/brandGradients';
import { gradients, brandGradients } from './components/premiumFoodCard/theme';

/** dark orange → purple */
export const NUT_CALORIES_GRADIENT = gradients.calories;

/** dark orange → pink */
export const NUT_ACTION_GRADIENT = brandGradients.orangePink;

/** Same macro palette as premium food cards */
export const NUT_MACRO_GRADIENTS = {
  protein: gradients.protein,
  carbs: gradients.carbs,
  fat: gradients.fat,
};

export const NUT_MACRO_RING_GRADIENTS = {
  Protein: gradients.protein,
  Carbs: gradients.carbs,
  Fat: gradients.fat,
  Fiber: brandGradients.goldPink,
  Sugar: brandGradients.orangePink,
  Sodium: brandGradients.cyanPurple,
  Potassium: brandGradients.orangePurple,
};

export const NUT_SECTION_GRADIENT = BRAND_NAV_ICON_GRADIENT;

export function gradientForNutrientLabel(label) {
  return NUT_MACRO_RING_GRADIENTS[label] || NUT_CALORIES_GRADIENT;
}

export const NUT_FOOD_MACRO_BAR_GRADIENTS = {
  protein: gradients.protein,
  carbs: gradients.carbs,
  fat: gradients.fat,
};
