// Pure helpers for trainer platform subscription access.
// Flow: parse dates on users/{uid}.subscription → pick free_trial / active / expired → format the trial countdown.
// Used by Pro screens and gates. No React and no Firestore reads here.

// ===== NAMED CONSTANTS =====

export const SUBSCRIPTION_STATUSES = {
  FREE_TRIAL: 'free_trial',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};

const ACCESS_NONE = 'no_subscription';
const ACCESS_FREE_TRIAL = 'free_trial';
const ACCESS_ACTIVE = 'active';
const ACCESS_EXPIRED = 'expired';

const MILLISECONDS_PER_MINUTE = 60000;
const MINUTES_IN_ONE_HOUR = 60;
const HOURS_IN_ONE_DAY = 24;
const MINUTES_IN_ONE_DAY = MINUTES_IN_ONE_HOUR * HOURS_IN_ONE_DAY;

/** @typedef {'no_subscription' | 'free_trial' | 'active' | 'expired'} SubscriptionAccess */

// ===== HELPER FUNCTIONS =====

function emptyAccessState() {
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

function isDateStillInTheFuture(date, nowMs) {
  return date && date.getTime() > nowMs;
}

function subscriptionStatusKey(subscription) {
  return String(subscription.status || '').toLowerCase() || null;
}

function fullAccessState({ access, status, trialEndsAt, expiresAt, nextBillingDate, trialCountdownMs }) {
  return {
    access,
    hasFullAccess: true,
    status,
    trialEndsAt,
    expiresAt,
    nextBillingDate,
    trialCountdownMs,
  };
}

function expiredAccessState({ status, isPaidPeriodStillOpen, trialEndsAt, expiresAt, nextBillingDate }) {
  return {
    access: ACCESS_EXPIRED,
    hasFullAccess: false,
    status:
      status === SUBSCRIPTION_STATUSES.CANCELLED && !isPaidPeriodStillOpen
        ? SUBSCRIPTION_STATUSES.EXPIRED
        : status || SUBSCRIPTION_STATUSES.EXPIRED,
    trialEndsAt,
    expiresAt,
    nextBillingDate,
    trialCountdownMs: null,
  };
}

function isKnownSubscriptionStatus(status) {
  return (
    status === SUBSCRIPTION_STATUSES.EXPIRED ||
    status === SUBSCRIPTION_STATUSES.CANCELLED ||
    status === SUBSCRIPTION_STATUSES.FREE_TRIAL ||
    status === SUBSCRIPTION_STATUSES.ACTIVE
  );
}

function isPaidStatusStillActive(status) {
  return status === SUBSCRIPTION_STATUSES.ACTIVE || status === SUBSCRIPTION_STATUSES.CANCELLED;
}

// ===== MAIN FUNCTION =====

/**
 * @param {string | Date | null | undefined} value
 * @returns {Date | null}
 */
export function parseIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsedDate = new Date(String(value));
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

/**
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
  const empty = emptyAccessState();
  if (!subscription || typeof subscription !== 'object') {
    return empty;
  }

  const status = subscriptionStatusKey(subscription);
  const trialEndsAt = parseIsoDate(subscription.trialEndsAt);
  const expiresAt = parseIsoDate(subscription.expiresAt);
  const nextBillingDate = parseIsoDate(subscription.nextBillingDate);
  const nowMs = now.getTime();

  const isTrialStillRunning = isDateStillInTheFuture(trialEndsAt, nowMs);
  const isPaidPeriodStillOpen = isDateStillInTheFuture(expiresAt, nowMs);

  if (status === SUBSCRIPTION_STATUSES.FREE_TRIAL && isTrialStillRunning) {
    return fullAccessState({
      access: ACCESS_FREE_TRIAL,
      status,
      trialEndsAt,
      expiresAt,
      nextBillingDate,
      trialCountdownMs: trialEndsAt.getTime() - nowMs,
    });
  }

  if (isPaidStatusStillActive(status) && isPaidPeriodStillOpen) {
    return fullAccessState({
      access: ACCESS_ACTIVE,
      status,
      trialEndsAt,
      expiresAt,
      nextBillingDate,
      trialCountdownMs: null,
    });
  }

  if (isKnownSubscriptionStatus(status)) {
    return expiredAccessState({
      status,
      isPaidPeriodStillOpen,
      trialEndsAt,
      expiresAt,
      nextBillingDate,
    });
  }

  return empty;
}

/**
 * Human-readable trial countdown, e.g. "2d 5h left in trial".
 * @param {number | null} remainingMs
 * @returns {string}
 */
export function formatTrialCountdown(remainingMs) {
  if (remainingMs == null || remainingMs <= 0) return 'Trial ended';
  const totalMinutes = Math.ceil(remainingMs / MILLISECONDS_PER_MINUTE);
  const days = Math.floor(totalMinutes / MINUTES_IN_ONE_DAY);
  const hours = Math.floor((totalMinutes % MINUTES_IN_ONE_DAY) / MINUTES_IN_ONE_HOUR);
  const minutes = totalMinutes % MINUTES_IN_ONE_HOUR;
  if (days > 0) return `${days}d ${hours}h left in trial`;
  if (hours > 0) return `${hours}h ${minutes}m left in trial`;
  return `${minutes}m left in trial`;
}
