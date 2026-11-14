// Document format presets (APA, MLA, Chicago, Resume, Essay, Letter, Report).
// Flow: preset key → empty-doc scaffold (if empty) → RN paper wrapper → CSS for TipTap WebView.
// Used by the trainer document editor as StyleSheet objects + optional content scaffold.

import { StyleSheet } from 'react-native';
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';

// Story: presets are plain objects the editor injects into the WebView page chrome.

// ===== NAMED CONSTANTS =====

const PRESET_KEY_DEFAULT = 'default';
// Manipulate here: Design Law outline width on the paper card in the WebView
const EDITOR_BORDER_WIDTH_PX = 3;
const PLACEHOLDER_DARK = 'rgba(242,242,242,0.45)';
const PLACEHOLDER_LIGHT = 'rgba(10,10,10,0.4)';
// Manipulate here: hard offset shadow string for light-mode paper (dark mode uses none)
const PAPER_HARD_SHADOW_LIGHT = '5px 5px 0 #0A0A0A';

const RESUME_SCAFFOLD = `
<h1 style="text-align:center;margin-bottom:0">Your Name</h1>
<p style="text-align:center;color:#575757">email@example.com · (555) 555-5555 · City, Country</p>
<h2>Experience</h2>
<p><strong>Role · Company</strong> — 2022–Present<br>What you did and the impact you had.</p>
<h2>Education</h2>
<p><strong>Degree · School</strong> — Year</p>
<h2>Skills</h2>
<ul><li>Skill one</li><li>Skill two</li><li>Skill three</li></ul>
`;

const ESSAY_SCAFFOLD = `
<h1 style="text-align:center">Essay Title</h1>
<p style="text-align:center;color:#575757">Your Name — Date</p>
<p>Begin your essay here.</p>
`;

const LETTER_SCAFFOLD = `
<p>Your Name<br>Your Address<br>City, State ZIP</p>
<p>${new Date().toLocaleDateString()}</p>
<p>Recipient Name<br>Recipient Address<br>City, State ZIP</p>
<p>Dear Recipient,</p>
<p>Body of your letter.</p>
<p>Sincerely,<br>Your Name</p>
`;

const REPORT_SCAFFOLD = `
<h1 style="text-align:center">Report Title</h1>
<p style="text-align:center;color:#575757">Prepared by · Date</p>
<h2>Executive Summary</h2>
<p>Brief overview of findings.</p>
<h2>Introduction</h2>
<p>Background and purpose.</p>
<h2>Findings</h2>
<p>Key findings and analysis.</p>
<h2>Conclusion</h2>
<p>Conclusions and next steps.</p>
`;

// Typography CSS injected into the TipTap WebView per preset key (letters frozen).
const PRESET_CSS_BY_KEY = {
  default: `.doc-paper-wrap { font-family: 'Outfit', sans-serif; line-height: 1.6; font-size: 14px; }`,
  apa: `.doc-paper-wrap { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 2; } .ProseMirror p { text-indent: 0.5in; margin: 0; } .ProseMirror h1, .ProseMirror h2 { text-align: center; }`,
  mla: `.doc-paper-wrap { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 2; } .ProseMirror p { text-indent: 0.5in; margin: 0; }`,
  chicago: `.doc-paper-wrap { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 2; } .ProseMirror p { text-indent: 0.5in; margin: 0; }`,
  resume: `.doc-paper-wrap { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; line-height: 1.4; } .ProseMirror h1 { font-size: 22pt; } .ProseMirror h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid currentColor; padding-bottom: 4px; margin-top: 1em; } .ProseMirror p { margin: 0 0 0.4em; }`,
  essay: `.doc-paper-wrap { font-family: 'Crimson Pro', Georgia, serif; font-size: 13pt; line-height: 2; } .ProseMirror p { text-indent: 0.5in; margin: 0; }`,
  letter: `.doc-paper-wrap { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; line-height: 1.5; }`,
  report: `.doc-paper-wrap { font-family: 'Outfit', sans-serif; font-size: 12pt; line-height: 1.65; } .ProseMirror h1 { text-align: center; font-weight: 700; } .ProseMirror h2 { border-bottom: 1px solid currentColor; padding-bottom: 4px; margin-top: 1em; }`,
};

// Shared paper padding used by every preset StyleSheet entry below.
const SHARED_PAPER_PADDING = {
  width: '100%',
  paddingVertical: 12,
  paddingHorizontal: 16,
};

