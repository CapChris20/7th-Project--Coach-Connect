const { resolveAiCoachDailyLimit } = require('../lib/aiCoachRateLimit');

describe('AI Coach rate limiting — tier from Firestore profile', () => {
  test('free user profile gets 30/day limit', () => {
    expect(resolveAiCoachDailyLimit({ subscriptionTier: 'free' })).toBe(30);
    expect(resolveAiCoachDailyLimit({})).toBe(30);
  });

  test('pro user profile gets 100/day limit', () => {
    expect(resolveAiCoachDailyLimit({ subscriptionTier: 'pro' })).toBe(100);
    expect(resolveAiCoachDailyLimit({ subscriptionTier: 'premium' })).toBe(100);
  });

  test('client body claiming pro is ignored when Firestore says free', () => {
    const firestoreProfile = { subscriptionTier: 'free' };
    const clientClaimedPro = { subscriptionTier: 'pro' };
    expect(resolveAiCoachDailyLimit(firestoreProfile)).toBe(30);
    expect(resolveAiCoachDailyLimit(clientClaimedPro)).toBe(100);
    expect(resolveAiCoachDailyLimit(firestoreProfile)).not.toBe(
      resolveAiCoachDailyLimit(clientClaimedPro),
    );
  });

  test('plus tier gets 50/day limit', () => {
    expect(resolveAiCoachDailyLimit({ subscriptionTier: 'plus' })).toBe(50);
    expect(resolveAiCoachDailyLimit({ planTier: 'standard' })).toBe(50);
  });
});
