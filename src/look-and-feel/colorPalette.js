// Shared color, type, spacing, and shadow tokens for light and dark mode.
// Flow: screens pick lightColors or darkColors → typography / spacing / shadows style the same components.
// Used by: screens across the app. Short keys like `xs` and `h1` are the names other files already import — do not rename them.
//
// vocab: Neobrutalist tokens added for redesign — thick outlines, hard shadows, gradient accents.
// See docs/design/DESIGN.md for the full design system.

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
  600: '#E25588',
  700: '#BE185D',
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
  600: '#E25588',
  700: '#FF6B9D',
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
  // Strip pass: no purple primary/accent chrome — brand pink / ink neutrals until handoff tokens land.
  primary: '#E25588',
  primaryDark: '#BE185D',
  secondary: '#6B7280',
  accent: '#E25588',
  background: '#F2F2F7', // iOS light gray background
  surface: '#FFFFFF', // White surface
  surfaceSecondary: '#F9F9F9',
  text: '#000000', // Black text for light mode
  textSecondary: '#3C3C43',
  success: '#30D158', // iOS green
  warning: '#FF9F0A', // iOS orange
  error: '#FF3B30', // iOS red
  info: '#E25588',
  border: '#E5E5E7',
  white: '#FFFFFF',
  black: '#000000',
  indigo: indigoRamp(LIGHT_INDIGO_HEX),
  gray: grayRamp(LIGHT_GRAY_HEX),
  
  // Handoff tokens (docs/design/DESIGN.md) — B/W/gray neo-brutalist
  nbBackground: '#F2F2F0',
  nbSurface: '#FFFFFF',
  nbSurfaceChip: '#FFFFFF',
  nbSoft: '#E3E3DF',
  nbInk: '#0A0A0A',
  nbMuted: '#575757',
  nbBorder: '#0A0A0A',
  nbShadow: '#0A0A0A',
  nbFill: '#0A0A0A',
  nbOnFill: '#FFFFFF',
};

/** Dark mode colors. Gray is flipped so 50 is the darkest step. */
export const darkColors = {
  // Strip pass: no purple primary/accent chrome.
  primary: '#E25588',
  primaryDark: '#FF6B9D',
  secondary: '#8E8E93',
  accent: '#E25588',
  background: '#000000', // Pure black background
  surface: '#1C1C1E', // iOS dark gray surface
  surfaceSecondary: '#2C2C2E',
  text: '#FFFFFF', // White text for dark mode
  textSecondary: '#AEAEB2',
  success: '#30D158', // iOS green (brighter for dark mode)
  warning: '#FF9F0A', // iOS orange
  error: '#FF453A', // iOS red
  info: '#E25588',
  border: '#38383A',
  white: '#FFFFFF',
  black: '#000000',
  indigo: indigoRamp(DARK_INDIGO_HEX),
  gray: grayRamp(DARK_GRAY_HEX),
  
  // Handoff tokens (docs/design/DESIGN.md) — B/W/gray neo-brutalist
  nbBackground: '#0B0B0B',
  nbSurface: '#161616',
  nbSurfaceChip: '#1F1F1F',
  nbSoft: '#262626',
  nbInk: '#F2F2F2',
  nbMuted: '#A6A6A6',
  nbBorder: '#F2F2F2',
  // Manipulate here: Design Law dark hard shadow must be bright (same as border), not gray —
  // gray shadows disappear on black and kill the neo-brutalist “sticker” pop light mode gets for free.
  nbShadow: '#F2F2F2',
  nbFill: '#F2F2F2',
  nbOnFill: '#0A0A0A',
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
  
  // Handoff radii by role
  nbChip: 12,
  nbCard: 10,
  nbHero: 10,
  nbSheet: 24,
  nbPhone: 36,
  nbButton: 10,
  nbInput: 8,
  nbIconChip: 12,
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

// Neobrutalist design tokens (handoff)
export const nb = {
  borderWidth: 3,
  borderWidthDivider: 2,
  borderWidthPill: 2.5,
  // Hard shadow offsets — no blur (iOS shadowRadius 0; Android sibling View)
  shadowOffset: 4,
  shadowOffsetCard: 5,
  shadowOffsetHero: 6,
  shadowOffsetSmall: 3,
  minTouchTarget: 44,
  buttonMinHeight: 50,
  chipPadding: 16,
  cardPadding: 14,
  screenGutter: 16,
  blockGap: 16,
  // Manipulate here: clearance above Design Law raised + dock (62 + raise + labels)
  bottomNavClearance: 140,
};

/** Accent gradient pairs — small accents only (pills, icon chips, nav +). Never card fills.
 *  No yellow / gold stops — pink→orange / purple / blue / coral only (owner: no yellow). */
export const accentGradients = [
  ['#FF6B9D', '#FB923C'],
  ['#FB7185', '#EF4444'],
  ['#A78BFA', '#E879F9'],
  ['#60A5FA', '#818CF8'],
  ['#FDA4AF', '#FB923C'],
  ['#FDA4AF', '#FB7185'],
  ['#7DD3FC', '#A78BFA'],
  ['#FB7185', '#FF6B9D'],
  ['#FDBA74', '#C4B5FD'],
  ['#A78BFA', '#FB7185'],
  ['#FF6B9D', '#F472B6'],
];

/** Nav + button — brand pink→orange (no yellow/gold). */
export const navAccentGradient = ['#FF6B9D', '#FB923C'];

// Gradient definitions for expo-linear-gradient
// All use 115deg diagonal, start {x:0,y:0} end {x:1,y:1}
export const gradients = {
  // Primary buttons, plus button, active chips, progress rings, avatars
  // Text on brand gradient is always nbInk (#0A0A0F)
  brand: {
    colors: ['#FF6B9D', '#FB923C'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  
  // Strip: was purple→magenta — now brand pink→orange (no purple chrome).
  ink: {
    colors: ['#FF6B9D', '#FB923C'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  
  // Hero titles only (masked text) - changes by theme
  title: {
    light: {
      colors: ['#BE185D', '#C2410C'],
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
    },
    dark: {
      colors: ['#FF6B9D', '#FB923C'],
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
    },
  },
  
  // Status tiles and option icons - text is always nbInk (#0A0A0F)
  water: {
    colors: ['#67E8F9', '#60A5FA'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  sleep: {
    colors: ['#FDA4AF', '#FB7185'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  // Energy accents — coral→orange (no yellow).
  energy: {
    colors: ['#FDA4AF', '#FB923C'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  
  // Selected option rows / soft card washes — muted pink→peach (readable, not neon). Never lavender/purple.
  // Manipulate here: raise both stops toward white = brighter; lower = calmer contrast.
  soft: {
    colors: ['#F3E4EA', '#F0D9C8'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
};
