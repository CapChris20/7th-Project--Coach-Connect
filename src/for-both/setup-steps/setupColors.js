// Onboarding color tokens aligned with food-card branding so setup and nutrition feel like one app.
// Flow: brand pairs → macro gradients → palette shortcuts → pill/hex helpers.
// Used by NewUserSetupScreen and setupStepPieces. Safe to import anywhere (no side effects).

import { lightColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: brand stop pairs — food-card macros reuse these exact hex letters.
export const FOOD_CARD_BRAND = {
  orangePink: ['#9A3412', '#FF3D8A'],
  orangePurple: ['#FF6B9D', '#FB923C'],
  goldPink: ['#A67C00', lightColors.primary],
  cyanPurple: ['#06B6D4', '#FB923C'],
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

// Literal string keeps spaces identical to older call sites (hexToRgba would not).
export const ONBOARDING_ACCENT_SOFT = 'rgba(255, 61, 138, 0.15)';

export const ONBOARDING_GLASS_TINTS = {
  cyan: ONBOARDING_PALETTE.cyan,
  violet: ONBOARDING_PALETTE.purple,
  magenta: ONBOARDING_PALETTE.pink,
  orange: ONBOARDING_PALETTE.orange,
  gold: ONBOARDING_PALETTE.gold,
};

// Manipulate here: pill fill strength — strong = selected chip, soft = resting chip.
const STRONG_PILL_START_ALPHA = 0.2;
const STRONG_PILL_END_ALPHA = 0.14;
const SOFT_PILL_START_ALPHA = 0.1;
const SOFT_PILL_END_ALPHA = 0.06;
const MIN_HEX_DIGITS_FOR_RGB = 6;
const FALLBACK_WHITE_RGB = '255,255,255';

// ===== MAIN FUNCTION =====

/**
 * Cycle through onboarding chip gradients by option index.
 * @param {number} optionIndex
 * @returns {string[]}
 */
export function onboardingOptionGradient(optionIndex) {
  // 1. Count how many chip gradients we rotate through.
  const gradientCount = ONBOARDING_OPTION_GRADIENTS.length;

  // 2. Wrap any integer (including negative) into 0…count-1.
  // vocab: Math.abs keeps negatives in the same cycle as positives
  const wrappedIndex = Math.abs(optionIndex) % gradientCount;

  // 3. Hand back the [start, end] pair for that chip / icon well.
  return ONBOARDING_OPTION_GRADIENTS[wrappedIndex];
}

/**
 * Convert "#RRGGBB" to rgba(); short hex falls back to white at the given alpha.
 * @param {string} hexColor
 * @param {number} alpha
 * @returns {string}
 */
export function hexToRgba(hexColor, alpha) {
  // vocab: hexColor = "#RRGGBB" or "RRGGBB" — two hex digits per red/green/blue channel.
  const hexDigits = stripHashFromHex(hexColor);

  // 1. Too short to read RGB — soft white at the caller's alpha.
  if (hexDigits.length < MIN_HEX_DIGITS_FOR_RGB) {
    return `rgba(${FALLBACK_WHITE_RGB},${alpha})`;
  }

  // 2. Read each channel as 0–255, then build the CSS rgba() string.
  const red = readHexChannel(hexDigits, 0, 2);
  const green = readHexChannel(hexDigits, 2, 4);
  const blue = readHexChannel(hexDigits, 4, 6);
  return `rgba(${red},${green},${blue},${alpha})`;
}

/**
 * Low-opacity gradient pair for macro-style pill backgrounds.
 * @param {string[]} gradientStops
 * @param {{ strong?: boolean }} [options]
 * @returns {string[]}
 */
export function pillBackgroundGradient(gradientStops, { strong = false } = {}) {
  // 1. Pick how see-through each gradient stop should be.
  const alphaPair = pickPillAlphaPair(strong);

  // 2. Fade both stops the same way food-card macro pills do.
  const startColor = hexToRgba(gradientStops[0], alphaPair.startAlpha);
  const endColor = hexToRgba(gradientStops[1], alphaPair.endAlpha);
  return [startColor, endColor];
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging =====

function stripHashFromHex(hexColor) {
  return String(hexColor || '').replace('#', '');
}

function readHexChannel(hexDigits, startIndex, endIndex) {
  // vocab: parseInt(..., 16) = read those characters as a base-16 number
  return parseInt(hexDigits.slice(startIndex, endIndex), 16);
}

function pickPillAlphaPair(isStrongPill) {
  if (isStrongPill) {
    return {
      startAlpha: STRONG_PILL_START_ALPHA,
      endAlpha: STRONG_PILL_END_ALPHA,
    };
  }
  return {
    startAlpha: SOFT_PILL_START_ALPHA,
    endAlpha: SOFT_PILL_END_ALPHA,
  };
}
