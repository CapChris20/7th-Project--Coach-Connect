// Colors for the trainer document and spreadsheet editors.
// Flow: getEditorTheme(isDark) returns one object of tokens → every editor control reads those instead of a hardcoded hex.
// Used by DocFlow. Also exports the font-size list, the color swatches, and the "saved Xs ago" label.

import { lightColors, darkColors } from '../../look-and-feel/colorPalette';
import {
  EDITOR_ACCENT,
  EDITOR_ACCENT_GRADIENT,
  EDITOR_ACCENT_SOFT,
  EDITOR_ACCENT_BORDER,
  EDITOR_ACCENT_START,
  EDITOR_ACCENT_END,
} from './editorAccent';

// ===== NAMED CONSTANTS =====

const DOC_FLOW_GRADIENT = ['#e11d48', '#9333ea', '#f59e0b'];
const FONT_SIZE_HEADING = 24;
const FONT_SIZES = [10, 12, 14, 16, 18, 20, FONT_SIZE_HEADING, 32, 48];

const EDITOR_TEXT_COLORS = [
  '#FFFFFF',
  '#0A0A0F',
  '#FF6B9D',
  '#5856D6',
  '#06B6D4',
  '#22C55E',
  '#FBBF24',
  '#FB7185',
  '#C084FC',
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

const LIGHT_ACCENT = '#0A0A0F';
const LIGHT_ACCENT_SOFT = 'rgba(0,0,0,0.06)';
const LIGHT_ACCENT_BORDER = 'rgba(0,0,0,0.22)';
const DARK_FORMULA_COLOR = 'rgba(255,255,255,0.55)';
const LIGHT_FORMULA_COLOR = 'rgba(0,0,0,0.45)';
const DARK_CANVAS = '#202124';
const LIGHT_CANVAS = '#E8EAED';
const DARK_PAGE = '#303134';
const LIGHT_PAGE = '#FFFFFF';
const DARK_PRINT_CANVAS = '#3C4043';
const PRINT_PAGE_BG = '#FFFFFF';
const PRINT_PAGE_TEXT = '#202124';
const PRINT_PAGE_MUTED = '#5F6368';
const DARK_HEADER = '#202124';
const LIGHT_HEADER = '#FFFFFF';
const DARK_TOOLBAR = '#292A2D';
const LIGHT_TOOLBAR = '#FFFFFF';
const DARK_GRID_HEADER = '#18181C';
const LIGHT_GRID_HEADER = '#F3F4F6';
const DARK_CORNER = '#121216';
const LIGHT_CORNER = '#ECECF0';
const DARK_HAIRLINE = 'rgba(255,255,255,0.08)';
const LIGHT_GRID_LINE = 'rgba(0,0,0,0.10)';
const TEXT_ON_DARK_ACCENT = '#0A0A0F';
const TEXT_ON_LIGHT_ACCENT = '#FFFFFF';
const DARK_SELECTION_FILL = 'rgba(224,64,138,0.18)';
const LIGHT_SELECTION_FILL = 'rgba(212,41,122,0.12)';
const DARK_SELECTION_BORDER = '#E0408A';
const LIGHT_SELECTION_BORDER = '#D4297A';
const DARK_SHEET_GRADIENT = ['#E0408A', '#9333EA'];
const LIGHT_SHEET_GRADIENT = ['#E8367A', '#7C3AED'];
const DARK_FORMULA_GREEN = '#6EE7A0';
const LIGHT_FORMULA_GREEN = '#2D8A55';
const DARK_INPUT_BG = 'rgba(255,255,255,0.04)';
const LIGHT_INPUT_BG = 'rgba(0,0,0,0.03)';
const DARK_DIVIDER = 'rgba(255,255,255,0.10)';
const LIGHT_DIVIDER = 'rgba(0,0,0,0.10)';
const PAGE_SHADOW_COLOR = '#000000';

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
    printCanvasBg: isDark ? DARK_PRINT_CANVAS : LIGHT_CANVAS,
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
  if (isDark) return null;
  return {
    shadowColor: PAGE_SHADOW_COLOR,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  };
}

// ===== MAIN FUNCTION =====

/**
 * @param {boolean} isDark
 * @returns {object}
 */
export function getEditorTheme(isDark) {
  const palette = isDark ? darkColors : lightColors;
  return {
    accentGradient: EDITOR_ACCENT_GRADIENT,
    accentStart: EDITOR_ACCENT_START,
    accentEnd: EDITOR_ACCENT_END,
    accent: isDark ? EDITOR_ACCENT : LIGHT_ACCENT,
    accentSoft: isDark ? EDITOR_ACCENT_SOFT : LIGHT_ACCENT_SOFT,
    accentBorder: isDark ? EDITOR_ACCENT_BORDER : LIGHT_ACCENT_BORDER,
    formula: isDark ? DARK_FORMULA_COLOR : LIGHT_FORMULA_COLOR,
    bg: isDark ? palette.background : palette.gray[50],
    canvasBg: isDark ? DARK_CANVAS : LIGHT_CANVAS,
    pageBg: isDark ? DARK_PAGE : LIGHT_PAGE,
    ...printPageTokens(isDark),
    headerBg: isDark ? DARK_HEADER : LIGHT_HEADER,
    toolbarBg: isDark ? DARK_TOOLBAR : LIGHT_TOOLBAR,
    gridHeaderBg: isDark ? DARK_GRID_HEADER : LIGHT_GRID_HEADER,
    cornerBg: isDark ? DARK_CORNER : LIGHT_CORNER,
    border: isDark ? DARK_HAIRLINE : palette.border,
    gridLine: isDark ? DARK_HAIRLINE : LIGHT_GRID_LINE,
    text: palette.text,
    textMuted: palette.textSecondary,
    textOnAccent: isDark ? TEXT_ON_DARK_ACCENT : TEXT_ON_LIGHT_ACCENT,
    success: palette.success,
    warning: palette.warning,
    selectionFill: isDark ? DARK_SELECTION_FILL : LIGHT_SELECTION_FILL,
    selectionBorder: isDark ? DARK_SELECTION_BORDER : LIGHT_SELECTION_BORDER,
    sheetGradient: isDark ? DARK_SHEET_GRADIENT : LIGHT_SHEET_GRADIENT,
    formulaGreen: isDark ? DARK_FORMULA_GREEN : LIGHT_FORMULA_GREEN,
    inputBg: isDark ? DARK_INPUT_BG : LIGHT_INPUT_BG,
    divider: isDark ? DARK_DIVIDER : LIGHT_DIVIDER,
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
  DOC_FLOW_GRADIENT,
  FONT_SIZES,
  EDITOR_TEXT_COLORS,
  EDITOR_HIGHLIGHT_COLORS,
};
