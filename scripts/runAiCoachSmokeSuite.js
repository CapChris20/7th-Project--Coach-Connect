#!/usr/bin/env node
/**
 * Runs all 5 AI Coach smoke scripts in sequence.
 * Run: npm run test:ai-coach-smoke
 */
const { spawnSync } = require('child_process');
const path = require('path');

const SCRIPTS = [
  { file: 'testAiCoachClientApiRouting.js', label: '1/5 Client API routing (offline)' },
  { file: 'testCoachWebSearchRouting.js', label: '2/5 Web search routing (offline)' },
  { file: 'testAiCoachGatesAndTools.js', label: '3/5 Gates & tools' },
  { file: 'testAiCoachPersonalData.js', label: '4/5 Personal data (live)' },
  { file: 'testAiCoachWebSearchE2E.js', label: '5/5 Web search E2E (live)' },
];

const OPTIONAL = [{ file: 'testAiCoachThreadFollowups.js', label: 'Bonus: Thread follow-ups (live, slower)' }];

const args = process.argv.slice(2);
const includeThread = args.includes('--with-thread');
const liveOnly = args.includes('--live-only');
const offlineOnly = args.includes('--offline-only');

let scripts = SCRIPTS;
if (liveOnly) {
  scripts = SCRIPTS.filter((s) => s.file.includes('PersonalData') || s.file.includes('WebSearchE2E'));
}
if (offlineOnly) {
  scripts = SCRIPTS.filter((s) => s.file.includes('Routing') || s.file.includes('Gates'));
}
if (includeThread) {
  scripts = [...scripts, ...OPTIONAL];
}

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║           AI COACH SMOKE SUITE                            ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

const results = [];
for (const s of scripts) {
  console.log(`\n▶ ${s.label}`);
  console.log('─'.repeat(60));
  const scriptPath = path.join(__dirname, s.file);
  const out = spawnSync(process.execPath, [scriptPath], {
    stdio: 'inherit',
    env: process.env,
  });
  results.push({ ...s, code: out.status ?? 1 });
}

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║           SUITE SUMMARY                                   ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

let failed = 0;
for (const r of results) {
  const ok = r.code === 0;
  if (!ok) failed += 1;
  console.log(`${ok ? '✅' : '❌'} ${r.label}`);
}

console.log(`\n${failed === 0 ? 'All scripts passed.' : `${failed} script(s) failed.`}`);
console.log('\nTips:');
console.log('  npm run test:ai-coach-smoke -- --offline-only   # no API calls');
console.log('  npm run test:ai-coach-smoke -- --live-only      # web + personal data only');
console.log('  npm run test:ai-coach-smoke -- --with-thread    # include multi-turn test');

process.exit(failed > 0 ? 1 : 0);
