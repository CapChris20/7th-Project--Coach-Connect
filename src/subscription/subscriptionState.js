/**
 * Pure helpers for trainer platform subscription access.
 * Firestore shape: users/{uid}.subscription
 */

export const SUBSCRIPTION_STATUSES = {
  FREE_TRIAL: 'free_trial',
  ACTIVE: 'active',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
};

/** @typedef {'no_subscription' | 'free_trial' | 'active' | 'expired'} SubscriptionAccess */

/**
 * @param {string | Date | null | undefined} value
 * @returns {Date | null}
 */
export function parseIsoDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
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
  const empty = {
    access: /** @type {SubscriptionAccess} */ ('no_subscription'),
    hasFullAccess: false,
    status: null,
    trialEndsAt: null,
    expiresAt: null,
    nextBillingDate: null,
    trialCountdownMs: null,
  };

  if (!subscription || typeof subscription !== 'object') {
    return empty;
  }

  const status = String(subscription.status || '').toLowerCase() || null;
  const trialEndsAt = parseIsoDate(subscription.trialEndsAt);
  const expiresAt = parseIsoDate(subscription.expiresAt);
  const nextBillingDate = parseIsoDate(subscription.nextBillingDate);
  const nowMs = now.getTime();

  const trialActive = trialEndsAt && trialEndsAt.getTime() > nowMs;
  const paidActive = expiresAt && expiresAt.getTime() > nowMs;

  if (status === SUBSCRIPTION_STATUSES.FREE_TRIAL && trialActive) {
    return {
      access: 'free_trial',
      hasFullAccess: true,
      status,
      trialEndsAt,
      expiresAt,
      nextBillingDate,
      trialCountdownMs: trialEndsAt.getTime() - nowMs,
    };
  }

  if (
    (status === SUBSCRIPTION_STATUSES.ACTIVE || status === SUBSCRIPTION_STATUSES.CANCELLED) &&
    paidActive
  ) {
    return {
      access: 'active',
      hasFullAccess: true,
      status,
      trialEndsAt,
      expiresAt,
      nextBillingDate,
      trialCountdownMs: null,
    };
  }

  if (
    status === SUBSCRIPTION_STATUSES.EXPIRED ||
    status === SUBSCRIPTION_STATUSES.CANCELLED ||
    status === SUBSCRIPTION_STATUSES.FREE_TRIAL ||
    status === SUBSCRIPTION_STATUSES.ACTIVE
  ) {
    return {
      access: 'expired',
      hasFullAccess: false,
      status: status === SUBSCRIPTION_STATUSES.CANCELLED && !paidActive
        ? SUBSCRIPTION_STATUSES.EXPIRED
        : status || SUBSCRIPTION_STATUSES.EXPIRED,
      trialEndsAt,
      expiresAt,
      nextBillingDate,
      trialCountdownMs: null,
    };
  }

  return empty;
}

/**
 * Human-readable trial countdown, e.g. "2d 5h left in trial".
 * @param {number | null} ms
 */
export function formatTrialCountdown(ms) {
  if (ms == null || ms <= 0) return 'Trial ended';
  const totalMinutes = Math.ceil(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h left in trial`;
  if (hours > 0) return `${hours}h ${minutes}m left in trial`;
  return `${minutes}m left in trial`;
}
