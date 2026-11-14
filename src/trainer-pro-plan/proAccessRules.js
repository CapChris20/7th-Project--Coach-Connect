// Pure rules for trainer Pro access — no React, no Firestore reads.
// Flow: turn users/{uid}.subscription dates into free_trial / active / expired → countdown copy for UI.
// Used by Pro gates and account screens. Status string letters must match stored Firestore values.
// Read order: constants → thin helpers → MAIN recipes → PLUMBING (countdown math).

// ===== NAMED CONSTANTS =====

// Firestore / Stripe status letters — do not rename the string values.
export const SUBSCRIPTION_STATUSES = {
  FREE_TRIAL: 'free_trial',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};

// Access kinds returned to screens (same letter set as status where they overlap).
const ACCESS_NONE = 'no_subscription';
const ACCESS_FREE_TRIAL = 'free_trial';
const ACCESS_ACTIVE = 'active';
const ACCESS_EXPIRED = 'expired';

// Manipulate here: countdown math — day/hour labels stay consistent app-wide.
const MILLISECONDS_PER_MINUTE = 60000;
const MINUTES_IN_ONE_HOUR = 60;
const HOURS_IN_ONE_DAY = 24;
const MINUTES_IN_ONE_DAY = MINUTES_IN_ONE_HOUR * HOURS_IN_ONE_DAY;

/** @typedef {'no_subscription' | 'free_trial' | 'active' | 'expired'} SubscriptionAccess */

// ===== HELPER FUNCTIONS =====

/**
 * Empty access row when there is no usable subscription object.
 * @returns {{ access: SubscriptionAccess, hasFullAccess: boolean, status: null, trialEndsAt: null, expiresAt: null, nextBillingDate: null, trialCountdownMs: null }}
 */
function buildNoAccessRow() {
  return {
    access: /** @type {SubscriptionAccess} */ (ACCESS_NONE),
    hasFullAccess: false,
    status: null,
    trialEndsAt: null,
    expiresAt: null,
    nextBillingDate: null,
    trialCountdownMs: null,
  };
}

/**
 * True when the date is after "now" (ms). Missing dates never count as open.
 * @param {Date | null} dateValue
 * @param {number} nowMilliseconds
 * @returns {boolean}
 */
function dateIsStillAfterNow(dateValue, nowMilliseconds) {
  if (!dateValue) return false;
  return dateValue.getTime() > nowMilliseconds;
}

/**
 * Lowercase status string from the subscription record, or null if blank.
 * @param {Record<string, unknown>} subscriptionRecord
 * @returns {string | null}
 */
function normalizedStatusFromSubscription(subscriptionRecord) {
  const rawStatus = subscriptionRecord.status || '';
  const lowerStatus = String(rawStatus).toLowerCase();
  if (!lowerStatus) return null;
  return lowerStatus;
}

/**
 * Full-feature access row (trial or paid window still open).
 * @param {object} parts
 * @returns {object}
 */
function buildFullAccessRow(parts) {
  return {
    access: parts.accessKind,
    hasFullAccess: true,
    status: parts.status,
    trialEndsAt: parts.trialEndsAt,
    expiresAt: parts.expiresAt,
    nextBillingDate: parts.nextBillingDate,
    trialCountdownMs: parts.trialCountdownMs,
  };
}

/**
 * Expired / cancelled-past-paid-window row. Cancelled with a closed paid window shows as expired.
 * @param {object} parts
 * @returns {object}
 */
function buildExpiredAccessRow(parts) {
  const cancelledAndPaidWindowClosed =
    parts.status === SUBSCRIPTION_STATUSES.CANCELLED && !parts.paidPeriodStillOpen;

  let displayStatus = parts.status || SUBSCRIPTION_STATUSES.EXPIRED;
  if (cancelledAndPaidWindowClosed) {
    displayStatus = SUBSCRIPTION_STATUSES.EXPIRED;
  }

  return {
    access: ACCESS_EXPIRED,
    hasFullAccess: false,
    status: displayStatus,
    trialEndsAt: parts.trialEndsAt,
    expiresAt: parts.expiresAt,
    nextBillingDate: parts.nextBillingDate,
    trialCountdownMs: null,
  };
}

