/**
 * onboarding Sync
 *
 * Purpose: Data/service layer: onboarding Sync. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: queuePendingOnboardingSync, flushPendingOnboardingSync
 *
 * @file-header
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseCandidates } from './baseUrl';

const pendingKeyForUid = (uid) => `pending_onboarding_sync_${uid}`;
const pendingCompleteKeyForUid = (uid) => `pending_onboarding_complete_${uid}`;

/**
 * Queue a pending onboarding completion payload to sync later.
 * Non-blocking; best-effort persistence.
 */
export async function queuePendingOnboardingSync(uid, payload) {
  if (!uid) return;
  try {
    const data = {
      queuedAt: new Date().toISOString(),
      payload,
    };
    await AsyncStorage.setItem(pendingKeyForUid(uid), JSON.stringify(data));
  } catch (_) {
    // ignore
  }
}

async function postWithAuth(firebaseUser, path, body) {
  const bases = getApiBaseCandidates();
  for (const baseUrl of bases) {
    try {
      await firebaseUser.reload();
      const idToken = await firebaseUser.getIdToken(true);
      if (!idToken) throw new Error('Missing ID token');

      const resp = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body ?? {}),
      });

      if (resp.ok) return true;
    } catch (_) {
      // try next base
    }
  }
  return false;
}

/**
 * Attempt to flush pending onboarding completion to the server.
 * Handles both wizard queue (`pending_onboarding_sync_*`) and
 * finishOnboarding cache (`pending_onboarding_complete_*`).
 * Returns true if flushed (or nothing to do), false if still pending.
 */
export async function flushPendingOnboardingSync(firebaseUser) {
  const uid = firebaseUser?.uid;
  if (!uid) return true;

  let syncOk = true;
  let completeOk = true;

  let raw = null;
  try {
    raw = await AsyncStorage.getItem(pendingKeyForUid(uid));
  } catch (_) {
    raw = null;
  }

  if (raw) {
    let queued = null;
    try {
      queued = JSON.parse(raw);
    } catch (_) {
      try {
        await AsyncStorage.removeItem(pendingKeyForUid(uid));
      } catch (_) {}
      queued = null;
    }

    const payload = queued?.payload;
    const path = payload?.path;
    const body = payload?.body;
    if (path) {
      const ok = await postWithAuth(firebaseUser, path, body ?? {});
      if (ok) {
        try {
          await AsyncStorage.removeItem(pendingKeyForUid(uid));
        } catch (_) {}
      } else {
        syncOk = false;
      }
    }
  }

  let completeRaw = null;
  try {
    completeRaw = await AsyncStorage.getItem(pendingCompleteKeyForUid(uid));
  } catch (_) {
    completeRaw = null;
  }

  if (completeRaw) {
    let completePayload = null;
    try {
      completePayload = JSON.parse(completeRaw);
    } catch (_) {
      try {
        await AsyncStorage.removeItem(pendingCompleteKeyForUid(uid));
      } catch (_) {}
      completePayload = null;
    }

    if (completePayload && (completePayload.finalRole || completePayload.onboardingData)) {
      const ok = await postWithAuth(firebaseUser, '/api/onboarding/complete', {
        finalRole: completePayload.finalRole,
        onboardingData: completePayload.onboardingData,
        displayName: completePayload.displayName,
      });
      if (ok) {
        try {
          await AsyncStorage.removeItem(pendingCompleteKeyForUid(uid));
        } catch (_) {}
      } else {
        completeOk = false;
      }
    }
  }

  return syncOk && completeOk;
}

