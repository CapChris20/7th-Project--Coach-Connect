// Tells the trainer's home screen that a client updated a dashboard number.
// Flow: require both ids → attach the login header → POST /api/notifications/create on each API base.
// Used by the client home screen and the workout diary. Failure returns { ok: false } and never throws.

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

// Missing header and a thrown auth lookup are the same outcome for the caller:
// there is no one to send as, so the alert is skipped.
async function signedInJsonHeaders() {
  try {
    const authHeaders = await getApiAuthHeaders({ 'Content-Type': JSON_CONTENT_TYPE });
    const isSignedIn = Boolean(authHeaders.Authorization);
    if (!isSignedIn) return null;
    return authHeaders;
  } catch (_) {
    return null;
  }
}

// Unlike the link-trainer call, this URL is joined as-is. Do not strip a trailing slash here.
async function postNotificationToBase(apiBase, authHeaders, requestBody) {
  try {
    const response = await fetch(`${apiBase}${CREATE_NOTIFICATION_PATH}`, {
      method: 'POST',
      headers: authHeaders,
      body: requestBody,
    });
    if (response.ok) return { ok: true };
    return { ok: false, reason: `http_${response.status}` };
  } catch (error) {
    return { ok: false, reason: error?.message || REASON_NETWORK_ERROR };
  }
}

// ===== MAIN FUNCTION =====

/**
 * Create a dashboard notification for the trainer.
 * @param {object} notificationRequest
 * @param {string} notificationRequest.recipientId Trainer uid
 * @param {string} notificationRequest.clientId Client uid (must match the signed-in user)
 * @param {string} [notificationRequest.type] Defaults to dashboard_update
 * @param {object} [notificationRequest.payload] { type, label, value, ... }
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function postDashboardNotification({
  recipientId,
  clientId,
  type = DEFAULT_NOTIFICATION_TYPE,
  payload = {},
}) {
  const hasRequiredIds = Boolean(recipientId && clientId);
  if (!hasRequiredIds) {
    return { ok: false, reason: REASON_MISSING_FIELDS };
  }

  const authHeaders = await signedInJsonHeaders();
  if (!authHeaders) {
    return { ok: false, reason: REASON_NOT_SIGNED_IN };
  }

  const requestBody = JSON.stringify({ recipientId, clientId, type, payload });
  const apiBases = getApiBaseCandidates();
  let lastFailure = '';

  for (const apiBase of apiBases) {
    const result = await postNotificationToBase(apiBase, authHeaders, requestBody);
    if (result.ok) return { ok: true };
    lastFailure = result.reason;
  }

  return { ok: false, reason: lastFailure || REASON_UNREACHABLE };
}
