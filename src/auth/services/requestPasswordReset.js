// Sends the "reset your password" email, preferring our branded backend and falling back to Firebase.
// Flow: validate the email → POST /api/auth/forgot-password → if that's unreachable or non-OK, call Firebase's sendPasswordResetEmail directly.
// Used by the forgot-password screen (also re-exported as sendPasswordResetEmail). Always resolves with a vague message on success — see GENERIC_SUCCESS.

import { sendPasswordResetEmail } from 'firebase/auth';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { auth } from '../../app-start/config';
import { getApiBase } from '../../for-both/api/baseUrl';

// Deliberately loose email check: "something@something.something" with no spaces. Strict RFC regexes
// reject real addresses, and the server validates properly anyway — this only catches typos early.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The same message whether or not the account exists. This is on purpose: telling a stranger
// "no account with that email" turns the reset form into a tool for discovering who has an account.
// Manipulate here: user-facing success copy.
const GENERIC_SUCCESS =
  'If an account exists for that email, we sent a reset link. Check your inbox and spam folder.';

// Logs go to dev consoles and crash reports, so never print a full address. 'chris@gmail.com' → 'c***@gmail.com'.
function maskEmail(email) {
  const s = String(email || '').trim();
  const at = s.indexOf('@');
  // at <= 1 covers both "no @ at all" (-1) and a one-character local part, where showing the first
  // letter would be the whole thing. Both collapse to '***'.
  if (at <= 1) return '***';
  return `${s[0]}***${s.slice(at)}`;
}

// Builds the settings object Firebase attaches to the reset email.
// vocab: continue URL = where the user lands after resetting. Firebase REJECTS any domain not on its
// Authorized-domains list, which is why this points at the Firebase-hosted auth domain and not at an
// API path that may not be deployed — an unlisted URL throws auth/unauthorized-continue-uri.
function getPasswordResetActionCodeSettings() {
  // Three sources, most-specific first: env var → the value baked into app config → hardcoded
  // fallback so a missing env var still produces a working link.
  // Note: 'anatrox-auth' is the live Firebase project id; it doesn't match the app's display name on
  // purpose and must not be renamed to match branding.
  const authDomain =
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    Constants.expoConfig?.extra?.firebaseAuthDomain ||
    'anatrox-auth.firebaseapp.com';
  // The env var may or may not already carry a scheme; Firebase needs a full URL either way.
  const continueUrl = authDomain.includes('://') ? authDomain : `https://${authDomain}`;

  const settings = {
    url: continueUrl,
    // vocab: handleCodeInApp = "open the reset link inside the app instead of a browser".
    // False means the user resets on Firebase's web page, which needs no in-app deep-link handler.
    // Manipulate here: flipping this to true requires building that in-app handler first.
    handleCodeInApp: false,
  };
  // Platform blocks tell the email link how to reopen the native app if it's installed.
  // vocab: bundleId / packageName = the app's unique id on iOS / Android respectively.
  if (Platform.OS === 'ios') {
    settings.iOS = { bundleId: 'com.coachconnect' };
  }
  if (Platform.OS === 'android') {
    settings.android = {
      packageName: 'com.coachconnect',
      // installApp: send users without the app to the Play Store rather than a dead link.
      installApp: true,
      minimumVersion: '1',
    };
  }
  return settings;
}

// Turns Firebase's machine error codes into something a user can act on.
// Without this they'd see raw strings like "auth/unauthorized-continue-uri", which tells them nothing.
// Manipulate here: every return below is user-facing copy.
function mapFirebaseResetError(err) {
  const code = err?.code || '';
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (code === 'auth/missing-email') return 'Email is required.';
  // This one is a developer/config problem, not a user problem — the message names the exact fix
  // because it's the failure most likely to show up right after a domain change.
  if (code === 'auth/unauthorized-continue-uri') {
    return 'Password reset is misconfigured. Add your app domain in Firebase Console → Authentication → Settings → Authorized domains.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Wait a few minutes and try again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error. Check your connection and try again.';
  }
  // Happens when the Firebase project has email/password sign-in disabled — the user's account is
  // fine, they just signed up via a social provider, so we point them there.
  if (code === 'auth/operation-not-allowed') {
    return 'Email/password sign-in is not enabled for this app. Try Google or Apple sign-in, or contact support.';
  }
  return err?.message || 'Could not send reset email. Try again in a moment.';
}

