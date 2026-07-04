/**
 * Auth flow unit tests — signup/login helpers and role routing.
 */
const {
  normalizeAppRole,
  profileNeedsOnboarding,
  isLikelyNewFirebaseUser,
  omitRestrictedUserDocFields,
} = require('../../auth/detectUserRole');
const { buildOnboardingUpdatePayload } = require('../../auth/finishOnboarding');
const { sanitizeOnboardingData } = require('../../../server/lib/onboardingSanitize');

describe('Authentication flows', () => {
  describe('Trainer sign-up payload', () => {
    test('buildOnboardingUpdatePayload sets trainer role and completion flags', () => {
      const payload = buildOnboardingUpdatePayload('trainer', {
        firstName: 'John',
        lastName: 'Doe',
        specialties: ['strength'],
      });
      expect(payload.role).toBe('trainer');
      expect(payload.onboardingCompleted).toBe(true);
      expect(payload.firstName).toBe('John');
      expect(payload.onboardingCompletedAt).toBeTruthy();
    });
  });

  describe('Client sign-up payload', () => {
    test('buildOnboardingUpdatePayload sets client role', () => {
      const payload = buildOnboardingUpdatePayload('client', {
        weight: 180,
        trainerId: 'tid1',
      });
      expect(payload.role).toBe('client');
      expect(payload.onboardingCompleted).toBe(true);
      expect(payload.trainerId).toBe('tid1');
    });
  });

  describe('Login role routing', () => {
    test('trainer role normalizes correctly', () => {
      expect(normalizeAppRole('trainer')).toBe('trainer');
      expect(normalizeAppRole('TRAINER')).toBe('trainer');
    });

    test('non-trainer roles route to client app', () => {
      expect(normalizeAppRole('client')).toBe('client');
      expect(normalizeAppRole('coach')).toBe('client');
      expect(normalizeAppRole('admin')).toBe('client');
    });
  });

  describe('Logout / restricted fields', () => {
    test('omitRestrictedUserDocFields strips role and trainerId for client writes', () => {
      const cleaned = omitRestrictedUserDocFields({
        firstName: 'Sam',
        role: 'client',
        trainerId: 'tid1',
      });
      expect(cleaned.firstName).toBe('Sam');
      expect(cleaned.role).toBeUndefined();
      expect(cleaned.trainerId).toBeUndefined();
    });
  });

  describe('Password reset / new user detection', () => {
    test('isLikelyNewFirebaseUser detects account created within 3 minutes', () => {
      const now = Date.now();
      const user = {
        metadata: {
          creationTime: new Date(now - 60_000).toUTCString(),
          lastSignInTime: new Date(now - 30_000).toUTCString(),
        },
      };
      expect(isLikelyNewFirebaseUser(user)).toBe(true);
    });

    test('isLikelyNewFirebaseUser returns false for established accounts', () => {
      const now = Date.now();
      const user = {
        metadata: {
          creationTime: new Date(now - 8 * 24 * 60 * 60 * 1000).toUTCString(),
          lastSignInTime: new Date(now).toUTCString(),
        },
      };
      expect(isLikelyNewFirebaseUser(user)).toBe(false);
    });
  });

  describe('Role-based onboarding gate', () => {
    test('trainer cannot skip onboarding when explicitly incomplete', () => {
      expect(profileNeedsOnboarding({ onboardingCompleted: false, role: 'trainer' })).toBe(true);
    });

    test('completed trainer skips onboarding', () => {
      expect(profileNeedsOnboarding({ onboardingCompleted: true, role: 'trainer' })).toBe(false);
    });
  });

  describe('Onboarding smuggling blocked server-side', () => {
    test('subscription tier smuggling stripped before user doc write', () => {
      const { sanitized } = sanitizeOnboardingData(
        { firstName: 'Eve', subscriptionTier: 'pro', role: 'admin' },
        { uid: 'u1', logStripped: false },
      );
      expect(sanitized.firstName).toBe('Eve');
      expect(sanitized.subscriptionTier).toBeUndefined();
      expect(sanitized.role).toBeUndefined();
    });
  });
});
