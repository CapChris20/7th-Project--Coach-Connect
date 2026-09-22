/**
 * Onboarding color tokens — literal values from premiumFoodCard/theme.js.
 * Kept in a dependency-free module so onboarding screens never crash on import order.
 */

export const FOOD_CARD_BRAND = {
  orangePink: ['#9A3412', '#FF3D8A'],
  orangePurple: ['#9A3412', '#8B5CF6'],
  goldPink: ['#A67C00', '#FF6B9D'],
  cyanPurple: ['#0891B2', '#8B5CF6'],
};

export const FOOD_CARD_MACRO_GRADIENTS = {
  protein: FOOD_CARD_BRAND.orangePink,
  carbs: FOOD_CARD_BRAND.goldPink,
  fat: FOOD_CARD_BRAND.cyanPurple,
  calories: FOOD_CARD_BRAND.orangePurple,
};

export const ONBOARDING_PALETTE = {
  purple: FOOD_CARD_BRAND.cyanPurple[1],
  pink: FOOD_CARD_BRAND.orangePink[1],
  orange: FOOD_CARD_BRAND.orangePink[0],
  cyan: FOOD_CARD_BRAND.cyanPurple[0],
  gold: FOOD_CARD_BRAND.goldPink[0],
};

export const ONBOARDING_OPTION_GRADIENTS = [
  FOOD_CARD_MACRO_GRADIENTS.protein,
  FOOD_CARD_MACRO_GRADIENTS.carbs,
  FOOD_CARD_MACRO_GRADIENTS.fat,
  FOOD_CARD_MACRO_GRADIENTS.calories,
];

export const ONBOARDING_CTA_GRADIENT = FOOD_CARD_MACRO_GRADIENTS.protein;
export const ONBOARDING_BRAND_GRADIENT = ONBOARDING_CTA_GRADIENT;
export const TRAINER_ONBOARDING_GRADIENT = FOOD_CARD_MACRO_GRADIENTS.carbs;
export const ONBOARDING_ACCENT = ONBOARDING_PALETTE.pink;
export const ONBOARDING_ACCENT_SOFT = 'rgba(255, 61, 138, 0.15)';

export const ONBOARDING_GLASS_TINTS = {
  cyan: ONBOARDING_PALETTE.cyan,
  violet: ONBOARDING_PALETTE.purple,
  magenta: ONBOARDING_PALETTE.pink,
  orange: ONBOARDING_PALETTE.orange,
  gold: ONBOARDING_PALETTE.gold,
};

export const onboardingOptionGradient = (index) =>
  ONBOARDING_OPTION_GRADIENTS[Math.abs(index) % ONBOARDING_OPTION_GRADIENTS.length];

export function hexToRgba(hex, alpha) {
  const h = String(hex || '').replace('#', '');
  if (h.length < 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Pill background: 135° gradient at low opacity (matches food-card MacroPill). */
export function pillBackgroundGradient(stops, { strong = false } = {}) {
  const a0 = strong ? 0.2 : 0.1;
  const a1 = strong ? 0.14 : 0.06;
  return [hexToRgba(stops[0], a0), hexToRgba(stops[1], a1)];
}
