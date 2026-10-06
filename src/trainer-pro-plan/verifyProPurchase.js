// Sends an Apple purchase to the server so Pro access is not decided on the phone alone.
// Flow: take the login token → try each API base → stop on a real rejection, retry on a network miss.
// Used by the trainer paywall after StoreKit returns a purchase or a restore.

import { auth } from '../app-start/cloudConnection';
import { getResilientApiBases, isCloudHostedApiBase } from '../for-both/online-connection/whereToConnect';

// ===== NAMED CONSTANTS =====

const VERIFY_ACTION = 'verify';
const RESTORE_ACTION = 'restore';
const SUBSCRIPTION_PATH = '/api/subscription/apple/';
const BEARER_PREFIX = 'Bearer ';
const JSON_CONTENT_TYPE = 'application/json';
const HTTP_FORBIDDEN = 403;
const VERIFICATION_FAILED_CODE = 'verification_failed';
const REQUEST_FAILED_CODE = 'request_failed';
const NETWORK_ERROR_CODE = 'network_error';

// ===== HELPER FUNCTIONS =====

/**
 * @returns {Promise<string>}
 */
async function getIdToken() {
  const currentUser = auth?.currentUser;
  if (!currentUser) throw new Error('Not signed in');
  return currentUser.getIdToken(true);
}

/**
 * Prefer a hosted API. If none is configured, keep the first base so local dev still has a target.
 * @returns {string[]}
 */
function verifyProPurchaseBases() {
  const hostedBases = getResilientApiBases().filter(isCloudHostedApiBase);
  if (hostedBases.length) return hostedBases;
  return getResilientApiBases().slice(0, 1);
}

/**
 * A failed verification or a 403 is the server's answer. Other errors can try the next base.
 * @param {Error} caughtError
 * @returns {boolean}
 */
function shouldStopRetrying(caughtError) {
  if (caughtError?.code === VERIFICATION_FAILED_CODE) return true;
  return caughtError?.status === HTTP_FORBIDDEN;
}

/**
 * @param {string} base
 * @param {string} action
 * @param {string} token
 * @param {object} body
 * @returns {Promise<object>}
 */
async function postToOneBase(base, action, token, body) {
  const response = await fetch(`${base}${SUBSCRIPTION_PATH}${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': JSON_CONTENT_TYPE,
      Authorization: `${BEARER_PREFIX}${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (response.ok) return json;
  const requestError = new Error(json?.error || `Request failed (${response.status})`);
  requestError.code = json?.code || REQUEST_FAILED_CODE;
  requestError.status = response.status;
  throw requestError;
}

/**
 * @param {string} base
 * @param {string} action
 * @param {string} token
 * @param {object} body
 * @returns {Promise<{ didSucceed: boolean, json?: object, error?: Error }>}
 */
async function attemptPost(base, action, token, body) {
  try {
    const json = await postToOneBase(base, action, token, body);
    return { didSucceed: true, json };
  } catch (caughtError) {
    return { didSucceed: false, error: caughtError };
  }
}

/**
 * @param {object} purchase
 * @returns {object}
 */
function purchaseBody(purchase) {
  return {
    productId: purchase?.productId,
    transactionId: purchase?.transactionId,
    purchaseToken: purchase?.purchaseToken || purchase?.transactionReceipt,
    expirationDateIOS: purchase?.expirationDateIOS ?? null,
    environmentIOS: purchase?.environmentIOS ?? null,
    transactionDate: purchase?.transactionDate ?? null,
  };
}

/**
 * @param {'verify'|'restore'} action
 * @param {object} body
 * @returns {Promise<object>}
 */
async function postSubscription(action, body) {
  const token = await getIdToken();
  const bases = verifyProPurchaseBases();
  let lastError = null;

  for (const base of bases) {
    const attempt = await attemptPost(base, action, token, body);
    if (attempt.didSucceed) return attempt.json;
    lastError = attempt.error;
    if (shouldStopRetrying(attempt.error)) throw attempt.error;
  }

  const networkError = new Error(lastError?.message || 'Network request failed');
  networkError.code = NETWORK_ERROR_CODE;
  throw networkError;
}

// ===== MAIN FUNCTION =====

/**
 * @param {object} purchase
 * @returns {Promise<object>}
 */
export async function verifyAppleSubscriptionOnServer(purchase) {
  return postSubscription(VERIFY_ACTION, purchaseBody(purchase));
}

/**
 * @param {object[]} [purchases]
 * @returns {Promise<object>}
 */
export async function restoreAppleSubscriptionOnServer(purchases = []) {
  return postSubscription(RESTORE_ACTION, {
    purchases: purchases.map((purchase) => purchaseBody(purchase)),
  });
}
