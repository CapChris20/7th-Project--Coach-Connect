// Asks the Coach Connect API to verify an Apple purchase so the phone alone never grants Pro.
// Flow: refresh Firebase id token → POST each API base → stop on hard reject → else network error.
// Used by ProPlanPurchases after StoreKit purchase or restore. Path letters: /api/subscription/apple/.

import { auth } from '../app-start/cloudConnection';
import { getResilientApiBases, isCloudHostedApiBase } from '../for-both/online-connection/whereToConnect';

// ===== NAMED CONSTANTS =====

const VERIFY_ACTION = 'verify';
const RESTORE_ACTION = 'restore';
// Manipulate here: must match the Express route under server subscription/apple
const SUBSCRIPTION_PATH = '/api/subscription/apple/';
const BEARER_PREFIX = 'Bearer ';
const JSON_CONTENT_TYPE = 'application/json';
const HTTP_FORBIDDEN = 403;
const VERIFICATION_FAILED_CODE = 'verification_failed';
const REQUEST_FAILED_CODE = 'request_failed';
const NETWORK_ERROR_CODE = 'network_error';
const FALLBACK_NETWORK_MESSAGE = 'Network request failed';

// ===== HELPER FUNCTIONS =====

/**
 * Fresh Firebase JWT so the backend does not see a stale token.
 * @returns {Promise<string>}
 */
async function fetchFreshFirebaseIdToken() {
  const signedInUser = auth.currentUser;
  if (!signedInUser) {
    throw new Error('Not signed in');
  }
  // vocab: getIdToken(true) = force refresh (true), not the cached JWT
  return signedInUser.getIdToken(true);
}

/**
 * Hosted Cloud Run bases first; if none, keep a single local/dev base.
 * @returns {string[]}
 */
function orderedApiBasesForVerification() {
  // vocab: getResilientApiBases = ordered API hosts the app can reach
  // vocab: isCloudHostedApiBase = true for production Cloud Run URLs
  const allBases = getResilientApiBases();
  const hostedOnly = [];
  for (let index = 0; index < allBases.length; index += 1) {
    if (isCloudHostedApiBase(allBases[index])) {
      hostedOnly.push(allBases[index]);
    }
  }
  if (hostedOnly.length > 0) {
    return hostedOnly;
  }
  return allBases.slice(0, 1);
}

/**
 * verification_failed or HTTP 403 = server's final no; do not try the next base.
 * @param {Error} caughtError
 * @returns {boolean}
 */
function errorMeansDoNotRetryOtherBases(caughtError) {
  if (!caughtError) {
    return false;
  }
  if (caughtError.code === VERIFICATION_FAILED_CODE) {
    return true;
  }
  if (caughtError.status === HTTP_FORBIDDEN) {
    return true;
  }
  return false;
}

/**
 * When every base failed with a soft error, throw one network Error for the UI.
 * @param {Error|null} lastCaughtError
 * @returns {Error}
 */
function buildNetworkGiveUpError(lastCaughtError) {
  let message = FALLBACK_NETWORK_MESSAGE;
  if (lastCaughtError && lastCaughtError.message) {
    message = lastCaughtError.message;
  }
  const networkError = new Error(message);
  networkError.code = NETWORK_ERROR_CODE;
  return networkError;
}

/**
 * Map one StoreKit purchase into the JSON body the Apple routes expect.
 * @param {object} purchase
 * @returns {object}
 */
function buildApplePurchaseBody(purchase) {
  let productId;
  let transactionId;
  let purchaseToken;
  let expirationDateIOS = null;
  let environmentIOS = null;
  let transactionDate = null;

  if (!purchase) {
    return {
      productId,
      transactionId,
      purchaseToken,
      expirationDateIOS,
      environmentIOS,
      transactionDate,
    };
  }

  productId = purchase.productId;
  transactionId = purchase.transactionId;

  // Prefer purchaseToken; fall back to the older transactionReceipt field.
  const tokenFromStore = purchase.purchaseToken;
  const receiptFromStore = purchase.transactionReceipt;
  purchaseToken = tokenFromStore || receiptFromStore;

  // vocab/symbol: ?? semantics — keep a real value (including 0); missing → null
  if (purchase.expirationDateIOS != null) {
    expirationDateIOS = purchase.expirationDateIOS;
  }
  if (purchase.environmentIOS != null) {
    environmentIOS = purchase.environmentIOS;
  }
  if (purchase.transactionDate != null) {
    transactionDate = purchase.transactionDate;
  }

  return {
    productId,
    transactionId,
    purchaseToken,
    expirationDateIOS,
    environmentIOS,
    transactionDate,
  };
}

