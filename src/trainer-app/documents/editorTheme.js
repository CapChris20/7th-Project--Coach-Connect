/**
 * editor Theme
 *
 * Purpose: editor Theme — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: getEditorTheme, formatEditorSavedAgo, FONT_SIZES, EDITOR_TEXT_COLORS, EDITOR_HIGHLIGHT_COLORS
 *
 * @file-header
 */
import { lightColors, darkColors } from '../../shared-ui/theme';
import {
  EDITOR_ACCENT,
  EDITOR_ACCENT_GRADIENT,
  EDITOR_ACCENT_SOFT,
  EDITOR_ACCENT_BORDER,
  EDITOR_ACCENT_START,
  EDITOR_ACCENT_END,
} from './editorGradients';

/** DocFlow brand gradient — rose → purple → amber */
export const DOC_FLOW_GRADIENT = ['#e11d48', '#9333ea', '#f59e0b'];

export const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 32, 48];

export const EDITOR_TEXT_COLORS = [
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

export const EDITOR_HIGHLIGHT_COLORS = [
  'transparent',
  'rgba(254,240,138,0.45)',
  'rgba(187,247,208,0.45)',
  'rgba(191,219,254,0.45)',
  'rgba(251,207,232,0.45)',
  'rgba(233,213,255,0.45)',
  'rgba(255,107,157,0.28)',
  'rgba(147,51,234,0.28)',
];

/** Shared light/dark tokens for document + spreadsheet editors. */
export function getEditorTheme(isDark) {
  const c = isDark ? darkColors : lightColors;
  return {
    accentGradient: EDITOR_ACCENT_GRADIENT,
    accentStart: EDITOR_ACCENT_START,
    accentEnd: EDITOR_ACCENT_END,
    accent: isDark ? EDITOR_ACCENT : '#0A0A0F',
    accentSoft: isDark ? EDITOR_ACCENT_SOFT : 'rgba(0,0,0,0.06)',
    accentBorder: isDark ? EDITOR_ACCENT_BORDER : 'rgba(0,0,0,0.22)',
    formula: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)',
    bg: isDark ? c.background : c.gray[50],
    canvasBg: isDark ? '#202124' : '#E8EAED',
    pageBg: isDark ? '#303134' : '#FFFFFF',
    /** Google Docs print layout: white page on gray canvas regardless of app chrome theme. */
    printCanvasBg: isDark ? '#3C4043' : '#E8EAED',
    printPageBg: '#FFFFFF',
    printPageText: '#202124',
    printPageMuted: '#5F6368',
    headerBg: isDark ? '#202124' : '#FFFFFF',
    toolbarBg: isDark ? '#292A2D' : '#FFFFFF',
    gridHeaderBg: isDark ? '#18181C' : '#F3F4F6',
    cornerBg: isDark ? '#121216' : '#ECECF0',
    border: isDark ? 'rgba(255,255,255,0.08)' : c.border,
    gridLine: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)',
    text: c.text,
    textMuted: c.textSecondary,
    textOnAccent: isDark ? '#0A0A0F' : '#FFFFFF',
    success: c.success,
    warning: c.warning,
    selectionFill: isDark ? 'rgba(224,64,138,0.18)' : 'rgba(212,41,122,0.12)',
    selectionBorder: isDark ? '#E0408A' : '#D4297A',
    sheetGradient: isDark ? ['#E0408A', '#9333EA'] : ['#E8367A', '#7C3AED'],
    formulaGreen: isDark ? '#6EE7A0' : '#2D8A55',
    inputBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    divider: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
    pageShadow: isDark
      ? null
      : {
          shadowColor: '#000000',
          shadowOpacity: 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        },
  };
}

export function formatEditorSavedAgo(lastSaved) {
  if (!lastSaved) return '—';
  const diff = Math.round((Date.now() - lastSaved.getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}
