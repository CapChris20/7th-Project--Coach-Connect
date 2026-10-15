// Moves every file tagged BACKEND in backend-split-proposal.json into a new
// backend/ subfolder next to where it already lives, and rewrites every
// relative import/require anywhere in src/ so the app still resolves to the
// same file at its new address.
//
// Two modes:
//   node scripts/applyBackendSplit.mjs            -> DRY RUN. Moves nothing.
//                                                     Prints every import line
//                                                     that would change, and
//                                                     writes a full report file.
//   node scripts/applyBackendSplit.mjs --apply    -> Actually moves files
//                                                     (git mv) and rewrites
//                                                     imports in place.
//
// How resolution works: for every relative import in every src file, we work
// out which real file on disk it currently points to (trying .js/.jsx/.native.js
// /.web.js/.ios.js/.android.js/index.js, same order Metro would). If that real
// file is one that's moving, we recompute the relative path from the importer's
// new location (it may also be moving) to the target's new location, and only
// touch the line if the path text actually changes.

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, resolve as resolvePath, extname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const APPLY = process.argv.includes('--apply');

const proposal = JSON.parse(
  readFileSync(join(ROOT, 'scripts/full-rewrite/backend-split-proposal.json'), 'utf8'),
);

function walk(dirPath) {
  const out = [];
  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name === '__tests__') continue;
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(fullPath));
    } else if (/\.(js|jsx)$/.test(entry.name)) {
      out.push(fullPath);
    }
  }
  return out;
}

const allAbsFiles = walk(SRC);
const allAbsFileSet = new Set(allAbsFiles);

// Build the move map: old absolute path -> new absolute path, for every file
// the classifier (plus our manual reads) put in the BACKEND bucket.
const moveMap = new Map();
for (const entry of proposal.BACKEND) {
  const oldAbs = join(ROOT, entry.relPath);
  const dir = dirname(oldAbs);
  const fileName = entry.relPath.split('/').pop();
  const newAbs = join(dir, 'backend', fileName);
  moveMap.set(oldAbs, newAbs);
}

const RESOLUTION_SUFFIXES = [
  '',
  '.js',
  '.jsx',
  '.native.js',
  '.web.js',
  '.ios.js',
  '.android.js',
  '/index.js',
  '/index.jsx',
];

// Given the file doing the importing and the text inside quotes, find which
// real file on disk that import currently points to (or null if it's a
// package import like 'react' or doesn't resolve to anything in src/).
function resolveSpecifier(importerAbsPath, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = resolvePath(dirname(importerAbsPath), specifier);
  for (const suffix of RESOLUTION_SUFFIXES) {
    const candidate = base + suffix;
    if (allAbsFileSet.has(candidate)) return candidate;
  }
  return null;
}

// Turn an absolute path back into a './relative' or '../relative' specifier,
// the same extensionless style this codebase already uses everywhere.
function toSpecifier(fromDir, toAbsPath) {
  const noExt = toAbsPath.replace(/\.(jsx|js)$/, '');
  let rel = relative(fromDir, noExt);
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

// Matches the quoted path inside import/export ... from '...', require('...'),
// and dynamic import('...') — the only places a module specifier can appear.
const IMPORT_LINE_PATTERN = /((?:from|require\(|import\()\s*)(['"])([^'"]+)(\2)/g;

const changesByFile = []; // { relPath, edits: [{old, new}], newContent }

for (const importerAbsPath of allAbsFiles) {
  const originalText = readFileSync(importerAbsPath, 'utf8');
  const importerMovesTo = moveMap.get(importerAbsPath) || importerAbsPath;
  const newImporterDir = dirname(importerMovesTo);

  let edits = [];
  const newText = originalText.replace(
    IMPORT_LINE_PATTERN,
    (fullMatch, prefix, quote, specifier) => {
      const resolvedOldTarget = resolveSpecifier(importerAbsPath, specifier);
      if (!resolvedOldTarget) return fullMatch; // package import or unresolved — leave alone

      const newTargetAbsPath = moveMap.get(resolvedOldTarget) || resolvedOldTarget;
      const importerMoving = moveMap.has(importerAbsPath);
      const targetMoving = moveMap.has(resolvedOldTarget);
      if (!importerMoving && !targetMoving) return fullMatch; // neither side moves — path still correct

      const newSpecifier = toSpecifier(newImporterDir, newTargetAbsPath);
      if (newSpecifier === specifier) return fullMatch; // path happens to still work

      edits.push({ old: specifier, new: newSpecifier });
      return `${prefix}${quote}${newSpecifier}${quote}`;
    },
  );

  if (edits.length > 0) {
    changesByFile.push({
      absPath: importerAbsPath,
      relPath: relative(ROOT, importerAbsPath),
      edits,
      newContent: newText,
    });
  }
}

// ---- Report (always printed, dry run or not) ----
console.log(`Files moving into backend/: ${moveMap.size}`);
console.log(`Files needing an import-path edit: ${changesByFile.length}`);
let totalEdits = 0;
for (const change of changesByFile) totalEdits += change.edits.length;
console.log(`Total import lines being rewritten: ${totalEdits}\n`);

let reportText = `Backend-split import rewrite ${APPLY ? '(APPLIED)' : '(DRY RUN — nothing moved yet)'}\n`;
reportText += `Files moving: ${moveMap.size}   Files with import edits: ${changesByFile.length}   Total edits: ${totalEdits}\n`;
reportText += '='.repeat(100) + '\n\n';
for (const change of changesByFile) {
  reportText += `${change.relPath}\n`;
  for (const edit of change.edits) {
    reportText += `   '${edit.old}'  ->  '${edit.new}'\n`;
  }
  reportText += '\n';
}
writeFileSync(join(ROOT, 'scripts/full-rewrite/backend-split-import-changes.txt'), reportText);
console.log('Full per-file edit list: scripts/full-rewrite/backend-split-import-changes.txt');

if (!APPLY) {
  console.log('\nDRY RUN ONLY — no files moved, no content changed. Re-run with --apply to execute.');
  process.exit(0);
}

// ---- Apply: write rewritten content, then git mv files into backend/ ----
console.log('\nApplying...');
for (const change of changesByFile) {
  writeFileSync(change.absPath, change.newContent);
}
let movedCount = 0;
for (const [oldAbs, newAbs] of moveMap) {
  mkdirSync(dirname(newAbs), { recursive: true });
  execSync(`git mv ${JSON.stringify(relative(ROOT, oldAbs))} ${JSON.stringify(relative(ROOT, newAbs))}`, {
    cwd: ROOT,
  });
  movedCount += 1;
}
console.log(`Moved ${movedCount} files into backend/ subfolders and rewrote ${totalEdits} import lines.`);
