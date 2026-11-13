// One-shot: replace joke / celebrity / garbage Firebase display names with plain example names.
// Flow: load users (+ trainers) → skip real teammate emails → assign unique John Doe–style names → write users, trainers, Auth.
// Run: node scripts/renameDemoUserNames.js
// Dry run: DRY_RUN=1 node scripts/renameDemoUserNames.js
//
// vocab: Auth displayName = Firebase Authentication profile name (separate from Firestore users doc)
// Manipulate here: EXAMPLE_NAMES pool; SKIP_EMAIL_RE for accounts that must keep their real names

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const admin = require('firebase-admin');
const { ensureFirebaseAdminInitialized } = require('./lib/ensureFirebaseAdmin');

// ===== NAMED CONSTANTS =====

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

// Keep teammate / owner accounts (Shane, Chris, Nancy) — everything else gets a clean demo name.
const SKIP_EMAIL_RE =
  /(shanemarion|shina|cshina@|christianshina|jozephshina|nancyshina|capchris|oakland\.edu|umich\.edu)/i;

// Manipulate here: plain example names for marketplace / inbox screenshots
const EXAMPLE_NAMES = [
  ['John', 'Doe'],
  ['Alex', 'Jones'],
  ['Jordan', 'Smith'],
  ['Sam', 'Taylor'],
  ['Riley', 'Brooks'],
  ['Avery', 'Quinn'],
  ['Morgan', 'Lee'],
  ['Casey', 'Nguyen'],
  ['Taylor', 'Reed'],
  ['Jamie', 'Patel'],
  ['Drew', 'Carter'],
  ['Cameron', 'Wright'],
  ['Harper', 'Kim'],
  ['Quinn', 'Bailey'],
  ['Reese', 'Foster'],
  ['Parker', 'Hayes'],
  ['Skyler', 'Bennett'],
  ['Rowan', 'Price'],
  ['Dakota', 'Coleman'],
  ['Emerson', 'Ross'],
  ['Finley', 'Griffin'],
  ['Hayden', 'Powell'],
  ['Kendall', 'Butler'],
  ['Logan', 'Simmons'],
  ['Micah', 'Perry'],
  ['Noah', 'Barnes'],
  ['Owen', 'Fisher'],
  ['Peyton', 'Henderson'],
  ['River', 'Crawford'],
  ['Sage', 'Dixon'],
  ['Tatum', 'Hunt'],
  ['Blair', 'West'],
  ['Charlie', 'Lane'],
  ['Devon', 'Stone'],
  ['Eden', 'Blake'],
  ['Frankie', 'Shaw'],
  ['Gray', 'Ford'],
  ['Indigo', 'Wells'],
  ['Jules', 'Burns'],
  ['Kai', 'Wade'],
  ['Lane', 'Holt'],
  ['Marley', 'Nash'],
  ['Nikita', 'Grant'],
  ['Oakley', 'Fox'],
  ['Phoenix', 'Dean'],
  ['Remy', 'Cole'],
  ['Sidney', 'Webb'],
  ['Terry', 'Walsh'],
  ['Val', 'Steele'],
  ['Winter', 'Boone'],
  ['Ash', 'Page'],
  ['Blake', 'Snow'],
  ['Chris', 'Hall'],
  ['Dana', 'Cross'],
  ['Ellis', 'Marsh'],
  ['Fran', 'York'],
  ['Gale', 'Knox'],
  ['Hugh', 'Vance'],
  ['Ira', 'Parks'],
  ['Jay', 'Rhodes'],
  ['Kim', 'Sloan'],
  ['Lee', 'Doyle'],
  ['Max', 'Burns'],
  ['Ned', 'Clay'],
  ['Ora', 'Frost'],
  ['Pat', 'Hahn'],
  ['Ray', 'Ives'],
  ['Sky', 'Jett'],
  ['Tom', 'Kline'],
  ['Uri', 'Lamb'],
  ['Vic', 'Moss'],
  ['Wes', 'Noon'],
  ['Xan', 'Owen'],
  ['Yan', 'Pike'],
  ['Zoe', 'Quill'],
];

