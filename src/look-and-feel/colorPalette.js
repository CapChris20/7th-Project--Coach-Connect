// Shared color, type, spacing, and shadow tokens for light and dark mode.
// Flow: builders assemble frozen keys → screens import lightColors, darkColors, nb, gradients, etc.
// Used by: screens across the app. Short keys like `xs` and `h1` are names other files already import — do not rename them.
//
// vocab: Neobrutalist (nb*) = thick outlines, hard shadows, B/W/gray chrome from Design-Law
// Manipulate here: hex tables live under PLUMBING — change a stop only when Design Law screens change
// Freeze: every export key letter and every hex string below must stay identical for callers.

// ===== NAMED CONSTANTS =====

// Palette step numbers are object keys callers read as indigo[400] / gray[500].
const PALETTE_STEP_50 = 50;
const PALETTE_STEP_100 = 100;
const PALETTE_STEP_200 = 200;
const PALETTE_STEP_300 = 300;
const PALETTE_STEP_400 = 400;
const PALETTE_STEP_500 = 500;
const PALETTE_STEP_600 = 600;
const PALETTE_STEP_700 = 700;
const PALETTE_STEP_800 = 800;
const PALETTE_STEP_900 = 900;

const FONT_SIZE_H1 = 32;
const FONT_SIZE_H2 = 24;
const FONT_SIZE_H3 = 20;
const FONT_SIZE_H4 = 18;
const FONT_SIZE_BODY = 16;
const FONT_SIZE_CAPTION = 14;
const FONT_SIZE_SMALL = 12;
const FONT_SIZE_XXL = 24;
const FONT_SIZE_XXXL = 32;
const FONT_SIZE_HUGE = 40;

const LINE_HEIGHT_H1 = 40;
const LINE_HEIGHT_H2 = 32;
const LINE_HEIGHT_H3 = 28;
const LINE_HEIGHT_H4 = 24;
const LINE_HEIGHT_BODY = 24;
const LINE_HEIGHT_CAPTION = 20;
const LINE_HEIGHT_SMALL = 16;

const SPACING_XS = 4;
const SPACING_SM = 8;
const SPACING_MD = 16;
const SPACING_LG = 24;
const SPACING_XL = 32;
const SPACING_XXL = 48;
const SPACING_XXXL = 64;

const RADIUS_SM = 4;
const RADIUS_MD = 8;
const RADIUS_LG = 12;
const RADIUS_XL = 16;
const RADIUS_XXL = 20;
const RADIUS_NB_SHEET = 24;
const RADIUS_NB_PHONE = 36;
const BORDER_RADIUS_PILL = 9999;

const SHADOW_COLOR_BLACK = '#000';

// Diagonal used by every expo-linear-gradient catalog entry (115deg feel).
const GRADIENT_START_CORNER = { x: 0, y: 0 };
const GRADIENT_END_CORNER = { x: 1, y: 1 };

// ===== HELPER FUNCTIONS =====

/**
 * One indigo ramp. Step numbers stay 50…900 so existing `colors.indigo[400]` reads still work.
 *
 * @param {object} hexByStep - map of step number → hex string
 * @returns {object}
 */
function buildIndigoStepRamp(hexByStep) {
  return {
    [PALETTE_STEP_50]: hexByStep[PALETTE_STEP_50],
    [PALETTE_STEP_100]: hexByStep[PALETTE_STEP_100],
    [PALETTE_STEP_200]: hexByStep[PALETTE_STEP_200],
    [PALETTE_STEP_300]: hexByStep[PALETTE_STEP_300],
    [PALETTE_STEP_400]: hexByStep[PALETTE_STEP_400],
    [PALETTE_STEP_500]: hexByStep[PALETTE_STEP_500],
    [PALETTE_STEP_600]: hexByStep[PALETTE_STEP_600],
    [PALETTE_STEP_700]: hexByStep[PALETTE_STEP_700],
    [PALETTE_STEP_800]: hexByStep[PALETTE_STEP_800],
    [PALETTE_STEP_900]: hexByStep[PALETTE_STEP_900],
  };
}

/**
 * One gray ramp. Same step keys as indigo.
 *
 * @param {object} hexByStep
 * @returns {object}
 */
function buildGrayStepRamp(hexByStep) {
  return {
    [PALETTE_STEP_50]: hexByStep[PALETTE_STEP_50],
    [PALETTE_STEP_100]: hexByStep[PALETTE_STEP_100],
    [PALETTE_STEP_200]: hexByStep[PALETTE_STEP_200],
    [PALETTE_STEP_300]: hexByStep[PALETTE_STEP_300],
    [PALETTE_STEP_400]: hexByStep[PALETTE_STEP_400],
    [PALETTE_STEP_500]: hexByStep[PALETTE_STEP_500],
    [PALETTE_STEP_600]: hexByStep[PALETTE_STEP_600],
    [PALETTE_STEP_700]: hexByStep[PALETTE_STEP_700],
    [PALETTE_STEP_800]: hexByStep[PALETTE_STEP_800],
    [PALETTE_STEP_900]: hexByStep[PALETTE_STEP_900],
  };
}

