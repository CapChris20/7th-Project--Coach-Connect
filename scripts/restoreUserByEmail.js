/**
 * Recreate `users/{uid}` in Firestore when the Firebase Auth user still exists
 * (e.g. you deleted the Firestore doc in the console by mistake).
 *
 * Does NOT recover subcollections (aiChats, notes_and_files, …) if they were
 * deleted with the user doc or via recursive delete — only the top-level user profile.
 *
 * If you used in-app "Delete Account", Auth was deleted too — this script cannot
 * restore that. Sign up again with the same email, then run this script, OR use
 * Google Cloud / Firestore point-in-time recovery if you had it enabled.
 *
 * Auth (pick one — never commit keys to git):
 *   - Existing key under server/ (any *firebase-adminsdk*.json — gitignored), OR
 *   - serviceAccountKey.json in project root, OR
 *   - GOOGLE_APPLICATION_CREDENTIALS=/abs/path/to-adminsdk-xxxxx.json, OR
 *   - FIREBASE_SERVICE_ACCOUNT_PATH=/abs/path/to.json, OR
 *   - Application Default Credentials: install Google Cloud SDK, then:
 *       gcloud auth application-default login
 *       gcloud config set project anatrox-auth
 *     (Project ID is taken from .env EXPO_PUBLIC_FIREBASE_PROJECT_ID or defaults to anatrox-auth.)
 *
 * Usage:
 *   node scripts/restoreUserByEmail.js cc@gmail.com
 *   node scripts/restoreUserByEmail.js cc@gmail.com client
 *   node scripts/restoreUserByEmail.js cc@gmail.com trainer
 *   node scripts/restoreUserByEmail.js cc@gmail.com client --fresh-onboarding
 */

const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const ROOT = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT, '.env') });

function firebaseProjectId() {
  return (
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    'anatrox-auth'
  ).trim();
}

function resolveEnvPath(p) {
  if (!p) return null;
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
}

/** Prefer existing repo keys: server/*firebase-adminsdk*.json (see .gitignore). */
function discoverServerAdminSdkPaths() {
  const dir = path.join(ROOT, 'server');
  const out = [];
  try {
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.json')) continue;
      if (!name.includes('firebase-adminsdk')) continue;
      out.push(path.join(dir, name));
    }
  } catch (_) {
    /* ignore */
  }
  return out.sort();
}

/** Try service-account JSON files; returns { credential, source } or { credential: null, checked }. */
function tryLoadServiceAccountJson() {
  const paths = [];
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const fsp = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (gac) paths.push(resolveEnvPath(gac));
  if (fsp) paths.push(resolveEnvPath(fsp));
  paths.push(...discoverServerAdminSdkPaths());
  paths.push(path.join(ROOT, 'serviceAccountKey.json'));
  paths.push(path.join(ROOT, 'functions', 'serviceAccountKey.json'));

  const checked = [...new Set(paths.filter(Boolean))];

  for (const finalAbs of checked) {
    if (!fs.existsSync(finalAbs)) continue;
    try {
      const raw = fs.readFileSync(finalAbs, 'utf8');
      const json = JSON.parse(raw);
      return { credential: admin.credential.cert(json), source: finalAbs, checked };
    } catch (_) {
      continue;
    }
  }
  return { credential: null, checked };
}

function printCredentialHelp(checkedPaths) {
  const pid = firebaseProjectId();
  console.error(`
Could not load Firebase Admin credentials.

Checked (missing or invalid):
${checkedPaths.map((p) => `  - ${p}`).join('\n')}

Option A — Service account JSON (recommended for this script)
  • This script auto-loads: server/*firebase-adminsdk*.json (if present)
  • Or place/copy a key as: ${path.join(ROOT, 'serviceAccountKey.json')}
  • Or: export GOOGLE_APPLICATION_CREDENTIALS="/full/path/to/your-key.json"
  New key from Firebase (only if you have no file yet):
  1) Console → ${pid} → Project settings → Service accounts → Generate new private key
  2) Save under server/ or project root as above (never commit; pattern is gitignored).

Option B — gcloud Application Default Credentials (no JSON file in repo)
  1) Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install
  2) Run:
       gcloud config set project ${pid}
       gcloud auth application-default login
     On the Google consent page, accept **all** requested permissions (including Cloud Platform).
     If the browser flow fails, try:  gcloud auth application-default login --no-browser
  3) Run this script again (it will try ADC automatically).

If you saw: "cloud-platform scope is required but not consented" — ADC never saved; run login again
and complete consent, or use Option A instead (JSON key is more reliable for one-off scripts).
`);
}