// ===== HELPER FUNCTIONS =====

function emailOf(data) {
  return String(data?.email || '').trim().toLowerCase();
}

function currentLabel(data) {
  return (
    String(data?.displayName || data?.name || '').trim() ||
    [data?.firstName, data?.lastName].filter(Boolean).join(' ').trim() ||
    '(blank)'
  );
}

function shouldSkipUser(data) {
  const email = emailOf(data);
  if (email && SKIP_EMAIL_RE.test(email)) return true;
  return false;
}

function needsRename(data) {
  const label = currentLabel(data);
  if (label === '(blank)') return true;
  // Already a clean First Last from our pool — still ok to reassign unique ones; always rename jokes.
  return true;
}

function namePayload(firstName, lastName) {
  const displayName = `${firstName} ${lastName}`;
  return {
    firstName,
    lastName,
    name: displayName,
    displayName,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

async function updateAuthDisplayName(uid, displayName) {
  try {
    await admin.auth().updateUser(uid, { displayName });
    return true;
  } catch (error) {
    if (error?.code === 'auth/user-not-found') return false;
    throw error;
  }
}

// ===== MAIN FUNCTION =====

async function main() {
  await ensureFirebaseAdminInitialized();
  const db = admin.firestore();

  const usersSnap = await db.collection('users').get();
  console.log(`Loaded ${usersSnap.size} users. DRY_RUN=${DRY_RUN ? 'yes' : 'no'}`);

  const nameQueue = [...EXAMPLE_NAMES];
  let nameIndex = 0;
  const nextName = () => {
    if (nameIndex < nameQueue.length) return nameQueue[nameIndex++];
    // Overflow: generate Alex + number so we never collide.
    const n = nameIndex - nameQueue.length + 1;
    nameIndex += 1;
    return ['Alex', `Example${n}`];
  };

  const renames = [];
  for (const doc of usersSnap.docs) {
    const data = doc.data() || {};
    if (shouldSkipUser(data)) {
      console.log(`SKIP teammate  ${doc.id}  ${emailOf(data)}  "${currentLabel(data)}"`);
      continue;
    }
    if (!needsRename(data)) continue;

    const [firstName, lastName] = nextName();
    const payload = namePayload(firstName, lastName);
    renames.push({
      uid: doc.id,
      email: emailOf(data),
      from: currentLabel(data),
      to: payload.displayName,
      role: data.role || null,
      payload,
    });
  }

  console.log(`\nWill rename ${renames.length} users:\n`);
  for (const row of renames) {
    console.log(`  ${row.from.padEnd(28)} → ${row.to.padEnd(20)}  ${row.email || row.uid}`);
  }

  if (DRY_RUN) {
    console.log('\nDry run only — no writes.');
    process.exit(0);
  }

  let batch = db.batch();
  let ops = 0;
  const commitBatch = async () => {
    if (ops === 0) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  for (const row of renames) {
    batch.set(db.collection('users').doc(row.uid), row.payload, { merge: true });
    ops += 1;

    // Trainers collection often mirrors the same uid with its own name fields.
    const trainerRef = db.collection('trainers').doc(row.uid);
    batch.set(
      trainerRef,
      {
        name: row.payload.name,
        displayName: row.payload.displayName,
        firstName: row.payload.firstName,
        lastName: row.payload.lastName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    ops += 1;

    if (ops >= 400) await commitBatch();
  }
  await commitBatch();

  let authUpdated = 0;
  for (const row of renames) {
    const ok = await updateAuthDisplayName(row.uid, row.payload.displayName);
    if (ok) authUpdated += 1;
  }

  console.log(`\nDone. Firestore renamed ${renames.length}. Auth displayName updated ${authUpdated}.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
