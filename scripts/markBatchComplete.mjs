// Record a Metro-gated batch in scripts/full-rewrite/progress.json
// Usage: node scripts/markBatchComplete.mjs 1

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const progressPath = join(ROOT, 'scripts/full-rewrite/progress.json');
const batchNumber = Number(process.argv[2]);

if (!Number.isInteger(batchNumber) || batchNumber < 1) {
  console.error('Usage: node scripts/markBatchComplete.mjs <batchNumber>');
  process.exit(2);
}

const progress = JSON.parse(readFileSync(progressPath, 'utf8'));
const completed = new Set(progress.completedBatches || []);
completed.add(batchNumber);
progress.completedBatches = [...completed].sort((left, right) => left - right);
writeFileSync(progressPath, `${JSON.stringify(progress, null, 2)}\n`, 'utf8');
console.log(`Marked batch ${batchNumber} complete. Done: ${progress.completedBatches.join(', ')}`);
