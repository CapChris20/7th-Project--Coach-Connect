#!/usr/bin/env node
/** Find src files with zero inbound relative imports (heuristic dead-code audit). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const EXT = /\.(js|jsx|mjs|cjs)$/;
const IMPORT_RE =
  /(?:import\s+(?:[\w*\s{},$]+\s+from\s+)?|require\s*\(\s*|export\s+.*?\s+from\s+)['"]([^'"]+)['"]/g;

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) walk(abs, out);
    else if (EXT.test(name)) out.push(path.relative(ROOT, abs).replace(/\\/g, '/'));
  }
  return out;
}

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(ROOT, path.dirname(fromFile), spec);
  for (const c of [
    base,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
  ]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return path.relative(ROOT, c).replace(/\\/g, '/');
    }
  }
  return null;
}

const srcFiles = walk(SRC);
const srcSet = new Set(srcFiles);
const scanFiles = [
  ...srcFiles,
  ...fs.readdirSync(ROOT).filter((f) => EXT.test(f)).map((f) => f),
];

const inbound = new Map(srcFiles.map((f) => [f, []]));

for (const file of scanFiles) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) continue;
  const content = fs.readFileSync(abs, 'utf8');
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(content))) {
    const resolved = resolveImport(file, m[1]);
    if (resolved && srcSet.has(resolved)) inbound.get(resolved).push(file);
  }
}

// Entry points always "used"
for (const e of [
  'App.js',
  'src/app-start/AuthGate.js',
  'src/app-start/ClientApp.js',
  'src/app-start/TrainerApp.js',
  'src/Loader.js',
]) {
  if (srcSet.has(e)) inbound.get(e)?.push('ENTRY');
}

const unused = srcFiles.filter((f) => inbound.get(f).length === 0).sort();
const byTop = {};
for (const f of unused) {
  const top = f.replace(/^src\//, '').split('/')[0];
  if (!byTop[top]) byTop[top] = [];
  byTop[top].push(f);
}

const usedSharedUi = srcFiles.filter((f) => f.startsWith('src/shared-ui/') && inbound.get(f).length > 0);
const unusedSharedUi = srcFiles.filter((f) => f.startsWith('src/shared-ui/') && inbound.get(f).length === 0);

console.log('=== SUMMARY ===');
console.log(`Total src modules: ${srcFiles.length}`);
console.log(`Zero inbound imports: ${unused.length}`);
console.log(`shared-ui USED (${usedSharedUi.length}):`);
for (const f of usedSharedUi) console.log(`  ✓ ${f.replace(/^src\//, '')}`);
console.log(`shared-ui UNUSED (${unusedSharedUi.length}):`);
for (const f of unusedSharedUi) console.log(`  ✗ ${f.replace(/^src\//, '')}`);

console.log('\n=== UNUSED BY TOP FOLDER ===');
for (const [k, v] of Object.entries(byTop).sort()) {
  console.log(`\n[${k}] (${v.length})`);
  for (const f of v) console.log(`  ${f.replace(/^src\//, '')}`);
}
