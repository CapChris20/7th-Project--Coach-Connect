// Decides when to show the "connect payouts" reminder, and records "Maybe later".
// Flow: already connected → hide; dismissed → hide for 30 days; brand-new trainer → show for 7 days.
// Used by the trainer home reminder. This is an opt-in nudge, not a block on every login.

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const STRIPE_STATUS_ACTIVE = 'active';
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
// Manipulate here: how long "Maybe later" stays quiet, and how new an account must be to see the first prompt.
const DISMISS_QUIET_DAYS = 30;
const FIRST_PROMPT_WINDOW_DAYS = 7;
const DISMISS_QUIET_MS = DISMISS_QUIET_DAYS * MILLISECONDS_PER_DAY;
const FIRST_PROMPT_WINDOW_MS = FIRST_PROMPT_WINDOW_DAYS * MILLISECONDS_PER_DAY;

// ===== HELPER FUNCTIONS =====

function toMillis(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasConnectedPayoutAccount(user) {
  const hasStripeAccountId = String(user.stripeAccountId || '').trim().length > 0;
  const isStripeActive = user.stripeStatus === STRIPE_STATUS_ACTIVE;
  const isConnectActive = user.stripeConnectStatus === STRIPE_STATUS_ACTIVE;
  return hasStripeAccountId || isStripeActive || isConnectActive;
}

function isDismissedQuietPeriodOver(user) {
  const dismissedAtMs = toMillis(user.paymentPromptDismissedAt);
  if (!dismissedAtMs) return false;
  return Date.now() - dismissedAtMs >= DISMISS_QUIET_MS;
}

function isInsideFirstPromptWindow(user) {
  const createdAtMs =
    toMillis(user.onboardingCompletedAt) ||
    toMillis(user.createdAt) ||
    toMillis(user.joinedAt);
  if (!createdAtMs) return false;
  return Date.now() - createdAtMs <= FIRST_PROMPT_WINDOW_MS;
}

// ===== MAIN FUNCTION =====

/**
 * Whether the post-signup payout popup should appear.
 * @param {object} [user]
 * @returns {boolean}
 */
export function shouldShowPayoutSetupReminderPopup(user = {}) {
  if (hasConnectedPayoutAccount(user)) return false;

  const isDismissed = user.paymentPromptDismissed === true;
  if (isDismissed) return isDismissedQuietPeriodOver(user);

  return isInsideFirstPromptWindow(user);
}

/**
 * Save "Maybe later" on the trainer profile.
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function dismissPayoutSetupReminderPopup(uid) {
  if (!uid || !db) return;
  await setDoc(
    doc(db, USERS_COLLECTION, uid),
    {
      paymentPromptDismissed: true,
      paymentPromptDismissedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