/**
 * Status letters we know how to map (everything else → no_subscription).
 * @param {string | null} status
 * @returns {boolean}
 */
function statusIsOneWeRecognize(status) {
  if (status === SUBSCRIPTION_STATUSES.EXPIRED) return true;
  if (status === SUBSCRIPTION_STATUSES.CANCELLED) return true;
  if (status === SUBSCRIPTION_STATUSES.FREE_TRIAL) return true;
  if (status === SUBSCRIPTION_STATUSES.ACTIVE) return true;
  return false;
}

/**
 * Active or cancelled-but-still-paid both count as "paid subscription" for the open-window check.
 * @param {string | null} status
 * @returns {boolean}
 */
function statusCountsAsPaidSubscription(status) {
  if (status === SUBSCRIPTION_STATUSES.ACTIVE) return true;
  if (status === SUBSCRIPTION_STATUSES.CANCELLED) return true;
  return false;
}

/**
 * Trial branch: free_trial status + trialEndsAt still in the future → full access + countdown ms.
 * @param {object} parts
 * @returns {object | null}
 */
function tryBuildTrialAccessRow(parts) {
  if (parts.status !== SUBSCRIPTION_STATUSES.FREE_TRIAL) return null;

  const trialStillRunning = dateIsStillAfterNow(parts.trialEndsAt, parts.nowMilliseconds);
  if (!trialStillRunning) return null;

  const millisecondsLeft = parts.trialEndsAt.getTime() - parts.nowMilliseconds;
  return buildFullAccessRow({
    accessKind: ACCESS_FREE_TRIAL,
    status: parts.status,
    trialEndsAt: parts.trialEndsAt,
    expiresAt: parts.expiresAt,
    nextBillingDate: parts.nextBillingDate,
    trialCountdownMs: millisecondsLeft,
  });
}

/**
 * Paid branch: active/cancelled + expiresAt still in the future → full access, no trial countdown.
 * @param {object} parts
 * @returns {object | null}
 */
function tryBuildPaidAccessRow(parts) {
  if (!statusCountsAsPaidSubscription(parts.status)) return null;

  const paidPeriodStillOpen = dateIsStillAfterNow(parts.expiresAt, parts.nowMilliseconds);
  if (!paidPeriodStillOpen) return null;

  return buildFullAccessRow({
    accessKind: ACCESS_ACTIVE,
    status: parts.status,
    trialEndsAt: parts.trialEndsAt,
    expiresAt: parts.expiresAt,
    nextBillingDate: parts.nextBillingDate,
    trialCountdownMs: null,
  });
}

// ===== MAIN FUNCTION =====

/**
 * Turn an ISO string or Date into a real Date, or null if unusable.
 * @param {string | Date | null | undefined} value
 * @returns {Date | null}
 */
export function parseIsoDate(value) {
  // 1. Missing value → null.
  if (!value) return null;

  // 2. Already a Date — keep only if getTime is finite.
  if (value instanceof Date) {
    const timeIsInvalid = Number.isNaN(value.getTime());
    if (timeIsInvalid) return null;
    return value;
  }

  // 3. Parse string; reject NaN clocks.
  const parsedFromString = new Date(String(value));
  const stringParseFailed = Number.isNaN(parsedFromString.getTime());
  if (stringParseFailed) return null;
  return parsedFromString;
}

/**
 * Decide what Pro features this trainer may use right now.
 * Flow: 1. refuse bad input  2. trial window  3. paid window  4. known-but-expired  5. none
 * @param {Record<string, unknown> | null | undefined} subscription
 * @param {Date} [now]
 * @returns {{
 *   access: SubscriptionAccess,
 *   hasFullAccess: boolean,
 *   status: string | null,
 *   trialEndsAt: Date | null,
 *   expiresAt: Date | null,
 *   nextBillingDate: Date | null,
 *   trialCountdownMs: number | null,
 * }}
 */
