// Onboarding color tokens. The hex values match the food-card brand so setup and nutrition look like one app.
// Flow: brand pairs → macro gradients → the palette screens read → helpers turn a hex into a faint pill fill.
// Used by NewUserSetupScreen and the setup step pieces. This file imports nothing, so it cannot crash on import order.

// ===== NAMED CONSTANTS =====

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
// Kept as a literal so the spaces match older call sites. hexToRgba() would drop those spaces.
export const ONBOARDING_ACCENT_SOFT = 'rgba(255, 61, 138, 0.15)';

export const ONBOARDING_GLASS_TINTS = {
  cyan: ONBOARDING_PALETTE.cyan,
  violet: ONBOARDING_PALETTE.purple,
  magenta: ONBOARDING_PALETTE.pink,
  orange: ONBOARDING_PALETTE.orange,
  gold: ONBOARDING_PALETTE.gold,
};

// Manipulate here: pill strength. Strong is the selected chip. Soft is the resting chip.
const STRONG_PILL_START_ALPHA = 0.2;
const STRONG_PILL_END_ALPHA = 0.14;
const SOFT_PILL_START_ALPHA = 0.1;
const SOFT_PILL_END_ALPHA = 0.06;
// A 3-digit hex is too short to split into red/green/blue pairs. Fall back to white.
const MIN_HEX_DIGITS = 6;

// ===== HELPER FUNCTIONS =====

function hexChannel(hexDigits, start, end) {
  return parseInt(hexDigits.slice(start, end), 16);
}

function pillAlphas(isStrongPill) {
  if (isStrongPill) {
    return { startAlpha: STRONG_PILL_START_ALPHA, endAlpha: STRONG_PILL_END_ALPHA };
  }
  return { startAlpha: SOFT_PILL_START_ALPHA, endAlpha: SOFT_PILL_END_ALPHA };
}

// ===== MAIN FUNCTION =====

/**
 * Pick a gradient for option number `index`, wrapping around the list.
 * @param {number} index
 * @returns {string[]}
 */
export function onboardingOptionGradient(index) {
  const gradientCount = ONBOARDING_OPTION_GRADIENTS.length;
  const wrappedIndex = Math.abs(index) % gradientCount;
  return ONBOARDING_OPTION_GRADIENTS[wrappedIndex];
}

/**
 * Turn "#RRGGBB" into an rgba() string. Short or empty input becomes white at the same alpha.
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
export function hexToRgba(hex, alpha) {
  // vocab: hex = six digits after the optional #, two each for red, green, and blue.
  const hexDigits = String(hex || '').replace('#', '');
  if (hexDigits.length < MIN_HEX_DIGITS) return `rgba(255,255,255,${alpha})`;
  const red = hexChannel(hexDigits, 0, 2);
  const green = hexChannel(hexDigits, 2, 4);
  const blue = hexChannel(hexDigits, 4, 6);
  return `rgba(${red},${green},${blue},${alpha})`;
}

/**
 * Pill background: the two gradient stops at low opacity. Matches the food-card macro pill.
 * @param {string[]} stops
 * @param {{ strong?: boolean }} [options]
 * @returns {string[]}
 */
export function pillBackgroundGradient(stops, { strong = false } = {}) {
  const isStrongPill = strong;
  const { startAlpha, endAlpha } = pillAlphas(isStrongPill);
  return [hexToRgba(stops[0], startAlpha), hexToRgba(stops[1], endAlpha)];
}
