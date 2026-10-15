// Premium food-card design tokens — Coach Connect macro palette, radii, fonts, and panel colors.
// Flow: pick brand gradients → map macros → tint pills → dark vs light palettes for FoodCard / nutrition facts.
// Used by FoodCard, NutritionFactsPanel, FoodListScreen, and the food-search screens.

// ===== NAMED CONSTANTS =====

const HEX_PREFIX = '#';
const MIN_HEX_LENGTH = 6;
const HEX_RADIX = 16;
const FALLBACK_WHITE_RGB = '255,255,255';
const STRONG_PILL_START_ALPHA = 0.2;
const STRONG_PILL_END_ALPHA = 0.14;
const SOFT_PILL_START_ALPHA = 0.1;
const SOFT_PILL_END_ALPHA = 0.06;
const DEFAULT_ACCENT_ALPHA = 0.14;

// ===== HELPER FUNCTIONS =====

function parseHexChannel(hexDigits, startIndex) {
  return parseInt(hexDigits.slice(startIndex, startIndex + 2), HEX_RADIX);
}

function nutritionSharedAccents(titleGradient, ruleColor) {
  return {
    titleGradient,
    ruleColor,
    breakdownGradient: brandColors.orangePink,
    microGradients: [
      brandColors.goldPink,
      brandColors.orangePink,
      brandColors.cyanPurple,
      brandColors.orangePurple,
    ],
  };
}

function embeddedLightNutritionPalette(sharedAccents) {
  return {
    ...sharedAccents,
    panelBg: '#FFFBF5',
    panelBorder: hexToRgba(brandColors.orangePink[0], 0.12),
    tileBg: '#FFFFFF',
    tileBorder: hexToRgba(brandColors.orangePink[0], 0.1),
    trackBg: 'rgba(10,10,15,0.06)',
    text: '#0A0A0F',
    textMuted: '#5C4A42',
    textSubtle: '#8A7268',
    badgeBg: hexToRgba(brandColors.goldPink[0], 0.08),
    badgeBorder: hexToRgba(brandColors.orangePurple[0], 0.14),
    iconOnGradient: brandColors.orangePink[0],
  };
}

function embeddedDarkNutritionPalette(sharedAccents) {
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

function standaloneNutritionPalette(sharedAccents) {
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

function embeddedDarkFoodCardPalette() {
  return {
    background: 'transparent',
    surface: 'transparent',
    surfaceElevated: 'rgba(255,255,255,0.08)',
    expandedSurface: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.12)',
    borderStrong: 'rgba(255,255,255,0.2)',
    foreground: '#FFFFFF',
    mutedForeground: 'rgba(255,255,255,0.62)',
    subtle: 'rgba(255,255,255,0.45)',
    innerHighlight: 'rgba(255,255,255,0.08)',
    microDivider: 'rgba(255,255,255,0.07)',
    iconPressBg: 'rgba(255,255,255,0.08)',
  };
}

function embeddedLightFoodCardPalette() {
  return {
    background: 'transparent',
    surface: 'transparent',
    surfaceElevated: 'rgba(0,0,0,0.04)',
    expandedSurface: 'rgba(0,0,0,0.025)',
    border: 'rgba(0,0,0,0.08)',
    borderStrong: 'rgba(0,0,0,0.14)',
    foreground: '#0A0A0F',
    mutedForeground: '#666666',
    subtle: 'rgba(10,10,15,0.5)',
    innerHighlight: 'rgba(0,0,0,0.05)',
    microDivider: 'rgba(0,0,0,0.07)',
    iconPressBg: 'rgba(0,0,0,0.05)',
  };
}

// ===== MAIN FUNCTION =====

export const brandColors = {
  /** dark orange → pink */
  orangePink: ['#9A3412', '#FF3D8A'],
  /** dark orange → purple */
  orangePurple: ['#9A3412', '#8B5CF6'],
  /** gold → pink */
  goldPink: ['#A67C00', '#FF6B9D'],
  /** cyan → purple */
  cyanPurple: ['#0891B2', '#8B5CF6'],
};

/** Macro mapping — full stops for accents (dots, thin bars) */
export const gradients = {
  protein: brandColors.orangePink,
  carbs: brandColors.goldPink,
  fat: brandColors.cyanPurple,
  calories: brandColors.orangePurple,
};

/** Same hues, pulled back for large surfaces (less neon on dark UI) */
export const gradientsSoft = {
  protein: ['#9A3412', '#BE185D'],
  carbs: ['#8B6914', '#B84D6F'],
  fat: ['#0E7490', '#6D28D9'],
  calories: ['#9A3412', '#7C3AED'],
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

export const radii = {
  card: 22,
  pill: 16,
  chip: 12,
};

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

/**
 * Turn #RRGGBB plus an alpha into an rgba() string. Short/invalid hex falls back to white.
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
export function hexToRgba(hex, alpha) {
  const hexDigits = String(hex || '').replace(HEX_PREFIX, '');
  if (hexDigits.length < MIN_HEX_LENGTH) return `rgba(${FALLBACK_WHITE_RGB},${alpha})`;
  const red = parseHexChannel(hexDigits, 0);
  const green = parseHexChannel(hexDigits, 2);
  const blue = parseHexChannel(hexDigits, 4);
  return `rgba(${red},${green},${blue},${alpha})`;
}

/**
 * Pill background: 135° gradient at 14% → 10% opacity — never full saturation.
 * @param {string[]} stops
 * @param {{ strong?: boolean }} [options]
 * @returns {string[]}
 */
export function pillBackgroundGradient(stops, { strong = false } = {}) {
  const startAlpha = strong ? STRONG_PILL_START_ALPHA : SOFT_PILL_START_ALPHA;
  const endAlpha = strong ? STRONG_PILL_END_ALPHA : SOFT_PILL_END_ALPHA;
  return [hexToRgba(stops[0], startAlpha), hexToRgba(stops[1], endAlpha)];
}

/**
 * Single accent at low alpha — icon wells, badges.
 * @param {string} hex
 * @param {number} [alpha]
 * @returns {string}
 */
export function accentTint(hex, alpha = DEFAULT_ACCENT_ALPHA) {
  return hexToRgba(hex, alpha);
}

const titleGradient = brandColors.orangePink;
const ruleColor = hexToRgba(brandColors.orangePurple[1], 0.28);

/**
 * Opaque, high-contrast palette for the expanded nutrition facts panel.
 * @param {boolean} isDark
 * @param {{ embedded?: boolean }} [options]
 * @returns {object}
 */
export function getNutritionPanelPalette(isDark, { embedded = false } = {}) {
  const sharedAccents = nutritionSharedAccents(titleGradient, ruleColor);

  if (embedded && !isDark) {
    return embeddedLightNutritionPalette(sharedAccents);
  }

  if (embedded && isDark) {
    return embeddedDarkNutritionPalette(sharedAccents);
  }

  return standaloneNutritionPalette(sharedAccents);
}

/**
 * Palette for FoodCard — standalone (dark premium) vs embedded in meal sections.
 * @param {boolean} isDark
 * @param {{ embedded?: boolean }} [options]
 */
export function getFoodCardPalette(isDark, { embedded = false } = {}) {
  if (embedded) {
    return isDark ? embeddedDarkFoodCardPalette() : embeddedLightFoodCardPalette();
  }

  return {
    ...colors,
    expandedSurface: colors.surface,
    innerHighlight: 'rgba(255,255,255,0.06)',
    microDivider: 'rgba(255,255,255,0.05)',
    iconPressBg: 'rgba(255,255,255,0.06)',
  };
}
