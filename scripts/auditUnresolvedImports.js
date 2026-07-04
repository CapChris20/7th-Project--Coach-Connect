#!/usr/bin/env node
/**
 * Find broken relative imports under src/ and auto-fix when the target file
 * exists elsewhere in the tree (common after feature-folder moves).
 *
 *   node scripts/auditUnresolvedImports.js          # report only
 *   node scripts/auditUnresolvedImports.js --fix    # apply fixes
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const FIX = process.argv.includes('--fix');

const EXTS = ['.jsx', '.js', '.tsx', '.ts'];
const INDEX_EXTS = EXTS.map((e) => `/index${e}`);
const ASSET_EXT = /\.(png|jpe?g|gif|webp|svg|json|mp3|mp4|ttf|otf|woff2?)$/i;

function isAssetSpec(spec) {
  return ASSET_EXT.test(spec) || spec.includes('/assets/');
}

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
  for (const ext of [...EXTS, ...INDEX_EXTS]) {
    const candidate = base + ext;
    if (fs.existsSync(candidate)) return { ok: true, resolved: candidate };
  }
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const ext of INDEX_EXTS) {
      const candidate = base + ext;
      if (fs.existsSync(candidate)) return { ok: true, resolved: candidate };
    }
  }
  return { ok: false, attempted: base };
}

/** basename (no ext) -> absolute file paths under src/ */
function buildBasenameIndex() {
  const index = new Map();
  for (const file of walk(SRC)) {
    const base = path.basename(file, path.extname(file));
    if (!index.has(base)) index.set(base, []);
    index.get(base).push(file);
  }
  return index;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function relImport(fromFile, targetFile) {
  let rel = toPosix(path.relative(path.dirname(fromFile), targetFile));
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel.replace(/\.(jsx?|tsx?)$/, '');
}

const basenameIndex = buildBasenameIndex();
const allFiles = walk(SRC);
const fixes = [];
const unresolved = [];

const importRe = /(?:import\s+[\s\S]*?\s+from\s+|export\s+[\s\S]*?\s+from\s+|require\s*\(\s*)['"](\.[^'"]+)['"]/g;

for (const file of allFiles) {
  const src = fs.readFileSync(file, 'utf8');
  let m;
  importRe.lastIndex = 0;
  while ((m = importRe.exec(src)) !== null) {
    const spec = m[1];
    if (isAssetSpec(spec)) continue;
    const check = resolveRelative(file, spec);
    if (check.ok) continue;

    const baseName = path.basename(spec);
    const stem = baseName.includes('.') ? baseName.replace(/\.[^.]+$/, '') : baseName;
    const candidates = basenameIndex.get(stem) || [];

    if (candidates.length === 1) {
      const target = candidates[0];
      const newSpec = relImport(file, target);
      if (newSpec !== spec) {
        fixes.push({
          file: path.relative(ROOT, file),
          from: spec,
          to: newSpec,
          target: path.relative(ROOT, target),
        });
      }
    } else if (candidates.length > 1) {
      unresolved.push({
        file: path.relative(ROOT, file),
        spec,
        reason: `ambiguous (${candidates.length} matches)`,
        candidates: candidates.map((c) => path.relative(ROOT, c)),
      });
    } else {
      unresolved.push({
        file: path.relative(ROOT, file),
        spec,
        reason: 'no file found',
      });
    }
  }
}

// Dedupe fixes per file+from
const deduped = [];
const seen = new Set();
for (const f of fixes) {
  const k = `${f.file}::${f.from}`;
  if (seen.has(k)) continue;
  seen.add(k);
  deduped.push(f);
}

console.log('\n🔍 Unresolved relative import audit\n');

if (deduped.length) {
  console.log(`✅ Auto-fixable (${deduped.length}):`);
  for (const f of deduped) {
    console.log(`  ${f.file}`);
    console.log(`    ${f.from}  →  ${f.to}`);
    console.log(`    (${f.target})`);
  }
  console.log('');
}

if (unresolved.length) {
  console.log(`⚠️  Manual review (${unresolved.length}):`);
  for (const u of unresolved.slice(0, 40)) {
    console.log(`  ${u.file}: "${u.spec}" — ${u.reason}`);
    if (u.candidates) console.log(`    ${u.candidates.join('\n    ')}`);
  }
  if (unresolved.length > 40) console.log(`  … and ${unresolved.length - 40} more`);
  console.log('');
}

if (FIX && deduped.length) {
  const byFile = new Map();
  for (const f of deduped) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }
  let changedFiles = 0;
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
      changedFiles += 1;
    }
  }
  console.log(`Applied fixes to ${changedFiles} file(s).\n`);
}

process.exit(unresolved.length && !deduped.length ? 1 : 0);
