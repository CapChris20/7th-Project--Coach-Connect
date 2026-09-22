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

/** Whether the post-signup payment popup should appear.
 * Opt-in reminder only — never spam trainers who already dismissed, and
 * don't force payment UI on every login.
 */
export function shouldShowPaymentSetupPopup(user = {}) {
  if (String(user.stripeAccountId || '').trim()) return false;
  if (user.stripeStatus === 'active' || user.stripeConnectStatus === 'active') return false;

  // Already said "Maybe later" — don't show again until 30 days later
  const dismissed = user.paymentPromptDismissed === true;
  if (dismissed) {
    const dismissedAtMs = toMillis(user.paymentPromptDismissedAt);
    if (!dismissedAtMs) return false;
    return Date.now() - dismissedAtMs >= THIRTY_DAYS_MS;
  }

  // First-time only within 7 days of account creation / onboarding finish
  const createdMs =
    toMillis(user.onboardingCompletedAt) ||
    toMillis(user.createdAt) ||
    toMillis(user.joinedAt);
  if (!createdMs) return false;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - createdMs <= SEVEN_DAYS_MS;
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
