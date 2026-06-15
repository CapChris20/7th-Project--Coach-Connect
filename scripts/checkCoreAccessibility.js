#!/usr/bin/env node
/**
 * Ensures core user flows expose accessibilityLabel on primary controls.
 * Run: npm run test:a11y-core
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const CORE_FILES = [
  {
    file: 'src/aiChat/chat-thread/AIChatScreen.jsx',
    mustInclude: [
      'Refresh coach context',
      'Message input',
      'Send message',
      'Add attachment',
      'a11yProps',
    ],
  },
  {
    file: 'src/aiChat/tool-modals/toolModalHelpers.js',
    mustInclude: ['accessibilityLabel="Cancel"', 'accessibilityLabel="Confirm"'],
  },
  {
    file: 'src/nutrition/food-search/FoodSearchScreen.js',
    mustInclude: ['Go back', 'Search foods', 'Clear search'],
  },
  {
    file: 'src/shared/components/home/QuickActionCard.jsx',
    mustInclude: ['accessibilityRole="button"'],
  },
];

let failed = 0;

console.log('Core accessibility static checks\n');

for (const { file, mustInclude } of CORE_FILES) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) {
    console.log(`❌ FAIL  ${file} — file missing`);
    failed += 1;
    continue;
  }
  const src = fs.readFileSync(abs, 'utf8');
  for (const needle of mustInclude) {
    if (src.includes(needle)) {
      console.log(`✅ PASS  ${file} — ${needle}`);
    } else {
      console.log(`❌ FAIL  ${file} — missing ${needle}`);
      failed += 1;
    }
  }
}

console.log('');
if (failed > 0) {
  console.log(`${failed} check(s) failed.`);
  process.exit(1);
}
console.log('All core accessibility checks passed.');
