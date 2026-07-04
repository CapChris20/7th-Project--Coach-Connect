import { auth } from '../app-start/config';
import { getResilientApiBases } from '../shared/api/baseUrl';

async function getIdToken() {
  const user = auth?.currentUser;
  if (!user) throw new Error('Not signed in');
  return user.getIdToken(true);
}

/**
 * @param {'verify' | 'restore'} action
 * @param {Record<string, unknown>} body
 */
async function postSubscription(action, body) {
  const token = await getIdToken();
  const bases = getResilientApiBases();
  let lastError = null;

  for (const base of bases) {
    try {
      const res = await fetch(`${base}/api/subscription/apple/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(json?.error || `Request failed (${res.status})`);
        err.code = json?.code || 'request_failed';
        err.status = res.status;
        throw err;
      }
      return json;
    } catch (e) {
      lastError = e;
      if (e?.code === 'verification_failed' || e?.status === 403) {
        throw e;
      }
    }
  }

  const networkErr = new Error(lastError?.message || 'Network request failed');
  networkErr.code = 'network_error';
  throw networkErr;
}

/**
 * @param {import('expo-iap').Purchase} purchase
 */
export async function verifyAppleSubscriptionOnServer(purchase) {
  return postSubscription('verify', {
    productId: purchase?.productId,
    transactionId: purchase?.transactionId,
    purchaseToken: purchase?.purchaseToken || purchase?.transactionReceipt,
    expirationDateIOS: purchase?.expirationDateIOS ?? null,
    environmentIOS: purchase?.environmentIOS ?? null,
    transactionDate: purchase?.transactionDate ?? null,
  });
}

export async function restoreAppleSubscriptionOnServer(purchases = []) {
  return postSubscription('restore', {
    purchases: purchases.map((p) => ({
      productId: p?.productId,
      transactionId: p?.transactionId,
      purchaseToken: p?.purchaseToken || p?.transactionReceipt,
      expirationDateIOS: p?.expirationDateIOS ?? null,
      environmentIOS: p?.environmentIOS ?? null,
      transactionDate: p?.transactionDate ?? null,
    })),
  });
}
