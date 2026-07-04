/**
 * Find client users whose profile contains a real name (e.g. "Cade") but TrainerApp
 * would show "cc", "Client", or another wrong label.
 *
 * Usage:
 *   node scripts/findTrainerClientNameMismatch.js
 *   node scripts/findTrainerClientNameMismatch.js --search cade
 *   node scripts/findTrainerClientNameMismatch.js --email cc@gmail.com
 *   node scripts/findTrainerClientNameMismatch.js --uid <firebaseUid>
 *   node scripts/findTrainerClientNameMismatch.js --json
 *   node scripts/findTrainerClientNameMismatch.js --fix   # writes healed name to users + CRM (dry-run unless --fix)
 *
 * Auth: scripts/lib/ensureFirebaseAdmin.js (service account JSON or gcloud ADC).
 */

const path = require('path');
const { admin, ROOT, ensureFirebaseAdminInitialized } = require('./lib/ensureFirebaseAdmin');
const {
  resolveTrainerClientDisplayName,
  explainTrainerClientDisplayName,
  isWeakClientDisplayName,
  isGenericClientDisplayName,
} = require('./lib/trainerClientDisplayName.cjs');

require('dotenv').config({ path: path.join(ROOT, '.env') });

const NAME_KEYS = [
  'name',
  'displayName',
  'fullName',
  'full_name',
  'firstName',
  'lastName',
  'givenName',
  'familyName',
  'preferredName',
  'preferred_name',
  'nickname',
  'clientName',
  'profileName',
  'legalName',
  'userName',
  'username',
  'email',
  'userEmail',
  'primaryEmail',
];

function parseArgs() {
  const argv = process.argv.slice(2);
  const flags = {
    search: 'cade',
    email: null,
    uid: null,
    json: argv.includes('--json'),
    fix: argv.includes('--fix'),
    allRoster: argv.includes('--all-roster'),
  };
  const searchIdx = argv.indexOf('--search');
  if (searchIdx >= 0 && argv[searchIdx + 1]) flags.search = argv[searchIdx + 1];
  const emailIdx = argv.indexOf('--email');
  if (emailIdx >= 0 && argv[emailIdx + 1]) flags.email = argv[emailIdx + 1];
  const uidIdx = argv.indexOf('--uid');
  if (uidIdx >= 0 && argv[uidIdx + 1]) flags.uid = argv[uidIdx + 1];
  return flags;
}

function pickNameFields(record) {
  const out = {};
  for (const k of NAME_KEYS) {
    const v = record?.[k];
    if (v != null && String(v).trim() !== '') out[k] = String(v).trim();
  }
  return out;
}

function recordContainsNeedle(record, needle) {
  if (!needle) return true;
  const n = String(needle).trim().toLowerCase();
  if (!n) return true;
  for (const k of NAME_KEYS) {
    const v = String(record?.[k] ?? '').toLowerCase();
    if (v.includes(n)) return true;
  }
  return false;
}

function findBestProfileName(userData = {}, authInfo = null) {
  const parts = [
    userData.name,
    userData.displayName,
    userData.fullName,
    [userData.firstName, userData.lastName].filter(Boolean).join(' ').trim(),
    userData.firstName,
    userData.givenName,
    userData.nickname,
    userData.preferredName,
    authInfo?.displayName,
  ];
  for (const raw of parts) {
    const t = String(raw ?? '').trim();
    if (!t) continue;
    if (isGenericClientDisplayName(t)) continue;
    if (isWeakClientDisplayName(t)) continue;
    return t;
  }
  return null;
}

function isBadTrainerLabel(resolved) {
  const t = String(resolved ?? '').trim().toLowerCase();
  return t === 'client' || t === 'cc' || isWeakClientDisplayName(t);
}

async function loadAuthByUid(auth, uid) {
  try {
    const u = await auth.getUser(uid);
    return {
      email: u.email || null,
      displayName: u.displayName || null,
      phoneNumber: u.phoneNumber || null,
    };
  } catch (_) {
    return null;
  }
}

async function scanTrainerRoster(db) {
  const rows = [];
  const snap = await db.collectionGroup('clients').get();
  snap.forEach((docSnap) => {
    const refPath = docSnap.ref.path;
    const parts = refPath.split('/');
    if (parts.length !== 4 || parts[0] !== 'trainer_clients' || parts[2] !== 'clients') return;
    rows.push({
      trainerId: parts[1],
      clientId: docSnap.id,
      crm: { id: docSnap.id, ...docSnap.data() },
      crmPath: refPath,
    });
  });
  return rows;
}

