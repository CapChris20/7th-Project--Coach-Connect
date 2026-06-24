import { StyleSheet } from 'react-native';

// Document format presets (APA, MLA, Chicago, Resume, Essay, Letter, Report).
// Applied as RN StyleSheet objects + optional content scaffold (only added if doc is empty).

export const PRESETS = [
  {
    key: "default",
    label: "Default",
    description: "Comfortable defaults",
    paperClass: "preset-default",
  },
  {
    key: "apa",
    label: "APA",
    description: "Double-spaced, 1\" margins, Times New Roman",
    paperClass: "preset-apa",
  },
  {
    key: "mla",
    label: "MLA",
    description: "Double-spaced, half-inch indent, Times New Roman",
    paperClass: "preset-mla",
  },
  {
    key: "chicago",
    label: "Chicago",
    description: "Double-spaced, indented paragraphs",
    paperClass: "preset-chicago",
  },
  {
    key: "resume",
    label: "Resume",
    description: "Tight spacing, sectioned layout",
    paperClass: "preset-resume",
    scaffold: `
<h1 style="text-align:center;margin-bottom:0">Your Name</h1>
<p style="text-align:center;color:#666">email@example.com · (555) 555-5555 · City, Country</p>
<h2>Experience</h2>
<p><strong>Role · Company</strong> — 2022–Present<br>What you did and the impact you had.</p>
<h2>Education</h2>
<p><strong>Degree · School</strong> — Year</p>
<h2>Skills</h2>
<ul><li>Skill one</li><li>Skill two</li><li>Skill three</li></ul>
`,
  },
  {
    key: "essay",
    label: "Essay",
    description: "Title, indented body, double-spaced",
    paperClass: "preset-essay",
    scaffold: `
<h1 style="text-align:center">Essay Title</h1>
<p style="text-align:center;color:#666">Your Name — Date</p>
<p>Begin your essay here.</p>
`,
  },
  {
    key: "letter",
    label: "Letter",
    description: "Business letter layout",
    paperClass: "preset-letter",
    scaffold: `
<p>Your Name<br>Your Address<br>City, State ZIP</p>
<p>${new Date().toLocaleDateString()}</p>
<p>Recipient Name<br>Recipient Address<br>City, State ZIP</p>
<p>Dear Recipient,</p>
<p>Body of your letter.</p>
<p>Sincerely,<br>Your Name</p>
`,
  },
  {
    key: "report",
    label: "Report",
    description: "Title, sections, structured",
    paperClass: "preset-report",
    scaffold: `
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
`,
  },
];

export function getPreset(key) {
  return PRESETS.find(p => p.key === key) || PRESETS[0];
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

export function getPaperStyle(presetKey) {
  const preset = getPreset(presetKey);
  return PRESET_STYLE_MAP[preset.paperClass] || paperStyles.presetDefault;
}

/** CSS injected into the TipTap WebView for typography presets */
export function getPaperCss(presetKey, isDark) {
  const bg = isDark ? '#121212' : '#ffffff';
  const fg = isDark ? '#f4f4f5' : '#111111';
  const base = `
    html, body {
      margin: 0;
      padding: 0;
      background: ${bg};
      color: ${fg};
      height: 100%;
    }
    .ProseMirror {
      min-height: 100%;
      padding: 16px;
      outline: none;
      color: ${fg} !important;
      -webkit-text-fill-color: ${fg};
      font-family: 'Outfit', -apple-system, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      caret-color: #9333ea;
    }
    .ProseMirror *:not(a) {
      color: inherit;
    }
    .ProseMirror p.is-editor-empty:first-child::before {
      color: ${isDark ? 'rgba(244,244,245,0.45)' : 'rgba(17,17,17,0.4)'};
    }
    .doc-paper-wrap {
      background: ${bg};
      color: ${fg};
      min-height: 100%;
      border-radius: 4px;
      box-shadow: ${isDark ? '0 1px 0 rgba(255,255,255,0.04)' : '0 12px 30px -10px rgba(0,0,0,0.08)'};
    }
    .ProseMirror p { margin: 0 0 8px; }
    .ProseMirror h1 { font-size: 32px; font-weight: 800; margin: 0 0 12px; }
    .ProseMirror h2 { font-size: 24px; font-weight: 800; margin: 20px 0 8px; }
    .ProseMirror h3 { font-size: 18px; font-weight: 700; margin: 16px 0 6px; }
    .ProseMirror blockquote { margin: 12px 0; padding: 10px 12px; border-left: 3px solid #9333ea; opacity: 0.9; font-style: italic; }
    .ProseMirror pre { background: ${isDark ? '#1a1a1a' : '#f4f4f5'}; padding: 12px; border-radius: 8px; overflow: auto; }
    .ProseMirror code { font-family: 'JetBrains Mono', monospace; background: ${isDark ? '#1a1a1a' : '#f4f4f5'}; padding: 2px 6px; border-radius: 4px; }
    .ProseMirror a { color: #9333ea; text-decoration: none; }
    .ProseMirror img { max-width: 100%; border-radius: 8px; }
    .ProseMirror table { border-collapse: collapse; width: 100%; }
    .ProseMirror td, .ProseMirror th { border: 1px solid ${isDark ? '#333' : '#ddd'}; padding: 6px 8px; }
  `;

  const presetCss = {
    default: `.doc-paper-wrap { font-family: 'Outfit', sans-serif; line-height: 1.6; font-size: 14px; }`,
    apa: `.doc-paper-wrap { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 2; } .ProseMirror p { text-indent: 0.5in; margin: 0; } .ProseMirror h1, .ProseMirror h2 { text-align: center; }`,
    mla: `.doc-paper-wrap { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 2; } .ProseMirror p { text-indent: 0.5in; margin: 0; }`,
    chicago: `.doc-paper-wrap { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 2; } .ProseMirror p { text-indent: 0.5in; margin: 0; }`,
    resume: `.doc-paper-wrap { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; line-height: 1.4; } .ProseMirror h1 { font-size: 22pt; } .ProseMirror h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid currentColor; padding-bottom: 4px; margin-top: 1em; } .ProseMirror p { margin: 0 0 0.4em; }`,
    essay: `.doc-paper-wrap { font-family: 'Crimson Pro', Georgia, serif; font-size: 13pt; line-height: 2; } .ProseMirror p { text-indent: 0.5in; margin: 0; }`,
    letter: `.doc-paper-wrap { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; line-height: 1.5; }`,
    report: `.doc-paper-wrap { font-family: 'Outfit', sans-serif; font-size: 12pt; line-height: 1.65; } .ProseMirror h1 { text-align: center; font-weight: 700; } .ProseMirror h2 { border-bottom: 1px solid currentColor; padding-bottom: 4px; margin-top: 1em; }`,
  };

  return base + (presetCss[presetKey] || presetCss.default);
}
