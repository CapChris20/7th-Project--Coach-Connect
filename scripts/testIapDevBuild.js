#!/usr/bin/env node
/**
 * Verify Coach Connect IAP is wired for iOS dev builds.
 *
 * Automated (no device):
 *   node scripts/testIapDevBuild.js
 *   npm run test:iap
 *
 * Hit your API with a mock StoreKit JWS + Firebase auth (writes TEST_USER_ID subscription):
 *   node scripts/testIapDevBuild.js --live
 *
 * Env: EXPO_PUBLIC_API_BASE_URL, EXPO_PUBLIC_FIREBASE_API_KEY, FIREBASE_SERVICE_ACCOUNT
 *      TEST_USER_ID (default trainer test uid), TEST_FIREBASE_ID_TOKEN (optional)
 */
const fs = require('fs');
const path = require('path');

const {
  ROOT,
  BASE,
  USER_ID,
  createTally,
  fetchHealth,
} = require('./lib/aiCoachTestHelpers');

const {
  EXPECTED_BUNDLE_ID,
  EXPECTED_PRODUCT_ID,
  verifyApplePurchaseToken,
  verifyAppleRestoredPurchases,
} = require('../server/lib/appleSubscriptionVerify');

const LIVE = process.argv.includes('--live');
const PRODUCT_ID = 'com.coachconnect.month';
const BUNDLE_ID = 'com.coachconnect';

