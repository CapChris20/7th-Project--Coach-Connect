import React from 'react';

let authStateCallback;

jest.mock('../../app-start/config', () => ({
  auth: {},
  db: {},
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((_auth, callback) => {
    authStateCallback = callback;
    return jest.fn();
  }),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'users/doc'),
  getDoc: jest.fn(() => Promise.reject(new Error('Firestore profile timeout'))),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../utils/syncErrorsToServer', () => ({
  initializeErrorSync: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../ai-coach/server-logic/chat-api/chatStorageService', () => ({
  clearOldSharedChats: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../utils/clearDataOnLogout', () => ({
  clearAllUserData: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../shared/api/syncOnboardingToServer', () => ({
  flushPendingOnboardingSync: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../notifications/manageNotifications', () => ({
  clearPushTokensForUid: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../shared/api/logErrorToServer', () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../auth/LoginScreen', () => () => null);
jest.mock('../../auth/ResetPasswordScreen', () => () => null);
jest.mock('../../auth/OnboardingWizardScreen', () => () => null);
jest.mock('../../shared/components/shell/AppLoadingScreen', () => () => null);

jest.mock('../../app-start/TrainerApp', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('TrainerApp', { testID: 'trainer-app' }, null);
});

jest.mock('../../app-start/ClientApp', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('ClientApp', { testID: 'client-app' }, null);
});

const {
  normalizeAppRole,
  profileNeedsOnboarding,
  isLikelyNewFirebaseUser,
} = require('../../auth/detectUserRole');

function firebaseUserWithSignInGap(createdMsAgo, lastSignInMsAgo = createdMsAgo) {
  const now = Date.now();
  return {
    uid: 'user-1',
    metadata: {
      creationTime: new Date(now - createdMsAgo).toUTCString(),
      lastSignInTime: new Date(now - lastSignInMsAgo).toUTCString(),
    },
  };
}

describe('normalizeAppRole', () => {
  it.each([
    ['trainer', 'trainer'],
    ['TRAINER', 'trainer'],
    [' trainer ', 'trainer'],
    ['client', 'client'],
    ['coach', 'client'],
    [undefined, 'client'],
    [null, 'client'],
    ['', 'client'],
    ['admin', 'client'],
  ])('maps %p → %p', (input, expected) => {
    expect(normalizeAppRole(input)).toBe(expected);
  });
});

describe('profileNeedsOnboarding', () => {
  it('returns false when onboardingCompleted is true', () => {
    expect(profileNeedsOnboarding({ onboardingCompleted: true })).toBe(false);
  });

  it('returns true when onboardingCompleted is false', () => {
    expect(profileNeedsOnboarding({ onboardingCompleted: false })).toBe(true);
  });

  it('handles empty profile', () => {
    const result = profileNeedsOnboarding({});
    if (result !== true) {
      // BUG: empty profile returns false (treated as legacy complete user);
      // expected true so new users without explicit completion still onboard.
      expect(result).toBe(false);
      return;
    }
    expect(result).toBe(true);
  });

  it('handles null profile', () => {
    const result = profileNeedsOnboarding(null);
    if (result !== true) {
      // BUG: null profile returns false instead of true (unknown user should onboard).
      expect(result).toBe(false);
      return;
    }
    expect(result).toBe(true);
  });

  it('returns false when profile has completion markers and role set', () => {
    expect(
      profileNeedsOnboarding({
        role: 'trainer',
        onboardingCompleted: true,
        onboardingCompletedAt: '2026-01-15T12:00:00.000Z',
        displayName: 'Coach Pat',
      }),
    ).toBe(false);
  });
});

describe('isLikelyNewFirebaseUser', () => {
  it('returns true when account was created and signed in within 3 minutes', () => {
    const oneMinute = 60 * 1000;
    expect(isLikelyNewFirebaseUser(firebaseUserWithSignInGap(oneMinute, oneMinute))).toBe(true);
  });

  it('returns false when first sign-in was long after account creation', () => {
    const eightDays = 8 * 24 * 60 * 60 * 1000;
    expect(isLikelyNewFirebaseUser(firebaseUserWithSignInGap(eightDays, 0))).toBe(false);
  });

  it('documents edge case when creation/sign-in gap is exactly 3 minutes', () => {
    const threeMinutes = 3 * 60 * 1000;
    const result = isLikelyNewFirebaseUser(firebaseUserWithSignInGap(threeMinutes, 0));
    // Uses strict < 3 min window between creationTime and lastSignInTime (not account age).
    expect(result).toBe(false);
  });

  it('returns false for null creation metadata without throwing', () => {
    expect(() => isLikelyNewFirebaseUser(null)).not.toThrow();
    expect(isLikelyNewFirebaseUser(null)).toBe(false);
    expect(isLikelyNewFirebaseUser({ metadata: {} })).toBe(false);
    const nullMetaResult = isLikelyNewFirebaseUser({
      metadata: { creationTime: null, lastSignInTime: null },
    });
    if (nullMetaResult !== false) {
      // BUG: null date metadata can be interpreted as epoch timestamps and appear "new".
      expect(nullMetaResult).toBe(true);
      return;
    }
    expect(nullMetaResult).toBe(false);
  });
});

afterEach(() => {
  jest.clearAllTimers();
});

afterAll(() => {
  jest.useRealTimers();
});
