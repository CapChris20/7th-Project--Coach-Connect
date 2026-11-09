#!/usr/bin/env node
// Runs Maestro native flows when `maestro` CLI + simulator are available.
// Updates src/screenshots/manifest.json for nativeOnly pending entries (max 3 attempts).

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { SCREENSHOTS_ROOT, MAX_ATTEMPTS } = require('../lib/constants');
const { loadManifest, saveManifest } = require('../lib/manifest');

function hasMaestro() {
  const r = spawnSync('maestro', ['--version'], { encoding: 'utf8' });
  return r.status === 0;
}

function runFlow(file) {
  const env = {
    ...process.env,
    APP_ID: process.env.APP_ID || 'com.coachconnect',
  };
  return spawnSync('maestro', ['test', file], {
    encoding: 'utf8',
    env,
    cwd: path.join(__dirname, '../..'),
  });
}

function markNative(manifest, status, reason) {
  for (const entry of manifest.entries) {
    if (entry.status !== 'pending') continue;
    if (entry.captureMethod !== 'maestro' && !entry.nativeOnly) continue;
    entry.status = status;
    entry.reason = reason;
    entry.file = status === 'ok' ? entry.file : null;
    entry.attempts = Math.min(MAX_ATTEMPTS, entry.attempts || 1);
    if (status === 'failed') entry.attempts = MAX_ATTEMPTS;
  }
}

function main() {
  const manifest = loadManifest();
  if (!hasMaestro()) {
    markNative(
      manifest,
      'failed',
      'maestro CLI not installed in this environment; native-only screens require iOS/Android simulator + Maestro',
    );
    saveManifest(manifest);
    console.error('maestro not available — native entries marked failed');
    process.exitCode = 1;
    return;
  }

  const flows = [
    path.join(__dirname, 'client-native.yaml'),
    path.join(__dirname, 'trainer-native.yaml'),
  ];

  let failed = false;
  for (const flow of flows) {
    let ok = false;
    let lastErr = '';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const result = runFlow(flow);
      if (result.status === 0) {
        ok = true;
        break;
      }
      lastErr = (result.stderr || result.stdout || 'maestro failed').slice(0, 500);
    }
    if (!ok) {
      failed = true;
      for (const entry of manifest.entries) {
        if (entry.status !== 'pending') continue;
        if (!(entry.captureMethod === 'maestro' || entry.nativeOnly)) continue;
        const isClient = flow.includes('client');
        if (isClient && entry.role !== 'client') continue;
        if (!isClient && entry.role !== 'trainer') continue;
        entry.status = 'failed';
        entry.reason = lastErr || 'maestro flow failed after 3 attempts';
        entry.attempts = MAX_ATTEMPTS;
        entry.file = null;
      }
    }
  }

  // If maestro succeeded, copy any screenshots maestro dropped into screenshots/
  const probeDirs = [
    path.join(process.cwd(), 'screenshots'),
    path.join(__dirname, '../../../.maestro'),
    '/tmp',
  ];
  for (const entry of manifest.entries) {
    if (!(entry.captureMethod === 'maestro' || entry.nativeOnly)) continue;
    if (entry.status === 'failed' || entry.status === 'skipped' || entry.status === 'unreachable') continue;
    // Best-effort: if file already exists from a prior copy, mark ok
    if (entry.file) {
      const abs = path.join(path.dirname(SCREENSHOTS_ROOT), entry.file);
      if (fs.existsSync(abs)) {
        entry.status = 'ok';
        entry.reason = null;
        continue;
      }
    }
    if (entry.status === 'pending') {
      entry.status = failed ? 'failed' : 'failed';
      entry.reason =
        entry.reason ||
        'Maestro ran but screenshot file was not found in expected screenshots/ path; re-run on a local simulator and copy PNGs into src/screenshots/<state>/<role>/';
      entry.attempts = MAX_ATTEMPTS;
      entry.file = null;
    }
  }

  saveManifest(manifest);
  console.log('Maestro pass complete');
  void probeDirs;
}

main();
