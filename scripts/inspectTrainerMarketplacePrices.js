/**
 * Dump trainer marketplace pricing as stored in Firestore vs what the app shows.
 *
 * Price resolution (same as TrainerSearchScreen.getTrainerPrice):
 *   price → pricing.perMonth → rate
 *
 * How it authenticates (first working path wins):
 *   1) Firebase Admin — FIREBASE_SERVICE_ACCOUNT, *_PATH, GOOGLE_APPLICATION_CREDENTIALS,
 *      or server/serviceAccountKey.json
 *   2) Firebase Admin — Application Default Credentials (only if gcloud/ADC exists)
 *   3) Terminal-only (no app, no Firebase API key): if `gcloud` is installed and you're logged in:
 *        gcloud auth login
 *        gcloud config set project <same as EXPO_PUBLIC_FIREBASE_PROJECT_ID e.g. anatrox-auth>
 *      The script runs `gcloud auth print-access-token` and reads Firestore via REST (GCP IAM).
 *   4) Client path — FIREBASE_INSPECT_ID_TOKEN, or WEB_API_KEY + anonymous/email (see source).
 *
 * Usage:
 *   npm run inspect:trainer-prices
 *
 * Easiest terminal-only (no Expo app): install Google Cloud SDK (e.g. brew install --cask google-cloud-sdk), then:
 *   gcloud auth login
 *   gcloud config set project anatrox-auth
 */

const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

const admin = require('firebase-admin');

function firebaseProjectIdHint() {
  const pid = (
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.FIREBASE_PROJECT_ID ||
    ''
  ).trim();
  return pid || null;
}

/** Expo key is often restricted to iOS/Android — REST sign-in may need a web/dev key. */
function firebaseInspectApiKey() {
  return (
    (process.env.FIREBASE_INSPECT_WEB_API_KEY || '').trim() ||
    (process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '').trim()
  );
}

function appOptions(credential, parsedServiceAccount) {
  const fromCert = parsedServiceAccount && parsedServiceAccount.project_id;
  const projectId = fromCert || firebaseProjectIdHint();
  if (projectId) return { credential, projectId };
  return { credential };
}

function certFromJsonFile(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  if (!fs.existsSync(abs)) return null;
  try {
    return admin.credential.cert(JSON.parse(fs.readFileSync(abs, 'utf8')));
  } catch (_) {
    return null;
  }
}

/** Returns true if Firebase Admin default app was initialized. */
function tryInitAdminFromServiceAccountJson() {
  if (admin.apps.length) return true;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw && typeof raw === 'string' && raw.trim().length > 0) {
    try {
      const parsed = JSON.parse(raw);
      admin.initializeApp(appOptions(admin.credential.cert(parsed), parsed));
      return true;
    } catch (e) {
      console.error('FIREBASE_SERVICE_ACCOUNT is invalid JSON:', e.message || e);
      process.exit(1);
    }
  }

  const pathEnv = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (pathEnv && pathEnv.trim()) {
    const abs = path.isAbsolute(pathEnv.trim()) ? pathEnv.trim() : path.join(process.cwd(), pathEnv.trim());
    if (fs.existsSync(abs)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
        admin.initializeApp(appOptions(admin.credential.cert(parsed), parsed));
        return true;
      } catch (_) {
        /* continue */
      }
    }
    const c = certFromJsonFile(pathEnv.trim());
    if (c) {
      admin.initializeApp({ credential: c });
      return true;
    }
  }

  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (gac && gac.trim()) {
    const abs = path.isAbsolute(gac.trim()) ? gac.trim() : path.join(process.cwd(), gac.trim());
    if (fs.existsSync(abs)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
        admin.initializeApp(appOptions(admin.credential.cert(parsed), parsed));
        return true;
      } catch (_) {
        /* continue */
      }
    }
    const c = certFromJsonFile(gac.trim());
    if (c) {
      admin.initializeApp({ credential: c });
      return true;
    }
  }

  const fallback = path.join(__dirname, '..', 'server', 'serviceAccountKey.json');
  if (fs.existsSync(fallback)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(fallback, 'utf8'));
      admin.initializeApp(appOptions(admin.credential.cert(parsed), parsed));
      return true;
    } catch (_) {
      return false;
    }
  }

  return false;
}

function tryInitAdminADC() {
  if (admin.apps.length) return true;
  const pid = firebaseProjectIdHint();
  if (!pid) return false;
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: pid,
    });
    return true;
  } catch (_) {
    return false;
  }
}

async function deleteDefaultAdminApp() {
  try {
    const app = admin.app();
    await app.delete();
  } catch (_) {
    /* none */
  }
}

function getTrainerPrice(t) {
  if (t.price != null) return t.price;
  const pm = t.pricing && t.pricing.perMonth != null ? t.pricing.perMonth : null;
  if (pm != null) return pm;
  return t.rate != null ? t.rate : null;
}

