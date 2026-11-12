const { resolveAiCoachDailyLimit } = require('../lib/aiCoachRateLimit');

describe('AI Coach rate limiting — tier from Firestore profile', () => {
  test('free user profile gets 100/day limit', () => {
    expect(resolveAiCoachDailyLimit({ subscriptionTier: 'free' })).toBe(100);
    expect(resolveAiCoachDailyLimit({})).toBe(100);
  });

  test('pro user profile gets 400/day limit', () => {
    expect(resolveAiCoachDailyLimit({ subscriptionTier: 'pro' })).toBe(400);
    expect(resolveAiCoachDailyLimit({ subscriptionTier: 'premium' })).toBe(400);
  });

  test('client body claiming pro is ignored when Firestore says free', () => {
    const firestoreProfile = { subscriptionTier: 'free' };
    const clientClaimedPro = { subscriptionTier: 'pro' };
    expect(resolveAiCoachDailyLimit(firestoreProfile)).toBe(100);
    expect(resolveAiCoachDailyLimit(clientClaimedPro)).toBe(400);
    expect(resolveAiCoachDailyLimit(firestoreProfile)).not.toBe(
      resolveAiCoachDailyLimit(clientClaimedPro),
    );
  });

  test('plus tier gets 200/day limit', () => {
    expect(resolveAiCoachDailyLimit({ subscriptionTier: 'plus' })).toBe(200);
    expect(resolveAiCoachDailyLimit({ planTier: 'standard' })).toBe(200);
  });
});
