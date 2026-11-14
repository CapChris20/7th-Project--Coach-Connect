// Stripe Connect calls for a trainer's payout account: create it, check it, read the balance.
// Flow: require a signed-in user → POST only cloud API bases → one status word the screens can switch on.
// Used by: payout setup, earnings, and Settings. HTTP errors are not retried across bases.

import { auth } from '../../app-start/cloudConnection';
import { getResilientApiBases, isCloudHostedApiBase } from '../online-connection/whereToConnect';

// ===== NAMED CONSTANTS =====

const CREATE_ACCOUNT_PATH = '/api/stripe/create-account';
const VERIFY_STATUS_PATH = '/api/stripe/verify-status';
const GET_BALANCE_PATH = '/api/stripe/get-balance';

// Manipulate here: how long one base may hang before we abort and try the next.
const STRIPE_REQUEST_TIMEOUT_MS = 20000;

const STATUS_NOT_CONNECTED = 'not_connected';
const STATUS_PENDING = 'pending';
const STATUS_PENDING_VERIFICATION = 'pending_verification';
const STATUS_ACTIVE = 'active';
const NETWORK_ERROR_CODE = 'network_error';

const LOGIN_REQUIRED_MESSAGE = 'Please log in first.';
const CONNECTION_FAILED_MESSAGE = 'Connection failed, try again';

const LABEL_ACTIVE = 'Active';
const LABEL_PENDING = 'Pending';
const LABEL_NOT_CONNECTED = 'Not connected';

const JSON_CONTENT_TYPE = 'application/json';

const STATUS_LABEL_BY_WORD = {
  [STATUS_ACTIVE]: LABEL_ACTIVE,
  [STATUS_PENDING]: LABEL_PENDING,
};

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging Stripe base fallback or fetch retries

/**
 * vocab: getIdToken(true) = force a new Firebase ID token so Stripe does not see an expired one.
 * @returns {Promise<string>}
 */
async function freshFirebaseIdToken() {
  let currentUser = null;
  if (auth) {
    currentUser = auth.currentUser;
  }
  if (!currentUser) {
    throw new Error(LOGIN_REQUIRED_MESSAGE);
  }
  return currentUser.getIdToken(true);
}

/**
 * A phone pointing at localhost cannot finish Stripe hosted onboarding. Prefer a cloud base.
 * If every base was filtered out, keep the first candidate so the error is a real HTTP failure,
 * not a silent "we tried zero servers".
 * @returns {string[]}
 */
function cloudPreferredStripeApiBases() {
  const allBases = getResilientApiBases();
  const cloudBases = [];
  for (let index = 0; index < allBases.length; index += 1) {
    const apiBase = allBases[index];
    if (isCloudHostedApiBase(apiBase)) {
      cloudBases.push(apiBase);
    }
  }
  if (cloudBases.length > 0) {
    return cloudBases;
  }
  return allBases.slice(0, 1);
}

/**
 * An error we built from an HTTP response carries .status. A dropped network does not.
 * Only the HTTP one should stop the loop — retrying a 400 on the next base will fail the same way.
 * @param {Error} error
 * @returns {boolean}
 */
function errorHasHttpStatus(error) {
  if (!error) {
    return false;
  }
  return Boolean(error.status);
}

/**
 * @param {string} rawStatus
 * @returns {boolean}
 */
function isPendingStripeStatus(rawStatus) {
  if (rawStatus === STATUS_PENDING_VERIFICATION) {
    return true;
  }
  if (rawStatus === STATUS_PENDING) {
    return true;
  }
  return false;
}

/**
 * Turn a non-OK HTTP response into an Error with .status and optional .code.
 * @param {Response} response
 * @param {object} responseJson
 * @returns {Error}
 */
function httpErrorFromStripeResponse(response, responseJson) {
  let errorMessage = `Request failed (${response.status})`;
  if (responseJson && responseJson.error) {
    errorMessage = responseJson.error;
  }

  const requestError = new Error(errorMessage);
  requestError.status = response.status;
  if (responseJson && responseJson.code) {
    requestError.code = responseJson.code;
  }
  return requestError;
}

/**
 * Read JSON from the response; empty object when the body is not JSON.
 * @param {Response} response
 * @returns {Promise<object>}
 */
async function readJsonBodyOrEmpty(response) {
  try {
    return await response.json();
  } catch (parseError) {
    return {};
  }
}

async function fetchStripeJsonOnce(apiBase, path, idToken, requestBody, abortSignal) {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': JSON_CONTENT_TYPE,
      Accept: JSON_CONTENT_TYPE,
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(requestBody),
    signal: abortSignal,
  });

  const responseJson = await readJsonBodyOrEmpty(response);
  if (!response.ok) {
    throw httpErrorFromStripeResponse(response, responseJson);
  }
  return responseJson;
}

