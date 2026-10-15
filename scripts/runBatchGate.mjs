// Run mechanical + strip gates for one full-rewrite batch (40 files = Na + Nb lists).
// Usage: node scripts/runBatchGate.mjs 1

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const batchNumber = process.argv[2];

if (!batchNumber || !/^\d+$/.test(batchNumber)) {
  console.error('Usage: node scripts/runBatchGate.mjs <batchNumber>');
  process.exit(2);
}

const listA = join(ROOT, 'scripts/full-rewrite', `batch${batchNumber}a.txt`);
const listB = join(ROOT, 'scripts/full-rewrite', `batch${batchNumber}b.txt`);

if (!existsSync(listA) || !existsSync(listB)) {
  console.error(`Missing batch lists for batch ${batchNumber}`);
  process.exit(2);
}

function pathsFromList(absolutePath) {
  return readFileSync(absolutePath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

const relativePaths = [...pathsFromList(listA), ...pathsFromList(listB)];
console.log(`Batch ${batchNumber}: ${relativePaths.length} files\n--- classifyReadable ---`);

const classify = spawnSync('node', ['scripts/classifyReadable.mjs', ...relativePaths], {
  cwd: ROOT,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

process.stdout.write(classify.stdout || '');
process.stderr.write(classify.stderr || '');

if (classify.status !== 0) {
  console.error('\nclassifyReadable failed');
  process.exit(classify.status ?? 1);
}

console.log('\n--- stripBatchGate ---');
const strip = spawnSync(
  'node',
  ['scripts/stripBatchGate.mjs', `scripts/full-rewrite/batch${batchNumber}a.txt`, `scripts/full-rewrite/batch${batchNumber}b.txt`],
  { cwd: ROOT, encoding: 'utf8', stdio: 'inherit' },
);

process.exit(strip.status ?? 1);