export function resolveSubscriptionAccess(subscription, now = new Date()) {
  const noAccess = buildNoAccessRow();

  // 1. Need a real object.
  if (!subscription) return noAccess;
  if (typeof subscription !== 'object') return noAccess;

  // 2. Pull status + date fields (letters stay trialEndsAt / expiresAt / nextBillingDate).
  const status = normalizedStatusFromSubscription(subscription);
  const trialEndsAt = parseIsoDate(subscription.trialEndsAt);
  const expiresAt = parseIsoDate(subscription.expiresAt);
  const nextBillingDate = parseIsoDate(subscription.nextBillingDate);
  const nowMilliseconds = now.getTime();
  const paidPeriodStillOpen = dateIsStillAfterNow(expiresAt, nowMilliseconds);

  const sharedParts = {
    status,
    trialEndsAt,
    expiresAt,
    nextBillingDate,
    nowMilliseconds,
  };

  // 3. Free trial still running → full access + countdown.
  const duringTrial = tryBuildTrialAccessRow(sharedParts);
  if (duringTrial) return duringTrial;

  // 4. Paid period still open (active or cancelled-but-paid) → full access.
  const duringPaidPeriod = tryBuildPaidAccessRow(sharedParts);
  if (duringPaidPeriod) return duringPaidPeriod;

  // 5. Known status but windows closed → expired row (cancelled may display as expired).
  if (statusIsOneWeRecognize(status)) {
    return buildExpiredAccessRow({
      status,
      paidPeriodStillOpen,
      trialEndsAt,
      expiresAt,
      nextBillingDate,
    });
  }

  // 6. Unknown / blank status → treat as no subscription.
  return noAccess;
}

/**
 * Human-readable trial countdown, e.g. "2d 5h left in trial".
 * @param {number | null} remainingMs
 * @returns {string}
 */
export function formatTrialCountdown(remainingMs) {
  // 1. Missing or already over → ended copy.
  if (remainingMs == null) return 'Trial ended';
  if (remainingMs <= 0) return 'Trial ended';

  // 2. Split remaining ms into days / hours / leftover minutes (ceil so "1m left" never shows 0 early).
  const parts = splitCountdownPartsFromMilliseconds(remainingMs);

  // 3. Pick the shortest label that still shows the biggest unit.
  if (parts.wholeDays > 0) {
    return `${parts.wholeDays}d ${parts.wholeHours}h left in trial`;
  }
  if (parts.wholeHours > 0) {
    return `${parts.wholeHours}h ${parts.leftoverMinutes}m left in trial`;
  }
  return `${parts.leftoverMinutes}m left in trial`;
}

// ===== PLUMBING — skip unless debugging =====

/**
 * Break remaining ms into whole days, hours after those days, and leftover minutes.
 * @param {number} remainingMs
 * @returns {{ wholeDays: number, wholeHours: number, leftoverMinutes: number }}
 */
function splitCountdownPartsFromMilliseconds(remainingMs) {
  // vocab: Math.ceil — round up so 30s remaining still shows as 1 minute, not 0.
  const totalMinutes = Math.ceil(remainingMs / MILLISECONDS_PER_MINUTE);
  const wholeDays = Math.floor(totalMinutes / MINUTES_IN_ONE_DAY);
  const minutesAfterFullDays = totalMinutes % MINUTES_IN_ONE_DAY;
  const wholeHours = Math.floor(minutesAfterFullDays / MINUTES_IN_ONE_HOUR);
  const leftoverMinutes = totalMinutes % MINUTES_IN_ONE_HOUR;
  return { wholeDays, wholeHours, leftoverMinutes };
}
