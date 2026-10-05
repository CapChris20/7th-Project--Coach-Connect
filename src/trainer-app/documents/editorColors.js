// Single design-token source for the trainer's document + spreadsheet editors ("DocFlow").
// Flow: getEditorTheme(isDark) returns one flat object of colors → every editor component reads
// tokens off it instead of hardcoding hexes, so light/dark stays consistent across both editors.
// Also exports the picker option lists (font sizes, text/highlight swatches) and a "saved Xs ago" helper.
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';
import {
  EDITOR_ACCENT,
  EDITOR_ACCENT_GRADIENT,
  EDITOR_ACCENT_SOFT,
  EDITOR_ACCENT_BORDER,
  EDITOR_ACCENT_START,
  EDITOR_ACCENT_END,
} from './editorAccent';

/** DocFlow brand gradient — rose → purple → amber */
// Manipulate here: the three-stop brand gradient used on the editor's title/branding, in render
// order. Unlike the accent above, this one really is a gradient.
export const DOC_FLOW_GRADIENT = ['#e11d48', '#9333ea', '#f59e0b'];

// Manipulate here: the exact options in the font-size dropdown. Non-linear on purpose — tight
// steps in the body-text range (10–20) where a point matters, big jumps for headings.
export const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 32, 48];

// Manipulate here: the text-color swatch grid, in display order. First two are the theme
// extremes (white for dark mode, near-black for light) so the default color is always the first
// tap; the rest are the accent palette.
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

// Highlight swatches. These are all low-alpha rgba rather than solid hex for one reason: a
// highlight must let the text underneath stay readable in BOTH themes. A solid pastel would
// make white text invisible in dark mode.
// Manipulate here: 'transparent' must stay first — it's the "remove highlight" option.
// The trailing 0.28 pair is stronger because those are brand-accent highlights, not pastels.
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
  // Start from the app-wide palette so the editor inherits global text/border/success colors
  // rather than redefining them — only editor-specific surfaces are overridden below.
  const c = isDark ? darkColors : lightColors;
  return {
    // Accent group: mostly passthrough from editorGradients, except light mode flips the accent to
    // near-black — a white accent would be invisible on a white toolbar.
    accentGradient: EDITOR_ACCENT_GRADIENT,
    accentStart: EDITOR_ACCENT_START,
    accentEnd: EDITOR_ACCENT_END,
    accent: isDark ? EDITOR_ACCENT : '#0A0A0F',
    accentSoft: isDark ? EDITOR_ACCENT_SOFT : 'rgba(0,0,0,0.06)',
    accentBorder: isDark ? EDITOR_ACCENT_BORDER : 'rgba(0,0,0,0.22)',
    // Muted color for the "fx" formula-bar label.
    formula: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)',

    // Surfaces, back to front: bg (screen) → canvasBg (the gray desk) → pageBg (the document).
    // Manipulate here: these greys are deliberately Google-Docs-like; changing canvasBg vs pageBg
    // contrast is what makes the page feel like it's floating.
    bg: isDark ? c.background : c.gray[50],
    canvasBg: isDark ? '#202124' : '#E8EAED',
    pageBg: isDark ? '#303134' : '#FFFFFF',
    /** Google Docs print layout: white page on gray canvas regardless of app chrome theme. */
    // The print* tokens intentionally IGNORE dark mode for the page itself: the page is a preview
    // of paper, and paper is white with black ink. Only the surrounding desk dims in dark mode.
    printCanvasBg: isDark ? '#3C4043' : '#E8EAED',
    printPageBg: '#FFFFFF',
    printPageText: '#202124',
    printPageMuted: '#5F6368',

    // Editor chrome: header strip, toolbar, and the spreadsheet's row/column headers + corner box.
    headerBg: isDark ? '#202124' : '#FFFFFF',
    toolbarBg: isDark ? '#292A2D' : '#FFFFFF',
    gridHeaderBg: isDark ? '#18181C' : '#F3F4F6',
    cornerBg: isDark ? '#121216' : '#ECECF0',

    // Lines and text. gridLine is separate from border because gridlines cover the whole sheet —
    // at that density they need to be fainter than a single UI border.
    border: isDark ? 'rgba(255,255,255,0.08)' : c.border,
    gridLine: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)',
    text: c.text,
    textMuted: c.textSecondary,
    // For text sitting ON an accent-filled surface — inverted so it stays legible.
    textOnAccent: isDark ? '#0A0A0F' : '#FFFFFF',
    success: c.success,
    warning: c.warning,

    // Spreadsheet selection: a translucent fill (so cell contents show through) plus a solid
    // border for a crisp edge. Manipulate here: raising the fill alpha hides cell text.
    selectionFill: isDark ? 'rgba(224,64,138,0.18)' : 'rgba(212,41,122,0.12)',
    selectionBorder: isDark ? '#E0408A' : '#D4297A',
    // Manipulate here: the pink→purple gradient on the sheet tab bar.
    sheetGradient: isDark ? ['#E0408A', '#9333EA'] : ['#E8367A', '#7C3AED'],
    // Green used for formula text, so "=SUM(...)" reads as code rather than content.
    formulaGreen: isDark ? '#6EE7A0' : '#2D8A55',
    inputBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
    divider: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',

    // null in dark mode on purpose: a black drop shadow is invisible against a dark canvas, so we
    // skip the shadow layer entirely instead of paying for one that can't be seen. Callers spread
    // this token, and spreading null is a harmless no-op.
    // Manipulate here: shadowOpacity/Radius/Offset shape the page's lift off the canvas (iOS);
    // `elevation` is Android's equivalent single dial.
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

// Relative "last saved" label for the editor header. Coarse by design — the exact second stops
// mattering after a minute, and a vague label re-renders far less often than a ticking clock.
// Manipulate here: the 5-second "just now" window, then seconds under a minute, then minutes.
// There's no hour tier because an editing session that idles that long shows a stale-doc state.
export function formatEditorSavedAgo(lastSaved) {
  // Em dash rather than 'Never' — this shows before the first save, when "never" would read as an error.
  if (!lastSaved) return '—';
  // Round to whole seconds so the label doesn't flicker between fractional values.
  const diff = Math.round((Date.now() - lastSaved.getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  // floor, not round, so 90s reads "1m ago" rather than jumping to "2m ago".
  return `${Math.floor(diff / 60)}m ago`;
}
