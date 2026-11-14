// Weekly-report color tokens — Design Law nb palette only (no green, no purple chrome).
// Flow: pick accent gradient slots → map light/dark nb surfaces → trend ink → export.
// Used by: reportColorSettings and every weekly-report card/chart.
// Pure token map — builders keep export values identical while making roles readable.

import { accentGradients, darkColors, lightColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: which accentGradients index feeds each chip slot (g1–g5).
// Indices are Design Law handoff slots — do not invent new hex here.
const GRADIENT_SLOT_G1_INDEX = 0;
const GRADIENT_SLOT_G2_INDEX = 2;
const GRADIENT_SLOT_G3_INDEX = 3;
const GRADIENT_SLOT_G4_INDEX = 6;
const GRADIENT_SLOT_G5_INDEX = 8;

// AsyncStorage key for theme mode toggle (shared with look-and-feel, not Firebase).
// Letters frozen — reportColorSettings reads/writes this exact string.
const THEME_MODE_STORAGE_KEY = 'coachconnect.theme.mode';

// ===== HELPER FUNCTIONS =====

/**
 * Chip / focus-tip accent gradients keyed g1–g5 for weekly-report UI.
 * @returns {{ g1: *, g2: *, g3: *, g4: *, g5: * }}
 */
function buildWeeklyReportGradients() {
  // vocab: accentGradients = Design Law rainbow stops from colorPalette (not ad-hoc hex)
  return {
    g1: accentGradients[GRADIENT_SLOT_G1_INDEX],
    g2: accentGradients[GRADIENT_SLOT_G2_INDEX],
    g3: accentGradients[GRADIENT_SLOT_G3_INDEX],
    g4: accentGradients[GRADIENT_SLOT_G4_INDEX],
    g5: accentGradients[GRADIENT_SLOT_G5_INDEX],
  };
}

/**
 * Map Design Law nb tokens onto the role names weekly-report screens expect.
 * Same keys for light and dark — only the palette source changes.
 * @param {object} nbPalette lightColors or darkColors from colorPalette
 * @param {'light'|'dark'} blurTintValue BlurView tint string for that theme
 * @returns {object}
 */
function buildThemeSurfaceColors(nbPalette, blurTintValue) {
  // vocab: nb* keys = Design Law tokens (flat surfaces, ink text, 3px borders)
  // Manipulate here: only swap token source if DESIGN-SYSTEM.md changes
  return {
    background: nbPalette.nbBackground,
    // Flat “gradient” of the same bg twice — screens expect an array shape.
    backgroundGradient: [nbPalette.nbBackground, nbPalette.nbBackground],
    surfacePrimary: nbPalette.nbSurface,
    surfaceSecondary: nbPalette.nbSoft,
    textPrimary: nbPalette.nbInk,
    textSecondary: nbPalette.nbMuted,
    textMuted: nbPalette.nbMuted,
    border: nbPalette.nbBorder,
    blurTint: blurTintValue,
    fill: nbPalette.nbFill,
    onFill: nbPalette.nbOnFill,
    soft: nbPalette.nbSoft,
    shadow: nbPalette.nbShadow,
  };
}

/**
 * Trend arrow colors — ink for up, muted for down.
 * Design Law: never green for “good” deltas.
 * @returns {{ positive: string, negative: string }}
 */
function buildTrendArrowColors() {
  return {
    positive: lightColors.nbInk,
    negative: lightColors.nbMuted,
  };
}

// ===== MAIN FUNCTION =====

// 1. Accent chips
const GRADIENTS = buildWeeklyReportGradients();

// 2. Light + dark surfaces (nb tokens only)
const LIGHT_COLORS = buildThemeSurfaceColors(lightColors, 'light');
const DARK_COLORS = buildThemeSurfaceColors(darkColors, 'dark');

// 3. Trend ink (never green)
const trendArrowColors = buildTrendArrowColors();
const TREND_POSITIVE = trendArrowColors.positive;
const TREND_NEGATIVE = trendArrowColors.negative;

// 4. Theme storage key (export name STORAGE_KEY stays frozen)
const STORAGE_KEY = THEME_MODE_STORAGE_KEY;

export {
  GRADIENTS,
  DARK_COLORS,
  LIGHT_COLORS,
  TREND_POSITIVE,
  TREND_NEGATIVE,
  STORAGE_KEY,
};
