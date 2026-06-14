/**
 * Find users who signed up / onboarded as clients but have no matching registry doc.
 *
 * Compares:
 *   - users/{uid}  (role === 'client', optional onboardingCompleted filter)
 *   - clients/{uid}  (top-level CRM / client registry)
 *   - trainer_clients/{trainerId}/clients/{uid}  (trainer roster links, via collectionGroup)
 *
 * Auth: same as restoreUserByEmail.js (server/*firebase-adminsdk*.json or gcloud ADC).
 *
 * Usage:
 *   node scripts/auditMissingClientDocs.js
 *   node scripts/auditMissingClientDocs.js --include-incomplete-onboarding
 *   node scripts/auditMissingClientDocs.js --json > missing-clients.json
 *   node scripts/auditMissingClientDocs.js --only-missing-registry
 *
 * Options:
 *   --include-incomplete-onboarding   Include users with role client but onboardingCompleted !== true
 *   --only-missing-registry           Only list users missing clients/{uid} (ignore trainer roster)
 *   --json                            Print machine-readable report to stdout
 *   --limit N                         Cap how many user docs are scanned (debug)
 */

const path = require('path');
const { admin, ROOT, ensureFirebaseAdminInitialized } = require('./lib/ensureFirebaseAdmin');

require('dotenv').config({ path: path.join(ROOT, '.env') });

function parseArgs() {
  const argv = process.argv.slice(2);
  const flags = {
    includeIncompleteOnboarding: argv.includes('--include-incomplete-onboarding'),
    onlyMissingRegistry: argv.includes('--only-missing-registry'),
    json: argv.includes('--json'),
    limit: null,
  };
  const limitIdx = argv.indexOf('--limit');
  if (limitIdx >= 0 && argv[limitIdx + 1]) {
    const n = parseInt(argv[limitIdx + 1], 10);
    if (Number.isFinite(n) && n > 0) flags.limit = n;
  }
  return flags;
}

function normalizeRole(role) {
  const r = String(role || '')
    .trim()
    .toLowerCase();
  if (r === 'trainer' || r === 'coach') return 'trainer';
  if (r === 'client' || r === 'user' || r === 'member') return 'client';
  return r || 'unknown';
}

function isTruthyOnboarding(value) {
  return value === true || value === 'true' || value === 1;
}

/** trainer_clients/{trainerId}/clients/{clientUid} */
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

/**
 * All client UIDs linked under any trainer roster (collectionGroup name is "clients").
 * Skips top-level clients/{id} paths (only one segment after collection name).
 */
