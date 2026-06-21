const {
  profileNeedsOnboarding,
  normalizeAppRole,
  isLikelyNewFirebaseUser,
} = require('../../auth/detectUserRole');

describe('onboarding gate', () => {
  test('explicit incomplete onboarding needs gate', () => {
    expect(profileNeedsOnboarding({ onboardingCompleted: false })).toBe(true);
  });

  test('completed profile skips onboarding', () => {
    expect(profileNeedsOnboarding({ onboardingCompleted: true })).toBe(false);
    expect(profileNeedsOnboarding({ onboardingCompletedAt: '2026-01-01' })).toBe(false);
  });

  test('legacy profile without flag does not force onboarding', () => {
    expect(profileNeedsOnboarding({})).toBe(false);
  });

  test('normalizeAppRole maps trainer role', () => {
    expect(normalizeAppRole('trainer')).toBe('trainer');
    expect(normalizeAppRole('client')).toBe('client');
  });

  test('isLikelyNewFirebaseUser detects fresh accounts', () => {
    const user = {
      metadata: {
        creationTime: new Date().toUTCString(),
        lastSignInTime: new Date().toUTCString(),
      },
    };
    expect(isLikelyNewFirebaseUser(user)).toBe(true);
  });
});
