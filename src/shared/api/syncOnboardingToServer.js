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
import { getApiBaseCandidates } from '../services/baseUrl';

const pendingKeyForUid = (uid) => `pending_onboarding_sync_${uid}`;

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

/**
 * Attempt to flush pending onboarding completion to the server.
 * Returns true if flushed (or nothing to do), false if still pending.
 */
export async function flushPendingOnboardingSync(firebaseUser) {
  const uid = firebaseUser?.uid;
  if (!uid) return true;

  let raw = null;
  try {
    raw = await AsyncStorage.getItem(pendingKeyForUid(uid));
  } catch (_) {
    return true;
  }

  if (!raw) return true;

  let queued = null;
  try {
    queued = JSON.parse(raw);
  } catch (_) {
    // Corrupt payload; clear it so it doesn't block.
    try {
      await AsyncStorage.removeItem(pendingKeyForUid(uid));
    } catch (_) {}
    return true;
  }

  const payload = queued?.payload;
  const path = payload?.path;
  const body = payload?.body;
  if (!path) return true;

  const bases = getApiBaseCandidates();

  // Try each base; if any succeeds, clear pending.
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

      if (!resp.ok) {
        // If base URL is reachable but server rejected, don't delete; let next run retry.
        continue;
      }

      // Success: clear pending
      try {
        await AsyncStorage.removeItem(pendingKeyForUid(uid));
      } catch (_) {}
      return true;
    } catch (_) {
      // try next base
    }
  }

  return false;
}

