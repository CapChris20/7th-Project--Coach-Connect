/**
 * Shared helpers for AI Coach smoke / E2E scripts.
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const ROOT = path.join(__dirname, '..', '..');
const PRODUCTION_API_BASE_URL =
  'https://coachconnect-api-421005574501.us-central1.run.app';

const BASE = String(
  process.env.EXPO_PUBLIC_API_BASE_URL || PRODUCTION_API_BASE_URL,
).replace(/\/+$/, '');

const USER_ID = String(process.env.TEST_USER_ID || '4hJJ7QLAMyU72T4BHSiQe33Z0ym1').trim();
const ID_TOKEN_ENV = String(process.env.TEST_FIREBASE_ID_TOKEN || '').trim();
const FIREBASE_API_KEY = String(
  process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY || '',
).trim();

function createTally() {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  return {
    pass(name, detail = '') {
      passed += 1;
      console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
    },
    fail(name, detail = '') {
      failed += 1;
      console.log(`❌ ${name}${detail ? ` — ${detail}` : ''}`);
    },
    skip(name, detail = '') {
      skipped += 1;
      console.log(`⏭️  ${name}${detail ? ` — ${detail}` : ''}`);
    },
    assert(name, cond, detail = '') {
      if (cond) this.pass(name, detail);
      else this.fail(name, detail);
    },
    summary(title) {
      console.log('\n────────────────────────────────────────');
      console.log(`${title}: ${passed} passed, ${failed} failed, ${skipped} skipped`);
      return failed;
    },
  };
}

async function getIdToken() {
  if (ID_TOKEN_ENV) return ID_TOKEN_ENV;

  if (!FIREBASE_API_KEY) {
    throw new Error(
      'Set TEST_FIREBASE_ID_TOKEN or EXPO_PUBLIC_FIREBASE_API_KEY for authenticated coach tests',
    );
  }

  const { tryInitializeFirebaseAdmin } = require(path.join(ROOT, 'server/lib/initFirebaseAdmin'));
  const init = tryInitializeFirebaseAdmin();
  if (!init.ok) {
    throw new Error('Firebase Admin not initialized — check service account in .env');
  }

  const admin = require('firebase-admin');
  const custom = await admin.auth().createCustomToken(USER_ID);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
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

async function fetchHealth(timeoutMs = 10_000) {
  const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(timeoutMs) });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

async function postCoach(token, body, options = {}) {
  const pathSuffix = options.path || '/api/ai-coach';
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-AI-Coach-Test-Suite': '1',
  };

  const res = await fetch(`${BASE}${pathSuffix}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs || 120_000),
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {
    json = null;
  }

  return {
    ok: res.ok,
    status: res.status,
    json,
    raw: json ? null : text,
    ms: options.started ? Date.now() - options.started : null,
  };
}

function coachPayload(message, options = {}) {
  const messages = Array.isArray(options.messages)
    ? options.messages
    : [{ role: 'user', content: message }];
  return {
    userId: USER_ID,
    messages,
    userProfile: options.userProfile || { name: 'Test User', goal: 'cut', trainingLevel: 'intermediate' },
    options: {
      web: options.web ?? 'auto',
      includePersonalData: options.includePersonalData ?? true,
      testSuite: true,
    },
  };
}

function preview(text, max = 100) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

module.exports = {
  ROOT,
  BASE,
  PRODUCTION_API_BASE_URL,
  USER_ID,
  createTally,
  getIdToken,
  fetchHealth,
  postCoach,
  coachPayload,
  preview,
};
