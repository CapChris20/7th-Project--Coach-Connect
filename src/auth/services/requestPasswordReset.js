/**
 * Request a password reset email — branded via API when deployed, else Firebase client SDK.
 */
import { sendPasswordResetEmail } from 'firebase/auth';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { auth } from '../../app/config';
import { getApiBase } from '../../shared/api/baseUrl';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GENERIC_SUCCESS =
  'If an account exists for that email, we sent a reset link. Check your inbox and spam folder.';

function maskEmail(email) {
  const s = String(email || '').trim();
  const at = s.indexOf('@');
  if (at <= 1) return '***';
  return `${s[0]}***${s.slice(at)}`;
}

/** Continue URL must be on Firebase Authorized domains — not an undeployed API path. */
function getPasswordResetActionCodeSettings() {
  const authDomain =
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    Constants.expoConfig?.extra?.firebaseAuthDomain ||
    'anatrox-auth.firebaseapp.com';
  const continueUrl = authDomain.includes('://') ? authDomain : `https://${authDomain}`;

  const settings = {
    url: continueUrl,
    handleCodeInApp: false,
  };
  if (Platform.OS === 'ios') {
    settings.iOS = { bundleId: 'com.chrisshina.coachconnect' };
  }
  if (Platform.OS === 'android') {
    settings.android = {
      packageName: 'com.chrisshina.coachconnect',
      installApp: true,
      minimumVersion: '1',
    };
  }
  return settings;
}

function mapFirebaseResetError(err) {
  const code = err?.code || '';
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (code === 'auth/missing-email') return 'Email is required.';
  if (code === 'auth/unauthorized-continue-uri') {
    return 'Password reset is misconfigured. Add your app domain in Firebase Console → Authentication → Settings → Authorized domains.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Wait a few minutes and try again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error. Check your connection and try again.';
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Email/password sign-in is not enabled for this app. Try Google or Apple sign-in, or contact support.';
  }
  return err?.message || 'Could not send reset email. Try again in a moment.';
}

async function sendFirebasePasswordReset(email) {
  if (!auth) {
    throw new Error('Sign-in is not ready. Close and reopen the app, then try again.');
  }
  console.log('[password-reset] Sending via Firebase…', { email: maskEmail(email) });
  await sendPasswordResetEmail(auth, email, getPasswordResetActionCodeSettings());
  console.log('[password-reset] Firebase reset email sent', { email: maskEmail(email) });
}

/**
 * @returns {Promise<{ success: true, message: string }>}
 */
export async function requestPasswordReset(email) {
  const trimmed = String(email || '').trim().toLowerCase();
  if (!trimmed) throw new Error('Email is required');
  if (!EMAIL_RE.test(trimmed)) throw new Error('Please enter a valid email address');

  const base = getApiBase();
  let apiHandled = false;

  try {
    const res = await fetch(`${base}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed }),
    });
    const data = await res.json().catch(() => ({}));

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
      if (data?.useClientFirebase === true) {
        await sendFirebasePasswordReset(trimmed);
      }
      return {
        success: true,
        message: data?.message || GENERIC_SUCCESS,
      };
    }

    console.warn('[password-reset] API returned non-OK — using Firebase fallback', {
      status: res.status,
      error: data?.error,
      base,
    });
  } catch (e) {
    if (e?.message && !String(e.message).toLowerCase().includes('fetch') && !apiHandled) {
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

  try {
    await sendFirebasePasswordReset(trimmed);
    return { success: true, message: GENERIC_SUCCESS };
  } catch (e) {
    console.error('[password-reset] Firebase failed:', e?.code, e?.message);
    throw new Error(mapFirebaseResetError(e));
  }
}
