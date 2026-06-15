#!/usr/bin/env node
/** Fail if any relative import under src/ (excl tests) does not resolve. */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src');
const EXTS = ['.jsx', '.js', '.tsx', '.ts', '.cjs', '.mjs', '.json', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === '__tests__') continue;
      walk(p, out);
    } else if (/\.(jsx?|tsx?)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function resolves(fromFile, spec) {
  if (!spec.startsWith('.')) return true;
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const ext of EXTS) {
    if (fs.existsSync(base + ext)) return true;
  }
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return true;
  return false;
}

const importRe = /(?:import\s+[\s\S]*?\s+from\s+|require\s*\(\s*)['"](\.[^'"]+)['"]/g;
const broken = [];

for (const file of walk(SRC)) {
  const raw = fs.readFileSync(file, 'utf8');
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  let m;
  importRe.lastIndex = 0;
  while ((m = importRe.exec(src)) !== null) {
    if (!resolves(file, m[1])) {
      broken.push({ file: path.relative(path.join(SRC, '..'), file), spec: m[1] });
    }
  }
}

if (!broken.length) {
  console.log('✅ All relative imports under src/ resolve.\n');
  process.exit(0);
}

console.log(`❌ ${broken.length} broken import(s):\n`);
for (const b of broken) console.log(`  ${b.file}\n    ${b.spec}`);
process.exit(1);
