// Design tokens for food cards — macro gradient stops, radii, fonts, and light/dark palettes.
// Flow: brand accent pairs → macro bar colors → pill tints → palette pickers for card vs nutrition panel.
// Used by FoodCard, NutritionFactsPanel, food search lists. Radii stay aligned with nb tokens in colorPalette.
// Read order: exported tokens → main palette pickers → PLUMBING builders.

import { lightColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const HEX_PREFIX = '#';
const MIN_HEX_LENGTH = 6;
const HEX_RADIX = 16;
const FALLBACK_WHITE_RGB = '255,255,255';
// Manipulate here: alpha pair for macro pills — strong = DV badges, soft = default pills
const STRONG_PILL_START_ALPHA = 0.2;
const STRONG_PILL_END_ALPHA = 0.14;
const SOFT_PILL_START_ALPHA = 0.1;
const SOFT_PILL_END_ALPHA = 0.06;
const DEFAULT_ACCENT_ALPHA = 0.14;
const PANEL_RULE_ALPHA = 0.28;

// Design Law accent pairs — no green, no solid purple borders.
// Manipulate here: DESIGN-SYSTEM §2 stride-of-3.
export const brandColors = {
  orangePink: ['#FF6B9D', '#FB923C'],
  orangePurple: ['#FB923C', '#FB7185'],
  goldPink: ['#FDA4AF', '#FB7185'],
  cyanPurple: ['#7DD3FC', '#60A5FA'],
};

// Macro bar fills on daily log (protein blue, carbs coral, fat red). Keys frozen for FoodCard / MacroBar.
export const gradients = {
  protein: ['#60A5FA', '#818CF8'],
  carbs: ['#FDA4AF', '#FB923C'],
  fat: ['#FB7185', '#EF4444'],
  calories: brandColors.orangePurple,
};

export const gradientsSoft = {
  protein: ['#3B82F6', '#6366F1'],
  carbs: ['#FB7185', '#F97316'],
  fat: ['#F43F5E', '#DC2626'],
  calories: ['#EA580C', '#E11D48'],
};

export const colors = {
  background: '#1A1B20',
  surface: '#23252C',
  surfaceElevated: '#2B2D35',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  foreground: '#FAFAFB',
  mutedForeground: '#A8ACB8',
  subtle: '#6F7480',
};

// vocab: nbCard 14 / nbChip 12 — keep in sync with look-and-feel/colorPalette.js
export const radii = {
  card: 14,
  pill: 12,
  chip: 12,
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

const PANEL_TITLE_GRADIENT = brandColors.orangePink;
const PANEL_RULE_COLOR = hexToRgba(brandColors.orangePurple[1], PANEL_RULE_ALPHA);

// ===== HELPER FUNCTIONS =====
// Palette builders sit under PLUMBING. Exported pickers follow.

// ===== MAIN FUNCTION =====

/**
 * Turn a hex color + alpha into an rgba() string for React Native styles.
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
export function hexToRgba(hex, alpha) {
  // 1. Strip the leading # and refuse short / missing values.
  const hexDigits = String(hex || '').replace(HEX_PREFIX, '');
  if (hexDigits.length < MIN_HEX_LENGTH) {
    return `rgba(${FALLBACK_WHITE_RGB},${alpha})`;
  }

  // 2. Read red / green / blue as 0–255 integers.
  const red = parseHexChannel(hexDigits, 0);
  const green = parseHexChannel(hexDigits, 2);
  const blue = parseHexChannel(hexDigits, 4);

  // 3. Return the rgba string the style system expects.
  return `rgba(${red},${green},${blue},${alpha})`;
}

/**
 * Soft two-stop background for macro pills.
 * @param {string[]} stops
 * @param {{ strong?: boolean }} [options]
 * @returns {string[]}
 */
export function pillBackgroundGradient(stops, { strong = false } = {}) {
  // 1. Pick soft vs strong alpha pair for the two gradient stops.
  let startAlpha = SOFT_PILL_START_ALPHA;
  let endAlpha = SOFT_PILL_END_ALPHA;
  if (strong) {
    startAlpha = STRONG_PILL_START_ALPHA;
    endAlpha = STRONG_PILL_END_ALPHA;
  }

  // 2. Tint each stop and return the pair FoodCard / panel pills paint with.
  const startColor = hexToRgba(stops[0], startAlpha);
  const endColor = hexToRgba(stops[1], endAlpha);
  return [startColor, endColor];
}

/**
 * Single-color accent tint (default alpha for soft washes).
 * @param {string} hex
 * @param {number} [alpha]
 * @returns {string}
 */
export function accentTint(hex, alpha = DEFAULT_ACCENT_ALPHA) {
  return hexToRgba(hex, alpha);
}

/**
 * Palette for the nutrition facts panel (embedded on a meal card, or standalone).
 * @param {boolean} isDark
 * @param {{ embedded?: boolean }} [options]
 * @returns {object}
 */
export function getNutritionPanelPalette(isDark, { embedded = false } = {}) {
  // 1. Shared title gradient + rule color for every panel variant.
  const sharedAccents = buildNutritionSharedAccents(PANEL_TITLE_GRADIENT, PANEL_RULE_COLOR);

  // 2. Embedded on a meal section — light tiles vs dark tiles.
  if (embedded && !isDark) {
    return buildEmbeddedLightNutritionPalette(sharedAccents);
  }
  if (embedded && isDark) {
    return buildEmbeddedDarkNutritionPalette(sharedAccents);
  }

  // 3. Standalone search / dark premium card shell.
  return buildStandaloneNutritionPalette(sharedAccents);
}

/**
 * Palette for the food card chrome (embedded translucent vs standalone dark shell).
 * @param {boolean} isDark
 * @param {{ embedded?: boolean }} [options]
 * @returns {object}
 */
export function getFoodCardPalette(isDark, { embedded = false } = {}) {
  // 1. Embedded cards sit on a meal section — transparent shell + contrast borders.
  if (embedded) {
    if (isDark) return buildEmbeddedDarkFoodCardPalette();
    return buildEmbeddedLightFoodCardPalette();
  }

  // 2. Standalone dark premium card (not embedded on a meal section).
  return buildStandaloneDarkFoodCardPalette();
}

/**
 * Standalone (non-embedded) dark food-card chrome.
 * @returns {object}
 */
function buildStandaloneDarkFoodCardPalette() {
  return {
    ...colors,
    expandedSurface: colors.surface,
    innerHighlight: 'rgba(255,255,255,0.06)',
    microDivider: 'rgba(255,255,255,0.05)',
    iconPressBg: 'rgba(255,255,255,0.06)',
  };
}

// ===== PLUMBING — skip unless debugging =====

function parseHexChannel(hexDigits, startIndex) {
  return parseInt(hexDigits.slice(startIndex, startIndex + 2), HEX_RADIX);
}

function buildNutritionSharedAccents(gradientForTitle, dividerColor) {
  return {
    titleGradient: gradientForTitle,
    ruleColor: dividerColor,
    breakdownGradient: brandColors.orangePink,
    microGradients: [
      brandColors.goldPink,
      brandColors.orangePink,
      brandColors.cyanPurple,
      brandColors.orangePurple,
    ],
  };
}

function buildEmbeddedLightNutritionPalette(sharedAccents) {
  return {
    ...sharedAccents,
    panelBg: '#FFFBF5',
    panelBorder: hexToRgba(brandColors.orangePink[0], 0.12),
    tileBg: lightColors.white,
    tileBorder: hexToRgba(brandColors.orangePink[0], 0.1),
    trackBg: 'rgba(10,10,15,0.06)',
    text: lightColors.nbInk,
    textMuted: '#5C4A42',
    textSubtle: '#8A7268',
    badgeBg: hexToRgba(brandColors.goldPink[0], 0.08),
    badgeBorder: hexToRgba(brandColors.orangePurple[0], 0.14),
    iconOnGradient: brandColors.orangePink[0],
  };
}

function buildEmbeddedDarkNutritionPalette(sharedAccents) {
  return {
    ...sharedAccents,
    panelBg: '#14110F',
    panelBorder: 'rgba(255,255,255,0.1)',
    tileBg: '#1A1714',
    tileBorder: 'rgba(255,255,255,0.08)',
    trackBg: 'rgba(255,255,255,0.08)',
    text: '#F4F2EF',
    textMuted: 'rgba(255,255,255,0.68)',
    textSubtle: 'rgba(255,255,255,0.45)',
    badgeBg: 'rgba(255,255,255,0.06)',
    badgeBorder: 'rgba(255,255,255,0.1)',
    iconOnGradient: '#E8B4C8',
  };
}

function buildStandaloneNutritionPalette(sharedAccents) {
  return {
    ...sharedAccents,
    panelBg: '#181410',
    panelBorder: 'rgba(255,255,255,0.1)',
    tileBg: '#1E1B18',
    tileBorder: 'rgba(255,255,255,0.08)',
    trackBg: 'rgba(255,255,255,0.08)',
    text: colors.foreground,
    textMuted: colors.mutedForeground,
    textSubtle: colors.subtle,
    badgeBg: 'rgba(255,255,255,0.06)',
    badgeBorder: 'rgba(255,255,255,0.1)',
    iconOnGradient: '#E8B4C8',
  };
}

function buildEmbeddedDarkFoodCardPalette() {
  return {
    background: 'transparent',
    surface: 'transparent',
    surfaceElevated: 'rgba(255,255,255,0.08)',
    expandedSurface: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.12)',
    borderStrong: 'rgba(255,255,255,0.2)',
    foreground: lightColors.white,
    mutedForeground: 'rgba(255,255,255,0.62)',
    subtle: 'rgba(255,255,255,0.45)',
    innerHighlight: 'rgba(255,255,255,0.08)',
    microDivider: 'rgba(255,255,255,0.07)',
    iconPressBg: 'rgba(255,255,255,0.08)',
  };
}

function buildEmbeddedLightFoodCardPalette() {
  return {
    background: 'transparent',
    surface: 'transparent',
    surfaceElevated: 'rgba(0,0,0,0.04)',
    expandedSurface: 'rgba(0,0,0,0.025)',
    border: 'rgba(0,0,0,0.08)',
    borderStrong: 'rgba(0,0,0,0.14)',
    foreground: lightColors.nbInk,
    mutedForeground: '#666666',
    subtle: 'rgba(10,10,15,0.5)',
    innerHighlight: 'rgba(0,0,0,0.05)',
    microDivider: 'rgba(0,0,0,0.07)',
    iconPressBg: 'rgba(0,0,0,0.05)',
  };
}
