/**
 * Firebase Admin bootstrap for the Express server.
 * Matches script discovery: env JSON, GOOGLE_APPLICATION_CREDENTIALS,
 * server/serviceAccountKey.json, *firebase-adminsdk*.json, project root key, ADC.
 */
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const SERVER_DIR = path.join(__dirname, '..');
const ROOT = path.join(SERVER_DIR, '..');

function resolveEnvPath(p) {
  if (!p) return null;
  return path.isAbsolute(p) ? p : path.join(process.cwd(), p);
}

function firebaseProjectId() {
  return (
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    'anatrox-auth'
  ).trim();
}

function discoverServerAdminSdkPaths() {
  const out = [];
  try {
    if (!fs.existsSync(SERVER_DIR)) return out;
    for (const name of fs.readdirSync(SERVER_DIR)) {
      if (!name.endsWith('.json')) continue;
      if (!name.includes('firebase-adminsdk')) continue;
      out.push(path.join(SERVER_DIR, name));
    }
  } catch (_) {
    /* ignore */
  }
  return out.sort();
}

function candidateCredentialPaths() {
  const paths = [];
  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const fsp = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (gac) paths.push(resolveEnvPath(gac));
  if (fsp) paths.push(resolveEnvPath(fsp));
  paths.push(...discoverServerAdminSdkPaths());
  paths.push(path.join(SERVER_DIR, 'serviceAccountKey.json'));
  paths.push(path.join(ROOT, 'serviceAccountKey.json'));
  paths.push(path.join(ROOT, 'functions', 'serviceAccountKey.json'));
  return [...new Set(paths.filter(Boolean))];
}

/**
 * @returns {{ ok: boolean, source?: string, error?: string, checked?: string[] }}
 */
function tryInitializeFirebaseAdmin() {
  if (admin.apps.length) {
    return { ok: true, source: 'already-initialized' };
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw && typeof raw === 'string' && raw.trim().length > 0) {
    try {
      const serviceAccount = JSON.parse(raw);
      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      return { ok: true, source: 'FIREBASE_SERVICE_ACCOUNT' };
    } catch (e) {
      return {
        ok: false,
        error: `FIREBASE_SERVICE_ACCOUNT is not valid JSON: ${e?.message || e}`,
        checked: [],
      };
    }
  }

  const checked = candidateCredentialPaths();
  for (const finalAbs of checked) {
    if (!fs.existsSync(finalAbs)) continue;
    try {
      const json = JSON.parse(fs.readFileSync(finalAbs, 'utf8'));
      if (!json || json.type !== 'service_account') continue;
      admin.initializeApp({ credential: admin.credential.cert(json) });
      return { ok: true, source: finalAbs };
    } catch (_) {
      continue;
    }
  }

  try {
    const projectId = firebaseProjectId();
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
    return { ok: true, source: `application-default (${projectId})` };
  } catch (e) {
    return {
      ok: false,
      error: e?.message || String(e),
      checked,
    };
  }
}

function printInitFailureHelp(result) {
  const pid = firebaseProjectId();
  const keyHint = path.join(SERVER_DIR, 'serviceAccountKey.json');
  console.warn('⚠️ Firebase Admin not initialized — AI Coach, push, and /api/me need credentials.');
  if (result.error) console.warn(`   Reason: ${result.error}`);
  console.warn(`
   Quick fix (local dev):
   1. Firebase Console → Project Settings → Service accounts → Generate new private key
   2. Save as: ${keyHint}
   3. Restart: npm run server

   Or set in .env:
   FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/your-key.json

   Or: gcloud auth application-default login  (project: ${pid})
`);
  if (result.checked?.length) {
    console.warn('   Checked paths (missing or invalid):');
    result.checked.forEach((p) => console.warn(`     - ${p}`));
  }
}

module.exports = {
  admin,
  tryInitializeFirebaseAdmin,
  printInitFailureHelp,
  firebaseProjectId,
};