async function loadTrainerRosterClientIds(db) {
  const map = new Map(); // clientUid -> Set<trainerUid>
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

async function loadClientUsers(db, { requireOnboarding, limit }) {
  const users = [];
  let q = db.collection('users').where('role', '==', 'client');
  if (requireOnboarding) {
    q = q.where('onboardingCompleted', '==', true);
  }
  const snap = await q.get();
  snap.forEach((doc) => {
    const data = doc.data() || {};
    if (!requireOnboarding && !isTruthyOnboarding(data.onboardingCompleted)) {
      // still include if flag set — handled by query; for incomplete mode we use separate query below
    }
    users.push({
      uid: doc.id,
      email: data.email || null,
      name: data.name || data.displayName || null,
      role: normalizeRole(data.role),
      onboardingCompleted: isTruthyOnboarding(data.onboardingCompleted),
      trainerId: data.trainerId || null,
      createdAt: data.createdAt || data.created_at || null,
      onboardingCompletedAt: data.onboardingCompletedAt || null,
    });
  });

  if (!requireOnboarding) {
    // Also pick up role=client without the onboarding index combo (already got all role=client)
    users.sort((a, b) => String(a.email || '').localeCompare(String(b.email || '')));
  }

  if (limit != null) return users.slice(0, limit);
  return users;
}

async function loadClientUsersIncludingIncomplete(db, limit) {
  const snap = await db.collection('users').where('role', '==', 'client').get();
  const users = [];
  snap.forEach((doc) => {
    const data = doc.data() || {};
    users.push({
      uid: doc.id,
      email: data.email || null,
      name: data.name || data.displayName || null,
      role: normalizeRole(data.role),
      onboardingCompleted: isTruthyOnboarding(data.onboardingCompleted),
      trainerId: data.trainerId || null,
      createdAt: data.createdAt || data.created_at || null,
      onboardingCompletedAt: data.onboardingCompletedAt || null,
    });
  });
  if (limit != null) return users.slice(0, limit);
  return users;
}

function buildReport(clientUsers, registryIds, trainerRosterMap, { onlyMissingRegistry }) {
  const missingRegistry = [];
  const missingRosterOnly = [];
  const missingBoth = [];
  const ok = [];

  for (const u of clientUsers) {
    const inRegistry = registryIds.has(u.uid);
    const trainers = trainerRosterMap.get(u.uid);
    const inRoster = trainers && trainers.size > 0;

    const row = {
      ...u,
      inClientsCollection: inRegistry,
      inTrainerRoster: inRoster,
      trainerRosterIds: inRoster ? [...trainers] : [],
      clientsDocPath: inRegistry ? `clients/${u.uid}` : null,
    };

    if (!inRegistry && !inRoster) {
      missingBoth.push(row);
    } else if (!inRegistry) {
      missingRegistry.push(row);
    } else if (!inRoster) {
      missingRosterOnly.push(row);
    } else {
      ok.push(row);
    }
  }

  if (onlyMissingRegistry) {
    return {
      summary: {
        clientUsersScanned: clientUsers.length,
        missingClientsCollection: missingRegistry.length + missingBoth.length,
        missingTrainerRoster: null,
        missingBoth: missingBoth.length,
        fullyLinked: null,
      },
      missingClientsCollection: [...missingRegistry, ...missingBoth],
      missingTrainerRosterOnly: [],
      missingBoth,
      ok: [],
    };
  }

  return {
    summary: {
      clientUsersScanned: clientUsers.length,
      topLevelClientsDocs: registryIds.size,
      trainerRosterClientLinks: trainerRosterMap.size,
      missingClientsCollection: missingRegistry.length + missingBoth.length,
      inTrainerRosterButNotClientsCollection: missingRegistry.length,
      missingTrainerRosterOnly: missingRosterOnly.length,
      missingBothCollections: missingBoth.length,
      fullyPresent: ok.length,
    },
    missingClientsCollection: [...missingRegistry, ...missingBoth],
    missingTrainerRosterOnly: missingRosterOnly,
    missingBoth,
    ok,
  };
}

function printHumanReport(report, flags) {
  const s = report.summary;
  console.log('\n=== Coach Connect — client registry audit ===\n');
  console.log('Client users scanned:', s.clientUsersScanned);
  console.log('Top-level clients/{uid} docs:', s.topLevelClientsDocs);
  if (s.trainerRosterClientLinks != null) {
    console.log('Distinct clients in trainer_clients/.../clients:', s.trainerRosterClientLinks);
  }
  console.log('');
  console.log('Missing clients/{uid}:', s.missingClientsCollection);
  if (!flags.onlyMissingRegistry) {
    console.log('  (only in users — not in clients collection, but on a trainer roster):', s.inTrainerRosterButNotClientsCollection);
    console.log('  (in clients collection — not on any trainer roster):', s.missingTrainerRosterOnly);
    console.log('  (missing BOTH clients collection and trainer roster):', s.missingBothCollections);
    console.log('  (present in clients and on roster):', s.fullyPresent);
  }

  const list = report.missingClientsCollection;
  if (list.length === 0) {
    console.log('\n✅ Every scanned client user has a clients/{uid} document.\n');
    return;
  }

  console.log(`\n--- Users missing clients/{uid} (${list.length}) ---\n`);
  for (const row of list) {
    console.log(`uid: ${row.uid}`);
    console.log(`  email: ${row.email || '(none)'}`);
    console.log(`  name: ${row.name || '(none)'}`);
    console.log(`  onboardingCompleted: ${row.onboardingCompleted}`);
    console.log(`  users.trainerId: ${row.trainerId || '(none)'}`);
    console.log(`  in trainer roster: ${row.inTrainerRoster ? row.trainerRosterIds.join(', ') : 'no'}`);
    console.log('');
  }
}

async function main() {
  const flags = parseArgs();
  const requireOnboarding = !flags.includeIncompleteOnboarding;

  const authInfo = await ensureFirebaseAdminInitialized();
  console.log('Project:', authInfo.projectId);
  console.log('Auth:', authInfo.source);
  console.log(
    'Filter:',
    requireOnboarding
      ? 'role=client AND onboardingCompleted=true'
      : 'role=client (all, including incomplete onboarding)',
  );

  const db = admin.firestore();

  const [registryIds, trainerRosterMap] = await Promise.all([
    loadTopLevelClientIds(db),
    flags.onlyMissingRegistry ? Promise.resolve(new Map()) : loadTrainerRosterClientIds(db),
  ]);

  const clientUsers = requireOnboarding
    ? await loadClientUsers(db, { requireOnboarding: true, limit: flags.limit })
    : await loadClientUsersIncludingIncomplete(db, flags.limit);

  const report = buildReport(clientUsers, registryIds, trainerRosterMap, {
    onlyMissingRegistry: flags.onlyMissingRegistry,
  });
  report.generatedAt = new Date().toISOString();
  report.projectId = authInfo.projectId;

  if (flags.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    printHumanReport(report, flags);
  }

  const exitCode = report.missingClientsCollection.length > 0 ? 1 : 0;
  process.exit(exitCode);
}

main().catch((err) => {
  console.error('Audit failed:', err?.message || err);
  process.exit(1);
});
