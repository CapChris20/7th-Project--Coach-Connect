// Decides when to show the "connect payouts" reminder, and records "Maybe later".
// Flow: already connected → hide; dismissed → hide for 30 days; brand-new trainer → show for 7 days.
// Used by: the trainer home reminder. This is an opt-in nudge, not a block on every login.

import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const STRIPE_STATUS_ACTIVE = 'active';
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_DAY =
  HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
// Manipulate here: how long "Maybe later" stays quiet, and how new an account must be to see the first prompt.
const DISMISS_QUIET_DAYS = 30;
const FIRST_PROMPT_WINDOW_DAYS = 7;
const DISMISS_QUIET_MS = DISMISS_QUIET_DAYS * MILLISECONDS_PER_DAY;
const FIRST_PROMPT_WINDOW_MS = FIRST_PROMPT_WINDOW_DAYS * MILLISECONDS_PER_DAY;

// ===== HELPER FUNCTIONS =====

/**
 * Turn a Firestore Timestamp, Date, or date string into milliseconds.
 * Missing or unreadable values return null so callers can skip the rule instead of using 0 (1970).
 * @param {*} timestampValue
 * @returns {number|null}
 */
function timestampToMillis(timestampValue) {
  if (!timestampValue) return null;
  // vocab: toDate() is Firestore Timestamp → JavaScript Date.
  if (typeof timestampValue?.toDate === 'function') return timestampValue.toDate().getTime();
  if (timestampValue instanceof Date) return timestampValue.getTime();
  const parsedTimeMs = Date.parse(timestampValue);
  return Number.isFinite(parsedTimeMs) ? parsedTimeMs : null;
}

/**
 * True once Stripe onboarding finished: an account id, or either status field set to active.
 * Any one of the three is enough because older trainer docs only filled some of them.
 * @param {object} user
 * @returns {boolean}
 */
function hasConnectedPayoutAccount(user) {
  const hasStripeAccountId = String(user.stripeAccountId || '').trim().length > 0;
  const isStripeActive = user.stripeStatus === STRIPE_STATUS_ACTIVE;
  const isConnectActive = user.stripeConnectStatus === STRIPE_STATUS_ACTIVE;
  return hasStripeAccountId || isStripeActive || isConnectActive;
}

/**
 * "Maybe later" is over only after the quiet window. No timestamp means stay hidden.
 * @param {object} user
 * @returns {boolean}
 */
function isDismissedQuietPeriodOver(user) {
  const dismissedAtMs = timestampToMillis(user.paymentPromptDismissedAt);
  if (!dismissedAtMs) return false;
  return Date.now() - dismissedAtMs >= DISMISS_QUIET_MS;
}

/**
 * First-week prompt uses onboarding time, then createdAt, then joinedAt — whichever the profile has.
 * @param {object} user
 * @returns {boolean}
 */
function isInsideFirstPromptWindow(user) {
  const createdAtMs =
    timestampToMillis(user.onboardingCompletedAt) ||
    timestampToMillis(user.createdAt) ||
    timestampToMillis(user.joinedAt);
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
  // 1. Already connected → never nudge.
  if (hasConnectedPayoutAccount(user)) return false;

  // 2. They tapped Maybe later → stay quiet unless the 30-day window has passed.
  const isDismissed = user.paymentPromptDismissed === true;
  if (isDismissed) return isDismissedQuietPeriodOver(user);

  // 3. Brand-new trainer → show for the first 7 days.
  return isInsideFirstPromptWindow(user);
}

/**
 * Save "Maybe later" on the trainer profile.
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function dismissPayoutSetupReminderPopup(uid) {
  // 1. No uid or no Firestore → skip. Do not throw; closing the popup still works.
  if (!uid || !db) return;

  // 2. Write Maybe later. merge: true keeps the rest of the users doc.
  await setDoc(
    doc(db, USERS_COLLECTION, uid),
    {
      paymentPromptDismissed: true,
      // vocab: serverTimestamp() is the server clock, so the 30-day quiet window is not affected by a wrong phone clock.
      paymentPromptDismissedAt: serverTimestamp(),
    },
    // vocab: merge: true updates these fields without wiping the rest of the users doc.
    { merge: true },
  );
}
