// Colors for the trainer document and spreadsheet editors.
// Flow: getEditorTheme(isDark) → nb chrome tokens; print/canvas tokens for WebView paper; save-age label.
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
  lightColors.nbMuted,
  '#FBBF24',
  '#FB7185',
  '#0A0A0A',
];

const EDITOR_HIGHLIGHT_COLORS = [
  'transparent',
  'rgba(254,240,138,0.45)',
  'rgba(229,229,229,0.65)',
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
// Design Law: never green chrome — formula result uses ink, not spreadsheet-green
const DARK_FORMULA_RESULT = darkColors.nbInk;
const LIGHT_FORMULA_RESULT = lightColors.nbInk;
const DARK_INPUT_BG = 'rgba(255,255,255,0.04)';
const LIGHT_INPUT_BG = 'rgba(0,0,0,0.03)';

const JUST_NOW_SECONDS = 5;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const NEVER_SAVED_LABEL = '—';

// Spreadsheet grid / selection lines — finer than nbBorder so cells stay readable.
const DARK_GRID_LINE = 'rgba(242,242,242,0.14)';
const LIGHT_GRID_LINE = 'rgba(10,10,10,0.12)';
const DARK_SELECTION_FILL = 'rgba(242,242,242,0.12)';
const LIGHT_SELECTION_FILL = 'rgba(10,10,10,0.08)';
const DARK_DIVIDER = 'rgba(242,242,242,0.16)';
const LIGHT_DIVIDER = 'rgba(10,10,10,0.12)';

// ===== HELPER FUNCTIONS =====

/**
 * Paper stays white with black ink. Only the desk around it dims in dark mode.
 * @param {boolean} isDark
 * @returns {object}
 */
function printPageTokensForTheme(isDark) {
  const deskBackground = isDark ? DARK_PRINT_CANVAS : lightColors.nbSoft;
  return {
    printCanvasBg: deskBackground,
    printPageBg: PRINT_PAGE_BG,
    printPageText: PRINT_PAGE_TEXT,
    printPageMuted: PRINT_PAGE_MUTED,
  };
}

/**
 * Hard offset shadow (Design Law). Soft blur looks like the old Google Docs desk.
 * Dark mode still returns a shadow object — callers always spread the same keys.
 * @param {boolean} isDark
 * @returns {object}
 */
function pageShadowStyleForTheme(isDark) {
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

/**
 * Finer grid / selection / divider colors for the spreadsheet surface.
 * @param {boolean} isDark
 * @returns {{ gridLineColor: string, selectionFill: string, dividerColor: string }}
 */
function spreadsheetLineColors(isDark) {
  if (isDark) {
    return {
      gridLineColor: DARK_GRID_LINE,
      selectionFill: DARK_SELECTION_FILL,
      dividerColor: DARK_DIVIDER,
    };
  }
  return {
    gridLineColor: LIGHT_GRID_LINE,
    selectionFill: LIGHT_SELECTION_FILL,
    dividerColor: LIGHT_DIVIDER,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Build the full chrome + print + spreadsheet color bag for one theme mode.
 * @param {boolean} isDark
 * @returns {object}
 */
export function getEditorTheme(isDark) {
  // 1. Pick the nb palette for the light or dark shell.
  const palette = isDark ? darkColors : lightColors;
  const chromeBorder = palette.nbBorder;
  const tabFill = palette.nbFill;
  const tabOnFill = palette.nbOnFill;

  // 2. Print preview tokens — paper stays white; desk dims in dark mode.
  const printTokens = printPageTokensForTheme(isDark);

  // 3. Page card shadow object (Design Law hard offset).
  const pageShadowStyle = pageShadowStyleForTheme(isDark);

  // 4. Spreadsheet line contrast (not nbBorder — finer lines for cells).
  const lineColors = spreadsheetLineColors(isDark);

  // 5. Name every theme-dependent paint before the return bag (no nested ternaries in the object).
  let formulaColor = LIGHT_FORMULA_COLOR;
  let formulaResultColor = LIGHT_FORMULA_RESULT;
  let inputBackgroundColor = LIGHT_INPUT_BG;
  if (isDark) {
    formulaColor = DARK_FORMULA_COLOR;
    formulaResultColor = DARK_FORMULA_RESULT;
    inputBackgroundColor = DARK_INPUT_BG;
  }

  return {
    accentGradient: EDITOR_ACCENT_GRADIENT,
    accentStart: EDITOR_ACCENT_START,
    accentEnd: EDITOR_ACCENT_END,
    accent: tabFill,
    accentSoft: palette.nbSoft,
    accentBorder: chromeBorder,
    chromeBorder,
    formula: formulaColor,
    bg: palette.nbBackground,
    canvasBg: palette.nbSoft,
    pageBg: palette.nbSurface,
    ...printTokens,
    headerBg: palette.nbSurface,
    toolbarBg: palette.nbSurface,
    gridHeaderBg: palette.nbSurfaceChip,
    cornerBg: palette.nbSoft,
    border: chromeBorder,
    gridLine: lineColors.gridLineColor,
    text: palette.nbInk,
    textMuted: palette.nbMuted,
    textOnAccent: tabOnFill,
    success: palette.success,
    warning: palette.warning,
    selectionFill: lineColors.selectionFill,
    selectionBorder: chromeBorder,
    sheetTabActiveBg: tabFill,
    sheetTabActiveText: tabOnFill,
    formulaGreen: formulaResultColor,
    inputBg: inputBackgroundColor,
    divider: lineColors.dividerColor,
    pageShadow: pageShadowStyle,
  };
}

/**
 * Coarse "saved Xs ago" label for the editor toolbar.
 * After a minute, the exact second does not matter.
 * @param {Date|null|undefined} lastSaved
 * @returns {string}
 */
export function formatEditorSavedAgo(lastSaved) {
  if (!lastSaved) {
    return NEVER_SAVED_LABEL;
  }

  const millisecondsSinceSave = Date.now() - lastSaved.getTime();
  const secondsAgo = Math.round(millisecondsSinceSave / MILLISECONDS_PER_SECOND);

  if (secondsAgo < JUST_NOW_SECONDS) {
    return 'just now';
  }
  if (secondsAgo < SECONDS_PER_MINUTE) {
    return `${secondsAgo}s ago`;
  }

  const minutesAgo = Math.floor(secondsAgo / SECONDS_PER_MINUTE);
  return `${minutesAgo}m ago`;
}

export {
  FONT_SIZES,
  EDITOR_TEXT_COLORS,
  EDITOR_HIGHLIGHT_COLORS,
};
