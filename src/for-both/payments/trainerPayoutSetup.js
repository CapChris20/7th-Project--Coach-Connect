// Stripe Connect calls for a trainer's payout account: create it, check it, read the balance.
// Flow: require a signed-in user → POST only cloud API bases → one status word the screens can switch on.
// Used by the payout setup flow, the earnings screen, and Settings. HTTP errors are not retried.

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

// ===== HELPER FUNCTIONS =====

async function getIdToken() {
  const currentUser = auth?.currentUser;
  if (!currentUser) throw new Error(LOGIN_REQUIRED_MESSAGE);
  // vocab: getIdToken(true) = force a new Firebase ID token so Stripe does not see an expired one.
  return currentUser.getIdToken(true);
}

// A phone pointing at localhost cannot finish Stripe hosted onboarding. Prefer a cloud base.
// If every base was filtered out, keep the first candidate so the error is a real HTTP failure,
// not a silent "we tried zero servers".
function stripeApiBases() {
  const cloudBases = getResilientApiBases().filter(isCloudHostedApiBase);
  if (cloudBases.length) return cloudBases;
  return getResilientApiBases().slice(0, 1);
}

// An error we built from an HTTP response carries .status. A dropped network does not.
// Only the HTTP one should stop the loop — retrying a 400 on the next base will fail the same way.
function isHttpStatusError(error) {
  return Boolean(error?.status);
}

async function postStripeToBase(apiBase, path, idToken, body) {
  // vocab: AbortController = a handle that can cancel this fetch. The timer calls abort().
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STRIPE_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      const requestError = new Error(responseBody?.error || `Request failed (${response.status})`);
      requestError.status = response.status;
      requestError.code = responseBody?.code;
      throw requestError;
    }
    return responseBody;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function postStripe(path, body = {}) {
  const idToken = await getIdToken();
  const apiBases = stripeApiBases();
  let lastError = null;

  for (const apiBase of apiBases) {
    try {
      return await postStripeToBase(apiBase, path, idToken, body);
    } catch (error) {
      if (isHttpStatusError(error)) throw error;
      lastError = error;
    }
  }

  const networkError = new Error(lastError?.message || CONNECTION_FAILED_MESSAGE);
  networkError.code = NETWORK_ERROR_CODE;
  throw networkError;
}

function isPendingStripeStatus(rawStatus) {
  return rawStatus === STATUS_PENDING_VERIFICATION || rawStatus === STATUS_PENDING;
}

// ===== MAIN FUNCTION =====

/**
 * Start Stripe Connect onboarding for this trainer.
 * @param {string} email
 * @returns {Promise<object>}
 */
export function createStripeConnectAccount(email) {
  return postStripe(CREATE_ACCOUNT_PATH, { email });
}

/**
 * Ask the server whether Stripe has finished verifying the trainer.
 * @returns {Promise<object>}
 */
export function verifyStripeConnectStatus() {
  return postStripe(VERIFY_STATUS_PATH);
}

/**
 * Read the trainer's Stripe balance.
 * @returns {Promise<object>}
 */
export function getStripeConnectBalance() {
  return postStripe(GET_BALANCE_PATH);
}

/**
 * Collapse backend and older Firestore status spellings into one word.
 * Screens only switch on 'active', 'pending', and 'not_connected'.
 * @param {object} [userDoc]
 * @returns {'active'|'pending'|'not_connected'}
 */
export function resolveStripeStatus(userDoc = {}) {
  const rawStatus = userDoc.stripeStatus || userDoc.stripeConnectStatus || STATUS_NOT_CONNECTED;
  if (isPendingStripeStatus(rawStatus)) return STATUS_PENDING;
  if (rawStatus === STATUS_ACTIVE) return STATUS_ACTIVE;
  return STATUS_NOT_CONNECTED;
}

/**
 * Short label for a resolved Stripe status.
 * @param {string} status
 * @returns {string}
 */
export function stripeStatusLabel(status) {
  switch (status) {
    case STATUS_ACTIVE:
      return LABEL_ACTIVE;
    case STATUS_PENDING:
      return LABEL_PENDING;
    default:
      return LABEL_NOT_CONNECTED;
  }
}