/** RN wrapper styles for the paper container */
export const paperStyles = StyleSheet.create({
  docPaper: {
    position: 'relative',
    marginHorizontal: 'auto',
    borderRadius: 10,
  },
  presetDefault: { ...SHARED_PAPER_PADDING },
  presetApa: { ...SHARED_PAPER_PADDING },
  presetMla: { ...SHARED_PAPER_PADDING },
  presetChicago: { ...SHARED_PAPER_PADDING },
  presetResume: { ...SHARED_PAPER_PADDING },
  presetEssay: { ...SHARED_PAPER_PADDING },
  presetLetter: { ...SHARED_PAPER_PADDING },
  presetReport: { ...SHARED_PAPER_PADDING },
});

// ===== HELPER FUNCTIONS =====

/**
 * Build one row for the preset picker list.
 * @param {string} key
 * @param {string} label
 * @param {string} description
 * @param {string} paperClass
 * @param {string} [scaffoldHtml]
 * @returns {{ key: string, label: string, description: string, paperClass: string, scaffold?: string }}
 */
function buildOnePresetRow(key, label, description, paperClass, scaffoldHtml) {
  const row = { key, label, description, paperClass };
  if (scaffoldHtml) {
    row.scaffold = scaffoldHtml;
  }
  return row;
}

/**
 * Map paperClass string → StyleSheet entry used by the RN wrapper.
 * @returns {Record<string, object>}
 */
function buildPaperClassToStyleMap() {
  return {
    'preset-default': paperStyles.presetDefault,
    'preset-apa': paperStyles.presetApa,
    'preset-mla': paperStyles.presetMla,
    'preset-chicago': paperStyles.presetChicago,
    'preset-resume': paperStyles.presetResume,
    'preset-essay': paperStyles.presetEssay,
    'preset-letter': paperStyles.presetLetter,
    'preset-report': paperStyles.presetReport,
  };
}

/**
 * Design Law colors for the WebView canvas + paper card.
 * @param {boolean} isDark
 * @returns {object}
 */
function pickWebViewColorsFromTheme(isDark) {
  const palette = isDark ? darkColors : lightColors;
  const tableBorder = isDark ? 'rgba(242,242,242,0.16)' : 'rgba(10,10,10,0.12)';
  const placeholderColor = isDark ? PLACEHOLDER_DARK : PLACEHOLDER_LIGHT;
  const paperShadow = isDark ? 'none' : PAPER_HARD_SHADOW_LIGHT;
  return {
    canvasBg: palette.nbBackground,
    surfaceBg: palette.nbSurface,
    foregroundColor: palette.nbInk,
    accentInk: palette.nbInk,
    borderColor: palette.nbBorder,
    placeholderColor,
    paperShadow,
    codeBackground: palette.nbSoft,
    tableBorder,
  };
}

/**
 * Shared ProseMirror + paper chrome CSS (theme tokens). Preset typography is appended later.
 * @param {boolean} isDark
 * @returns {string}
 */
function buildSharedEditorChromeCss(isDark) {
  const colors = pickWebViewColorsFromTheme(isDark);
  return `
    html, body {
      margin: 0;
      padding: 0;
      background: ${colors.canvasBg};
      color: ${colors.foregroundColor};
      height: 100%;
    }
    .ProseMirror {
      min-height: 100%;
      padding: 16px;
      outline: none;
      color: ${colors.foregroundColor} !important;
      -webkit-text-fill-color: ${colors.foregroundColor};
      font-family: 'Outfit', -apple-system, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      caret-color: ${colors.accentInk};
    }
    .ProseMirror *:not(a) {
      color: inherit;
    }
    .ProseMirror p.is-editor-empty:first-child::before {
      color: ${colors.placeholderColor};
    }
    .doc-paper-wrap {
      background: ${colors.surfaceBg};
      color: ${colors.foregroundColor};
      min-height: 100%;
      border-radius: 10px;
      border: ${EDITOR_BORDER_WIDTH_PX}px solid ${colors.borderColor};
      box-shadow: ${colors.paperShadow};
    }
    .ProseMirror p { margin: 0 0 8px; }
    .ProseMirror h1 { font-size: 32px; font-weight: 800; margin: 0 0 12px; }
    .ProseMirror h2 { font-size: 24px; font-weight: 800; margin: 20px 0 8px; }
    .ProseMirror h3 { font-size: 18px; font-weight: 700; margin: 16px 0 6px; }
    .ProseMirror blockquote { margin: 12px 0; padding: 10px 12px; border-left: ${EDITOR_BORDER_WIDTH_PX}px solid ${colors.accentInk}; opacity: 0.9; font-style: italic; }
    .ProseMirror pre { background: ${colors.codeBackground}; padding: 12px; border-radius: 8px; overflow: auto; }
    .ProseMirror code { font-family: 'JetBrains Mono', monospace; background: ${colors.codeBackground}; padding: 2px 6px; border-radius: 4px; }
    .ProseMirror a { color: ${colors.accentInk}; text-decoration: underline; text-underline-offset: 2px; }
    .ProseMirror img { max-width: 100%; border-radius: 8px; }
    .ProseMirror table { border-collapse: collapse; width: 100%; }
    .ProseMirror td, .ProseMirror th { border: 1px solid ${colors.tableBorder}; padding: 6px 8px; }
  `;
}

