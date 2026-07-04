#!/usr/bin/env node
/**
 * Aggressive pass: resolve every broken relative import/require under src/
 * by locating the target file anywhere in src/ (or src/assets).
 *
 *   node scripts/fixAllBrokenImports.js          # report
 *   node scripts/fixAllBrokenImports.js --fix    # apply
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const FIX = process.argv.includes('--fix');

const CODE_EXTS = ['.jsx', '.js', '.tsx', '.ts'];
const ALL_EXTS = [...CODE_EXTS, '.json', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', '.git', '__MACOSX'].includes(ent.name)) continue;
      walk(p, out);
    } else if (/\.(jsx?|tsx?)$/.test(ent.name)) {
      out.push(p);
    }
  }
  return out;
}

function resolveRelative(fromFile, spec) {
  if (!spec.startsWith('.')) return { ok: true };
  const base = path.resolve(path.dirname(fromFile), spec);
  for (const ext of ALL_EXTS) {
    const c = base + ext;
    if (fs.existsSync(c)) return { ok: true, resolved: c };
  }
  for (const ext of CODE_EXTS.map((e) => `/index${e}`)) {
    const c = base + ext;
    if (fs.existsSync(c)) return { ok: true, resolved: c };
  }
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const ext of CODE_EXTS.map((e) => `/index${e}`)) {
      const c = base + ext;
      if (fs.existsSync(c)) return { ok: true, resolved: c };
    }
  }
  return { ok: false };
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function relImport(fromFile, targetFile) {
  let rel = toPosix(path.relative(path.dirname(fromFile), targetFile));
  if (!rel.startsWith('.')) rel = `./${rel}`;
  const ext = path.extname(targetFile).toLowerCase();
  if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
    return rel.replace(/\.(jsx?|tsx?)$/, '');
  }
  return rel;
}

/** stem -> [abs paths] */
function buildIndex() {
  const index = new Map();
  function indexFile(file) {
    const stem = path.basename(file, path.extname(file));
    if (!index.has(stem)) index.set(stem, []);
    index.get(stem).push(file);
  }
  walk(SRC, []).forEach(indexFile);
  // also index asset files under src/assets and src/shared/assets
  for (const dir of [path.join(SRC, 'assets'), path.join(SRC, 'shared', 'assets')]) {
    if (!fs.existsSync(dir)) continue;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
      if (ent.isFile()) indexFile(path.join(ent.parentPath || dir, ent.name));
    }
  }
  return index;
}

const basenameIndex = buildIndex();
const importRe = /(?:import\s+[\s\S]*?\s+from\s+|export\s+[\s\S]*?\s+from\s+|require\s*\(\s*)['"](\.[^'"]+)['"]/g;

const fixes = [];
const unresolved = [];

for (const file of walk(SRC)) {
  const relFile = path.relative(ROOT, file);
  if (relFile.startsWith('__tests__')) continue;

  const src = fs.readFileSync(file, 'utf8');
  let m;
  importRe.lastIndex = 0;
  while ((m = importRe.exec(src)) !== null) {
    const spec = m[1];
    if (resolveRelative(file, spec).ok) continue;

    const baseName = path.basename(spec);
    const stem = baseName.includes('.') ? baseName.replace(/\.[^.]+$/, '') : baseName;
    let candidates = basenameIndex.get(stem) || [];

    // prefer same extension if spec had one
    const specExt = path.extname(spec);
    if (specExt && candidates.length > 1) {
      const filtered = candidates.filter((c) => path.extname(c).toLowerCase() === specExt.toLowerCase());
      if (filtered.length) candidates = filtered;
    }

    if (candidates.length === 1) {
      const newSpec = relImport(file, candidates[0]);
      if (newSpec !== spec) {
        fixes.push({ file: relFile, from: spec, to: newSpec, target: path.relative(ROOT, candidates[0]) });
      }
    } else if (candidates.length > 1) {
      unresolved.push({ file: relFile, spec, reason: 'ambiguous', candidates: candidates.map((c) => path.relative(ROOT, c)) });
    } else {
      unresolved.push({ file: relFile, spec, reason: 'missing' });
    }
  }
}

const deduped = [];
const seen = new Set();
for (const f of fixes) {
  const k = `${f.file}::${f.from}`;
  if (seen.has(k)) continue;
  seen.add(k);
  deduped.push(f);
}

console.log(`\n🔧 fixAllBrokenImports — ${deduped.length} fixable, ${unresolved.length} unresolved\n`);

if (deduped.length) {
  for (const f of deduped.slice(0, 60)) {
    console.log(`  ${f.file}\n    ${f.from} → ${f.to}`);
  }
  if (deduped.length > 60) console.log(`  … +${deduped.length - 60} more`);
}

if (unresolved.length) {
  console.log(`\n⚠️  Unresolved (${unresolved.length}):`);
  for (const u of unresolved.slice(0, 25)) {
    console.log(`  ${u.file}: "${u.spec}" (${u.reason})`);
    if (u.candidates) u.candidates.forEach((c) => console.log(`    - ${c}`));
  }
}

if (FIX && deduped.length) {
  const byFile = new Map();
  for (const f of deduped) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }
  let n = 0;
  for (const [relFile, fileFixes] of byFile) {
    const abs = path.join(ROOT, relFile);
    let text = fs.readFileSync(abs, 'utf8');
    const orig = text;
    for (const f of fileFixes) {
      text = text.split(`'${f.from}'`).join(`'${f.to}'`);
      text = text.split(`"${f.from}"`).join(`"${f.to}"`);
    }
    if (text !== orig) {
      fs.writeFileSync(abs, text);
      n += 1;
    }
  }
  console.log(`\n✅ Updated ${n} file(s).\n`);
}

process.exit(unresolved.length && !deduped.length ? 1 : 0);
