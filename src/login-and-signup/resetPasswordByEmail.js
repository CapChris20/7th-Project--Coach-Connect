// Sends the "reset your password" email, preferring our branded backend and falling back to Firebase.
// Flow: validate the email → POST /api/auth/forgot-password → if that's unreachable or non-OK, call Firebase's sendPasswordResetEmail directly.
// Used by: the forgot-password screen (also re-exported as sendPasswordResetEmail). Always resolves with a vague message on success — see GENERIC_SUCCESS.

import { sendPasswordResetEmail } from 'firebase/auth';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { auth } from '../app-start/cloudConnection';
import { getApiBase } from '../for-both/online-connection/whereToConnect';

// ===== NAMED CONSTANTS =====

// Deliberately loose: "something@something.something" with no spaces. Strict RFC regexes reject
// real addresses, and the server validates properly anyway — this only catches typos early.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FORGOT_PASSWORD_PATH = '/api/auth/forgot-password';
const IOS_BUNDLE_ID = 'com.coachconnect';
const ANDROID_PACKAGE_NAME = 'com.coachconnect';
const ANDROID_MINIMUM_VERSION = '1';
const FALLBACK_AUTH_DOMAIN = 'anatrox-auth.firebaseapp.com';

// 429 = rate limited. Must bind before use; retrying via Firebase would defeat the throttle we just hit.
const RATE_LIMIT_STATUS = 429;

// The same message whether or not the account exists. Telling a stranger "no account with that
// email" turns the reset form into a tool for discovering who has an account.
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

// ===== HELPER FUNCTIONS =====

/**
 * Logs go to dev consoles and crash reports, so never print a full address.
 * 'chris@gmail.com' → 'c***@gmail.com'.
 * @param {string} email
 * @returns {string}
 */
function maskEmail(email) {
  const emailText = String(email || '').trim();
  const atIndex = emailText.indexOf('@');
  // atIndex <= 1 covers both "no @ at all" (-1) and a one-character local part.
  if (atIndex <= 1) return '***';
  return `${emailText[0]}***${emailText.slice(atIndex)}`;
}

/**
 * Builds the settings object Firebase attaches to the reset email.
 * vocab: continue URL = where the user lands after resetting. Firebase REJECTS any domain not on
 * its Authorized-domains list, which is why this points at the Firebase-hosted auth domain.
 * Note: 'anatrox-auth' is the live Firebase project id; it must not be renamed to match branding.
 * @returns {object}
 */
