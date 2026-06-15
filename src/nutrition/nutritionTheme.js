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
import { BRAND_NAV_ICON_GRADIENT } from '../shared/ui/brandGradients';

export const NUT_CALORIES_GRADIENT = ['#BE185D', '#C2410C'];
export const NUT_ACTION_GRADIENT = ['#FF6B9D', '#F97316'];

export const NUT_MACRO_GRADIENTS = {
  protein: ['#FF6B9D', '#DB2777'],
  carbs: ['#FBBF24', '#F97316'],
  fat: ['#22D3EE', '#06B6D4'],
};

export const NUT_MACRO_RING_GRADIENTS = {
  Protein: NUT_MACRO_GRADIENTS.protein,
  Carbs: NUT_MACRO_GRADIENTS.carbs,
  Fat: NUT_MACRO_GRADIENTS.fat,
  Fiber: ['#BE185D', '#C2410C'],
  Sugar: ['#FF6B9D', '#F97316'],
  Sodium: ['#E94EAD', '#A348D0'],
  Potassium: ['#A348D0', '#6B3AD9'],
};

export const NUT_SECTION_GRADIENT = BRAND_NAV_ICON_GRADIENT;

export function gradientForNutrientLabel(label) {
  return NUT_MACRO_RING_GRADIENTS[label] || NUT_CALORIES_GRADIENT;
}

export const NUT_FOOD_MACRO_BAR_GRADIENTS = {
  protein: ['#FF6B9D', '#A348D0'],
  carbs: ['#F5C842', '#F97316'],
  fat: ['#22D3EE', '#6B3AD9'],
};
