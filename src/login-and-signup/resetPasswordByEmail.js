// Sends the "reset your password" email, preferring our branded backend and falling back to Firebase.
// Flow: validate email → POST /api/auth/forgot-password → if unreachable or non-OK, Firebase sendPasswordResetEmail.
// Used by: the forgot-password screen. Always resolves with a vague success message — see GENERIC_SUCCESS.
// Read order: constants → main recipe → PLUMBING at the bottom.
// Note: Firebase project id stays anatrox-auth — never rename it to match branding.

import { sendPasswordResetEmail } from 'firebase/auth';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { auth } from '../app-start/cloudConnection';
import { getApiBase } from '../for-both/online-connection/whereToConnect';

// ===== NAMED CONSTANTS =====

// Deliberately loose: catches typos early; the server validates properly anyway.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FORGOT_PASSWORD_PATH = '/api/auth/forgot-password';
const IOS_BUNDLE_ID = 'com.coachconnect';
const ANDROID_PACKAGE_NAME = 'com.coachconnect';
const ANDROID_MINIMUM_VERSION = '1';
const FALLBACK_AUTH_DOMAIN = 'anatrox-auth.firebaseapp.com';

// 429 = rate limited — retrying via Firebase would defeat the throttle we just hit.
const RATE_LIMIT_STATUS = 429;

// Same message whether or not the account exists (no account enumeration).
// Manipulate here: user-facing success copy.
const GENERIC_SUCCESS =
  'If an account exists for that email, we sent a reset link. Check your inbox and spam folder.';

const FIREBASE_RESET_ERROR_COPY = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/missing-email': 'Email is required.',
  'auth/unauthorized-continue-uri':
    'Password reset is misconfigured. Add your app domain in Firebase Console → Authentication → Settings → Authorized domains.',
  'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/operation-not-allowed':
    'Email/password sign-in is not enabled for this app. Try Google or Apple sign-in, or contact support.',
};

// ===== MAIN FUNCTION =====

/**
 * Public entry for "forgot password".
 * Throws only on validation failure, deliberate API errors (e.g. 429), or when BOTH paths fail.
 * @param {string} email
 * @returns {Promise<{ success: true, message: string }>}
 */