async function main() {
  const flags = parseArgs();
  const { source, projectId } = await ensureFirebaseAdminInitialized();
  const db = admin.firestore();
  const auth = admin.auth();

  console.log(`Firebase project: ${projectId}`);
  console.log(`Admin credentials: ${source}`);
  console.log(`Search needle: "${flags.search}"${flags.email ? ` | email: ${flags.email}` : ''}${flags.uid ? ` | uid: ${flags.uid}` : ''}`);
  if (flags.fix) console.log('⚠️  --fix enabled: will merge healed names into users + trainer_clients CRM rows');
  console.log('');

  let roster = await scanTrainerRoster(db);
  if (flags.uid) {
    roster = roster.filter((r) => r.clientId === flags.uid);
  }

  const matches = [];
  const seenClientIds = new Set();

  for (const row of roster) {
    const { trainerId, clientId, crm, crmPath } = row;
    seenClientIds.add(clientId);

    const userSnap = await db.collection('users').doc(clientId).get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const authInfo = await loadAuthByUid(auth, clientId);

    const email = userData.email || userData.userEmail || authInfo?.email || crm.email || null;
    if (flags.email && String(email || '').toLowerCase() !== String(flags.email).toLowerCase()) {
      continue;
    }

    const profileNames = pickNameFields(userData);
    const crmNames = pickNameFields(crm);
    const explanation = explainTrainerClientDisplayName(crm, userData);
    const resolved = explanation.resolved;
    const bestProfileName = findBestProfileName(userData, authInfo);
    const hasNeedle =
      recordContainsNeedle(userData, flags.search) ||
      recordContainsNeedle(crm, flags.search) ||
      recordContainsNeedle(authInfo || {}, flags.search);

    const mismatch =
      flags.allRoster
        ? isBadTrainerLabel(resolved) && !!bestProfileName
        : hasNeedle &&
          (isBadTrainerLabel(resolved) ||
            String(resolved).toLowerCase() === 'cc' ||
            (bestProfileName && bestProfileName.toLowerCase() !== String(resolved).toLowerCase()));

    if (!mismatch && !flags.allRoster && !hasNeedle) continue;
    if (flags.allRoster && !mismatch) continue;

    const entry = {
      clientId,
      trainerId,
      crmPath,
      email,
      authDisplayName: authInfo?.displayName || null,
      profileNames,
      crmNames,
      resolvedTrainerAppName: resolved,
      resolverWinner: explanation.winner,
      resolverWinnerValue: explanation.winnerValue,
      suggestedFixName: bestProfileName || authInfo?.displayName || null,
      authHasNameFirestoreMissing:
        !!authInfo?.displayName &&
        !isWeakClientDisplayName(authInfo.displayName) &&
        !findBestProfileName(userData, null),
      trainerAppShowsWrongLabel: isBadTrainerLabel(resolved) && !!bestProfileName && bestProfileName.toLowerCase() !== String(resolved).toLowerCase(),
      resolverTrace: explanation.evaluations,
    };

    matches.push(entry);

    if (!flags.json) {
      console.log('─'.repeat(72));
      console.log(`Client UID:     ${clientId}`);
      console.log(`Trainer UID:    ${trainerId}`);
      console.log(`CRM path:       ${crmPath}`);
      console.log(`Email:          ${email || '—'}`);
      console.log(`Auth display:   ${authInfo?.displayName || '—'}`);
      console.log(`TrainerApp shows: "${resolved}"  (via ${explanation.winner}${explanation.winnerValue ? ` = "${explanation.winnerValue}"` : ''})`);
      if (bestProfileName) console.log(`Best profile name: "${bestProfileName}"`);
      if (entry.authHasNameFirestoreMissing) {
        console.log('⚠️  Auth has displayName but Firestore users doc is missing name fields');
      }
      console.log('Profile name fields:', JSON.stringify(profileNames, null, 2));
      if (Object.keys(crmNames).length) console.log('CRM name fields:', JSON.stringify(crmNames, null, 2));
      console.log('Resolver trace:');
      for (const ev of explanation.evaluations) {
        const flagsTxt = [
          ev.usable ? 'USABLE' : null,
          ev.generic ? 'generic' : null,
          ev.weak ? 'weak' : null,
        ].filter(Boolean).join(', ');
        console.log(`  ${ev.key.padEnd(28)} ${JSON.stringify(ev.raw)}  [${flagsTxt || 'empty'}]`);
      }
    }

    if (flags.fix && entry.suggestedFixName && (entry.trainerAppShowsWrongLabel || entry.authHasNameFirestoreMissing)) {
      const healed = entry.suggestedFixName;
      await db.collection('users').doc(clientId).set(
        { name: healed, displayName: healed, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      await db.doc(crmPath).set(
        { name: healed, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      if (!flags.json) console.log(`✅ Fixed → wrote name "${healed}" to users/${clientId} and ${crmPath}`);
      entry.fixed = healed;
    }
  }

  // Also scan users collection for "cade" not on any roster (informational)
  if (!flags.uid && !flags.email) {
    const usersSnap = await db.collection('users').get();
    const extra = [];
    usersSnap.forEach((docSnap) => {
      const uid = docSnap.id;
      if (seenClientIds.has(uid)) return;
      const data = docSnap.data() || {};
      if (!recordContainsNeedle(data, flags.search)) return;
      extra.push({
        clientId: uid,
        onTrainerRoster: false,
        profileNames: pickNameFields(data),
        resolvedWithoutCrm: resolveTrainerClientDisplayName({}, data),
      });
    });
    if (extra.length && !flags.json) {
      console.log('\n' + '─'.repeat(72));
      console.log(`Users matching "${flags.search}" but NOT on any trainer_clients roster (${extra.length}):`);
      for (const e of extra.slice(0, 10)) {
        console.log(`  ${e.clientId}  resolved=${e.resolvedWithoutCrm}  ${JSON.stringify(e.profileNames)}`);
      }
      if (extra.length > 10) console.log(`  … and ${extra.length - 10} more`);
    }
    matches.push(...extra.map((e) => ({ ...e, note: 'not_on_roster' })));
  }

  console.log('\n' + '═'.repeat(72));
  console.log(`Done. ${matches.filter((m) => m.trainerAppShowsWrongLabel).length} roster mismatch(es), ${matches.length} total match row(s).`);

  if (flags.json) {
    console.log(JSON.stringify({ projectId, matches }, null, 2));
  } else if (!matches.length) {
    console.log(`No rows matched. Try: node scripts/findTrainerClientNameMismatch.js --search cade --all-roster`);
    console.log(`Or:     node scripts/findTrainerClientNameMismatch.js --email cc@gmail.com`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
