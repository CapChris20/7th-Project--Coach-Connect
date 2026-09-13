/**
 * Client → trainer coaching charge API (Stripe Connect).
 *
 * Purpose: Post a card token to POST /api/charges so the client pays the trainer.
 * Why it matters: Keeps Stripe/backend wiring out of the payment modal UI.
 * Area: src/shared
 * Key exports: postCoachingCharge
 *
 * @file-header
 */
import { auth } from '../../app-start/config';
import { getResilientApiBases } from './baseUrl';

async function getIdToken() {
  const user = auth?.currentUser;
  if (!user) throw new Error('Please log in first.');
  return user.getIdToken(true);
}

/**
 * Charge the signed-in client and pay the given trainer.
 * @param {{ trainerId: string, amount: number, token: string, idempotencyKey?: string }} params
 * @returns {Promise<{ success: boolean, charge_id: string, trainer_gets: number }>}
 */
export async function postCoachingCharge({ trainerId, amount, token, idempotencyKey }) {
  const idToken = await getIdToken();
  const bases = getResilientApiBases();
  let lastError = null;

  for (const base of bases) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(`${base}/api/charges`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          trainerId,
          amount,
          token,
          ...(idempotencyKey ? { idempotencyKey } : {}),
        }),
        signal: controller.signal,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(json?.error || `Payment failed (${res.status})`);
        err.status = res.status;
        // 4xx are terminal (declined / not verified / bad amount) — don't retry other bases.
        if (res.status >= 400 && res.status < 500) throw err;
        lastError = err;
        continue;
      }
      return json;
    } catch (e) {
      if (e?.status >= 400 && e?.status < 500) throw e;
      lastError = e;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  const networkErr = new Error(lastError?.message || 'Network error, try again');
  networkErr.code = 'network_error';
  throw networkErr;
}
