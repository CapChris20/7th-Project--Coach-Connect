#!/usr/bin/env node
/**
 * Merge _png_message_map.json + _visual_descriptions.json → SCREENSHOT_VISUAL_CATALOG.md
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const mapPath = path.join(ROOT, '_png_message_map.json');
const descPath = path.join(ROOT, '_visual_descriptions.json');
const outPath = path.join(ROOT, 'SCREENSHOT_VISUAL_CATALOG.md');

const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const desc = JSON.parse(fs.readFileSync(descPath, 'utf8'));

const lines = [
  '# Screenshot Visual Catalog — All 246 PNGs',
  '',
  'Generated after visual read of every screenshot in `screenshots-2026-05-31_to_2026-06-14/`.',
  '',
  '| Stat | Value |',
  '|------|-------|',
  '| Total PNGs | 246 |',
  '| Message-mapped | 246 |',
  '',
  '---',
  '',
];

let missing = [];
for (const item of map) {
  const d = desc[String(item.index)];
  if (!d) {
    missing.push(item.index);
    continue;
  }
  lines.push(`## #${item.index} — \`${item.filename}\``);
  lines.push(`- **Session:** ${item.session_folder} | ${item.session_date}`);
  lines.push(`- **User message:** ${item.message}`);
  lines.push(`- **What's on screen:** ${d.onScreen}`);
  lines.push(`- **Issue shown:** ${d.issue}`);
  lines.push('');
}

if (missing.length) {
  console.error('Missing descriptions for indices:', missing.join(', '));
  process.exit(1);
}

fs.writeFileSync(outPath, lines.join('\n'));
const stat = fs.statSync(outPath);
const sectionCount = (lines.join('\n').match(/^## #/gm) || []).length;
console.log(JSON.stringify({ written: outPath, bytes: stat.size, sections: sectionCount }));
