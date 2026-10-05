/**
 * Sign in with Apple — store tokens for later revoke on account delete (Guideline 5.1.1).
 *
 * Needs Functions env (optional but required for real revoke):
 *   APPLE_SIGNIN_TEAM_ID, APPLE_SIGNIN_KEY_ID, APPLE_SIGNIN_PRIVATE_KEY (or _BASE64),
 *   APPLE_SIGNIN_CLIENT_ID (bundle id, default com.coachconnect)
 *
 * Without those secrets we still store the authorizationCode briefly; revoke is skipped.
 */

const crypto = require('crypto');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

const TOKEN_COL = 'appleAuthTokens';
const DEFAULT_CLIENT_ID = 'com.coachconnect';

function getDb() {
  return admin.firestore();
}

function getAppleClientId() {
  return String(process.env.APPLE_SIGNIN_CLIENT_ID || process.env.APPLE_BUNDLE_ID || DEFAULT_CLIENT_ID).trim();
}

function getPrivateKeyPem() {
  const raw = process.env.APPLE_SIGNIN_PRIVATE_KEY || '';
  const b64 = process.env.APPLE_SIGNIN_PRIVATE_KEY_BASE64 || '';
  let pem = raw.trim();
  if (!pem && b64) {
    try {
      pem = Buffer.from(b64, 'base64').toString('utf8').trim();
    } catch (_) {
      pem = '';
    }
  }
  // Env often stores newlines as \n
  if (pem.includes('\\n')) pem = pem.replace(/\\n/g, '\n');
  return pem;
}

function appleSignInConfigured() {
  return Boolean(
    process.env.APPLE_SIGNIN_TEAM_ID &&
      process.env.APPLE_SIGNIN_KEY_ID &&
      getPrivateKeyPem(),
  );
}

/** Apple client_secret = ES256 JWT signed with your Sign in with Apple .p8 key. */
function createAppleClientSecret() {
  const teamId = process.env.APPLE_SIGNIN_TEAM_ID;
  const keyId = process.env.APPLE_SIGNIN_KEY_ID;
  const privateKey = getPrivateKeyPem();
  const clientId = getAppleClientId();
  if (!teamId || !keyId || !privateKey) {
    throw new Error('Apple Sign in revoke secrets are not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: keyId };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 60 * 30,
    aud: 'https://appleid.apple.com',
    sub: clientId,
  };

  const encode = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const unsigned = `${encode(header)}.${encode(payload)}`;
  const signer = crypto.createSign('SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  return `${unsigned}.${signature.toString('base64url')}`;
}

async function exchangeAuthorizationCode(authorizationCode) {
  const clientSecret = createAppleClientSecret();
  const body = new URLSearchParams({
    client_id: getAppleClientId(),
    client_secret: clientSecret,
    code: authorizationCode,
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json?.error || `Apple token exchange failed (${res.status})`);
    err.apple = json;
    throw err;
  }
  return json;
}

async function revokeAppleToken(token, tokenTypeHint = 'refresh_token') {
  const clientSecret = createAppleClientSecret();
  const body = new URLSearchParams({
    client_id: getAppleClientId(),
    client_secret: clientSecret,
    token,
    token_type_hint: tokenTypeHint,
  });
  const res = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  // Apple returns 200 on success with empty body
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`Apple revoke failed (${res.status}) ${text}`);
    throw err;
  }
}

/**
 * Persist tokens for later revoke. Prefer refresh_token when exchange works.
 * @param {string} uid
 * @param {string} authorizationCode
 */
async function storeAppleAuthForRevoke(uid, authorizationCode) {
  const code = String(authorizationCode || '').trim();
  if (!uid || !code) throw new Error('uid and authorizationCode are required');

  const doc = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    clientId: getAppleClientId(),
  };

  if (appleSignInConfigured()) {
    try {
      const tokens = await exchangeAuthorizationCode(code);
      if (tokens.refresh_token) doc.refreshToken = tokens.refresh_token;
      if (tokens.access_token) doc.accessToken = tokens.access_token;
      doc.exchangedAt = admin.firestore.FieldValue.serverTimestamp();
    } catch (e) {
      logger.warn('Apple code exchange failed; storing authorizationCode only', {
        uid,
        error: e?.message || String(e),
      });
      doc.authorizationCode = code;
    }
  } else {
    // No .p8 secrets in this environment — keep code so a later deploy can still attempt revoke
    doc.authorizationCode = code;
    doc.pendingExchange = true;
  }

  await getDb().collection(TOKEN_COL).doc(uid).set(doc, { merge: true });
  return { ok: true };
}

/** Best-effort revoke then delete appleAuthTokens/{uid}. Never throws to block account delete. */
async function revokeAndClearAppleAuth(uid) {
  if (!uid) return { revoked: false };
  const ref = getDb().collection(TOKEN_COL).doc(uid);
  let snap;
  try {
    snap = await ref.get();
  } catch (e) {
    logger.warn('appleAuthTokens read failed', { uid, error: e?.message || String(e) });
    return { revoked: false };
  }
  if (!snap.exists) return { revoked: false };

  const data = snap.data() || {};
  let revoked = false;

  if (appleSignInConfigured()) {
    try {
      if (data.refreshToken) {
        await revokeAppleToken(data.refreshToken, 'refresh_token');
        revoked = true;
      } else if (data.accessToken) {
        await revokeAppleToken(data.accessToken, 'access_token');
        revoked = true;
      } else if (data.authorizationCode) {
        // Last resort: try exchanging then revoking
        try {
          const tokens = await exchangeAuthorizationCode(data.authorizationCode);
          if (tokens.refresh_token) {
            await revokeAppleToken(tokens.refresh_token, 'refresh_token');
            revoked = true;
          } else if (tokens.access_token) {
            await revokeAppleToken(tokens.access_token, 'access_token');
            revoked = true;
          }
        } catch (ex) {
          logger.warn('Apple late exchange/revoke failed', { uid, error: ex?.message || String(ex) });
        }
      }
    } catch (e) {
      logger.warn('Apple revoke failed', { uid, error: e?.message || String(e) });
    }
  } else {
    logger.info('Apple Sign in secrets missing — skip revoke', { uid });
  }

  try {
    await ref.delete();
  } catch (_) {
    /* ignore */
  }
  return { revoked };
}

module.exports = {
  storeAppleAuthForRevoke,
  revokeAndClearAppleAuth,
  appleSignInConfigured,
  TOKEN_COL,
};
