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

// Firestore field letters stay frozen — callers and older trainer docs already use these names.
const FIELD_PAYMENT_PROMPT_DISMISSED = 'paymentPromptDismissed';
const FIELD_PAYMENT_PROMPT_DISMISSED_AT = 'paymentPromptDismissedAt';
const FIELD_STRIPE_ACCOUNT_ID = 'stripeAccountId';
const FIELD_STRIPE_STATUS = 'stripeStatus';
const FIELD_STRIPE_CONNECT_STATUS = 'stripeConnectStatus';
const FIELD_ONBOARDING_COMPLETED_AT = 'onboardingCompletedAt';
const FIELD_CREATED_AT = 'createdAt';
const FIELD_JOINED_AT = 'joinedAt';

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging Stripe flags or date parsing

/**
 * True once Stripe onboarding finished: an account id, or either status field set to active.
 * Any one of the three is enough because older trainer docs only filled some of them.
 * @param {object} user
 * @returns {boolean}
 */
function trainerHasConnectedPayoutAccount(user) {
  const stripeAccountIdText = String(user[FIELD_STRIPE_ACCOUNT_ID] || '').trim();
  const hasStripeAccountId = stripeAccountIdText.length > 0;
  const isStripeStatusActive = user[FIELD_STRIPE_STATUS] === STRIPE_STATUS_ACTIVE;
  const isConnectStatusActive = user[FIELD_STRIPE_CONNECT_STATUS] === STRIPE_STATUS_ACTIVE;
  if (hasStripeAccountId) {
    return true;
  }
  if (isStripeStatusActive) {
    return true;
  }
  if (isConnectStatusActive) {
    return true;
  }
  return false;
}

/**
 * Turn a Firestore Timestamp, Date, or date string into milliseconds.
 * Missing or unreadable values return null so callers skip the rule instead of using 0 (1970).
 * @param {*} timestampValue
 * @returns {number|null}
 */
function firestoreTimeToMillis(timestampValue) {
  if (!timestampValue) {
    return null;
  }

  // vocab: toDate() is Firestore Timestamp → JavaScript Date.
  const hasToDateMethod = typeof timestampValue.toDate === 'function';
  if (hasToDateMethod) {
    return timestampValue.toDate().getTime();
  }

  if (timestampValue instanceof Date) {
    return timestampValue.getTime();
  }

  const parsedTimeMs = Date.parse(timestampValue);
  const parsedOk = Number.isFinite(parsedTimeMs);
  if (!parsedOk) {
    return null;
  }
  return parsedTimeMs;
}

function millisIsInsideFirstPromptWindow(createdAtMs) {
  const millisSinceCreated = Date.now() - createdAtMs;
  return millisSinceCreated <= FIRST_PROMPT_WINDOW_MS;
}

/**
 * "Maybe later" is over only after the quiet window. No timestamp means stay hidden.
 * @param {object} user
 * @returns {boolean}
 */
function dismissedQuietPeriodHasEnded(user) {
  const dismissedAtMs = firestoreTimeToMillis(user[FIELD_PAYMENT_PROMPT_DISMISSED_AT]);
  if (!dismissedAtMs) {
    return false;
  }

  const millisSinceDismiss = Date.now() - dismissedAtMs;
  return millisSinceDismiss >= DISMISS_QUIET_MS;
}

/**
 * First-week prompt uses onboarding time, then createdAt, then joinedAt — whichever the profile has.
 * @param {object} user
 * @returns {boolean}
 */
function trainerIsInsideFirstPromptWindow(user) {
  const onboardingDoneMs = firestoreTimeToMillis(user[FIELD_ONBOARDING_COMPLETED_AT]);
  if (onboardingDoneMs) {
    return millisIsInsideFirstPromptWindow(onboardingDoneMs);
  }

  const createdAtMs = firestoreTimeToMillis(user[FIELD_CREATED_AT]);
  if (createdAtMs) {
    return millisIsInsideFirstPromptWindow(createdAtMs);
  }

  const joinedAtMs = firestoreTimeToMillis(user[FIELD_JOINED_AT]);
  if (!joinedAtMs) {
    return false;
  }
  return millisIsInsideFirstPromptWindow(joinedAtMs);
}

// ===== MAIN FUNCTION =====

/**
 * Whether the post-signup payout popup should appear.
 * Flow: 1. connected?  2. dismissed quiet window?  3. inside first-week window?
 * @param {object} [user]
 * @returns {boolean}
 */
export function shouldShowPayoutSetupReminderPopup(user = {}) {
  // 1. Already connected to Stripe → never nudge again.
  const payoutAlreadyConnected = trainerHasConnectedPayoutAccount(user);
  if (payoutAlreadyConnected) {
    return false;
  }

  // 2. They tapped Maybe later → stay quiet unless the 30-day window has passed.
  const userTappedMaybeLater = user[FIELD_PAYMENT_PROMPT_DISMISSED] === true;
  if (userTappedMaybeLater) {
    return dismissedQuietPeriodHasEnded(user);
  }

  // 3. Brand-new trainer → show for the first 7 days after they joined / finished onboarding.
  return trainerIsInsideFirstPromptWindow(user);
}

/**
 * Save "Maybe later" on the trainer profile so the reminder stays quiet.
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function dismissPayoutSetupReminderPopup(uid) {
  // 1. No uid or no Firestore → skip. Do not throw; closing the popup still works.
  const hasUid = Boolean(uid);
  const hasFirestore = Boolean(db);
  if (!hasUid || !hasFirestore) {
    return;
  }

  // 2. Write Maybe later. merge: true keeps the rest of the users doc.
  // vocab: serverTimestamp() = server clock, so the 30-day quiet window ignores a wrong phone clock.
  // vocab: merge: true = update these fields without wiping the rest of the users doc.
  const trainerDocRef = doc(db, USERS_COLLECTION, uid);
  const dismissFields = {
    [FIELD_PAYMENT_PROMPT_DISMISSED]: true,
    [FIELD_PAYMENT_PROMPT_DISMISSED_AT]: serverTimestamp(),
  };
  await setDoc(trainerDocRef, dismissFields, { merge: true });
}