/**
 * Build a list of Apple purchase bodies without using .map in a recipe.
 * @param {object[]} purchases
 * @returns {object[]}
 */
function buildApplePurchaseBodyList(purchases) {
  const bodies = [];
  for (let index = 0; index < purchases.length; index += 1) {
    bodies.push(buildApplePurchaseBody(purchases[index]));
  }
  return bodies;
}

/**
 * POST JSON to one base. Throws an Error with .code and .status on failure.
 * @param {string} base
 * @param {string} action
 * @param {string} token
 * @param {object} body
 * @returns {Promise<object>}
 */
async function postJsonToOneApiBase(base, action, token, body) {
  const url = `${base}${SUBSCRIPTION_PATH}${action}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': JSON_CONTENT_TYPE,
      Authorization: `${BEARER_PREFIX}${token}`,
    },
    body: JSON.stringify(body),
  });

  let responseJson = {};
  try {
    responseJson = await response.json();
  } catch (_parseError) {
    responseJson = {};
  }

  if (response.ok) {
    return responseJson;
  }

  let messageFromServer = `Request failed (${response.status})`;
  if (responseJson && responseJson.error) {
    messageFromServer = responseJson.error;
  }

  let errorCode = REQUEST_FAILED_CODE;
  if (responseJson && responseJson.code) {
    errorCode = responseJson.code;
  }

  const requestError = new Error(messageFromServer);
  requestError.code = errorCode;
  requestError.status = response.status;
  throw requestError;
}

/**
 * One try against one base — never throws; callers decide retry vs stop.
 * @param {string} base
 * @param {string} action
 * @param {string} token
 * @param {object} body
 * @returns {Promise<{ didSucceed: boolean, json?: object, error?: Error }>}
 */
async function tryPostSubscriptionOnce(base, action, token, body) {
  try {
    const json = await postJsonToOneApiBase(base, action, token, body);
    return { didSucceed: true, json };
  } catch (caughtError) {
    return { didSucceed: false, error: caughtError };
  }
}

/**
 * Walk API bases until one accepts the subscription call or the server refuses verification.
 * @param {'verify'|'restore'} action
 * @param {object} body
 * @returns {Promise<object>}
 */
async function postSubscriptionWithRetries(action, body) {
  // 1. Require a signed-in trainer — the route checks this Firebase token.
  const idToken = await fetchFreshFirebaseIdToken();

  // 2. Prefer cloud-hosted bases; local dev still gets one fallback target.
  const basesToTry = orderedApiBasesForVerification();

  let lastCaughtError = null;

  // 3. Try each base until success or a non-retryable rejection.
  for (let baseIndex = 0; baseIndex < basesToTry.length; baseIndex += 1) {
    const apiBase = basesToTry[baseIndex];
    const attemptResult = await tryPostSubscriptionOnce(apiBase, action, idToken, body);

    if (attemptResult.didSucceed) {
      return attemptResult.json;
    }

    lastCaughtError = attemptResult.error;
    const serverSaidStopRetrying = errorMeansDoNotRetryOtherBases(attemptResult.error);
    if (serverSaidStopRetrying) {
      throw attemptResult.error;
    }
  }

  // 4. Every base failed with a retryable error — one network-style failure for the UI.
  throw buildNetworkGiveUpError(lastCaughtError);
}

// ===== MAIN FUNCTION =====

/**
 * Verify one StoreKit purchase with the server.
 * @param {object} purchase — react-native-iap purchase row
 * @returns {Promise<object>} server JSON on success
 */
export async function verifyAppleSubscriptionOnServer(purchase) {
  // 1. Shape the body the Apple verify route expects (field letters frozen).
  const requestBody = buildApplePurchaseBody(purchase);

  // 2. Walk API bases until one accepts or the server hard-refuses.
  return postSubscriptionWithRetries(VERIFY_ACTION, requestBody);
}

/**
 * Restore one or more StoreKit purchases with the server.
 * @param {object[]} [purchases]
 * @returns {Promise<object>}
 */
export async function restoreAppleSubscriptionOnServer(purchases = []) {
  // 1. Turn each StoreKit row into the same body shape verify uses.
  const purchaseBodies = buildApplePurchaseBodyList(purchases);

  // 2. Walk API bases with the restore action.
  return postSubscriptionWithRetries(RESTORE_ACTION, { purchases: purchaseBodies });
}