function buildRow(id, d) {
  return {
    id,
    name: d.displayName || d.name || '(no name)',
    priceField: d.price,
    perMonth: d.pricing && d.pricing.perMonth != null ? d.pricing.perMonth : null,
    perSession: d.pricing && d.pricing.perSession != null ? d.pricing.perSession : null,
    rate: d.rate != null ? d.rate : null,
    resolved: getTrainerPrice(d),
    source:
      d.price != null
        ? 'price'
        : d.pricing && d.pricing.perMonth != null
          ? 'pricing.perMonth'
          : d.rate != null
            ? 'rate'
            : '(none)',
  };
}

async function fetchRowsAdmin() {
  const snap = await admin.firestore().collection('trainers').get();
  const rows = [];
  snap.forEach((doc) => rows.push(buildRow(doc.id, doc.data())));
  return rows;
}

// ── Firestore REST + Identity Toolkit (same API key as Expo; any authenticated user can read trainers) ──

function decodeFirestoreRestValue(v) {
  if (v == null) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return Number(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.nullValue !== undefined) return null;
  if (v.timestampValue !== undefined) return v.timestampValue;
  if (v.mapValue?.fields) {
    const o = {};
    for (const [k, val] of Object.entries(v.mapValue.fields)) {
      o[k] = decodeFirestoreRestValue(val);
    }
    return o;
  }
  if (v.arrayValue?.values) return v.arrayValue.values.map((x) => decodeFirestoreRestValue(x));
  return null;
}

function restDocToPlain(doc) {
  const id = doc.name.split('/').pop();
  const d = {};
  if (doc.fields) {
    for (const [k, v] of Object.entries(doc.fields)) {
      d[k] = decodeFirestoreRestValue(v);
    }
  }
  return { id, ...d };
}

async function fetchIdTokenAnonymous(apiKey) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || JSON.stringify(data));
  }
  return data.idToken;
}

async function fetchIdTokenPassword(apiKey, email, password) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || JSON.stringify(data));
  }
  return data.idToken;
}

/** OAuth2 access token from `gcloud auth login` — Firestore REST accepts it as a GCP caller (not Firebase Auth). */
function tryGcloudAccessToken() {
  const cmd = process.platform === 'win32' ? 'gcloud.cmd' : 'gcloud';
  const r = spawnSync(cmd, ['auth', 'print-access-token'], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
  });
  if (r.error || r.status !== 0) return null;
  const t = String(r.stdout || '').trim();
  return t.length > 32 ? t : null;
}

async function listTrainersRest(projectId, idToken) {
  const rows = [];
  let pageToken = '';
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/trainers`;
  do {
    const q = new URLSearchParams({ pageSize: '200' });
    if (pageToken) q.set('pageToken', pageToken);
    const res = await fetch(`${base}?${q}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || JSON.stringify(data));
    }
    for (const doc of data.documents || []) {
      const plain = restDocToPlain(doc);
      rows.push(buildRow(plain.id, plain));
    }
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return rows;
}

function formatInspectHelp(baseError) {
  return (
    `${baseError}\n\n` +
    `Fix (pick one):\n` +
    `  A) Paste ID token from a user already logged into the app (expires ~1h; local .env only):\n` +
    `     FIREBASE_INSPECT_ID_TOKEN=eyJhbGc...\n` +
    `     Dev: after sign-in call auth.currentUser.getIdToken() (or log in Expo dev client and read from a quick debug log).\n\n` +
    `  B) Google Cloud Console → APIs & Services → Credentials → Create API key → for this script set:\n` +
    `     FIREBASE_INSPECT_WEB_API_KEY=<web or unrestricted key>\n` +
    `     (Mobile-only keys often cause ADMIN_ONLY_OPERATION from Node.)\n\n` +
    `  C) With (B), enable Anonymous auth in Firebase Console, or set:\n` +
    `     FIREBASE_INSPECT_EMAIL=...  FIREBASE_INSPECT_PASSWORD=...\n\n` +
    `  D) Terminal-only, no app: brew install --cask google-cloud-sdk\n` +
    `     gcloud auth login\n` +
    `     gcloud config set project anatrox-auth\n` +
    `     npm run inspect:trainer-prices\n`
  );
}

