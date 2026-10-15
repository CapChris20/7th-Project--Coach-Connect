// Compare comment-stripped source vs git HEAD for each path in batch list files.
// Exit 1 if any file is SAME-CODE (presentation pass). Used after full Variation 3 rewrites.
// Usage: node scripts/stripBatchGate.mjs scripts/full-rewrite/batch1a.txt [more lists...]

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const requireFromRepo = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), '../package.json'),
);
const { parse } = requireFromRepo('@babel/parser');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGINS = [
  'jsx',
  'classProperties',
  'optionalChaining',
  'nullishCoalescingOperator',
  'objectRestSpread',
  'exportDefaultFrom',
];

function strippedSource(sourceText) {
  const ast = parse(sourceText, {
    sourceType: 'unambiguous',
    plugins: PLUGINS,
    ranges: true,
  });
  const comments = [...(ast.comments || [])].sort((left, right) => left.start - right.start);
  let withoutComments = '';
  let cursor = 0;
  for (const comment of comments) {
    withoutComments += sourceText.slice(cursor, comment.start);
    cursor = comment.end;
  }
  withoutComments += sourceText.slice(cursor);
  return withoutComments.replace(/\s+/g, ' ').trim();
}

function pathsFromListFiles(listPaths) {
  const relPaths = [];
  for (const listPath of listPaths) {
    const absoluteListPath = listPath.startsWith('/') ? listPath : join(ROOT, listPath);
    const lines = readFileSync(absoluteListPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      relPaths.push(trimmed);
    }
  }
  return relPaths;
}

const listArgs = process.argv.slice(2);
if (listArgs.length === 0) {
  console.error('Usage: node scripts/stripBatchGate.mjs <batch-list.txt> [...]');
  process.exit(2);
}

const relativePaths = pathsFromListFiles(listArgs);
let movedCount = 0;
let sameCount = 0;
let problemCount = 0;

for (const rel of relativePaths) {
  const workPath = join(ROOT, rel);
  if (!existsSync(workPath)) {
    problemCount += 1;
    console.log(`MISSING\t${rel}`);
    continue;
  }
  const workText = readFileSync(workPath, 'utf8');
  let headText = '';
  try {
    headText = execSync(`git show HEAD:${rel}`, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    problemCount += 1;
    console.log(`NO-HEAD\t${rel}`);
    continue;
  }
  const headStripped = strippedSource(headText);
  const workStripped = strippedSource(workText);
  if (headStripped === workStripped) {
    sameCount += 1;
    console.log(`SAME-CODE\t${rel}`);
  } else {
    movedCount += 1;
    console.log(`CODE-MOVED\t${rel}`);
  }
}

console.log(`\nmoved ${movedCount}  same ${sameCount}  problems ${problemCount}`);
if (sameCount > 0 || problemCount > 0) {
  process.exit(1);
}
