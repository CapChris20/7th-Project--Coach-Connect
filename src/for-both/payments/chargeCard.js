// Posts a card token to POST /api/charges so the signed-in client pays a trainer.
// Flow: get a fresh login token → try each API base until one accepts the charge → surface a decline immediately.
// Used by the pay-trainer popup. Stripe details stay out of that screen.

import { auth } from '../../app-start/cloudConnection';
import { getResilientApiBases } from '../online-connection/whereToConnect';

// ===== NAMED CONSTANTS =====

const CHARGES_PATH = '/api/charges';
// Manipulate here: how long to wait on one API base before trying the next.
const CHARGE_TIMEOUT_MS = 20000;
const CLIENT_ERROR_MIN = 400;
const CLIENT_ERROR_MAX = 500;
const NETWORK_ERROR_CODE = 'network_error';
const NETWORK_ERROR_FALLBACK_MESSAGE = 'Network error, try again';
const NOT_SIGNED_IN_MESSAGE = 'Please log in first.';
const JSON_CONTENT_TYPE = 'application/json';

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging charge retries or AbortController timeouts

function buildChargeRequestBody(trainerId, amount, token, idempotencyKey) {
  const chargeBody = { trainerId, amount, token };
  if (idempotencyKey) {
    chargeBody.idempotencyKey = idempotencyKey;
  }
  return chargeBody;
}

function buildNetworkFailureError(lastRetryableError) {
  let errorMessage = NETWORK_ERROR_FALLBACK_MESSAGE;
  if (lastRetryableError && lastRetryableError.message) {
    errorMessage = lastRetryableError.message;
  }

  const networkError = new Error(errorMessage);
  networkError.code = NETWORK_ERROR_CODE;
  return networkError;
}

async function getFirebaseIdTokenForCurrentUser() {
  let currentUser = null;
  if (auth) {
    currentUser = auth.currentUser;
  }
  if (!currentUser) {
    throw new Error(NOT_SIGNED_IN_MESSAGE);
  }
  // vocab: getIdToken(true) = force-refresh so the Bearer token is not stale
  const idToken = await currentUser.getIdToken(true);
  return idToken;
}

function httpStatusIsClientError(statusCode) {
  if (typeof statusCode !== 'number') {
    return false;
  }
  if (statusCode < CLIENT_ERROR_MIN) {
    return false;
  }
  if (statusCode >= CLIENT_ERROR_MAX) {
    return false;
  }
  return true;
}

function paymentErrorFromFailedResponse(responseBody, statusCode) {
  let errorMessage = `Payment failed (${statusCode})`;
  if (responseBody && responseBody.error) {
    errorMessage = responseBody.error;
  }

  const paymentError = new Error(errorMessage);
  paymentError.status = statusCode;
  return paymentError;
}

// vocab: AbortController = cancel this fetch when CHARGE_TIMEOUT_MS fires. RN fetch has no timeout option.
async function postChargeJsonToApiBase(apiBase, idToken, chargeBody) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(function abortThisChargeAttempt() {
    abortController.abort();
  }, CHARGE_TIMEOUT_MS);

  try {
    const chargeUrl = `${apiBase}${CHARGES_PATH}`;
    const response = await fetch(chargeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': JSON_CONTENT_TYPE,
        Accept: JSON_CONTENT_TYPE,
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(chargeBody),
      signal: abortController.signal,
    });

    let responseBody = {};
    try {
      responseBody = await response.json();
    } catch (parseError) {
      responseBody = {};
    }

    return { response: response, responseBody: responseBody };
  } finally {
    clearTimeout(timeoutId);
  }
}

// One API base. A declined card is returned as clientError and is not tried on the next base.
async function tryChargeOnOneApiBase(apiBase, idToken, chargeBody) {
  try {
    const postResult = await postChargeJsonToApiBase(apiBase, idToken, chargeBody);
    const response = postResult.response;
    const responseBody = postResult.responseBody;

    if (response.ok) {
      return { responseBody: responseBody };
    }

    const paymentError = paymentErrorFromFailedResponse(responseBody, response.status);
    if (httpStatusIsClientError(response.status)) {
      return { clientError: paymentError };
    }
    return { retryableError: paymentError };
  } catch (networkOrParseError) {
    let errorStatus = null;
    if (networkOrParseError) {
      errorStatus = networkOrParseError.status;
    }
    if (httpStatusIsClientError(errorStatus)) {
      return { clientError: networkOrParseError };
    }
    return { retryableError: networkOrParseError };
  }
}

// ===== MAIN FUNCTION =====

/**
 * Charge the signed-in client and pay the given trainer.
 * A 4xx (declined, not verified, bad amount) is not retried on another base.
 * @param {{ trainerId: string, amount: number, token: string, idempotencyKey?: string }} charge
 * @returns {Promise<object>}
 */
export async function postCoachingCharge({ trainerId, amount, token, idempotencyKey }) {
  // 1. Fresh login token — the charges route rejects a stale one.
  const idToken = await getFirebaseIdTokenForCurrentUser();
  const apiBases = getResilientApiBases();

  // 2. Body keeps the Stripe token, not the card number. Keys stay trainerId / amount / token.
  const chargeBody = buildChargeRequestBody(trainerId, amount, token, idempotencyKey);

  // 3. Try each API base. A 4xx (decline, not verified, bad amount) stops the loop.
  let lastRetryableError = null;
  for (let index = 0; index < apiBases.length; index += 1) {
    const apiBase = apiBases[index];
    const attemptResult = await tryChargeOnOneApiBase(apiBase, idToken, chargeBody);

    if (attemptResult.responseBody) {
      return attemptResult.responseBody;
    }
    if (attemptResult.clientError) {
      throw attemptResult.clientError;
    }

    lastRetryableError = attemptResult.retryableError;
  }

  // 4. Every base dropped or timed out → one network error the popup can map.
  throw buildNetworkFailureError(lastRetryableError);
}
