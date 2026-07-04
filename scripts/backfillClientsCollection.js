/**
 * Backfill top-level clients/{uid} from users/{uid} for every client missing a registry doc.
 *
 * Default is dry-run (no writes). Pass --execute to write to Firestore.
 *
 * Usage:
 *   node scripts/backfillClientsCollection.js
 *   node scripts/backfillClientsCollection.js --execute
 *   node scripts/backfillClientsCollection.js --execute --include-incomplete-onboarding
 *   node scripts/backfillClientsCollection.js --execute --limit 5
 *   node scripts/backfillClientsCollection.js --execute --overwrite
 *
 * Options:
 *   --execute                         Actually write (default: dry-run only)
 *   --include-incomplete-onboarding   Include role=client without onboardingCompleted
 *   --overwrite                       Merge into existing clients/{uid} (default: skip if exists)
 *   --limit N                         Max docs to write
 */

const path = require('path');
const { admin, ROOT, ensureFirebaseAdminInitialized } = require('./lib/ensureFirebaseAdmin');
const { buildClientRegistryDoc } = require('./lib/buildClientRegistryDoc');

require('dotenv').config({ path: path.join(ROOT, '.env') });

const BATCH_SIZE = 400;

function parseArgs() {
  const argv = process.argv.slice(2);
  return {
    execute: argv.includes('--execute'),
    overwrite: argv.includes('--overwrite'),
    includeIncompleteOnboarding: argv.includes('--include-incomplete-onboarding'),
    limit: (() => {
      const i = argv.indexOf('--limit');
      if (i < 0 || !argv[i + 1]) return null;
      const n = parseInt(argv[i + 1], 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    })(),
  };
}

function isTrainerRosterClientPath(refPath) {
  const parts = String(refPath || '').split('/');
  return (
    parts.length === 4 &&
    parts[0] === 'trainer_clients' &&
    parts[2] === 'clients' &&
    !!parts[1] &&
    !!parts[3]
  );
}

async function loadTopLevelClientIds(db) {
  const ids = new Set();
  const snap = await db.collection('clients').select().get();
  snap.forEach((doc) => ids.add(doc.id));
  return ids;
}

async function loadTrainerRosterClientIds(db) {
  const map = new Map();
  const snap = await db.collectionGroup('clients').select().get();
  snap.forEach((doc) => {
    if (!isTrainerRosterClientPath(doc.ref.path)) return;
    const parts = doc.ref.path.split('/');
    const trainerUid = parts[1];
    const clientUid = parts[3];
    if (!map.has(clientUid)) map.set(clientUid, new Set());
    map.get(clientUid).add(trainerUid);
  });
  return map;
}

async function loadClientUserDocs(db, requireOnboarding) {
  let q = db.collection('users').where('role', '==', 'client');
  if (requireOnboarding) {
    q = q.where('onboardingCompleted', '==', true);
  }
  const snap = await q.get();
  const rows = [];
  snap.forEach((doc) => {
    rows.push({ uid: doc.id, data: doc.data() || {} });
  });
  return rows;
}

async function main() {
  const flags = parseArgs();
  const requireOnboarding = !flags.includeIncompleteOnboarding;

  const authInfo = await ensureFirebaseAdminInitialized();
  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  console.log('Project:', authInfo.projectId);
  console.log('Mode:', flags.execute ? 'EXECUTE (writes enabled)' : 'DRY RUN (pass --execute to write)');
  console.log(
    'Users:',
    requireOnboarding ? 'role=client, onboardingCompleted=true' : 'role=client (all)',
  );

  const [existingClientIds, rosterMap, userRows] = await Promise.all([
    loadTopLevelClientIds(db),
    loadTrainerRosterClientIds(db),
    loadClientUserDocs(db, requireOnboarding),
  ]);

  const toWrite = [];
  let skippedExists = 0;
  let skippedLimit = 0;

  for (const { uid, data } of userRows) {
    if (!flags.overwrite && existingClientIds.has(uid)) {
      skippedExists += 1;
      continue;
    }

    const rosterTrainers = rosterMap.get(uid);
    const trainerId =
      data.trainerId ||
      (rosterTrainers && rosterTrainers.size > 0 ? [...rosterTrainers][0] : null);

    const payload = buildClientRegistryDoc(uid, data, {
      trainerId,
      FieldValue,
    });

    toWrite.push({ uid, email: data.email || null, name: payload.name, trainerId: payload.trainerId, payload });
  }

  let planned = toWrite;
  if (flags.limit != null && planned.length > flags.limit) {
    skippedLimit = planned.length - flags.limit;
    planned = planned.slice(0, flags.limit);
  }

  console.log('\nSummary:');
  console.log('  Client users scanned:', userRows.length);
  console.log('  Already in clients/:', skippedExists);
  console.log('  To backfill:', planned.length);
  if (skippedLimit) console.log('  Skipped (limit):', skippedLimit);

  if (planned.length === 0) {
    console.log('\nNothing to backfill.\n');
    process.exit(0);
  }

  console.log('\nPlanned writes:');
  for (const row of planned) {
    console.log(`  clients/${row.uid}  ${row.email || '(no email)'}  trainerId=${row.trainerId || '(none)'}`);
  }

  if (!flags.execute) {
    console.log('\nDry run complete. Re-run with --execute to apply.\n');
    process.exit(0);
  }

  console.log('\nWriting...\n');
  let written = 0;
  for (let i = 0; i < planned.length; i += BATCH_SIZE) {
    const chunk = planned.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const row of chunk) {
      const ref = db.collection('clients').doc(row.uid);
      batch.set(ref, row.payload, { merge: true });
    }
    await batch.commit();
    written += chunk.length;
    console.log(`  Committed batch: ${written}/${planned.length}`);
  }

  console.log(`\n✅ Backfilled ${written} document(s) in clients/.\n`);
  console.log('Re-run audit: node scripts/auditMissingClientDocs.js\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill failed:', err?.message || err);
  process.exit(1);
});
