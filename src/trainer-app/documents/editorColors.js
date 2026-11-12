// Colors for the trainer document and spreadsheet editors.
// Flow: getEditorTheme(isDark) → nb chrome tokens for shell; print/canvas tokens stay for WebView paper.
// Used by DocFlow. Also exports font swatches and the "saved Xs ago" label.

import { lightColors, darkColors } from '../../look-and-feel/colorPalette';
import {
  EDITOR_ACCENT_GRADIENT,
  EDITOR_ACCENT_START,
  EDITOR_ACCENT_END,
} from './editorAccent';

// ===== NAMED CONSTANTS =====

const FONT_SIZE_HEADING = 24;
const FONT_SIZES = [10, 12, 14, 16, 18, 20, FONT_SIZE_HEADING, 32, 48];

const EDITOR_TEXT_COLORS = [
  lightColors.white,
  lightColors.nbInk,
  lightColors.primary,
  lightColors.primary,
  '#06B6D4',
  '#22C55E',
  '#FBBF24',
  '#FB7185',
  '#E25588',
];

const EDITOR_HIGHLIGHT_COLORS = [
  'transparent',
  'rgba(254,240,138,0.45)',
  'rgba(187,247,208,0.45)',
  'rgba(191,219,254,0.45)',
  'rgba(251,207,232,0.45)',
  'rgba(233,213,255,0.45)',
  'rgba(255,107,157,0.28)',
  'rgba(147,51,234,0.28)',
];

const LIGHT_FORMULA_COLOR = 'rgba(0,0,0,0.45)';
const DARK_FORMULA_COLOR = 'rgba(255,255,255,0.55)';
// Design Law paper: surface on soft desk (not Google-docs gray ink)
const PRINT_PAGE_BG = lightColors.nbSurface;
const PRINT_PAGE_TEXT = lightColors.nbInk;
const PRINT_PAGE_MUTED = lightColors.nbMuted;
const DARK_PRINT_CANVAS = darkColors.nbBackground;
const PAGE_SHADOW_COLOR = lightColors.nbShadow;
const DARK_FORMULA_GREEN = '#6EE7A0';
const LIGHT_FORMULA_GREEN = '#2D8A55';
const DARK_INPUT_BG = 'rgba(255,255,255,0.04)';
const LIGHT_INPUT_BG = 'rgba(0,0,0,0.03)';

const JUST_NOW_SECONDS = 5;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const NEVER_SAVED_LABEL = '—';

// ===== HELPER FUNCTIONS =====

/**
 * Paper stays white with black ink. Only the desk around it dims in dark mode.
 * @param {boolean} isDark
 * @returns {object}
 */
function printPageTokens(isDark) {
  return {
    printCanvasBg: isDark ? DARK_PRINT_CANVAS : lightColors.nbSoft,
    printPageBg: PRINT_PAGE_BG,
    printPageText: PRINT_PAGE_TEXT,
    printPageMuted: PRINT_PAGE_MUTED,
  };
}

/**
 * A black drop shadow is invisible on a dark canvas, so dark mode skips it.
 * @param {boolean} isDark
 * @returns {object|null}
 */
function pageShadow(isDark) {
  // Hard offset shadow (Design Law) — soft blur looks like the old Google Docs desk.
  if (isDark) {
    return {
      shadowColor: darkColors.nbShadow,
      shadowOpacity: 1,
      shadowRadius: 0,
      shadowOffset: { width: 4, height: 4 },
      elevation: 0,
    };
  }
  return {
    shadowColor: PAGE_SHADOW_COLOR,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 4, height: 4 },
    elevation: 0,
  };
}

// ===== MAIN FUNCTION =====

/**
 * @param {boolean} isDark
 * @returns {object}
 */
export function getEditorTheme(isDark) {
  const palette = isDark ? darkColors : lightColors;
  const chromeBorder = palette.nbBorder;
  const tabFill = palette.nbFill;
  const tabOnFill = palette.nbOnFill;

  return {
    accentGradient: EDITOR_ACCENT_GRADIENT,
    accentStart: EDITOR_ACCENT_START,
    accentEnd: EDITOR_ACCENT_END,
    accent: tabFill,
    accentSoft: palette.nbSoft,
    accentBorder: chromeBorder,
    chromeBorder,
    formula: isDark ? DARK_FORMULA_COLOR : LIGHT_FORMULA_COLOR,
    bg: palette.nbBackground,
    canvasBg: palette.nbSoft,
    pageBg: palette.nbSurface,
    ...printPageTokens(isDark),
    headerBg: palette.nbSurface,
    toolbarBg: palette.nbSurface,
    gridHeaderBg: palette.nbSurfaceChip,
    cornerBg: palette.nbSoft,
    border: chromeBorder,
    gridLine: isDark ? 'rgba(242,242,242,0.14)' : 'rgba(10,10,10,0.12)',
    text: palette.nbInk,
    textMuted: palette.nbMuted,
    textOnAccent: tabOnFill,
    success: palette.success,
    warning: palette.warning,
    selectionFill: isDark ? 'rgba(242,242,242,0.12)' : 'rgba(10,10,10,0.08)',
    selectionBorder: chromeBorder,
    sheetTabActiveBg: tabFill,
    sheetTabActiveText: tabOnFill,
    formulaGreen: isDark ? DARK_FORMULA_GREEN : LIGHT_FORMULA_GREEN,
    inputBg: isDark ? DARK_INPUT_BG : LIGHT_INPUT_BG,
    divider: isDark ? 'rgba(242,242,242,0.16)' : 'rgba(10,10,10,0.12)',
    pageShadow: pageShadow(isDark),
  };
}

/**
 * Coarse on purpose. After a minute, the exact second does not matter.
 * @param {Date|null|undefined} lastSaved
 * @returns {string}
 */
export function formatEditorSavedAgo(lastSaved) {
  if (!lastSaved) return NEVER_SAVED_LABEL;
  const secondsAgo = Math.round((Date.now() - lastSaved.getTime()) / MILLISECONDS_PER_SECOND);
  if (secondsAgo < JUST_NOW_SECONDS) return 'just now';
  if (secondsAgo < SECONDS_PER_MINUTE) return `${secondsAgo}s ago`;
  return `${Math.floor(secondsAgo / SECONDS_PER_MINUTE)}m ago`;
}

export {
  FONT_SIZES,
  EDITOR_TEXT_COLORS,
  EDITOR_HIGHLIGHT_COLORS,
};
