/**
 * Server-backed Firestore notifications (dashboard metric updates).
 */
import { getApiBaseCandidates } from './baseUrl';
import { getApiAuthHeaders } from './getAuthHeaders';

/**
 * @param {object} p
 * @param {string} p.recipientId - Trainer uid
 * @param {string} p.clientId - Client uid (must match signed-in user)
 * @param {string} [p.type] - defaults to dashboard_update
 * @param {object} p.payload - { type, label, value, ... }
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function postDashboardNotification({ recipientId, clientId, type = 'dashboard_update', payload = {} }) {
  if (!recipientId || !clientId) {
    return { ok: false, reason: 'missing_fields' };
  }

  let authHeaders = {};
  try {
    authHeaders = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
  } catch (_) {
    return { ok: false, reason: 'not_signed_in' };
  }
  if (!authHeaders.Authorization) {
    return { ok: false, reason: 'not_signed_in' };
  }

  const body = JSON.stringify({ recipientId, clientId, type, payload });
  const bases = getApiBaseCandidates();
  let lastFailure = '';

  for (const API_BASE_URL of bases) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/create`, {
        method: 'POST',
        headers: authHeaders,
        body,
      });
      if (res.ok) return { ok: true };
      lastFailure = `http_${res.status}`;
    } catch (e) {
      lastFailure = e?.message || 'network_error';
    }
  }

  return { ok: false, reason: lastFailure || 'unreachable' };
}
