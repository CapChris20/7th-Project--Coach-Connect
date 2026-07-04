/**
 * Trainer Stripe Connect onboarding API.
 *
 * Purpose: Create Connect accounts, poll verification, fetch balance.
 * Why it matters: Keeps Stripe Connect HTTP calls out of UI components.
 * Area: src/shared
 * Key exports: createStripeConnectAccount, verifyStripeConnectStatus, getStripeConnectBalance
 *
 * @file-header
 */
import { auth } from '../../app-start/config';
import { getResilientApiBases, isCloudHostedApiBase } from './baseUrl';

async function getIdToken() {
  const user = auth?.currentUser;
  if (!user) throw new Error('Please log in first.');
  return user.getIdToken(true);
}

function stripeApiBases() {
  const bases = getResilientApiBases().filter(isCloudHostedApiBase);
  return bases.length ? bases : getResilientApiBases().slice(0, 1);
}

async function postStripe(path, body = {}) {
  const token = await getIdToken();
  const bases = stripeApiBases();
  let lastError = null;

  for (const base of bases) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(json?.error || `Request failed (${res.status})`);
        err.status = res.status;
        err.code = json?.code;
        throw err;
      }
      return json;
    } catch (e) {
      if (e?.status) throw e;
      lastError = e;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const networkErr = new Error(lastError?.message || 'Connection failed, try again');
  networkErr.code = 'network_error';
  throw networkErr;
}

export function createStripeConnectAccount(email) {
  return postStripe('/api/stripe/create-account', { email });
}

export function verifyStripeConnectStatus() {
  return postStripe('/api/stripe/verify-status');
}

export function getStripeConnectBalance() {
  return postStripe('/api/stripe/get-balance');
}

/** Normalize backend + legacy Firestore stripe status fields. */
export function resolveStripeStatus(userDoc = {}) {
  const raw = userDoc.stripeStatus || userDoc.stripeConnectStatus || 'not_connected';
  if (raw === 'pending_verification' || raw === 'pending') return 'pending';
  if (raw === 'active') return 'active';
  return 'not_connected';
}

export function stripeStatusLabel(status) {
  switch (status) {
    case 'active':
      return 'Active';
    case 'pending':
      return 'Pending';
    default:
      return 'Not connected';
  }
}
