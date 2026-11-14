// Tells the trainer's home screen that a client updated a dashboard number.
// Flow: require both ids → attach the login header → POST /api/notifications/create on each API base.
// Used by: client home screen + workout diary. Failure returns { ok: false } and never throws.

import { getApiBaseCandidates } from './whereToConnect';
import { getApiAuthHeaders } from './attachLoginProof';

// ===== NAMED CONSTANTS =====

const CREATE_NOTIFICATION_PATH = '/api/notifications/create';
const DEFAULT_NOTIFICATION_TYPE = 'dashboard_update';
const JSON_CONTENT_TYPE = 'application/json';

const REASON_MISSING_FIELDS = 'missing_fields';
const REASON_NOT_SIGNED_IN = 'not_signed_in';
const REASON_NETWORK_ERROR = 'network_error';
const REASON_UNREACHABLE = 'unreachable';

// ===== HELPER FUNCTIONS =====

// Missing Authorization and a thrown auth lookup are the same outcome:
// there is no one to send as, so the alert is skipped.
async function buildSignedInJsonHeadersOrNull() {
  try {
    const authHeaders = await getApiAuthHeaders({ 'Content-Type': JSON_CONTENT_TYPE });
    const userHasBearerToken = Boolean(authHeaders.Authorization);
    if (!userHasBearerToken) return null;
    return authHeaders;
  } catch (_authLookupFailed) {
    return null;
  }
}

// Unlike linkTrainerAndTrainee, this URL is joined as-is. Do not strip a trailing slash here.
async function postCreateNotificationOnce(apiBase, authHeaders, requestBodyText) {
  try {
    const response = await fetch(`${apiBase}${CREATE_NOTIFICATION_PATH}`, {
      method: 'POST',
      headers: authHeaders,
      body: requestBodyText,
    });
    if (response.ok) return { ok: true };
    return { ok: false, reason: `http_${response.status}` };
  } catch (networkError) {
    // vocab/symbol: ?. = only read .message when networkError is not null/undefined
    return { ok: false, reason: networkError?.message || REASON_NETWORK_ERROR };
  }
}

async function tryCreateNotificationOnEachBase(apiBaseList, authHeaders, requestBodyText) {
  let lastFailureReason = '';

  for (const apiBase of apiBaseList) {
    const attempt = await postCreateNotificationOnce(apiBase, authHeaders, requestBodyText);
    if (attempt.ok) return { ok: true };
    lastFailureReason = attempt.reason;
  }

  return { ok: false, reason: lastFailureReason || REASON_UNREACHABLE };
}

// ===== MAIN FUNCTION =====

/**
 * Create a dashboard notification for the trainer.
 * recipientId = trainer uid. clientId = signed-in client uid.
 * @param {object} notificationRequest
 * @param {string} notificationRequest.recipientId
 * @param {string} notificationRequest.clientId
 * @param {string} [notificationRequest.type]
 * @param {object} [notificationRequest.payload]
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function postDashboardNotification({
  recipientId,
  clientId,
  type = DEFAULT_NOTIFICATION_TYPE,
  payload = {},
}) {
  // 1. Both uids are required — the server cannot route the alert without them.
  const trainerAndClientArePresent = Boolean(recipientId && clientId);
  if (!trainerAndClientArePresent) {
    return { ok: false, reason: REASON_MISSING_FIELDS };
  }

  // 2. No login token means we cannot act as the client; skip quietly.
  const signedInHeaders = await buildSignedInJsonHeadersOrNull();
  if (!signedInHeaders) {
    return { ok: false, reason: REASON_NOT_SIGNED_IN };
  }

  // 3. Walk every API base until one accepts the create call.
  // vocab: getApiBaseCandidates = ordered list of host URLs (primary, then fallbacks).
  const requestBodyText = JSON.stringify({
    recipientId,
    clientId,
    type,
    payload,
  });
  const apiBaseList = getApiBaseCandidates();
  const createResult = await tryCreateNotificationOnEachBase(
    apiBaseList,
    signedInHeaders,
    requestBodyText,
  );
  return createResult;
}
