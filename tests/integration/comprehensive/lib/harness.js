/**
 * Shared harness for CoachConnect comprehensive integration tests.
 * Uses Firebase Admin + API when credentials are available; records PASS/FAIL/SKIP.
 */
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..', '..', '..', '..');

function loadEnv() {
  for (const rel of ['.env', 'server/.env', '.env.maestro']) {
    const fp = path.join(ROOT, rel);
    if (!fs.existsSync(fp)) continue;
    for (const line of fs.readFileSync(fp, 'utf8').split('\n')) {
      let t = line.trim();
      if (!t || t.startsWith('#')) continue;
      if (t.startsWith('export ')) t = t.slice(7).trim();
      const i = t.indexOf('=');
      if (i < 1) continue;
      const k = t.slice(0, i).trim();
      const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

loadEnv();

const PRODUCTION_API =
  'https://coachconnect-api-421005574501.us-central1.run.app';

function getApiBase() {
  return String(process.env.EXPO_PUBLIC_API_BASE_URL || PRODUCTION_API).replace(/\/+$/, '');
}

function getFirebaseApiKey() {
  return String(
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY || '',
  ).trim();
}

function createResult(test, status, extra = {}) {
  const { status: _ignored, ...safeExtra } = extra;
  return { test, status, ...safeExtra };
}

function pass(test, extra = {}) {
  return createResult(test, 'PASS', extra);
}

function fail(test, error, extra = {}) {
  return createResult(test, 'FAIL', { error: String(error), ...extra });
}

function skip(test, reason, extra = {}) {
  return createResult(test, 'SKIP', { error: reason, ...extra });
}

let adminCache = null;

function getAdminModule() {
  const { admin, tryInitializeFirebaseAdmin } = require(path.join(ROOT, 'server/lib/initFirebaseAdmin'));
  const init = tryInitializeFirebaseAdmin();
  if (!init.ok || !admin.apps.length) return { admin: null, init };
  return { admin, init };
}

function getAdmin() {
  if (adminCache && adminCache.apps.length) return adminCache;
  const { admin } = getAdminModule();
  if (!admin) return null;
  adminCache = admin;
  return adminCache;
}

async function getIdTokenForUid(uid) {
  const preset = String(process.env.TEST_FIREBASE_ID_TOKEN || '').trim();
  if (preset && uid === String(process.env.TEST_USER_ID || '').trim()) return preset;

  const admin = getAdmin();
  const apiKey = getFirebaseApiKey();
  if (!admin || !apiKey) return null;

  const custom = await admin.auth().createCustomToken(uid);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Token exchange failed');
  return json.idToken;
}

async function apiFetch(apiPath, options = {}, token = null) {
  const base = getApiBase();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const start = Date.now();
  const res = await fetch(`${base}${apiPath}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(options.timeoutMs || 120_000),
  });
  const elapsed = Date.now() - start;
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { res, json, elapsed };
}

function uniqueEmail(prefix) {
  const tag = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}+${tag}@coachconnect-test.invalid`;
}

async function createTestUser(role = 'client') {
  const admin = getAdmin();
  if (!admin) throw new Error('Firebase Admin not available');

  const email = uniqueEmail(role);
  const password = `CcTest!${Math.random().toString(36).slice(2, 10)}`;
  const userRecord = await admin.auth().createUser({ email, password, emailVerified: true });
  const uid = userRecord.uid;

  await admin.firestore().collection('users').doc(uid).set({
    email,
    role,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { uid, email, password };
}

async function deleteTestUser(uid) {
  const admin = getAdmin();
  if (!admin || !uid) return;
  try {
    await admin.auth().deleteUser(uid);
  } catch (_) {
    /* ignore */
  }
  try {
    await admin.firestore().collection('users').doc(uid).delete();
  } catch (_) {
    /* ignore */
  }
}

async function importEsm(modulePath) {
  return import(pathToFileURL(modulePath).href);
}

function hasLiveFirebase() {
  const admin = getAdmin();
  return Boolean(admin && admin.apps.length > 0 && getFirebaseApiKey());
}

let firebaseWriteProbe = null;

async function canWriteFirebase() {
  if (firebaseWriteProbe !== null) return firebaseWriteProbe;
  const admin = getAdmin();
  if (!admin) {
    firebaseWriteProbe = false;
    return false;
  }
  try {
    await admin.auth().listUsers(1);
    firebaseWriteProbe = true;
  } catch (_) {
    firebaseWriteProbe = false;
  }
  return firebaseWriteProbe;
}

async function signInWithPassword(email, password) {
  const apiKey = getFirebaseApiKey();
  if (!apiKey || !email || !password) return null;
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const json = await res.json();
  if (!res.ok) return null;
  return { token: json.idToken, uid: json.localId };
}

async function getTestAuth() {
  const presetToken = String(process.env.TEST_FIREBASE_ID_TOKEN || '').trim();
  const presetUid = String(process.env.TEST_USER_ID || '').trim();
  if (presetToken) {
    return { token: presetToken, uid: presetUid || null };
  }

  const clientEmail = String(process.env.MAESTRO_CLIENT_EMAIL || '').trim();
  const clientPassword = String(process.env.MAESTRO_CLIENT_PASSWORD || '').trim();
  if (clientEmail && clientPassword) {
    const signedIn = await signInWithPassword(clientEmail, clientPassword);
    if (signedIn?.token) return signedIn;
  }

  if (!(await canWriteFirebase())) return null;

  const user = await createTestUser('client');
  const token = await getIdTokenForUid(user.uid);
  return { token, uid: user.uid, cleanup: [user.uid] };
}

function hasLiveApi() {
  return Boolean(getApiBase());
}

module.exports = {
  ROOT,
  getApiBase,
  getAdmin,
  getIdTokenForUid,
  apiFetch,
  createTestUser,
  deleteTestUser,
  importEsm,
  hasLiveFirebase,
  canWriteFirebase,
  getTestAuth,
  signInWithPassword,
  hasLiveApi,
  pass,
  fail,
  skip,
  createResult,
};
