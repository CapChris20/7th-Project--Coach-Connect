/**
 * Tracks AI workout plan generation across tab switches / screen unmounts.
 * Generation continues in JS; UI re-subscribes via AsyncStorage + listeners.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const listeners = new Set();

function storageKeys(uid) {
  return {
    inFlight: `@cc_workout_gen_inflight_${uid}`,
    pendingReady: `@cc_workout_plan_ready_${uid}`,
  };
}

function emit(payload) {
  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (_) {
      /* ignore */
    }
  });
}

export async function readWorkoutGenerationSession(uid) {
  if (!uid) return { inFlight: false, pendingReady: false };
  const k = storageKeys(uid);
  const [inFlightRaw, pendingRaw] = await Promise.all([
    AsyncStorage.getItem(k.inFlight),
    AsyncStorage.getItem(k.pendingReady),
  ]);
  return {
    inFlight: inFlightRaw === '1',
    pendingReady: pendingRaw === '1',
  };
}

export async function markWorkoutGenerationStarted(uid) {
  if (!uid) return;
  const k = storageKeys(uid);
  await AsyncStorage.setItem(k.inFlight, '1');
  await AsyncStorage.removeItem(k.pendingReady);
  emit({ uid, inFlight: true, pendingReady: false });
}

/** @param {{ userAwayFromWorkout?: boolean }} opts */
export async function markWorkoutGenerationSucceeded(uid, opts = {}) {
  if (!uid) return;
  const k = storageKeys(uid);
  await AsyncStorage.removeItem(k.inFlight);
  if (opts.userAwayFromWorkout) {
    await AsyncStorage.setItem(k.pendingReady, '1');
    emit({ uid, inFlight: false, pendingReady: true });
  } else {
    await AsyncStorage.removeItem(k.pendingReady);
    emit({ uid, inFlight: false, pendingReady: false });
  }
}

export async function markWorkoutGenerationFailed(uid) {
  if (!uid) return;
  const k = storageKeys(uid);
  await AsyncStorage.multiRemove([k.inFlight, k.pendingReady]);
  emit({ uid, inFlight: false, pendingReady: false });
}

export async function clearWorkoutPlanReadyBadge(uid) {
  if (!uid) return;
  await AsyncStorage.removeItem(storageKeys(uid).pendingReady);
  emit({ uid, inFlight: false, pendingReady: false });
}

export function subscribeWorkoutGenerationSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
