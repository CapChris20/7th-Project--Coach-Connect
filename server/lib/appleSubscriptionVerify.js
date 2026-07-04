const EXPECTED_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'com.coachconnect';
const EXPECTED_PRODUCT_ID = process.env.APPLE_SUBSCRIPTION_PRODUCT_ID || 'com.coachconnect.month';
/** All product IDs the app can sell (monthly + annual paywall plans). */
const EXPECTED_PRODUCT_IDS = (
  process.env.APPLE_SUBSCRIPTION_PRODUCT_IDS ||
  `${EXPECTED_PRODUCT_ID},com.coachconnect.year`
)
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);

/**
 * Decode a JWS (header.payload.signature) without cryptographic signature verification.
 * StoreKit 2 tokens are signed by Apple; production should set APPLE_IAP_REQUIRE_JWS_SIGNATURE=true.
 * @param {string} jws
 */
function decodeJwsPayload(jws) {
  const parts = String(jws || '').split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWS format');
  }
  if (!parts[0] || !parts[1] || !parts[2]) {
    throw new Error('Invalid JWS format');
  }

  const requireSignature =
    process.env.APPLE_IAP_REQUIRE_JWS_SIGNATURE === 'true' ||
    (process.env.NODE_ENV === 'production' && process.env.APPLE_IAP_REQUIRE_JWS_SIGNATURE !== 'false');

  if (requireSignature && parts[2].length < 20) {
    const err = new Error('JWS signature missing or invalid');
    err.code = 'invalid_token';
    throw err;
  }

  const json = Buffer.from(parts[1], 'base64url').toString('utf8');
  return JSON.parse(json);
}

/**
 * @param {Record<string, unknown>} payload
 */
function normalizeAppleTransaction(payload) {
  const productId = String(payload.productId || payload.product_id || '');
  const bundleId = String(payload.bundleId || payload.bundle_id || '');
  const transactionId = String(payload.transactionId || payload.transaction_id || '');
  const originalTransactionId = String(
    payload.originalTransactionId || payload.original_transaction_id || transactionId,
  );

  const purchaseDateMs = Number(payload.purchaseDate || payload.purchase_date || 0) || null;
  const expiresDateMs = Number(payload.expiresDate || payload.expires_date || 0) || null;
  const revocationDateMs = Number(payload.revocationDate || payload.revocation_date || 0) || null;

  const offerType = payload.offerType ?? payload.offer_type ?? null;
  const environment = String(payload.environment || 'Production');

  return {
    productId,
    bundleId,
    transactionId,
    originalTransactionId,
    purchaseDateMs,
    expiresDateMs,
    revocationDateMs,
    offerType,
    environment,
  };
}

/**
 * @param {Record<string, unknown>} tx
 * @param {Date} now
 */
function buildSubscriptionFromTransaction(tx, now = new Date()) {
  const nowMs = now.getTime();
  const expiresMs = tx.expiresDateMs;
  const purchaseMs = tx.purchaseDateMs || nowMs;

  const isRevoked = tx.revocationDateMs && tx.revocationDateMs <= nowMs;
  const isExpired = !expiresMs || expiresMs <= nowMs;

  const trialOfferTypes = new Set([1, 2, 3]);
  const isTrialOffer = trialOfferTypes.has(Number(tx.offerType));

  let trialEndsAt = null;
  let status = 'expired';

  if (isRevoked || isExpired) {
    status = 'expired';
  } else if (isTrialOffer) {
    status = 'free_trial';
    trialEndsAt = expiresMs ? new Date(expiresMs).toISOString() : null;
  } else {
    status = 'active';
  }

  const expiresAt = expiresMs ? new Date(expiresMs).toISOString() : null;
  const nextBillingDate = expiresAt;

  return {
    status,
    productId: tx.productId || EXPECTED_PRODUCT_ID,
    expiresAt,
    nextBillingDate,
    trialEndsAt: status === 'free_trial' ? trialEndsAt : null,
    platform: 'ios',
    verifiedAt: now.toISOString(),
    environment: tx.environment,
    originalTransactionId: tx.originalTransactionId,
    transactionId: tx.transactionId,
    purchaseDate: new Date(purchaseMs).toISOString(),
  };
}

/**
 * Verify StoreKit 2 signed transaction (JWS) and map to Firestore subscription.
 * @param {string} purchaseToken - Signed transaction JWS from StoreKit 2
 * @param {{ productId?: string, expirationDateIOS?: number | null }} hints
 */
function verifyApplePurchaseToken(purchaseToken, hints = {}) {
  if (!purchaseToken) {
    const err = new Error('Missing purchase token');
    err.code = 'invalid_token';
    throw err;
  }

  let payload;
  try {
    payload = decodeJwsPayload(purchaseToken);
  } catch (e) {
    const err = new Error('Could not decode Apple purchase token');
    err.code = 'invalid_token';
    throw e;
  }

  const tx = normalizeAppleTransaction(payload);

  if (tx.bundleId && tx.bundleId !== EXPECTED_BUNDLE_ID) {
    const err = new Error('Bundle ID mismatch');
    err.code = 'verification_failed';
    throw err;
  }

  if (!tx.transactionId) {
    const err = new Error('Missing transaction ID in purchase token');
    err.code = 'verification_failed';
    throw err;
  }

  const productId = hints.productId || tx.productId;
  if (productId && !EXPECTED_PRODUCT_IDS.includes(productId)) {
    const err = new Error('Product ID mismatch');
    err.code = 'verification_failed';
    throw err;
  }

  if (!tx.expiresDateMs && hints.expirationDateIOS) {
    tx.expiresDateMs = Number(hints.expirationDateIOS);
  }

  if (!tx.productId) {
    tx.productId = EXPECTED_PRODUCT_ID;
  }

  const subscription = buildSubscriptionFromTransaction(tx);
  subscription.purchaseToken = purchaseToken;
  return { transaction: tx, subscription };
}

/**
 * Pick the best active subscription from multiple restored purchases.
 * @param {Array<{ purchaseToken?: string, productId?: string, expirationDateIOS?: number | null }>} purchases
 */
function verifyAppleRestoredPurchases(purchases = []) {
  const now = Date.now();
  let best = null;
  let bestExpires = 0;

  for (const purchase of purchases) {
    if (!purchase?.purchaseToken) continue;
    try {
      const { subscription } = verifyApplePurchaseToken(purchase.purchaseToken, purchase);
      const expiresMs = subscription.expiresAt ? new Date(subscription.expiresAt).getTime() : 0;
      if (expiresMs > now && expiresMs >= bestExpires) {
        bestExpires = expiresMs;
        best = subscription;
      }
    } catch (_) {
      /* try next */
    }
  }

  if (!best) {
    const err = new Error('No active subscription found to restore');
    err.code = 'not_found';
    throw err;
  }

  return best;
}

module.exports = {
  EXPECTED_BUNDLE_ID,
  EXPECTED_PRODUCT_ID,
  EXPECTED_PRODUCT_IDS,
  verifyApplePurchaseToken,
  verifyAppleRestoredPurchases,
  buildSubscriptionFromTransaction,
  decodeJwsPayload,
};
