/**
 * Shared Firebase Admin init for one-off scripts (service account JSON or gcloud ADC).
 */
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const ROOT = path.join(__dirname, '..', '..');

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

Option A — Service account JSON
  • server/*firebase-adminsdk*.json (gitignored), or serviceAccountKey.json in project root
  • export GOOGLE_APPLICATION_CREDENTIALS="/full/path/to/key.json"

Option B — gcloud ADC
  gcloud config set project ${pid}
  gcloud auth application-default login
`);
}

async function ensureFirebaseAdminInitialized() {
  const jsonTry = tryLoadServiceAccountJson();
  if (jsonTry.credential) {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: jsonTry.credential });
    }
    return { source: jsonTry.source, projectId: firebaseProjectId() };
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
    return { source: 'application-default', projectId: pid };
  } catch (e) {
    printCredentialHelp(jsonTry.checked);
    console.error('\nADC failed:', e?.message || e);
    process.exit(1);
  }
}

module.exports = {
  admin,
  ROOT,
  firebaseProjectId,
  ensureFirebaseAdminInitialized,
};
