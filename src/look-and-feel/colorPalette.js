// Shared color, type, spacing, and shadow tokens for light and dark mode.
// Flow: screens pick lightColors or darkColors → typography / spacing / shadows style the same components.
// Used by: screens across the app. Short keys like `xs` and `h1` are the names other files already import — do not rename them.

// ===== NAMED CONSTANTS =====

// Palette step numbers are object keys callers read as indigo[400] / gray[500].
// Bind the numeric literals, then use them as computed keys so the key letters stay the same.
const PALETTE_STEP_400 = 400;
const PALETTE_STEP_500 = 500;

const FONT_SIZE_H2 = 24;
const LINE_HEIGHT_H4 = 24;
const LINE_HEIGHT_BODY = 24;
const SPACING_LG = 24;
const FONT_SIZE_XXL = 24;
const BORDER_RADIUS_PILL = 9999;

const SHADOW_COLOR = '#000';

// ===== HELPER FUNCTIONS =====

/**
 * One indigo ramp. Step numbers stay 50…900 so existing `colors.indigo[400]` reads still work.
 * @param {object} hexByStep
 * @returns {object}
 */
function indigoRamp(hexByStep) {
  return {
    50: hexByStep[50],
    100: hexByStep[100],
    200: hexByStep[200],
    300: hexByStep[300],
    [PALETTE_STEP_400]: hexByStep[PALETTE_STEP_400],
    [PALETTE_STEP_500]: hexByStep[PALETTE_STEP_500],
    600: hexByStep[600],
    700: hexByStep[700],
    800: hexByStep[800],
    900: hexByStep[900],
  };
}

/**
 * One gray ramp. Same step keys as indigo.
 * @param {object} hexByStep
 * @returns {object}
 */
function grayRamp(hexByStep) {
  return {
    50: hexByStep[50],
    100: hexByStep[100],
    200: hexByStep[200],
    300: hexByStep[300],
    [PALETTE_STEP_400]: hexByStep[PALETTE_STEP_400],
    [PALETTE_STEP_500]: hexByStep[PALETTE_STEP_500],
    600: hexByStep[600],
    700: hexByStep[700],
    800: hexByStep[800],
    900: hexByStep[900],
  };
}

/**
 * iOS shadow plus Android elevation. Every step uses black; only the size changes.
 * @param {number} offsetHeight
 * @param {number} shadowOpacity
 * @param {number} shadowRadius
 * @param {number} elevation
 * @returns {object}
 */
function buildDropShadow(offsetHeight, shadowOpacity, shadowRadius, elevation) {
  return {
    shadowColor: SHADOW_COLOR,
    shadowOffset: { width: 0, height: offsetHeight },
    shadowOpacity,
    shadowRadius,
    elevation,
  };
}

const LIGHT_INDIGO_HEX = {
  50: '#F0F0FF',
  100: '#E5E5FF',
  200: '#D1D1FF',
  300: '#B8B8FF',
  [PALETTE_STEP_400]: '#9F9FFF',
  [PALETTE_STEP_500]: '#8686FF',
  600: '#5856D6',
  700: '#4A49C7',
  800: '#3C3BA8',
  900: '#2E2D89',
};

const LIGHT_GRAY_HEX = {
  50: '#F2F2F7',
  100: '#E5E5EA',
  200: '#D1D1D6',
  300: '#C7C7CC',
  [PALETTE_STEP_400]: '#AEAEB2',
  [PALETTE_STEP_500]: '#8E8E93',
  600: '#636366',
  700: '#48484A',
  800: '#3A3A3C',
  900: '#1C1C1E',
};

const DARK_INDIGO_HEX = {
  50: '#1C1C1E',
  100: '#2C2C2E',
  200: '#3C3C41',
  300: '#4C4C52',
  [PALETTE_STEP_400]: '#5C5C63',
  [PALETTE_STEP_500]: '#6C6C74',
  600: '#5856D6',
  700: '#6B6CFF',
  800: '#7F7FFF',
  900: '#9393FF',
};

const DARK_GRAY_HEX = {
  50: '#000000',
  100: '#1C1C1E',
  200: '#2C2C2E',
  300: '#3A3A3C',
  [PALETTE_STEP_400]: '#48484A',
  [PALETTE_STEP_500]: '#636366',
  600: '#8E8E93',
  700: '#AEAEB2',
  800: '#C7C7CC',
  900: '#D1D1D6',
};

// ===== MAIN FUNCTION =====

/** Light mode colors (Modern Neutral theme). Keep these keys — screens import them by name. */
export const lightColors = {
  primary: '#5856D6', // iOS indigo primary
  primaryDark: '#4A49C7',
  secondary: '#6B7280',
  accent: '#AF52DE', // Subtle purple accent
  background: '#F2F2F7', // iOS light gray background
  surface: '#FFFFFF', // White surface
  surfaceSecondary: '#F9F9F9',
  text: '#000000', // Black text for light mode
  textSecondary: '#3C3C43',
  success: '#30D158', // iOS green
  warning: '#FF9F0A', // iOS orange
  error: '#FF3B30', // iOS red
  info: '#5856D6',
  border: '#E5E5E7',
  white: '#FFFFFF',
  black: '#000000',
  indigo: indigoRamp(LIGHT_INDIGO_HEX),
  gray: grayRamp(LIGHT_GRAY_HEX),
};

/** Dark mode colors. Gray is flipped so 50 is the darkest step. */
export const darkColors = {
  primary: '#5856D6', // iOS indigo primary (same for consistency)
  primaryDark: '#6B6CFF',
  secondary: '#8E8E93',
  accent: '#AF52DE', // Subtle purple accent
  background: '#000000', // Pure black background
  surface: '#1C1C1E', // iOS dark gray surface
  surfaceSecondary: '#2C2C2E',
  text: '#FFFFFF', // White text for dark mode
  textSecondary: '#AEAEB2',
  success: '#30D158', // iOS green (brighter for dark mode)
  warning: '#FF9F0A', // iOS orange
  error: '#FF453A', // iOS red
  info: '#5856D6',
  border: '#38383A',
  white: '#FFFFFF',
  black: '#000000',
  indigo: indigoRamp(DARK_INDIGO_HEX),
  gray: grayRamp(DARK_GRAY_HEX),
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
  },
  h2: {
    fontSize: FONT_SIZE_H2,
    fontWeight: '600',
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: LINE_HEIGHT_H4,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: LINE_HEIGHT_BODY,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  small: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: SPACING_LG,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  round: BORDER_RADIUS_PILL,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: FONT_SIZE_XXL,
  xxxl: 32,
  huge: 40,
};

export const fontWeight = {
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

/** Four shadow steps. `sm` is the lightest, `xl` is the heaviest. */
export const shadows = {
  sm: buildDropShadow(1, 0.05, 2, 1),
  md: buildDropShadow(2, 0.1, 4, 3),
  lg: buildDropShadow(4, 0.15, 8, 6),
  xl: buildDropShadow(8, 0.2, 16, 10),
};
