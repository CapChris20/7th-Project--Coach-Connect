const {
  resolveSubscriptionAccess,
  formatTrialCountdown,
  SUBSCRIPTION_STATUSES,
} = require('../../subscription/subscriptionState');

describe('resolveSubscriptionAccess', () => {
  const now = new Date('2026-06-24T12:00:00.000Z');

  it('returns no_subscription when missing', () => {
    expect(resolveSubscriptionAccess(null, now).access).toBe('no_subscription');
  });

  it('grants free_trial while trialEndsAt is in the future', () => {
    const result = resolveSubscriptionAccess(
      {
        status: SUBSCRIPTION_STATUSES.FREE_TRIAL,
        trialEndsAt: '2026-06-26T12:00:00.000Z',
        expiresAt: '2026-06-26T12:00:00.000Z',
      },
      now,
    );
    expect(result.access).toBe('free_trial');
    expect(result.hasFullAccess).toBe(true);
  });

  it('grants active for paid subscription', () => {
    const result = resolveSubscriptionAccess(
      {
        status: SUBSCRIPTION_STATUSES.ACTIVE,
        expiresAt: '2026-07-24T12:00:00.000Z',
      },
      now,
    );
    expect(result.access).toBe('active');
    expect(result.hasFullAccess).toBe(true);
  });

  it('keeps access for cancelled until expiresAt', () => {
    const result = resolveSubscriptionAccess(
      {
        status: SUBSCRIPTION_STATUSES.CANCELLED,
        expiresAt: '2026-07-01T12:00:00.000Z',
      },
      now,
    );
    expect(result.access).toBe('active');
    expect(result.hasFullAccess).toBe(true);
  });

  it('returns expired after trial ends', () => {
    const result = resolveSubscriptionAccess(
      {
        status: SUBSCRIPTION_STATUSES.FREE_TRIAL,
        trialEndsAt: '2026-06-20T12:00:00.000Z',
        expiresAt: '2026-06-20T12:00:00.000Z',
      },
      now,
    );
    expect(result.access).toBe('expired');
    expect(result.hasFullAccess).toBe(false);
  });
});

describe('formatTrialCountdown', () => {
  it('formats days and hours', () => {
    expect(formatTrialCountdown(2 * 24 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000)).toMatch(/2d 5h/);
  });
});
