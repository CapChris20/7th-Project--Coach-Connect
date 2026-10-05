/**
 * One-off dev script to ensure a Firestore user doc exists.
 *
 * Usage:
 *   node server/scripts/seedUserDoc.js <uid> [displayName]
 *
 * Example:
 *   node server/scripts/seedUserDoc.js SPHkiuTpEbX85ek8rgzLODpuF0r1 "Cade Cunnignham"
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
require('dotenv').config();

const admin = require('firebase-admin');

function ensureAdmin() {
  if (admin.apps.length) return;

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : require(path.join(__dirname, '..', 'serviceAccountKey.json'));

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function main() {
  const uid = process.argv[2];
  const displayNameArg = process.argv[3];

  if (!uid || typeof uid !== 'string' || uid.trim().length < 8) {
    // eslint-disable-next-line no-console
    console.error('Missing uid.\n\nUsage: node server/scripts/seedUserDoc.js <uid> [displayName]');
    process.exit(1);
  }

  ensureAdmin();
  const db = admin.firestore();

  const displayName = displayNameArg || 'User';
  const ref = db.collection('users').doc(uid.trim());

  await ref.set(
    {
      displayName,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      seededBy: 'server/scripts/seedUserDoc.js',
    },
    { merge: true }
  );

  const snap = await ref.get();

  // eslint-disable-next-line no-console
  console.log('✅ Seeded user doc:', { uid: ref.id, exists: snap.exists });
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('❌ Seed failed:', e?.message || e);
  process.exit(1);
});

