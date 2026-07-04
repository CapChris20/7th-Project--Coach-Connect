/**
 * Payment setup popup eligibility + Firestore dismissal helpers.
 */
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../app-start/config';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function toMillis(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Whether the post-signup payment popup should appear. */
export function shouldShowPaymentSetupPopup(user = {}) {
  if (String(user.stripeAccountId || '').trim()) return false;
  if (user.stripeStatus === 'active' || user.stripeConnectStatus === 'active') return false;

  const dismissed = user.paymentPromptDismissed === true;
  if (!dismissed) return true;

  const dismissedAtMs = toMillis(user.paymentPromptDismissedAt);
  if (!dismissedAtMs) return true;

  return Date.now() - dismissedAtMs >= THIRTY_DAYS_MS;
}

/** Persist "Maybe later" dismissal on the trainer profile. */
export async function dismissPaymentSetupPopup(uid) {
  if (!uid || !db) return;
  await setDoc(
    doc(db, 'users', uid),
    {
      paymentPromptDismissed: true,
      paymentPromptDismissedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
