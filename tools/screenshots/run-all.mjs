#!/usr/bin/env node
// Orchestrates: write seeds → optional Admin import → Playwright web → Maestro native → manifest.
// No app source changes. No credential files. Do not git commit from this tool.

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { initManifest, loadManifest, saveManifest } = require('./lib/manifest');
const { writeSeedJson } = require('./import-seed.js');
const metroStub = require('./lib/metro-web-stub');

function runNode(script, args = [], opts = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    cwd: __dirname,
    env: process.env,
    stdio: 'inherit',
    ...opts,
  });
  return result.status === 0;
}

function main() {
  console.log('=== Coach Connect screenshot capture ===');
  let metroPatched = false;
  try {
    const manifest = initManifest();
    console.log(`Catalog entries: ${manifest.entries.length}`);

    // Always materialize portable seed JSON (empty + with-food)
    writeSeedJson('empty');
    writeSeedJson('with-food');
    console.log('Seed JSON written under tools/screenshots/seeds/{empty,with-food}');

    const canSeed =
      process.env.FIREBASE_SERVICE_ACCOUNT ||
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.SCREENSHOT_APPLY_SEED === '1';

    const hasPasswords =
      process.env.SCREENSHOT_CLIENT_PASSWORD && process.env.SCREENSHOT_TRAINER_PASSWORD;

    if (canSeed && hasPasswords) {
      const scenario = process.env.SCREENSHOT_SCENARIO || 'with-food';
      console.log(`Applying live seed scenario=${scenario}`);
      runNode(path.join(__dirname, 'import-seed.js'), ['--scenario', scenario, '--apply']);
    } else {
      console.warn(
        'Skipping live Admin seed (need Firebase Admin creds + SCREENSHOT_*_PASSWORD). Seed JSON still written.',
      );
    }

    // Temporary metro web stub so @stripe/stripe-react-native can bundle (restored in finally)
    metroStub.apply();
    metroPatched = true;
    console.log('Applied temporary metro Stripe web stub (will restore after capture)');

    // Playwright web capture
    runNode(path.join(__dirname, 'playwright/capture.mjs'));

    // Maestro native
    runNode(path.join(__dirname, 'maestro/run-maestro.mjs'));

    const finalManifest = loadManifest();
    for (const entry of finalManifest.entries) {
      if (entry.status === 'pending') {
        entry.status = 'failed';
        entry.reason = entry.reason || 'Capture pipeline ended before this screen was attempted';
        entry.file = null;
        entry.attempts = entry.attempts || 1;
      }
    }
    saveManifest(finalManifest);

    const counts = finalManifest.entries.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1;
      return acc;
    }, {});
    console.log('Manifest status counts:', counts);
    console.log('Wrote src/screenshots/manifest.json');
  } finally {
    if (metroPatched) {
      metroStub.restore();
      console.log('Restored original metro.config.js');
    }
  }
}

main();
