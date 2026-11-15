// Mark a Variation 3 batch complete ONLY after the real gate passes.
// Usage: node scripts/markBatchComplete.mjs <batchNumber>
// Gate: classifyReadable (0 fails) + stripBatchGate (all CODE-MOVED).
// Metro export is required separately before calling this (see README).
// Human junior-recipe checklist is required by the agent before calling this.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const progressPath = join(ROOT, 'scripts/full-rewrite/progress.json');
const batchNumber = Number(process.argv[2]);
const forceFlag = process.argv.includes('--force-skip-gate');

if (!Number.isInteger(batchNumber) || batchNumber < 1) {
  console.error('Usage: node scripts/markBatchComplete.mjs <batchNumber>');
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

if (!forceFlag) {
  console.log(`Gate for batch ${batchNumber}: classifyReadable + stripBatchGate\n`);
  const gate = spawnSync('node', ['scripts/runBatchGate.mjs', String(batchNumber)], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (gate.status !== 0) {
    console.error(
      `\nRefusing to mark batch ${batchNumber} complete — gate failed.\n` +
        'Fix Variation 3 (classify + CODE-MOVED strip), then retry.\n' +
        'Do not use --force-skip-gate unless debugging tooling.',
    );
    process.exit(gate.status ?? 1);
  }
} else {
  console.warn('WARNING: --force-skip-gate used; progress may lie.');
}

const progress = JSON.parse(readFileSync(progressPath, 'utf8'));
const completed = new Set(progress.completedBatches || []);
completed.add(batchNumber);
progress.completedBatches = [...completed].sort((left, right) => left - right);
if (!progress.variation3Passed || typeof progress.variation3Passed !== 'object') {
  progress.variation3Passed = {};
}
progress.variation3Passed[String(batchNumber)] = relativePaths;
progress.notes =
  'Batch is complete only after classifyReadable + stripBatchGate CODE-MOVED + human junior-recipe read + Metro. Metro alone does not count.';
writeFileSync(progressPath, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');
console.log(
  `Marked batch ${batchNumber} Variation 3 complete (${relativePaths.length} files). Done: ${progress.completedBatches.join(', ')}`,
);