/**
 * Look up preset typography CSS; unknown keys fall back to default.
 * @param {string} presetKey
 * @returns {string}
 */
function typographyCssForPresetKey(presetKey) {
  const matchedCss = PRESET_CSS_BY_KEY[presetKey];
  if (matchedCss) {
    return matchedCss;
  }
  return PRESET_CSS_BY_KEY[PRESET_KEY_DEFAULT];
}

const PAPER_CLASS_TO_STYLE = buildPaperClassToStyleMap();

// ===== MAIN FUNCTION =====

/**
 * Preset rows the Style picker shows (label + description + optional scaffold).
 * Key letters stay frozen — editor stores these keys on the document.
 */
export const PRESETS = [
  buildOnePresetRow(PRESET_KEY_DEFAULT, 'Default', 'Comfortable defaults', 'preset-default'),
  buildOnePresetRow('apa', 'APA', 'Double-spaced, 1" margins, Times New Roman', 'preset-apa'),
  buildOnePresetRow('mla', 'MLA', 'Double-spaced, half-inch indent, Times New Roman', 'preset-mla'),
  buildOnePresetRow('chicago', 'Chicago', 'Double-spaced, indented paragraphs', 'preset-chicago'),
  buildOnePresetRow('resume', 'Resume', 'Tight spacing, sectioned layout', 'preset-resume', RESUME_SCAFFOLD),
  buildOnePresetRow('essay', 'Essay', 'Title, indented body, double-spaced', 'preset-essay', ESSAY_SCAFFOLD),
  buildOnePresetRow('letter', 'Letter', 'Business letter layout', 'preset-letter', LETTER_SCAFFOLD),
  buildOnePresetRow('report', 'Report', 'Title, sections, structured', 'preset-report', REPORT_SCAFFOLD),
];

/**
 * Find a preset by key, or the default row when the key is unknown.
 * @param {string} key
 * @returns {{ key: string, label: string, description: string, paperClass: string, scaffold?: string }}
 */
export function getPreset(key) {
  // 1. Walk the picker list for an exact key match.
  for (let index = 0; index < PRESETS.length; index += 1) {
    const presetRow = PRESETS[index];
    if (presetRow.key === key) {
      return presetRow;
    }
  }
  // 2. Unknown keys always land on Default (first row).
  return PRESETS[0];
}

/**
 * RN StyleSheet entry for the paper wrapper of this preset.
 * @param {string} presetKey
 * @returns {object}
 */
export function getPaperStyle(presetKey) {
  // 1. Resolve the preset so we get its paperClass string.
  const presetRow = getPreset(presetKey);
  // 2. Map paperClass → StyleSheet; missing class falls back to default padding.
  const styleForClass = PAPER_CLASS_TO_STYLE[presetRow.paperClass];
  if (styleForClass) {
    return styleForClass;
  }
  return paperStyles.presetDefault;
}

/**
 * Full CSS string for the TipTap WebView: shared chrome + preset typography.
 * @param {string} presetKey
 * @param {boolean} isDark
 * @returns {string}
 */
export function getPaperCss(presetKey, isDark) {
  // 1. Shared ProseMirror + paper card chrome (Design Law tokens).
  const sharedChromeCss = buildSharedEditorChromeCss(isDark);
  // 2. Typography rules for APA / MLA / resume / etc.
  const presetTypographyCss = typographyCssForPresetKey(presetKey);
  // 3. TipTap injects one concatenated stylesheet string.
  return sharedChromeCss + presetTypographyCss;
}

// ===== PLUMBING — skip unless debugging =====
// (helpers above cover this file; section kept for Variation 3 story shape)
