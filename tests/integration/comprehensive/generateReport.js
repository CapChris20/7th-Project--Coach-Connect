/**
 * Generate detailed TEST_RESULTS.md from comprehensive suite results JSON.
 */
const fs = require('fs');
const path = require('path');
const { lookupTestMeta, getCategoryInfo } = require('./lib/testCatalog');

const ROOT = path.join(__dirname, '..', '..', '..');

const CRITICAL = new Set([
  'auth',
  'trainer-client-linking',
  'messaging',
  'food-search',
  'ai-coach',
]);

const IMPORTANT = new Set([
  'firestore-listeners',
  'workout-generation',
  'ai-tools',
  'account-deletion',
  'trainer-dashboard',
  'client-dashboard',
  'notifications',
  'progress-photos',
  'weekly-summaries',
  'session-scheduling',
  'apple-iap',
]);

const TYPE_LABEL = {
  live_api: 'Live API call',
  live_firestore: 'Live Firestore write',
  live_auth: 'Live Firebase Auth',
  code_audit: 'Source code audit',
  unit_logic: 'Pure logic / mock',
  load: 'Load smoke',
};

function statusEmoji(status) {
  if (status === 'PASS') return '✅ PASS';
  if (status === 'SKIP') return '⏭️ SKIP';
  return '❌ FAIL';
}

function formatMetrics(test) {
  const parts = [];
  if (test.elapsed != null) parts.push(`**${test.elapsed}ms**`);
  if (test.time && !parts.length) parts.push(`**${test.time}**`);
  if (test.results != null) parts.push(`${test.results} results`);
  if (test.count != null) parts.push(`count=${test.count}`);
  if (test.httpStatus != null) parts.push(`HTTP ${test.httpStatus}`);
  return parts.length ? parts.join(' · ') : null;
}