/**
 * POST JSON to one API base. The timeout aborts this attempt so the caller can try the next base.
 * vocab: AbortController = a handle that can cancel this fetch. The timer calls abort().
 * @param {string} apiBase
 * @param {string} path
 * @param {string} idToken
 * @param {object} requestBody
 * @returns {Promise<object>}
 */
async function postStripeToOneBase(apiBase, path, idToken, requestBody) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(function abortThisStripeAttempt() {
    abortController.abort();
  }, STRIPE_REQUEST_TIMEOUT_MS);

  try {
    return await fetchStripeJsonOnce(
      apiBase,
      path,
      idToken,
      requestBody,
      abortController.signal,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * One base: capture HTTP vs network so the walker can throw or continue without nested try/if.
 * @returns {Promise<{ didSucceed: boolean, responseJson?: object, httpError?: Error, error?: Error }>}
 */
async function attemptPostStripeOnBase(apiBase, path, idToken, requestBody) {
  try {
    const responseJson = await postStripeToOneBase(apiBase, path, idToken, requestBody);
    return { didSucceed: true, responseJson: responseJson };
  } catch (caughtError) {
    if (errorHasHttpStatus(caughtError)) {
      return { didSucceed: false, httpError: caughtError };
    }
    return { didSucceed: false, error: caughtError };
  }
}

/**
 * Walk each API base. An HTTP status error is final; a network drop tries the next base.
 * @param {string} path
 * @param {object} [requestBody]
 * @returns {Promise<object>}
 */
async function postStripeJson(path, requestBody = {}) {
  const idToken = await freshFirebaseIdToken();
  const apiBases = cloudPreferredStripeApiBases();
  let lastNetworkError = null;

  for (let index = 0; index < apiBases.length; index += 1) {
    const apiBase = apiBases[index];
    const baseAttempt = await attemptPostStripeOnBase(apiBase, path, idToken, requestBody);

    if (baseAttempt.httpError) {
      throw baseAttempt.httpError;
    }
    if (baseAttempt.didSucceed) {
      return baseAttempt.responseJson;
    }

    lastNetworkError = baseAttempt.error;
  }

  let networkMessage = CONNECTION_FAILED_MESSAGE;
  if (lastNetworkError && lastNetworkError.message) {
    networkMessage = lastNetworkError.message;
  }
  const networkError = new Error(networkMessage);
  networkError.code = NETWORK_ERROR_CODE;
  throw networkError;
}

// ===== MAIN FUNCTION =====

/**
 * Start Stripe Connect onboarding for this trainer.
 * @param {string} email
 * @returns {Promise<object>}
 */
export function createStripeConnectAccount(email) {
  // 1. POST /api/stripe/create-account with the trainer email.
  return postStripeJson(CREATE_ACCOUNT_PATH, { email: email });
}

/**
 * Ask the server whether Stripe has finished verifying the trainer.
 * @returns {Promise<object>}
 */
export function verifyStripeConnectStatus() {
  // 1. POST /api/stripe/verify-status — has Stripe finished verifying this trainer?
  return postStripeJson(VERIFY_STATUS_PATH);
}

/**
 * Read the trainer's Stripe balance.
 * @returns {Promise<object>}
 */
export function getStripeConnectBalance() {
  // 1. POST /api/stripe/get-balance for the signed-in trainer.
  return postStripeJson(GET_BALANCE_PATH);
}

/**
 * Collapse backend and older Firestore status spellings into one word.
 * Screens only switch on 'active', 'pending', and 'not_connected'.
 * @param {object} [userDoc]
 * @returns {'active'|'pending'|'not_connected'}
 */
export function resolveStripeStatus(userDoc = {}) {
  // 1. Prefer stripeStatus; older docs used stripeConnectStatus.
  let rawStatus = STATUS_NOT_CONNECTED;
  if (userDoc.stripeStatus) {
    rawStatus = userDoc.stripeStatus;
  } else if (userDoc.stripeConnectStatus) {
    rawStatus = userDoc.stripeConnectStatus;
  }

  // 2. Both pending spellings collapse to one word the screens can switch on.
  if (isPendingStripeStatus(rawStatus)) {
    return STATUS_PENDING;
  }
  if (rawStatus === STATUS_ACTIVE) {
    return STATUS_ACTIVE;
  }
  return STATUS_NOT_CONNECTED;
}

/**
 * Short label for a resolved Stripe status word.
 * @param {string} status
 * @returns {string}
 */
export function stripeStatusLabel(status) {
  // 1. Look up the short label; unknown words show as Not connected.
  const knownLabel = STATUS_LABEL_BY_WORD[status];
  if (knownLabel) {
    return knownLabel;
  }
  return LABEL_NOT_CONNECTED;
}