export async function resetPasswordByEmail(email) {
  // 1. Normalize and reject empty or malformed addresses before any network work.
  const trimmedEmail = cleanEmailForReset(email);
  if (!trimmedEmail) throw new Error('Email is required');
  if (!emailLooksValid(trimmedEmail)) throw new Error('Please enter a valid email address');

  let backendAlreadyHandledRequest = false;

  try {
    // 2. Prefer our branded backend (rate limits + optional Firebase handoff).
    const backendResult = await askBackendToSendReset(trimmedEmail);
    if (backendResult.backendSucceeded) {
      backendAlreadyHandledRequest = true;
      return await finishAfterBackendAccepted(backendResult.data, trimmedEmail);
    }
  } catch (error) {
    // Deliberate throws (429, validation) must not fall through to Firebase.
    if (shouldRethrowWithoutFirebaseFallback(error, backendAlreadyHandledRequest)) {
      throw error;
    }
    console.warn('[password-reset] API unreachable or failed — using Firebase fallback', {
      email: maskEmailForLogs(trimmedEmail),
      base: getApiBase(),
      error: error && error.message ? error.message : String(error),
    });
  }

  // 3. Backend down or non-OK — Firebase keeps reset working in local dev.
  return finishWithFirebaseOnly(trimmedEmail);
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging Firebase settings or the branded API fallback.

/**
 * Trim + lowercase so "Me@Mail.com" matches the stored account.
 * @param {string} email
 * @returns {string}
 */
function cleanEmailForReset(email) {
  return String(email || '').trim().toLowerCase();
}

/**
 * Loose shape check before we hit the network.
 * @param {string} trimmedEmail
 * @returns {boolean}
 */
function emailLooksValid(trimmedEmail) {
  return EMAIL_RE.test(trimmedEmail);
}

/**
 * Logs must never print a full address — 'user@example.com' → 'u***@example.com'.
 * @param {string} email
 * @returns {string}
 */
function maskEmailForLogs(email) {
  const emailText = String(email || '').trim();
  const atIndex = emailText.indexOf('@');
  if (atIndex <= 1) return '***';
  const localPart = emailText[0];
  const domainPart = emailText.slice(atIndex);
  return `${localPart}***${domainPart}`;
}

/**
 * Build Firebase ActionCodeSettings for the reset email.
 * vocab: continue URL = where the user lands after resetting; domain must be on Firebase's allow list.
 * Note: 'anatrox-auth' is the live Firebase project id; do not rename it to match branding.
 * @returns {object}
 */
function buildFirebaseResetEmailSettings() {
  const authDomain =
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    (Constants.expoConfig && Constants.expoConfig.extra
      ? Constants.expoConfig.extra.firebaseAuthDomain
      : null) ||
    FALLBACK_AUTH_DOMAIN;

  const continueUrl = authDomain.includes('://') ? authDomain : `https://${authDomain}`;

  const settings = {
    url: continueUrl,
    // Manipulate here: handleCodeInApp true needs an in-app link handler first.
    handleCodeInApp: false,
  };

  if (Platform.OS === 'ios') {
    settings.iOS = { bundleId: IOS_BUNDLE_ID };
  }
  if (Platform.OS === 'android') {
    settings.android = {
      packageName: ANDROID_PACKAGE_NAME,
      installApp: true,
      minimumVersion: ANDROID_MINIMUM_VERSION,
    };
  }
  return settings;
}

/**
 * Map a Firebase auth error code to user-facing copy.
 * @param {object} error
 * @returns {string}
 */
function messageForFirebaseResetError(error) {
  const code = error && error.code ? error.code : '';
  if (FIREBASE_RESET_ERROR_COPY[code]) return FIREBASE_RESET_ERROR_COPY[code];
  if (error && error.message) return error.message;
  return 'Could not send reset email. Try again in a moment.';
}

/**
 * Call Firebase Auth's sendPasswordResetEmail with our continue URL settings.
 * @param {string} email
 * @returns {Promise<void>}
 */
async function sendResetEmailThroughFirebase(email) {
  if (!auth) {
    throw new Error('Sign-in is not ready. Close and reopen the app, then try again.');
  }
  console.log('[password-reset] Sending via Firebase…', { email: maskEmailForLogs(email) });
  const settings = buildFirebaseResetEmailSettings();
  await sendPasswordResetEmail(auth, email, settings);
  console.log('[password-reset] Firebase reset email sent', { email: maskEmailForLogs(email) });
}

/**
 * Deliberate throws from this file must not fall through to Firebase (especially 429).
 * @param {Error} error
 * @param {boolean} apiAlreadyHandledRequest
 * @returns {boolean}
 */
function shouldRethrowWithoutFirebaseFallback(error, apiAlreadyHandledRequest) {
  if (!error || !error.message) return false;
  if (apiAlreadyHandledRequest) return false;

  const messageLower = String(error.message).toLowerCase();
  if (messageLower.includes('fetch')) return false;

  if (error.message.includes('Too many attempts')) return true;
  if (error.message.includes('valid email')) return true;
  if (error.message.includes('Email is required')) return true;
  return false;
}

/**
 * POST the forgot-password endpoint. Non-OK (except 429) returns backendSucceeded false for fallback.
 * @param {string} trimmedEmail
 * @returns {Promise<{ backendSucceeded: boolean, data: object, baseUrl: string }>}
 */
async function askBackendToSendReset(trimmedEmail) {
  const baseUrl = getApiBase();
  const response = await fetch(`${baseUrl}${FORGOT_PASSWORD_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: trimmedEmail }),
  });

  // .catch(() => ({})) — error pages may be HTML and .json() would throw.
  const data = await response.json().catch(() => ({}));

  if (response.status === RATE_LIMIT_STATUS) {
    const rateLimitMessage =
      data && data.error ? data.error : 'Too many attempts. Please wait a few minutes.';
    throw new Error(rateLimitMessage);
  }

  if (response.ok) {
    return { backendSucceeded: true, data, baseUrl };
  }

  console.warn('[password-reset] API returned non-OK — using Firebase fallback', {
    status: response.status,
    error: data && data.error ? data.error : undefined,
    base: baseUrl,
  });
  return { backendSucceeded: false, data, baseUrl };
}

/**
 * Backend accepted the request. Optionally hand off to client Firebase when the server asks.
 * @param {object} data
 * @param {string} trimmedEmail
 * @returns {Promise<{ success: true, message: string }>}
 */
async function finishAfterBackendAccepted(data, trimmedEmail) {
  console.log('[password-reset] API response', {
    email: maskEmailForLogs(trimmedEmail),
    useClientFirebase: data && data.useClientFirebase === true,
    provider: data && data.provider != null ? data.provider : null,
  });

  const serverWantsClientFirebase = data && data.useClientFirebase === true;
  if (serverWantsClientFirebase) {
    await sendResetEmailThroughFirebase(trimmedEmail);
  }

  const message = data && data.message ? data.message : GENERIC_SUCCESS;
  return { success: true, message };
}

/**
 * Backend unavailable — send via Firebase alone, or throw a friendly mapped error.
 * @param {string} trimmedEmail
 * @returns {Promise<{ success: true, message: string }>}
 */
async function finishWithFirebaseOnly(trimmedEmail) {
  try {
    await sendResetEmailThroughFirebase(trimmedEmail);
    return { success: true, message: GENERIC_SUCCESS };
  } catch (error) {
    console.error(
      '[password-reset] Firebase failed:',
      error && error.code ? error.code : undefined,
      error && error.message ? error.message : undefined,
    );
    throw new Error(messageForFirebaseResetError(error));
  }
}