async function fetchRowsClientAuth() {
  const projectId = firebaseProjectIdHint();
  if (!projectId) {
    throw new Error('Missing EXPO_PUBLIC_FIREBASE_PROJECT_ID in .env.');
  }

  const pastedToken = (process.env.FIREBASE_INSPECT_ID_TOKEN || '').trim();
  if (pastedToken) {
    const rows = await listTrainersRest(projectId, pastedToken);
    return { rows, authVia: 'FIREBASE_INSPECT_ID_TOKEN' };
  }

  const apiKey = firebaseInspectApiKey();
  if (!apiKey) {
    throw new Error(
      'Need FIREBASE_INSPECT_ID_TOKEN, or FIREBASE_INSPECT_WEB_API_KEY / EXPO_PUBLIC_FIREBASE_API_KEY for sign-in.'
    );
  }

  let idToken;
  let authVia = 'anonymous + REST';
  try {
    idToken = await fetchIdTokenAnonymous(apiKey);
  } catch (e) {
    const msg = String(e.message || e);
    const email = (process.env.FIREBASE_INSPECT_EMAIL || '').trim();
    const password = (process.env.FIREBASE_INSPECT_PASSWORD || '').trim();
    if (!email || !password) {
      if (msg.includes('ADMIN_ONLY_OPERATION')) {
        throw new Error(
          formatInspectHelp(
            'Identity Toolkit returned ADMIN_ONLY_OPERATION — your API key is probably restricted to mobile apps only.'
          )
        );
      }
      throw new Error(formatInspectHelp(`Anonymous sign-in failed (${msg}).`));
    }
    try {
      idToken = await fetchIdTokenPassword(apiKey, email, password);
      authVia = 'email/password (FIREBASE_INSPECT_*)';
    } catch (e2) {
      const msg2 = String(e2.message || e2);
      if (msg2.includes('ADMIN_ONLY_OPERATION')) {
        throw new Error(
          formatInspectHelp(
            'Email sign-in failed with ADMIN_ONLY_OPERATION (API key restriction). Use FIREBASE_INSPECT_ID_TOKEN or a web API key.'
          )
        );
      }
      throw new Error(formatInspectHelp(`Email/password sign-in failed (${msg2}).`));
    }
  }

  const rows = await listTrainersRest(projectId, idToken);
  return { rows, authVia };
}

function printTable(rows, projectId, mode) {
  rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));

  console.log('');
  console.log('── Firestore trainers/{id} — marketplace $ display ──');
  console.log(`Firebase projectId: ${projectId}`);
  console.log(`Auth: ${mode}`);
  console.log(`Count: ${rows.length}`);
  console.log('');

  const wId = 28;
  const wName = 22;
  const wSrc = 16;
  console.log(
    `${'id'.padEnd(wId)} ${'name'.padEnd(wName)} ${'resolved'.padStart(8)} ${'source'.padEnd(wSrc)} raw: price | pm | ps | rate`
  );
  console.log('-'.repeat(120));

  for (const r of rows) {
    const res = r.resolved != null && r.resolved !== '' ? String(r.resolved) : '—';
    const raw = `${r.priceField ?? '—'} | ${r.perMonth ?? '—'} | ${r.perSession ?? '—'} | ${r.rate ?? '—'}`;
    console.log(
      `${r.id.slice(0, wId).padEnd(wId)} ${String(r.name).slice(0, wName).padEnd(wName)} ${res.padStart(8)} ${String(r.source).padEnd(wSrc)} ${raw}`
    );
  }

  console.log('');
  console.log('App shows "$<resolved>/mo" on cards when resolved is a finite number > 0.');
  console.log('If numbers look random, check whether scripts/seedRandomTrainerMarketplaceData.js was run on this project.');
  console.log('');
}

async function main() {
  const projectId = firebaseProjectIdHint() || '(unknown)';
  let mode = '';
  let rows;

  if (tryInitAdminFromServiceAccountJson()) {
    try {
      rows = await fetchRowsAdmin();
      mode = 'Firebase Admin (service account)';
      printTable(rows, admin.app().options.projectId || projectId, mode);
      return;
    } catch (e) {
      await deleteDefaultAdminApp();
      /* fall through: ADC or client (Identity Toolkit works without Admin) */
    }
  }

  if (tryInitAdminADC()) {
    try {
      rows = await fetchRowsAdmin();
      mode = 'FirebaseAdmin (application default / gcloud)';
      printTable(rows, admin.app().options.projectId || projectId, mode);
      return;
    } catch (e) {
      await deleteDefaultAdminApp();
    }
  }

  const pid = firebaseProjectIdHint();
  if (pid) {
    const gcToken = tryGcloudAccessToken();
    if (gcToken) {
      try {
        rows = await listTrainersRest(pid, gcToken);
        mode = 'gcloud auth print-access-token (GCP OAuth → Firestore REST)';
        printTable(rows, pid, mode);
        return;
      } catch (_) {
        /* wrong project, no Firestore API access, etc. — try Firebase client path */
      }
    }
  }

  const clientResult = await fetchRowsClientAuth();
  rows = clientResult.rows;
  mode = `Client API + Firestore REST (${clientResult.authVia})`;
  printTable(rows, projectId, mode);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
