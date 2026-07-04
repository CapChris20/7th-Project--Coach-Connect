#!/usr/bin/env node
/**
 * Run all payment + subscription tests with full per-test output.
 * Usage: npm run test:payments
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const SUITES = [
  { file: 'stripeConnect.test.js', label: 'Trainer bank connect API' },
  { file: 'stripePayment.test.js', label: 'Client pays trainer API' },
  { file: 'ClientPaymentModal.test.js', label: 'Client payment form UI' },
  { file: 'firestore.rules.test.js', label: 'Firestore payment security' },
  { file: 'appleSubscriptionVerify.test.js', label: 'Apple IAP verify logic' },
  { file: 'subscriptionState.test.js', label: 'Subscription access state' },
];

function resolveEnv(file) {
  const env = { ...process.env };
  if (file === 'firestore.rules.test.js') {
    const brewJava = '/opt/homebrew/opt/openjdk@17';
    if (!env.JAVA_HOME && fs.existsSync(`${brewJava}/bin/java`)) {
      env.JAVA_HOME = brewJava;
      env.PATH = `${brewJava}/bin:${env.PATH || ''}`;
    }
  }
  return env;
}

function stripNoise(text) {
  return String(text || '')
    .split('\n')
    .filter((line) => {
      if (/^npm warn /i.test(line)) return false;
      if (/^watchman warning:/i.test(line)) return false;
      if (/^MustScanSubDirs/i.test(line)) return false;
      if (/^https:\/\/facebook\.io\/watchman/i.test(line)) return false;
      if (/^To clear this warning/i.test(line)) return false;
      if (/^`watchman watch-del/i.test(line)) return false;
      return true;
    })
    .join('\n')
    .trim();
}

function extractTestLines(output) {
  const lines = [];
  for (const line of output.split('\n')) {
    if (/^\s*✓\s/.test(line) || /^\s*✕\s/.test(line)) {
      lines.push(line.trim());
    }
  }
  return lines;
}

function runSuite(file) {
  const result = spawnSync(
    'npx',
    ['jest', '--runInBand', '--verbose', '--no-cache', file],
    { cwd: ROOT, env: resolveEnv(file), encoding: 'utf8' },
  );

  const output = stripNoise(`${result.stdout || ''}\n${result.stderr || ''}`);
  const passMatch = output.match(/Tests:\s+(\d+) passed/);
  const failMatch = output.match(/Tests:\s+(\d+) failed/);

  return {
    ok: result.status === 0,
    passed: passMatch ? Number(passMatch[1]) : 0,
    failed: failMatch ? Number(failMatch[1]) : 0,
    output,
    tests: extractTestLines(output),
  };
}

function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log(' Coach Connect — Payments & Subscriptions Tests');
  console.log(' (verbose — each line is one assertion that passed)');
  console.log('═══════════════════════════════════════════════════\n');

  const rows = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const suite of SUITES) {
    console.log(`\n━━━ ${suite.label} (${suite.file}) ━━━\n`);
    const result = runSuite(suite.file);
    rows.push({ ...suite, ...result });
    totalPassed += result.passed;
    totalFailed += result.failed;

    if (result.tests.length) {
      for (const testLine of result.tests) {
        console.log(`  ${testLine}`);
      }
    } else if (result.output) {
      console.log(result.output);
    }

    console.log('');
    if (result.ok) {
      console.log(`  → ${result.passed} passed in ${suite.file}`);
    } else {
      console.log(`  → FAILED — see output above`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`TOTAL: ${totalPassed} passed${totalFailed ? `, ${totalFailed} failed` : ''}`);
  console.log('═══════════════════════════════════════════════════');

  if (rows.some((r) => !r.ok)) {
    process.exit(1);
  }
}

main();