function makeJws(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

function readText(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
}

function includesAll(haystack, needles, label, tally) {
  if (!haystack) {
    tally.fail(label, `missing file`);
    return false;
  }
  const missing = needles.filter((n) => !haystack.includes(n));
  if (missing.length) {
    tally.fail(label, `missing: ${missing.join(', ')}`);
    return false;
  }
  tally.pass(label);
  return true;
}

function checkDevBuildWiring(tally) {
  console.log('\n── Dev build wiring ──');

  const pkg = JSON.parse(readText('package.json') || '{}');
  tally.assert(
    'expo-iap dependency',
    !!pkg.dependencies?.['expo-iap'],
    pkg.dependencies?.['expo-iap'] || 'not in package.json',
  );
  tally.assert(
    'expo-dev-client dependency',
    !!pkg.dependencies?.['expo-dev-client'],
    'required — IAP does not work in Expo Go',
  );

  includesAll(readText('app.config.js'), ["'expo-iap'", `bundleIdentifier: '${BUNDLE_ID}'`], 'app.config.js IAP + bundle id', tally);

  includesAll(
    readText('src/subscription/constants.js'),
    [PRODUCT_ID],
    'client product id constant',
    tally,
  );

  tally.assert(
    'server product id constant',
    EXPECTED_PRODUCT_ID === PRODUCT_ID,
    `server=${EXPECTED_PRODUCT_ID}`,
  );
  tally.assert(
    'server bundle id constant',
    EXPECTED_BUNDLE_ID === BUNDLE_ID,
    `server=${EXPECTED_BUNDLE_ID}`,
  );

  includesAll(
    readText('src/subscription/SubscriptionProviderIap.jsx'),
    ['useIAP', 'fetchProducts', 'requestPurchase', PRODUCT_ID, 'verifyAppleSubscriptionOnServer'],
    'SubscriptionProviderIap StoreKit flow',
    tally,
  );

  includesAll(
    readText('src/subscription/constants.js'),
    ['TRAINER_PLATFORM_SUBSCRIPTION_ENABLED', PRODUCT_ID],
    'subscription constants + IAP flag',
    tally,
  );

  includesAll(
    readText('ios/CoachConnect.xcodeproj/project.pbxproj'),
    ['com.apple.InAppPurchase', 'StoreKit.framework'],
    'Xcode In-App Purchase capability',
    tally,
  );

  includesAll(readText('ios/Podfile.lock'), ['ExpoIap', 'openiap'], 'iOS ExpoIap pod linked', tally);

  tally.assert(
    'expo-iap native module installed',
    fs.existsSync(path.join(ROOT, 'node_modules/expo-iap/package.json')),
  );
}

function checkServerVerification(tally) {
  console.log('\n── Apple JWS verification (local) ──');

  const now = Date.now();
  const trialJws = makeJws({
    productId: PRODUCT_ID,
    bundleId: BUNDLE_ID,
    transactionId: `iap-test-${now}`,
    originalTransactionId: `iap-test-${now}`,
    purchaseDate: now,
    expiresDate: now + 3 * 24 * 60 * 60 * 1000,
    offerType: 1,
    environment: 'Sandbox',
  });

  try {
    const { subscription } = verifyApplePurchaseToken(trialJws, { productId: PRODUCT_ID });
    tally.assert('trial JWS → free_trial', subscription.status === 'free_trial', subscription.status);
    tally.assert('trial platform ios', subscription.platform === 'ios');
  } catch (e) {
    tally.fail('trial JWS verify', e?.message || String(e));
  }

  const activeJws = makeJws({
    productId: PRODUCT_ID,
    bundleId: BUNDLE_ID,
    transactionId: `iap-active-${now}`,
    originalTransactionId: `iap-active-${now}`,
    purchaseDate: now,
    expiresDate: now + 30 * 24 * 60 * 60 * 1000,
    environment: 'Sandbox',
  });

  try {
    const { subscription } = verifyApplePurchaseToken(activeJws);
    tally.assert('paid JWS → active', subscription.status === 'active', subscription.status);
  } catch (e) {
    tally.fail('paid JWS verify', e?.message || String(e));
  }

  try {
    verifyApplePurchaseToken(makeJws({ productId: 'wrong.product', bundleId: BUNDLE_ID, expiresDate: now + 1e6 }));
    tally.fail('wrong product id rejected');
  } catch (e) {
    tally.assert('wrong product id rejected', e?.code === 'verification_failed', e?.code);
  }

  try {
    const restored = verifyAppleRestoredPurchases([
      { purchaseToken: trialJws, productId: PRODUCT_ID },
      { purchaseToken: activeJws, productId: PRODUCT_ID },
    ]);
    tally.assert('restore picks latest active', restored.status === 'active', restored.status);
  } catch (e) {
    tally.fail('restore merge', e?.message || String(e));
  }
}

async function postSubscription(pathSuffix, token, body) {
  const res = await fetch(`${BASE}${pathSuffix}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {
    json = null;
  }
  return { status: res.status, json, raw: json ? null : text };
}

async function checkApiRoutes(tally) {
  console.log(`\n── API routes (${BASE}) ──`);

  const health = await fetchHealth();
  tally.assert('GET /api/health', health.ok, `status ${health.status}`);
  tally.assert('firebaseAdmin on API', health.json?.firebaseAdmin === true, 'set FIREBASE_SERVICE_ACCOUNT on Cloud Run');

  const verifyNoAuth = await postSubscription('/api/subscription/apple/verify', null, {});
  tally.assert(
    'POST verify without auth → 401',
    verifyNoAuth.status === 401,
    `got ${verifyNoAuth.status}`,
  );

  const restoreNoAuth = await postSubscription('/api/subscription/apple/restore', null, { purchases: [] });
  tally.assert(
    'POST restore without auth → 401',
    restoreNoAuth.status === 401,
    `got ${restoreNoAuth.status}`,
  );

  if (verifyNoAuth.status === 404) {
    tally.fail(
      'subscription routes deployed',
      '404 — run npm run api:deploy or ./server/deploy.sh',
    );
    return null;
  }

  tally.pass('subscription routes deployed', 'not 404');
  return verifyNoAuth;
}

async function getLiveIdToken(tally) {
  const pasted = String(process.env.TEST_FIREBASE_ID_TOKEN || '').trim();
  if (pasted) {
    tally.pass('Firebase ID token', 'TEST_FIREBASE_ID_TOKEN');
    return pasted;
  }

  const apiKey = String(
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY || '',
  ).trim();

  const { tryInitializeFirebaseAdmin, admin } = require('../server/lib/initFirebaseAdmin');
  const init = tryInitializeFirebaseAdmin();
  if (!init.ok || admin.apps.length === 0) {
    throw new Error(
      init.error ||
        'Firebase Admin not initialized — add FIREBASE_SERVICE_ACCOUNT or server/serviceAccountKey.json',
    );
  }

  try {
    const custom = await admin.auth().createCustomToken(USER_ID);
    if (!apiKey) {
      throw new Error('EXPO_PUBLIC_FIREBASE_API_KEY required to exchange custom token');
    }
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
    tally.pass('Firebase ID token', `custom token for uid ${USER_ID}`);
    return json.idToken;
  } catch (e) {
    throw new Error(
      `${e?.message || e}. For --live without Admin SDK, set TEST_FIREBASE_ID_TOKEN in .env`,
    );
  }
}

async function checkLiveApi(tally) {
  console.log('\n── Live API verify + restore (--live) ──');

  let token;
  try {
    token = await getLiveIdToken(tally);
  } catch (e) {
    tally.skip('live API verify/restore', e?.message || String(e));
    return;
  }

  const now = Date.now();
  const trialJws = makeJws({
    productId: PRODUCT_ID,
    bundleId: BUNDLE_ID,
    transactionId: `live-iap-${now}`,
    originalTransactionId: `live-iap-${now}`,
    purchaseDate: now,
    expiresDate: now + 3 * 24 * 60 * 60 * 1000,
    offerType: 1,
    environment: 'Sandbox',
  });

  const missingToken = await postSubscription('/api/subscription/apple/verify', token, {});
  tally.assert(
    'POST verify missing purchaseToken → 400',
    missingToken.status === 400 && missingToken.json?.code === 'invalid_token',
    `status ${missingToken.status}`,
  );

  const verify = await postSubscription('/api/subscription/apple/verify', token, {
    purchaseToken: trialJws,
    productId: PRODUCT_ID,
    expirationDateIOS: now + 3 * 24 * 60 * 60 * 1000,
    environmentIOS: 'Sandbox',
  });

  tally.assert(
    'POST verify mock sandbox JWS → 200',
    verify.status === 200 && verify.json?.ok === true,
    verify.json?.error || verify.raw || `status ${verify.status}`,
  );

  if (verify.json?.subscription) {
    const sub = verify.json.subscription;
    tally.assert('API returns free_trial', sub.status === 'free_trial', sub.status);
    tally.assert('API returns productId', sub.productId === PRODUCT_ID, sub.productId);
  }

  const restore = await postSubscription('/api/subscription/apple/restore', token, {
    purchases: [
      {
        purchaseToken: trialJws,
        productId: PRODUCT_ID,
        expirationDateIOS: now + 3 * 24 * 60 * 60 * 1000,
        environmentIOS: 'Sandbox',
      },
    ],
  });

  tally.assert(
    'POST restore mock purchase → 200',
    restore.status === 200 && restore.json?.ok === true,
    restore.json?.error || restore.raw || `status ${restore.status}`,
  );

  console.log(`\n   ℹ️  Wrote subscription to Firestore users/${USER_ID}.subscription (mock JWS, not a real Apple receipt).`);
}

function printDeviceChecklist() {
  console.log('\n── On-device StoreKit checklist (manual) ──');
  console.log('  1. Build dev client on a physical iPhone: npm run ios  (not Expo Go)');
  console.log('  2. App Store Connect: subscription SKU com.coachconnect.month → Ready to Submit');
  console.log('  3. iPhone Settings → App Store → Sandbox Account → sign in with sandbox tester');
  console.log('  4. App: sign in as trainer → paywall or onboarding subscription step');
  console.log('  5. Tap "Start free trial" — Apple sheet should show Sandbox + your product');
  console.log('  6. After purchase, paywall should clear (Firestore users/{uid}.subscription updates)');
  console.log('  7. Settings → Restore purchases should work for the same sandbox Apple ID');
  console.log('\n  StoreKit cannot be automated from Node — the steps above confirm the real purchase UI.');
}

async function main() {
  const tally = createTally();

  console.log('Coach Connect IAP dev-build verification');
  console.log(`  API base: ${BASE}`);
  console.log(`  mode: ${LIVE ? 'live (authenticated API)' : 'automated only'}`);

  checkDevBuildWiring(tally);
  checkServerVerification(tally);
  await checkApiRoutes(tally);

  if (LIVE) {
    await checkLiveApi(tally);
  } else {
    tally.skip('live API verify/restore', 'pass --live to test authenticated endpoints');
  }

  printDeviceChecklist();

  const failed = tally.summary('IAP dev-build checks');
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('\n❌', e?.message || e);
  process.exit(1);
});