// The fallback path: ask Firebase to send its own (unbranded) reset email.
async function sendFirebasePasswordReset(email) {
  // `auth` is null when Firebase config was missing at startup (see app-start/config.js). Throw a
  // human instruction rather than letting "cannot read property of null" surface.
  if (!auth) {
    throw new Error('Sign-in is not ready. Close and reopen the app, then try again.');
  }
  console.log('[password-reset] Sending via Firebase…', { email: maskEmail(email) });
  await sendPasswordResetEmail(auth, email, getPasswordResetActionCodeSettings());
  console.log('[password-reset] Firebase reset email sent', { email: maskEmail(email) });
}

// Public entry point.
// @returns {Promise<{ success: true, message: string }>} — throws only on validation failure or when
// BOTH the API and Firebase paths fail.
export async function requestPasswordReset(email) {
  // Lowercase + trim so "  Chris@Gmail.com " matches the stored address.
  const trimmed = String(email || '').trim().toLowerCase();
  if (!trimmed) throw new Error('Email is required');
  if (!EMAIL_RE.test(trimmed)) throw new Error('Please enter a valid email address');

  const base = getApiBase();
  // Tracks whether the API already owned this request, so the catch below doesn't misattribute a
  // later error to "API unreachable".
  let apiHandled = false;

  // --- Preferred path: our backend (branded email + server-side rate limiting) ---
  try {
    const res = await fetch(`${base}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed }),
    });
    // .catch(() => ({})) because an error page may return HTML, and .json() would throw on it —
    // we'd rather fall through with an empty object than crash on a parse error.
    const data = await res.json().catch(() => ({}));

    // 429 = rate limited. Surfaced as a real throw (not a fallback) on purpose: retrying the same
    // request via Firebase would defeat the throttle we just hit.
    if (res.status === 429) {
      throw new Error(data?.error || 'Too many attempts. Please wait a few minutes.');
    }

    if (res.ok) {
      apiHandled = true;
      console.log('[password-reset] API response', {
        email: maskEmail(trimmed),
        useClientFirebase: data?.useClientFirebase === true,
        provider: data?.provider ?? null,
      });
      // The server can answer "I verified this account, but you send the actual email" — it has no
      // way to trigger a Firebase reset link itself for some account types.
      if (data?.useClientFirebase === true) {
        await sendFirebasePasswordReset(trimmed);
      }
      return {
        success: true,
        message: data?.message || GENERIC_SUCCESS,
      };
    }

    // Non-OK and not 429: log, then drop out of the try and let the Firebase fallback below run.
    console.warn('[password-reset] API returned non-OK — using Firebase fallback', {
      status: res.status,
      error: data?.error,
      base,
    });
  } catch (e) {
    // This catch sees two very different things: (a) the network genuinely failed, and (b) one of
    // OUR deliberate throws above. Case (b) must propagate — falling back after a 429 would send an
    // email we just refused to send.
    if (e?.message && !String(e.message).toLowerCase().includes('fetch') && !apiHandled) {
      // Matching on message text is fragile but these strings are all thrown in this same file.
      const isOurThrow =
        e.message.includes('Too many attempts') ||
        e.message.includes('valid email') ||
        e.message.includes('Email is required');
      if (isOurThrow) throw e;
    }
    console.warn('[password-reset] API unreachable or failed — using Firebase fallback', {
      email: maskEmail(trimmed),
      base,
      error: e?.message || String(e),
    });
  }

  // --- Fallback path: reached only if the API didn't return a successful response ---
  // This is what keeps reset working in local dev and whenever the backend is down.
  try {
    await sendFirebasePasswordReset(trimmed);
    return { success: true, message: GENERIC_SUCCESS };
  } catch (e) {
    // Both routes failed — now the user genuinely needs to know, in plain language.
    console.error('[password-reset] Firebase failed:', e?.code, e?.message);
    throw new Error(mapFirebaseResetError(e));
  }
}
