#!/usr/bin/env node
/**
 * Run CoachConnect comprehensive integration test suite and write TEST_RESULTS.md.
 *
 * Usage:
 *   node tests/integration/comprehensive/runAll.js
 *   npm run test:comprehensive
 */
const { writeReport } = require('./generateReport');
const { getApiBase, hasLiveFirebase, canWriteFirebase } = require('./lib/harness');

const { testAuth } = require('./auth.test.js');
const { testTrainerClientLinking } = require('./trainer-client-linking.test.js');
const { testMessaging } = require('./messaging.test.js');
const { testFoodSearch } = require('./food-search.test.js');
const { testAICoach } = require('./ai-coach.test.js');
const { testFirestoreListeners } = require('./firestore-listeners.test.js');
const { testWorkoutGeneration } = require('./workout-generation.test.js');
const { testAiTools } = require('./ai-tools.test.js');
const { testAccountDeletion } = require('./account-deletion.test.js');
const { testTrainerDashboard } = require('./trainer-dashboard.test.js');
const { testClientDashboard } = require('./client-dashboard.test.js');
const { testNotifications } = require('./notifications.test.js');
const { testProgressPhotos } = require('./progress-photos.test.js');
const { testWeeklySummaries } = require('./weekly-summaries.test.js');
const { testSessionScheduling } = require('./session-scheduling.test.js');
const { testAppleIap } = require('./apple-iap.test.js');
const { testScaleTests } = require('./scale-tests.test.js');

const SUITE = [
  { key: 'auth', label: 'CRITICAL', run: testAuth },
  { key: 'trainer-client-linking', label: 'CRITICAL', run: testTrainerClientLinking },
  { key: 'messaging', label: 'CRITICAL', run: testMessaging },
  { key: 'food-search', label: 'CRITICAL', run: testFoodSearch },
  { key: 'ai-coach', label: 'CRITICAL', run: testAICoach },
  { key: 'firestore-listeners', label: 'IMPORTANT', run: testFirestoreListeners },
  { key: 'workout-generation', label: 'IMPORTANT', run: testWorkoutGeneration },
  { key: 'ai-tools', label: 'IMPORTANT', run: testAiTools },
  { key: 'account-deletion', label: 'IMPORTANT', run: testAccountDeletion },
  { key: 'trainer-dashboard', label: 'IMPORTANT', run: testTrainerDashboard },
  { key: 'client-dashboard', label: 'IMPORTANT', run: testClientDashboard },
  { key: 'notifications', label: 'IMPORTANT', run: testNotifications },
  { key: 'progress-photos', label: 'IMPORTANT', run: testProgressPhotos },
  { key: 'weekly-summaries', label: 'IMPORTANT', run: testWeeklySummaries },
  { key: 'session-scheduling', label: 'IMPORTANT', run: testSessionScheduling },
  { key: 'apple-iap', label: 'IMPORTANT', run: testAppleIap },
  { key: 'scale-tests', label: 'LOAD', run: testScaleTests },
];

function printResults(key, tests) {
  for (const t of tests) {
    const icon = t.status === 'PASS' ? '✅' : t.status === 'SKIP' ? '⏭️' : '❌';
    const detail = t.error || t.metric || t.time || (t.elapsed != null ? `${t.elapsed}ms` : '');
    console.log(`  ${icon} ${t.test}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runAllTests() {
  const allResults = {};
  const started = Date.now();

  console.log('🚀 Running CoachConnect Comprehensive Test Suite...\n');
  console.log(`API: ${getApiBase()}`);
  console.log(`Firebase Admin: ${hasLiveFirebase() ? 'yes' : 'no'}\n`);

  let lastLabel = null;
  for (const item of SUITE) {
    if (item.label !== lastLabel) {
      console.log(`▶️ ${item.label} TESTS`);
      lastLabel = item.label;
    }
    console.log(`\n[${item.key}]`);
    try {
      const tests = await item.run();
      allResults[item.key] = tests;
      printResults(item.key, tests);
    } catch (e) {
      allResults[item.key] = [{ test: `${item.key} suite`, status: 'FAIL', error: e.message }];
      console.log(`  ❌ suite crashed — ${e.message}`);
    }
  }

  const durationMs = Date.now() - started;
  const meta = {
    generatedAt: new Date().toISOString(),
    apiBase: getApiBase(),
    firebaseAdmin: hasLiveFirebase(),
    firebaseAdminWritable: await canWriteFirebase(),
    durationMs,
  };

  const { reportPath } = writeReport(allResults, meta);

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  for (const tests of Object.values(allResults)) {
    for (const t of tests) {
      if (t.status === 'PASS') passed += 1;
      else if (t.status === 'SKIP') skipped += 1;
      else failed += 1;
    }
  }
  const total = passed + failed + skipped;
  const scored = total - skipped;
  const rate = scored > 0 ? ((passed / scored) * 100).toFixed(1) : '0.0';

  console.log('\n────────────────────────────────────────');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${skipped} skipped (${rate}% excl. skips)`);
  console.log(`Report: ${reportPath}`);
  console.log('────────────────────────────────────────\n');

  process.exit(failed > 0 ? 1 : 0);
}

runAllTests().catch((e) => {
  console.error(e);
  process.exit(1);
});

module.exports = { runAllTests };