function renderTestDetail(category, test) {
  const meta = lookupTestMeta(category, test.test);
  const lines = [];
  lines.push(`#### ${test.test} — ${statusEmoji(test.status)}`);
  lines.push('');
  if (meta.what) lines.push(`- **What was tested:** ${meta.what}`);
  if (meta.how) lines.push(`- **How:** ${meta.how}`);
  if (meta.expects) lines.push(`- **Pass criteria:** ${meta.expects}`);
  if (test.type && TYPE_LABEL[test.type]) {
    lines.push(`- **Test type:** ${TYPE_LABEL[test.type]}`);
  }
  if (test.verified) lines.push(`- **Verified:** ${test.verified}`);
  if (test.evidence) lines.push(`- **Evidence:** ${test.evidence}`);
  const metrics = formatMetrics(test);
  if (metrics) lines.push(`- **Metrics:** ${metrics}`);
  if (test.sample) lines.push(`- **Sample data:** \`${String(test.sample).slice(0, 200)}\``);
  if (test.endpoint) lines.push(`- **Endpoint:** \`${test.endpoint}\``);
  if (test.status === 'SKIP' && test.error) {
    lines.push(`- **Skipped because:** ${test.error}`);
  }
  if (test.status === 'FAIL' && test.error) {
    lines.push(`- **Failure:** ${test.error}`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderCategorySection(category, tests, heading) {
  const info = getCategoryInfo(category);
  let md = `### ${heading}: ${info.title || category}\n\n`;
  if (info.summary) md += `${info.summary}\n\n`;
  md += `| # | Test | Status | Metrics | Verified |\n`;
  md += `|---|------|--------|---------|----------|\n`;
  tests.forEach((t, i) => {
    const metrics = formatMetrics(t) || '—';
    const verified = t.verified ? String(t.verified).slice(0, 60) : (t.evidence ? String(t.evidence).slice(0, 60) : '—');
    md += `| ${i + 1} | ${t.test} | ${statusEmoji(t.status)} | ${metrics} | ${verified} |\n`;
  });
  md += '\n<details>\n<summary>Click to expand full details for each test</summary>\n\n';
  for (const t of tests) {
    md += renderTestDetail(category, t);
  }
  md += '</details>\n\n';
  return md;
}

function generateMarkdownReport(results, meta = {}) {
  let total = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  const failures = [];

  const criticalEntries = {};
  const importantEntries = {};
  const otherEntries = {};

  for (const [category, tests] of Object.entries(results)) {
    const bucket = CRITICAL.has(category)
      ? criticalEntries
      : IMPORTANT.has(category)
        ? importantEntries
        : otherEntries;

    for (const t of tests) {
      const enriched = { ...lookupTestMeta(category, t.test), ...t };
      if (!bucket[category]) bucket[category] = [];
      bucket[category].push(enriched);
      total += 1;
      if (t.status === 'PASS') passed += 1;
      else if (t.status === 'SKIP') skipped += 1;
      else {
        failed += 1;
        failures.push({ category, ...enriched });
      }
    }
  }

  const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
  const scored = total - skipped;
  const scoredRate = scored > 0 ? ((passed / scored) * 100).toFixed(1) : '0.0';

  let md = '# COACHCONNECT COMPREHENSIVE TEST RESULTS\n\n';
  md += '> Detailed report: what each test did, how it was run, and what was verified.\n\n';
  md += `**Generated:** ${meta.generatedAt || new Date().toISOString()}  \n`;
  if (meta.apiBase) md += `**API base:** ${meta.apiBase}  \n`;
  md += `**Firebase project:** anatrox-auth  \n`;
  md += `**Firebase Admin:** ${meta.firebaseAdminWritable ? 'writable (service account)' : meta.firebaseAdmin ? 'initialized' : 'not available'}  \n`;
  if (meta.durationMs != null) md += `**Duration:** ${(meta.durationMs / 1000).toFixed(1)}s  \n`;
  md += '\n';

  md += '## Executive summary\n\n';
  md += '| Metric | Value |\n';
  md += '|--------|-------|\n';
  md += `| Total assertions | ${total} |\n`;
  md += `| Passed | ${passed} ✅ |\n`;
  md += `| Failed | ${failed} ❌ |\n`;
  md += `| Skipped | ${skipped} ⏭️ |\n`;
  md += `| Pass rate (excl. skips) | ${scoredRate}% |\n`;
  md += '\n';

  md += '### What this suite covers\n\n';
  md += '- **Live production API** — food search, AI coach, workout generation, health checks\n';
  md += '- **Live Firestore + Auth** — create users, link trainer/client, messages, dashboards, sessions\n';
  md += '- **Code wiring audits** — listener patterns, error boundaries, pagination constants\n';
  md += '- **Server logic** — purge pagination, tool validation, IAP auth gate\n';
  md += '- **Not covered here** — device UI taps (Maestro), Stripe payments, 500-user load test\n';
  md += '\n';

  md += '## 🔴 CRITICAL TESTS\n\n';
  for (const [cat, tests] of Object.entries(criticalEntries)) {
    md += renderCategorySection(cat, tests, cat.toUpperCase());
  }

  md += '## 🟡 IMPORTANT TESTS\n\n';
  for (const [cat, tests] of Object.entries(importantEntries)) {
    md += renderCategorySection(cat, tests, cat.toUpperCase());
  }

  if (Object.keys(otherEntries).length > 0) {
    md += '## ⚪ OTHER TESTS\n\n';
    for (const [cat, tests] of Object.entries(otherEntries)) {
      md += renderCategorySection(cat, tests, cat.toUpperCase());
    }
  }

  if (failures.length > 0) {
    md += '## ❌ FAILURES (action required)\n\n';
    for (const f of failures) {
      md += `### ${f.category} → ${f.test}\n\n`;
      md += `- **Error:** ${f.error || 'unknown'}\n`;
      if (f.what) md += `- **What:** ${f.what}\n`;
      if (f.how) md += `- **How:** ${f.how}\n`;
      md += '\n';
    }
  }

  md += '## Recommendations\n\n';
  if (failed === 0 && skipped === 0) {
    md += '✅ All tests passed. Review expanded sections above for per-test evidence.\n';
  } else if (failed === 0) {
    md += `✅ No failures. ${skipped} test(s) skipped — see skip reasons in expanded sections.\n`;
  } else {
    md += `⚠️ Fix ${failed} failure(s) above, then re-run \`npm run test:comprehensive\`.\n`;
  }

  md += '\n---\n\n';
  md += '*Re-run: `npm run test:comprehensive`* · *Raw JSON: `tests/integration/comprehensive/last-results.json`*\n';

  return md;
}

function writeReport(results, meta = {}) {
  const reportPath = path.join(ROOT, 'TEST_RESULTS.md');
  const jsonPath = path.join(__dirname, 'last-results.json');
  const markdown = generateMarkdownReport(results, meta);
  fs.writeFileSync(reportPath, markdown);
  fs.writeFileSync(jsonPath, JSON.stringify({ meta, results }, null, 2));
  return { reportPath, jsonPath, markdown };
}

if (require.main === module) {
  const jsonPath = path.join(__dirname, 'last-results.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('No last-results.json — run runAll.js first');
    process.exit(1);
  }
  const { meta, results } = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const { reportPath } = writeReport(results, meta);
  console.log(`✅ Report written to ${reportPath}`);
}

module.exports = { generateMarkdownReport, writeReport };
