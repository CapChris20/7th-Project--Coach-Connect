// Document format presets (APA, MLA, Chicago, Resume, Essay, Letter, Report).
// Flow: pick a preset key → optional empty-doc HTML scaffold → RN paper wrapper style → CSS injected into the TipTap WebView.
// Used by: the trainer document editor. Applied as RN StyleSheet objects + optional content scaffold (only added if the doc is empty).

import { StyleSheet } from 'react-native';

// ===== NAMED CONSTANTS =====

const PRESET_KEY_DEFAULT = 'default';

const EDITOR_DARK_BACKGROUND = '#121212';
const EDITOR_LIGHT_BACKGROUND = '#ffffff';
const EDITOR_DARK_FOREGROUND = '#f4f4f5';
const EDITOR_LIGHT_FOREGROUND = '#111111';
const EDITOR_CARET_COLOR = '#9333ea';
const EDITOR_LINK_COLOR = '#9333ea';
const EDITOR_CODE_DARK = '#1a1a1a';
const EDITOR_CODE_LIGHT = '#f4f4f5';
const EDITOR_TABLE_BORDER_DARK = '#333';
const EDITOR_TABLE_BORDER_LIGHT = '#ddd';
const PLACEHOLDER_DARK = 'rgba(244,244,245,0.45)';
const PLACEHOLDER_LIGHT = 'rgba(17,17,17,0.4)';
const PAPER_SHADOW_DARK = '0 1px 0 rgba(255,255,255,0.04)';
const PAPER_SHADOW_LIGHT = '0 12px 30px -10px rgba(0,0,0,0.08)';

const RESUME_SCAFFOLD = `
<h1 style="text-align:center;margin-bottom:0">Your Name</h1>
<p style="text-align:center;color:#666">email@example.com · (555) 555-5555 · City, Country</p>
<h2>Experience</h2>
<p><strong>Role · Company</strong> — 2022–Present<br>What you did and the impact you had.</p>
<h2>Education</h2>
<p><strong>Degree · School</strong> — Year</p>
<h2>Skills</h2>
<ul><li>Skill one</li><li>Skill two</li><li>Skill three</li></ul>
`;

const ESSAY_SCAFFOLD = `
<h1 style="text-align:center">Essay Title</h1>
<p style="text-align:center;color:#666">Your Name — Date</p>
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
<p style="text-align:center;color:#666">Prepared by · Date</p>
<h2>Executive Summary</h2>
<p>Brief overview of findings.</p>
<h2>Introduction</h2>
<p>Background and purpose.</p>
<h2>Findings</h2>
<p>Key findings and analysis.</p>
<h2>Conclusion</h2>
<p>Conclusions and next steps.</p>
`;

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

// ===== HELPER FUNCTIONS =====

function definePreset(key, label, description, paperClass, scaffold) {
  const preset = { key, label, description, paperClass };
  if (scaffold) preset.scaffold = scaffold;
  return preset;
}

function editorColors(isDark) {
  return {
    backgroundColor: isDark ? EDITOR_DARK_BACKGROUND : EDITOR_LIGHT_BACKGROUND,
    foregroundColor: isDark ? EDITOR_DARK_FOREGROUND : EDITOR_LIGHT_FOREGROUND,
    placeholderColor: isDark ? PLACEHOLDER_DARK : PLACEHOLDER_LIGHT,
    paperShadow: isDark ? PAPER_SHADOW_DARK : PAPER_SHADOW_LIGHT,
    codeBackground: isDark ? EDITOR_CODE_DARK : EDITOR_CODE_LIGHT,
    tableBorder: isDark ? EDITOR_TABLE_BORDER_DARK : EDITOR_TABLE_BORDER_LIGHT,
  };
}