/**
 * iOS shadow bag + Android elevation. Color is always black; only the size changes.
 *
 * @param {number} offsetHeight
 * @param {number} shadowOpacity
 * @param {number} shadowRadius
 * @param {number} elevation
 * @returns {object}
 */
function buildSoftDropShadowStyle(offsetHeight, shadowOpacity, shadowRadius, elevation) {
  return {
    shadowColor: SHADOW_COLOR_BLACK,
    shadowOffset: { width: 0, height: offsetHeight },
    shadowOpacity,
    shadowRadius,
    elevation,
  };
}

/**
 * Two-stop diagonal gradient bag for expo-linear-gradient.
 *
 * @param {string} fromHex
 * @param {string} toHex
 * @returns {{ colors: string[], start: object, end: object }}
 */
function buildDiagonalGradientPair(fromHex, toHex) {
  return {
    colors: [fromHex, toHex],
    start: GRADIENT_START_CORNER,
    end: GRADIENT_END_CORNER,
  };
}

/**
 * Light mode chrome. Keep these keys — screens import them by name.
 * Design Law: chrome primary = fill/ink (never solid pink/purple/green).
 * Tiny pink→orange gradients stay in accentGradients only — not these chrome keys.
 *
 * @returns {object}
 */
function buildLightThemeColors() {
  // 1. Classic semantic chrome (primary / surface / text / status).
  const semanticChrome = {
    primary: '#0A0A0A',
    primaryDark: '#0A0A0A',
    secondary: '#575757',
    accent: '#0A0A0A',
    background: '#F2F2F0',
    surface: '#FFFFFF',
    surfaceSecondary: '#E3E3DF',
    text: '#0A0A0A',
    textSecondary: '#575757',
    // Manipulate here: was iOS green — Design Law forbids green chrome
    success: '#F97316',
    warning: '#FF9F0A',
    error: '#FF3B30',
    info: '#06B6D4',
    border: '#0A0A0A',
    white: '#FFFFFF',
    black: '#000000',
  };

  // 2. Indigo + gray ramps (callers still read indigo[400], gray[500]).
  const rampChrome = {
    indigo: buildIndigoStepRamp(LIGHT_INDIGO_HEX_BY_STEP),
    gray: buildGrayStepRamp(LIGHT_GRAY_HEX_BY_STEP),
  };

  // 3. Handoff nb* tokens (Design-Law DESIGN-SYSTEM.md) — B/W/gray neo-brutalist.
  const neoBrutalistChrome = {
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

  return {
    ...semanticChrome,
    ...rampChrome,
    ...neoBrutalistChrome,
  };
}

/**
 * Dark mode colors. Gray ramp is flipped so 50 is the darkest step.
 *
 * @returns {object}
 */
function buildDarkThemeColors() {
  // 1. Classic semantic chrome for dark surfaces.
  const semanticChrome = {
    primary: '#F2F2F2',
    primaryDark: '#F2F2F2',
    secondary: '#A6A6A6',
    accent: '#F2F2F2',
    background: '#0B0B0B',
    surface: '#161616',
    surfaceSecondary: '#262626',
    text: '#F2F2F2',
    textSecondary: '#A6A6A6',
    // Manipulate here: was iOS green — Design Law forbids green chrome
    success: '#FB923C',
    warning: '#FF9F0A',
    error: '#FF453A',
    info: '#7DD3FC',
    border: '#F2F2F2',
    white: '#FFFFFF',
    black: '#000000',
  };

  // 2. Dark indigo + flipped gray ramps.
  const rampChrome = {
    indigo: buildIndigoStepRamp(DARK_INDIGO_HEX_BY_STEP),
    gray: buildGrayStepRamp(DARK_GRAY_HEX_BY_STEP),
  };

  // 3. Handoff nb* tokens — dark ink is bright; shadow must match border (not gray).
  // Manipulate here: Design Law dark hard shadow must be bright (same as border), not gray —
  // gray shadows disappear on black and kill the neo-brutalist “sticker” pop light mode gets for free.
  const neoBrutalistChrome = {
    nbBackground: '#0B0B0B',
    nbSurface: '#161616',
    nbSurfaceChip: '#1F1F1F',
    nbSoft: '#262626',
    nbInk: '#F2F2F2',
    nbMuted: '#A6A6A6',
    nbBorder: '#F2F2F2',
    nbShadow: '#F2F2F2',
    nbFill: '#F2F2F2',
    nbOnFill: '#0A0A0A',
  };

  return {
    ...semanticChrome,
    ...rampChrome,
    ...neoBrutalistChrome,
  };
}

/**
 * Type scale — keys h1…small stay frozen for StyleSheet callers.
 *
 * @returns {object}
 */
function buildTypographyScale() {
  return {
    h1: {
      fontSize: FONT_SIZE_H1,
      fontWeight: '700',
      lineHeight: LINE_HEIGHT_H1,
    },
    h2: {
      fontSize: FONT_SIZE_H2,
      fontWeight: '600',
      lineHeight: LINE_HEIGHT_H2,
    },
    h3: {
      fontSize: FONT_SIZE_H3,
      fontWeight: '600',
      lineHeight: LINE_HEIGHT_H3,
    },
    h4: {
      fontSize: FONT_SIZE_H4,
      fontWeight: '600',
      lineHeight: LINE_HEIGHT_H4,
    },
    body: {
      fontSize: FONT_SIZE_BODY,
      fontWeight: '400',
      lineHeight: LINE_HEIGHT_BODY,
    },
    caption: {
      fontSize: FONT_SIZE_CAPTION,
      fontWeight: '400',
      lineHeight: LINE_HEIGHT_CAPTION,
    },
    small: {
      fontSize: FONT_SIZE_SMALL,
      fontWeight: '400',
      lineHeight: LINE_HEIGHT_SMALL,
    },
  };
}

/**
 * Spacing scale — keys xs…xxxl stay frozen.
 *
 * @returns {object}
 */
function buildSpacingScale() {
  return {
    xs: SPACING_XS,
    sm: SPACING_SM,
    md: SPACING_MD,
    lg: SPACING_LG,
    xl: SPACING_XL,
    xxl: SPACING_XXL,
    xxxl: SPACING_XXXL,
  };
}

/**
 * Corner radii — classic sm…round plus Design Law nb* role radii.
 *
 * @returns {object}
 */
function buildBorderRadiusScale() {
  return {
    sm: RADIUS_SM,
    md: RADIUS_MD,
    lg: RADIUS_LG,
    xl: RADIUS_XL,
    xxl: RADIUS_XXL,
    round: BORDER_RADIUS_PILL,

    // Handoff radii by role
    nbChip: RADIUS_LG,
    nbCard: 10,
    nbHero: 10,
    nbSheet: RADIUS_NB_SHEET,
    nbPhone: RADIUS_NB_PHONE,
    nbButton: 10,
    nbInput: RADIUS_MD,
    nbIconChip: RADIUS_LG,
  };
}

/**
 * Font size bag used outside typography objects.
 *
 * @returns {object}
 */
function buildFontSizeScale() {
  return {
    xs: FONT_SIZE_SMALL,
    sm: FONT_SIZE_CAPTION,
    base: FONT_SIZE_BODY,
    lg: FONT_SIZE_H4,
    xl: FONT_SIZE_H3,
    xxl: FONT_SIZE_XXL,
    xxxl: FONT_SIZE_XXXL,
    huge: FONT_SIZE_HUGE,
  };
}

/**
 * Font weight name → CSS string.
 *
 * @returns {object}
 */
function buildFontWeightScale() {
  return {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  };
}

/**
 * Four soft shadow steps. `sm` is the lightest, `xl` is the heaviest.
 * (Hard neo-brutalist shadows live on HardShadow / nb.shadowOffset*, not here.)
 *
 * @returns {object}
 */
function buildShadowScale() {
  return {
    sm: buildSoftDropShadowStyle(1, 0.05, 2, 1),
    md: buildSoftDropShadowStyle(2, 0.1, 4, 3),
    lg: buildSoftDropShadowStyle(4, 0.15, 8, 6),
    xl: buildSoftDropShadowStyle(8, 0.2, 16, 10),
  };
}

/**
 * Neobrutalist layout tokens (Design-Law handoff).
 *
 * @returns {object}
 */
function buildNeoBrutalistLayoutTokens() {
  return {
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
}

/**
 * Accent gradient pairs — small accents only (pills, icon chips, nav +). Never card fills.
 * No yellow / gold stops — pink→orange / purple / blue / coral only (owner: no yellow).
 *
 * @returns {string[][]}
 */
function buildAccentGradientPairs() {
  return [
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
}

/**
 * Named expo-linear-gradient presets. Text on brand is always nbInk (#0A0A0A).
 * Status tiles use water / sleep / energy — text is always #0A0A0F.
 *
 * @returns {object}
 */
function buildLinearGradientCatalog() {
  // Brand pink→orange (primary buttons, plus, active chips, rings, avatars)
  const brandPinkToOrange = buildDiagonalGradientPair('#FF6B9D', '#FB923C');

  return {
    // Primary buttons, plus button, active chips, progress rings, avatars
    brand: brandPinkToOrange,

    // Selected chrome accents — same brand pair (never solid purple).
    ink: buildDiagonalGradientPair('#FF6B9D', '#FB923C'),

    // Hero titles only (masked text) - brand pink→orange both themes
    title: {
      light: buildDiagonalGradientPair('#FF6B9D', '#FB923C'),
      dark: buildDiagonalGradientPair('#FF6B9D', '#FB923C'),
    },

    // Status tiles and option icons
    water: buildDiagonalGradientPair('#67E8F9', '#60A5FA'),
    sleep: buildDiagonalGradientPair('#FDA4AF', '#FB7185'),
    // Energy accents — coral→orange (no yellow).
    energy: buildDiagonalGradientPair('#FDA4AF', '#FB923C'),

    // Selected option rows / soft card washes — muted pink→peach (readable, not neon).
    // Manipulate here: raise both stops toward white = brighter; lower = calmer contrast.
    soft: buildDiagonalGradientPair('#F3E4EA', '#F0D9C8'),
  };
}

// ===== PLUMBING — skip unless debugging =====
// Raw hex tables for indigo/gray ramps. Step keys and hex letters are frozen.
// Declared before the export consts so module load can read them safely.

const LIGHT_INDIGO_HEX_BY_STEP = {
  [PALETTE_STEP_50]: '#F0F0FF',
  [PALETTE_STEP_100]: '#E5E5FF',
  [PALETTE_STEP_200]: '#D1D1FF',
  [PALETTE_STEP_300]: '#B8B8FF',
  [PALETTE_STEP_400]: '#9F9FFF',
  [PALETTE_STEP_500]: '#8686FF',
  // Design Law: no pink chrome in indigo ramp — cool blue only
  [PALETTE_STEP_600]: '#06B6D4',
  [PALETTE_STEP_700]: '#0284C7',
  [PALETTE_STEP_800]: '#0369A1',
  [PALETTE_STEP_900]: '#0C4A6E',
};

const LIGHT_GRAY_HEX_BY_STEP = {
  [PALETTE_STEP_50]: '#F2F2F7',
  [PALETTE_STEP_100]: '#E5E5EA',
  [PALETTE_STEP_200]: '#D1D1D6',
  [PALETTE_STEP_300]: '#C7C7CC',
  [PALETTE_STEP_400]: '#AEAEB2',
  [PALETTE_STEP_500]: '#8E8E93',
  [PALETTE_STEP_600]: '#636366',
  [PALETTE_STEP_700]: '#48484A',
  [PALETTE_STEP_800]: '#3A3A3C',
  [PALETTE_STEP_900]: '#1C1C1E',
};

const DARK_INDIGO_HEX_BY_STEP = {
  [PALETTE_STEP_50]: '#1C1C1E',
  [PALETTE_STEP_100]: '#2C2C2E',
  [PALETTE_STEP_200]: '#3C3C41',
  [PALETTE_STEP_300]: '#4C4C52',
  [PALETTE_STEP_400]: '#5C5C63',
  [PALETTE_STEP_500]: '#6C6C74',
  // Design Law: no pink chrome in indigo ramp — cool blue only
  [PALETTE_STEP_600]: '#22D3EE',
  [PALETTE_STEP_700]: '#38BDF8',
  [PALETTE_STEP_800]: '#7F7FFF',
  [PALETTE_STEP_900]: '#9393FF',
};

const DARK_GRAY_HEX_BY_STEP = {
  [PALETTE_STEP_50]: '#000000',
  [PALETTE_STEP_100]: '#1C1C1E',
  [PALETTE_STEP_200]: '#2C2C2E',
  [PALETTE_STEP_300]: '#3A3A3C',
  [PALETTE_STEP_400]: '#48484A',
  [PALETTE_STEP_500]: '#636366',
  [PALETTE_STEP_600]: '#8E8E93',
  [PALETTE_STEP_700]: '#AEAEB2',
  [PALETTE_STEP_800]: '#C7C7CC',
  [PALETTE_STEP_900]: '#D1D1D6',
};

// ===== MAIN FUNCTION =====
// Module load wires frozen export keys after PLUMBING hex tables exist.

export const lightColors = buildLightThemeColors();
export const darkColors = buildDarkThemeColors();
export const typography = buildTypographyScale();
export const spacing = buildSpacingScale();
export const borderRadius = buildBorderRadiusScale();
export const fontSize = buildFontSizeScale();
export const fontWeight = buildFontWeightScale();
export const shadows = buildShadowScale();
export const nb = buildNeoBrutalistLayoutTokens();
export const accentGradients = buildAccentGradientPairs();

// Nav + button — Design Law gold→pink (the one allowed place for that pair).
export const navAccentGradient = ['#FCD34D', '#F472B6'];

export const gradients = buildLinearGradientCatalog();