async function ensureFirebaseAdminInitialized() {
  const jsonTry = tryLoadServiceAccountJson();
  if (jsonTry.credential) {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: jsonTry.credential });
    }
    console.log('Auth source:', jsonTry.source);
    return;
  }

  const pid = firebaseProjectId();
  try {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: pid,
      });
    }
    await admin.auth().listUsers(1);
    console.log('Auth source: application default credentials (projectId:', pid + ')');
  } catch (e) {
    printCredentialHelp(jsonTry.checked);
    console.error('\nADC / Auth probe failed:', e?.message || e);
    console.error(
      '\nTip: Firebase Admin almost always works immediately if you use Option A (download JSON from Firebase).\n'
    );
    process.exit(1);
  }
}

function parseArgs() {
  const argv = process.argv.slice(2).filter((a) => a !== '--fresh-onboarding');
  const freshOnboarding = process.argv.includes('--fresh-onboarding');
  const email = (argv[0] || '').trim().toLowerCase();
  const roleRaw = (argv[1] || 'client').trim().toLowerCase();
  const role = roleRaw === 'trainer' ? 'trainer' : 'client';
  return { email, role, freshOnboarding };
}

async function main() {
  const { email, role, freshOnboarding } = parseArgs();
  if (!email || !email.includes('@')) {
    console.error('Usage: node scripts/restoreUserByEmail.js <email> [client|trainer] [--fresh-onboarding]');
    process.exit(1);
  }

  await ensureFirebaseAdminInitialized();

  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(email);
  } catch (e) {
    const code = e?.errorInfo?.code || e?.code || '';
    if (String(code).includes('user-not-found')) {
      console.error(
        '\nNo Firebase Authentication user for that email.\n' +
          'The account was fully deleted (Auth + Firestore) or never existed.\n' +
          'Fix: sign up again in the app with that email, then run this script to ensure the Firestore profile exists,\n' +
          '     or restore from a Google Cloud / Firestore backup if you use one.\n'
      );
      process.exit(2);
    }
    throw e;
  }

  const uid = userRecord.uid;
  const db = admin.firestore();
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`users/${uid} already exists. No write performed.`);
    console.log('Current role:', snap.get('role'), 'onboardingCompleted:', snap.get('onboardingCompleted'));
    process.exit(0);
  }

  const name =
    (userRecord.displayName && String(userRecord.displayName).trim()) ||
    email.split('@')[0] ||
    'User';

  const payload = {
    uid,
    email: userRecord.email || email,
    name,
    role,
    onboardingCompleted: freshOnboarding ? false : true,
    ...(freshOnboarding
      ? {}
      : {
          onboardingCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
        }),
    createdAt: new Date().toISOString(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    authProvider: userRecord.providerData?.some((p) => p.providerId === 'google.com') ? 'google' : 'password',
    restoredAt: admin.firestore.FieldValue.serverTimestamp(),
    restoredNote: 'Firestore user doc recreated by scripts/restoreUserByEmail.js',
  };

  if (userRecord.photoURL) {
    payload.photoURL = userRecord.photoURL;
  }

  await ref.set(payload, { merge: true });
  console.log('\nDone. Recreated users/' + uid);
  console.log('Email:', payload.email, '| Role:', role, '| onboardingCompleted:', payload.onboardingCompleted);
  if (freshOnboarding) {
    console.log('User will see onboarding again (--fresh-onboarding).');
  } else {
    console.log('User should load the main app without onboarding (omit --fresh-onboarding to change).');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
