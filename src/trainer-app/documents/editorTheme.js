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
  '#FEF08A',
  '#BBF7D0',
  '#BFDBFE',
  '#FBCFE8',
  '#E9D5FF',
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
    canvasBg: isDark ? '#0A0A0F' : '#F2F2F7',
    pageBg: isDark ? '#141418' : '#FFFFFF',
    headerBg: isDark ? '#141418' : '#FFFFFF',
    toolbarBg: isDark ? '#18181C' : '#FFFFFF',
    gridHeaderBg: isDark ? '#18181C' : '#F3F4F6',
    cornerBg: isDark ? '#121216' : '#ECECF0',
    border: isDark ? 'rgba(255,255,255,0.08)' : c.border,
    gridLine: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)',
    text: c.text,
    textMuted: c.textSecondary,
    textOnAccent: isDark ? '#0A0A0F' : '#FFFFFF',
    success: c.success,
    warning: c.warning,
    selectionFill: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
    selectionBorder: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)',
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
