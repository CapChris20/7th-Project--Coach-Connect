const fs = require('fs');
const path = require('path');
const { SCREENSHOTS_ROOT, REPO_ROOT } = require('./constants');
const { expandCatalogEntries } = require('./screen-catalog');

function ensureScreenshotDirs() {
  const states = ['empty', 'with-food', 'loading', 'error'];
  const roles = ['both', 'client', 'trainer'];
  for (const state of states) {
    for (const role of roles) {
      fs.mkdirSync(path.join(SCREENSHOTS_ROOT, state, role), { recursive: true });
    }
  }
}

function absoluteFromRepoRelative(rel) {
  if (!rel) return null;
  return path.join(REPO_ROOT, rel);
}

function initManifest() {
  ensureScreenshotDirs();
  const entries = expandCatalogEntries();
  const manifest = {
    generatedAt: new Date().toISOString(),
    viewport: { width: 390, height: 844, deviceScaleFactor: 2 },
    notes: [
      'Passwords never stored in files — use SCREENSHOT_*_PASSWORD env vars.',
      'No app source changes. Tooling lives under tools/screenshots.',
      'After 3 failed attempts a screen is recorded as failed and not retried.',
    ],
    entries,
  };
  const out = path.join(SCREENSHOTS_ROOT, 'manifest.json');
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
  return manifest;
}

function loadManifest() {
  const out = path.join(SCREENSHOTS_ROOT, 'manifest.json');
  if (!fs.existsSync(out)) return initManifest();
  return JSON.parse(fs.readFileSync(out, 'utf8'));
}

function saveManifest(manifest) {
  manifest.updatedAt = new Date().toISOString();
  const out = path.join(SCREENSHOTS_ROOT, 'manifest.json');
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
}

function updateEntry(manifest, matchFn, patch) {
  const entry = manifest.entries.find(matchFn);
  if (!entry) return null;
  Object.assign(entry, patch);
  return entry;
}

module.exports = {
  ensureScreenshotDirs,
  absoluteFromRepoRelative,
  initManifest,
  loadManifest,
  saveManifest,
  updateEntry,
};
