#!/usr/bin/env node
/**
 * Captures REAL iOS simulator screenshots of every onboarding step.
 *
 * Prereqs:
 *   - iOS Simulator booted with the dev build installed
 *   - Metro running (npm start)
 *
 * Usage: npm run snapshot:onboarding
 *
 * Output: docs/onboarding-snapshots/*.png + index.html
 */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'docs/onboarding-snapshots');

const CAPTURES = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'src/auth/onboardingSnapshotManifest.json'), 'utf8'),
);
const TOTAL = CAPTURES.length;

const manifest = [];

function hasBootedSimulator() {
  try {
    const out = execSync('xcrun simctl list devices booted', { encoding: 'utf8' });
    return /Booted/.test(out);
  } catch {
    return false;
  }
}

function takeScreenshot(filename) {
  const outPath = path.join(OUT_DIR, `${filename}.png`);
  execSync(`xcrun simctl io booted screenshot "${outPath}"`, { stdio: 'pipe' });
  return outPath;
}

function writeGalleryIndex() {
  const cards = manifest
    .map(
      (f) => `
    <a class="card" href="${f.file}.png">
      <img src="${f.file}.png" alt="${f.title}" loading="lazy" />
      <div class="meta"><span class="role ${f.role}">${f.role}</span> Step ${f.step}: ${f.title}</div>
    </a>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Coach Connect — Onboarding Screenshots (simulator)</title>
<style>
  body { font-family: system-ui, sans-serif; background:#0f0f14; color:#eee; margin:0; padding:24px; }
  h1 { font-size:28px; margin-bottom:8px; }
  p { color:#888; margin-bottom:24px; }
  .grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:20px; }
  .card { text-decoration:none; color:inherit; background:#1a1a22; border-radius:16px; overflow:hidden; border:1px solid rgba(255,255,255,0.08); }
  .card img { width:100%; display:block; aspect-ratio: 9/19.5; object-fit:cover; object-position:top; background:#0A0A0F; }
  .meta { padding:12px 14px; font-size:13px; line-height:1.4; }
  .role { font-size:10px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; display:inline-block; padding:2px 8px; border-radius:999px; margin-right:6px; }
  .role.client { background:rgba(255,61,138,0.15); color:#FF6B9D; }
  .role.trainer { background:rgba(166,124,0,0.2); color:#FCD34D; }
</style></head>
<body>
  <h1>Onboarding screenshots (real simulator)</h1>
  <p>${manifest.length} PNGs from the live React Native onboarding screens — client (9) + trainer (8).</p>
  <div class="grid">${cards}</div>
</body></html>`;

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

if (!hasBootedSimulator()) {
  console.error('No booted iOS Simulator. Open Simulator and launch the app first.');
  process.exit(1);
}

let captureCount = 0;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/ping') {
    res.writeHead(200);
    res.end('ready');
    return;
  }

  if (req.method !== 'POST' || !req.url?.startsWith('/snap')) {
    res.writeHead(404);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://127.0.0.1');
  const file = url.searchParams.get('file');
  if (!file) {
    res.writeHead(400);
    res.end('missing file');
    return;
  }

  try {
    takeScreenshot(file);
    const meta = CAPTURES.find((c) => c.file === file);
    manifest.push(meta || { file, role: '?', step: '?', title: file });
    captureCount += 1;
    console.log(`[${captureCount}/${TOTAL}] ${file}.png`);
    res.writeHead(200);
    res.end('ok');

    if (captureCount >= TOTAL) {
      writeGalleryIndex();
      console.log(`\nDone — ${captureCount} simulator screenshots in docs/onboarding-snapshots/`);
      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 250);
    }
  } catch (err) {
    console.error('Screenshot error:', err?.message || err);
    res.writeHead(500);
    res.end(String(err));
  }
});

const TIMEOUT_MS = 4 * 60 * 1000;

server.listen(9876, '127.0.0.1', async () => {
  console.log('Capture server listening on http://127.0.0.1:9876');
  console.log(`Expecting ${TOTAL} simulator screenshots…\n`);
  console.log('Reloading Metro bundle so the app picks up the capture runner…');

  for (const port of [8081, 8082, 19000, 19001]) {
    try {
      execSync(`curl -sf -X POST "http://localhost:${port}/reload"`, { stdio: 'pipe' });
      console.log(`Reloaded Metro on port ${port}`);
      break;
    } catch {
      /* try next port */
    }
  }

  console.log('\nKeep the iOS Simulator in the foreground. Capture starts automatically.\n');
});

setTimeout(() => {
  console.error(`\nTimed out after ${TIMEOUT_MS / 1000}s (${captureCount}/${TOTAL} captured).`);
  console.error('Make sure Metro is running and the dev build is open in the simulator.');
  process.exit(1);
}, TIMEOUT_MS);
