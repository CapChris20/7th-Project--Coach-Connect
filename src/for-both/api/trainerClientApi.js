/**
 * Trainer CRM actions via server (Admin SDK writes).
 */
import { getApiBaseCandidates } from './baseUrl';
import { getApiAuthHeaders } from './getAuthHeaders';

/**
 * Accept a pending connection request and link trainer ↔ client.
 * @param {object} p
 * @param {string} p.trainerId
 * @param {string} p.clientId
 * @param {string} p.messageId
 * @param {object} [p.clientData]
 */
export async function postAcceptTrainerClient({ trainerId, clientId, messageId, clientData = {} }) {
  if (!trainerId || !clientId || !messageId) {
    throw new Error('trainerId, clientId, and messageId are required');
  }

  const headers = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
  if (!headers.Authorization) {
    throw new Error('Not signed in');
  }

  const body = JSON.stringify({ trainerId, clientId, messageId, clientData });
  const bases = getApiBaseCandidates();
  let lastError = null;

  for (const base of bases) {
    try {
      const res = await fetch(`${String(base).replace(/\/$/, '')}/api/trainer/accept-client`, {
        method: 'POST',
        headers,
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;
      lastError = new Error(data?.error || `HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('Could not reach Coach Connect API');
}

/**
 * Set monthly coaching rate for a linked client (writes users + trainer_clients).
 * @param {object} p
 * @param {string} p.clientId
 * @param {number} p.monthlyRateCents
 */
export async function postSetClientRate({ clientId, monthlyRateCents }) {
  if (!clientId) throw new Error('clientId is required');
  const cents = Math.round(Number(monthlyRateCents));
  if (!Number.isFinite(cents) || cents < 100) {
    throw new Error('Enter a rate of at least $1');
  }

  const headers = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
  if (!headers.Authorization) {
    throw new Error('Not signed in');
  }

  const body = JSON.stringify({ clientId, monthlyRateCents: cents });
  const bases = getApiBaseCandidates();
  let lastError = null;

  for (const base of bases) {
    try {
      const res = await fetch(`${String(base).replace(/\/$/, '')}/api/trainer/set-client-rate`, {
        method: 'POST',
        headers,
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;
      lastError = new Error(data?.error || `HTTP ${res.status}`);
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error('Could not reach Coach Connect API');
}
