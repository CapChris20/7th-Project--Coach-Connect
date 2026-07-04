const { sanitizeOnboardingData } = require('../lib/onboardingSanitize');

describe('onboarding data sanitization', () => {
  test('strips privileged role field', () => {
    const { sanitized, stripped } = sanitizeOnboardingData(
      {
        firstName: 'John',
        role: 'admin',
      },
      { uid: 'u1', logStripped: false },
    );
    expect(sanitized.firstName).toBe('John');
    expect(sanitized.role).toBeUndefined();
    expect(stripped).toContain('role');
  });

  test('strips subscription fields', () => {
    const { sanitized, stripped } = sanitizeOnboardingData(
      {
        firstName: 'Jane',
        subscription: 'active',
        subscriptionTier: 'pro',
      },
      { uid: 'u2', logStripped: false },
    );
    expect(sanitized.firstName).toBe('Jane');
    expect(sanitized.subscription).toBeUndefined();
    expect(sanitized.subscriptionTier).toBeUndefined();
    expect(stripped).toEqual(expect.arrayContaining(['subscription', 'subscriptionTier']));
  });

  test('keeps valid onboarding fields', () => {
    const payload = {
      firstName: 'Sam',
      lastName: 'Lee',
      weight: 180,
      specialties: ['strength'],
      trainerId: 'tid1',
    };
    const { sanitized, stripped } = sanitizeOnboardingData(payload, {
      uid: 'u3',
      logStripped: false,
    });
    expect(sanitized).toEqual(payload);
    expect(stripped).toHaveLength(0);
  });
});
