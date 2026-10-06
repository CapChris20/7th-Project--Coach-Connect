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

// ===== HELPER FUNCTIONS =====

async function getIdToken() {
  const currentUser = auth?.currentUser;
  if (!currentUser) throw new Error('Please log in first.');
  return currentUser.getIdToken(true);
}

function isClientErrorStatus(statusCode) {
  return statusCode >= CLIENT_ERROR_MIN && statusCode < CLIENT_ERROR_MAX;
}

async function postChargeToBase(apiBase, idToken, chargeBody) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CHARGE_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBase}${CHARGES_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(chargeBody),
      signal: controller.signal,
    });
    const responseBody = await response.json().catch(() => ({}));
    return { response, responseBody };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * One API base. A declined card throws later and is not tried on the next base.
 * @returns {Promise<{ responseBody?: object, clientError?: Error, retryableError?: Error }>}
 */
async function tryChargeOnOneBase(apiBase, idToken, chargeBody) {
  try {
    const { response, responseBody } = await postChargeToBase(apiBase, idToken, chargeBody);
    if (response.ok) return { responseBody };

    const paymentError = new Error(responseBody?.error || `Payment failed (${response.status})`);
    paymentError.status = response.status;
    if (isClientErrorStatus(response.status)) return { clientError: paymentError };
    return { retryableError: paymentError };
  } catch (error) {
    if (isClientErrorStatus(error?.status)) return { clientError: error };
    return { retryableError: error };
  }
}

// ===== MAIN FUNCTION =====

/**
 * Charge the signed-in client and pay the given trainer.
 * A 4xx (declined, not verified, bad amount) is not retried on another base.
 * @param {{ trainerId: string, amount: number, token: string, idempotencyKey?: string }} charge
 * @returns {Promise<{ success: boolean, charge_id: string, trainer_gets: number }>}
 */
export async function postCoachingCharge({ trainerId, amount, token, idempotencyKey }) {
  const idToken = await getIdToken();
  const apiBases = getResilientApiBases();
  const chargeBody = {
    trainerId,
    amount,
    token,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };
  let lastError = null;

  for (const apiBase of apiBases) {
    const attempt = await tryChargeOnOneBase(apiBase, idToken, chargeBody);
    if (attempt.responseBody) return attempt.responseBody;
    if (attempt.clientError) throw attempt.clientError;
    lastError = attempt.retryableError;
  }

  const networkError = new Error(lastError?.message || 'Network error, try again');
  networkError.code = 'network_error';
  throw networkError;
}
