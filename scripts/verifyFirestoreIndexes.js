#!/usr/bin/env node
/**
 * Ensures firestore.indexes.json defines composites required for scaled queries.
 * Run: npm run test:firestore-indexes
 */
const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '..', 'firestore.indexes.json');

/** @type {{ collectionGroup: string, fields: string[] }[]} */
const REQUIRED = [
  { collectionGroup: 'nutrition_logs', fields: ['user_id', 'date'] },
  { collectionGroup: 'nutrition_logs', fields: ['user_id', 'created_at'] },
  { collectionGroup: 'nutrition_logs', fields: ['userId', 'date'] },
  { collectionGroup: 'conversations', fields: ['participants', 'updatedAt'] },
  { collectionGroup: 'messages', fields: ['conversationId', 'timestamp'] },
  { collectionGroup: 'clients', fields: ['trainerId', 'updatedAt'] },
  { collectionGroup: 'completedWorkouts', fields: ['userId', 'completedAt'] },
];

function fieldKey(fields) {
  return (fields || [])
    .map((f) => {
      if (f.arrayConfig) return `${f.fieldPath}:array`;
      return `${f.fieldPath}:${f.order || ''}`;
    })
    .join('|');
}

function indexMatches(index, req) {
  if (index.collectionGroup !== req.collectionGroup) return false;
  const paths = (index.fields || []).map((f) => f.fieldPath);
  return req.fields.every((f) => paths.includes(f));
}

const raw = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
const indexes = raw.indexes || [];

let failed = 0;
console.log('Firestore index definitions\n');

for (const req of REQUIRED) {
  const ok = indexes.some((idx) => indexMatches(idx, req));
  if (ok) {
    console.log(`✅ PASS  ${req.collectionGroup} — ${req.fields.join(' + ')}`);
  } else {
    console.log(`❌ FAIL  ${req.collectionGroup} — missing ${req.fields.join(' + ')}`);
    failed += 1;
  }
}

const hasMsgDesc = indexes.some(
  (idx) =>
    idx.collectionGroup === 'messages' &&
    fieldKey(idx.fields).includes('conversationId') &&
    fieldKey(idx.fields).includes('timestamp:DESCENDING'),
);
if (hasMsgDesc) {
  console.log('✅ PASS  messages — conversationId + timestamp DESC');
} else {
  console.log('❌ FAIL  messages — conversationId + timestamp DESC');
  failed += 1;
}

console.log('');
if (failed > 0) {
  console.log(`${failed} required index(es) missing. Deploy: firebase deploy --only firestore:indexes --project anatrox-auth`);
  process.exit(1);
}
console.log('All required Firestore composite indexes are declared.');