function buildBaseEditorCss(isDark) {
  const colors = editorColors(isDark);
  return `
    html, body {
      margin: 0;
      padding: 0;
      background: ${colors.backgroundColor};
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
      caret-color: ${EDITOR_CARET_COLOR};
    }
    .ProseMirror *:not(a) {
      color: inherit;
    }
    .ProseMirror p.is-editor-empty:first-child::before {
      color: ${colors.placeholderColor};
    }
    .doc-paper-wrap {
      background: ${colors.backgroundColor};
      color: ${colors.foregroundColor};
      min-height: 100%;
      border-radius: 4px;
      box-shadow: ${colors.paperShadow};
    }
    .ProseMirror p { margin: 0 0 8px; }
    .ProseMirror h1 { font-size: 32px; font-weight: 800; margin: 0 0 12px; }
    .ProseMirror h2 { font-size: 24px; font-weight: 800; margin: 20px 0 8px; }
    .ProseMirror h3 { font-size: 18px; font-weight: 700; margin: 16px 0 6px; }
    .ProseMirror blockquote { margin: 12px 0; padding: 10px 12px; border-left: 3px solid ${EDITOR_LINK_COLOR}; opacity: 0.9; font-style: italic; }
    .ProseMirror pre { background: ${colors.codeBackground}; padding: 12px; border-radius: 8px; overflow: auto; }
    .ProseMirror code { font-family: 'JetBrains Mono', monospace; background: ${colors.codeBackground}; padding: 2px 6px; border-radius: 4px; }
    .ProseMirror a { color: ${EDITOR_LINK_COLOR}; text-decoration: none; }
    .ProseMirror img { max-width: 100%; border-radius: 8px; }
    .ProseMirror table { border-collapse: collapse; width: 100%; }
    .ProseMirror td, .ProseMirror th { border: 1px solid ${colors.tableBorder}; padding: 6px 8px; }
  `;
}

function cssForPresetKey(presetKey) {
  return PRESET_CSS_BY_KEY[presetKey] || PRESET_CSS_BY_KEY[PRESET_KEY_DEFAULT];
}

// ===== MAIN FUNCTION =====

export const PRESETS = [
  definePreset(PRESET_KEY_DEFAULT, 'Default', 'Comfortable defaults', 'preset-default'),
  definePreset('apa', 'APA', 'Double-spaced, 1" margins, Times New Roman', 'preset-apa'),
  definePreset('mla', 'MLA', 'Double-spaced, half-inch indent, Times New Roman', 'preset-mla'),
  definePreset('chicago', 'Chicago', 'Double-spaced, indented paragraphs', 'preset-chicago'),
  definePreset('resume', 'Resume', 'Tight spacing, sectioned layout', 'preset-resume', RESUME_SCAFFOLD),
  definePreset('essay', 'Essay', 'Title, indented body, double-spaced', 'preset-essay', ESSAY_SCAFFOLD),
  definePreset('letter', 'Letter', 'Business letter layout', 'preset-letter', LETTER_SCAFFOLD),
  definePreset('report', 'Report', 'Title, sections, structured', 'preset-report', REPORT_SCAFFOLD),
];

/**
 * Find a preset by key, or the Default row if the key is unknown.
 * @param {string} key
 * @returns {object}
 */
export function getPreset(key) {
  return PRESETS.find((preset) => preset.key === key) || PRESETS[0];
}

/** RN wrapper styles for the paper container */
export const paperStyles = StyleSheet.create({
  docPaper: {
    position: 'relative',
    marginHorizontal: 'auto',
    borderRadius: 4,
  },
  presetDefault: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  presetApa: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  presetMla: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  presetChicago: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  presetResume: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  presetEssay: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  presetLetter: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  presetReport: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
});

const PRESET_STYLE_MAP = {
  'preset-default': paperStyles.presetDefault,
  'preset-apa': paperStyles.presetApa,
  'preset-mla': paperStyles.presetMla,
  'preset-chicago': paperStyles.presetChicago,
  'preset-resume': paperStyles.presetResume,
  'preset-essay': paperStyles.presetEssay,
  'preset-letter': paperStyles.presetLetter,
  'preset-report': paperStyles.presetReport,
};

/**
 * RN StyleSheet for the paper wrapper that matches a preset's paperClass.
 * @param {string} presetKey
 * @returns {object}
 */
export function getPaperStyle(presetKey) {
  const preset = getPreset(presetKey);
  return PRESET_STYLE_MAP[preset.paperClass] || paperStyles.presetDefault;
}

/**
 * CSS injected into the TipTap WebView for typography presets.
 * Hex strings stay identical so the editor looks the same in light and dark.
 * @param {string} presetKey
 * @param {boolean} isDark
 * @returns {string}
 */
export function getPaperCss(presetKey, isDark) {
  return buildBaseEditorCss(isDark) + cssForPresetKey(presetKey);
}