function getPasswordResetActionCodeSettings() {
  const authDomain =
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    Constants.expoConfig?.extra?.firebaseAuthDomain ||
    FALLBACK_AUTH_DOMAIN;
  // The env var may or may not already carry a scheme; Firebase needs a full URL either way.
  const continueUrl = authDomain.includes('://') ? authDomain : `https://${authDomain}`;

  const settings = {
    url: continueUrl,
    // vocab: handleCodeInApp = "open the reset link inside the app instead of a browser".
    // Manipulate here: flipping this to true requires building that in-app handler first.
    handleCodeInApp: false,
  };

  // vocab: bundleId / packageName = the app's unique id on iOS / Android respectively.
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
 * Turns Firebase's machine error codes into something a user can act on.
 * Lookup map instead of else-if so nesting stays flat.
 * Manipulate here: every value is user-facing copy.
 * @param {Error} error
 * @returns {string}
 */
function mapFirebaseResetError(error) {
  const code = error?.code || '';
  if (FIREBASE_RESET_ERROR_COPY[code]) return FIREBASE_RESET_ERROR_COPY[code];
  return error?.message || 'Could not send reset email. Try again in a moment.';
}

/**
 * The fallback path: ask Firebase to send its own (unbranded) reset email.
 * `auth` is null when Firebase config was missing at startup.
 */
async function sendFirebasePasswordReset(email) {
  if (!auth) {
    throw new Error('Sign-in is not ready. Close and reopen the app, then try again.');
  }
  console.log('[password-reset] Sending via Firebase…', { email: maskEmail(email) });
  await sendPasswordResetEmail(auth, email, getPasswordResetActionCodeSettings());
  console.log('[password-reset] Firebase reset email sent', { email: maskEmail(email) });
}

/**
 * Matching on message text is fragile but these strings are all thrown in this same file.
 * Case (b) in the catch must propagate — falling back after a 429 would send an email we refused.
 * @param {Error} error
 * @param {boolean} apiHandled
 * @returns {boolean}
 */
function isDeliberateResetThrow(error, apiHandled) {
  if (!error?.message) return false;
  if (String(error.message).toLowerCase().includes('fetch')) return false;
  if (apiHandled) return false;
  return (
    error.message.includes('Too many attempts') ||
    error.message.includes('valid email') ||
    error.message.includes('Email is required')
  );
}

/**
 * Preferred path: our backend (branded email + server-side rate limiting).
 * @returns {Promise<{ ok: boolean, data: object, baseUrl: string }>}
 */
async function tryBrandedForgotPasswordApi(trimmedEmail) {
  const baseUrl = getApiBase();
  const response = await fetch(`${baseUrl}${FORGOT_PASSWORD_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: trimmedEmail }),
  });
  // .catch(() => ({})) because an error page may return HTML, and .json() would throw on it.
  const data = await response.json().catch(() => ({}));

  if (response.status === RATE_LIMIT_STATUS) {
    throw new Error(data?.error || 'Too many attempts. Please wait a few minutes.');
  }
  if (response.ok) {
    return { ok: true, data, baseUrl };
  }

  console.warn('[password-reset] API returned non-OK — using Firebase fallback', {
    status: response.status,
    error: data?.error,
    base: baseUrl,
  });
  return { ok: false, data, baseUrl };
}

/**
 * The server can answer "I verified this account, but you send the actual email".
 * @param {object} data
 * @param {string} trimmedEmail
 * @returns {Promise<{ success: true, message: string }>}
 */
async function finishSuccessfulApiReset(data, trimmedEmail) {
  console.log('[password-reset] API response', {
    email: maskEmail(trimmedEmail),
    useClientFirebase: data?.useClientFirebase === true,
    provider: data?.provider ?? null,
  });
  if (data?.useClientFirebase === true) {
    await sendFirebasePasswordReset(trimmedEmail);
  }
  return {
    success: true,
    message: data?.message || GENERIC_SUCCESS,
  };
}

async function sendFirebaseResetOrThrow(trimmedEmail) {
  try {
    await sendFirebasePasswordReset(trimmedEmail);
    return { success: true, message: GENERIC_SUCCESS };
  } catch (error) {
    console.error('[password-reset] Firebase failed:', error?.code, error?.message);
    throw new Error(mapFirebaseResetError(error));
  }
}

function normalizeResetEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// ===== MAIN FUNCTION =====

/**
 * Public entry point for "forgot password".
 * Throws only on validation failure or when BOTH the API and Firebase paths fail.
 * @param {string} email
 * @returns {Promise<{ success: true, message: string }>}
 */
export async function resetPasswordByEmail(email) {
  const trimmedEmail = normalizeResetEmail(email);
  if (!trimmedEmail) throw new Error('Email is required');
  if (!EMAIL_RE.test(trimmedEmail)) throw new Error('Please enter a valid email address');

  // Tracks whether the API already owned this request, so the catch below doesn't
  // misattribute a later error to "API unreachable".
  let apiHandled = false;

  try {
    const apiResult = await tryBrandedForgotPasswordApi(trimmedEmail);
    if (apiResult.ok) {
      apiHandled = true;
      return await finishSuccessfulApiReset(apiResult.data, trimmedEmail);
    }
  } catch (error) {
    if (isDeliberateResetThrow(error, apiHandled)) throw error;
    console.warn('[password-reset] API unreachable or failed — using Firebase fallback', {
      email: maskEmail(trimmedEmail),
      base: getApiBase(),
      error: error?.message || String(error),
    });
  }

  // Reached only if the API didn't return a successful response.
  // This is what keeps reset working in local dev and whenever the backend is down.
  return sendFirebaseResetOrThrow(trimmedEmail);
}
