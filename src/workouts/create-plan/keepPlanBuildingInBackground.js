// Remembers that a workout plan is still being built after the trainer leaves the screen.
// Flow: write a flag on this phone → tell every open screen → clear the flag when the plan finishes or fails.
// Used by: the plan builder, so a tab switch does not cancel generation.

import AsyncStorage from '@react-native-async-storage/async-storage';

// ===== NAMED CONSTANTS =====

const FLAG_ON = '1';

// ===== HELPER FUNCTIONS =====

const sessionListeners = new Set();

/**
 * These keys are stored on the phone. The letters stay the same so old flags still match.
 * @param {string} uid
 * @returns {{ inFlight: string, pendingReady: string }}
 */
function storageKeys(uid) {
  return {
    inFlight: `@cc_workout_gen_inflight_${uid}`,
    pendingReady: `@cc_workout_plan_ready_${uid}`,
  };
}

/**
 * @param {object} payload
 */
function tellListeners(payload) {
  sessionListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (_) {
      // One broken screen must not stop the others from hearing the update.
    }
  });
}

// ===== MAIN FUNCTION =====

/**
 * @param {string} uid
 * @returns {Promise<{ inFlight: boolean, pendingReady: boolean }>}
 */
export async function readWorkoutGenerationSession(uid) {
  if (!uid) return { inFlight: false, pendingReady: false };
  const keys = storageKeys(uid);
  const [inFlightRaw, pendingRaw] = await Promise.all([
    AsyncStorage.getItem(keys.inFlight),
    AsyncStorage.getItem(keys.pendingReady),
  ]);
  return {
    inFlight: inFlightRaw === FLAG_ON,
    pendingReady: pendingRaw === FLAG_ON,
  };
}

/**
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function markWorkoutGenerationStarted(uid) {
  if (!uid) return;
  const keys = storageKeys(uid);
  await AsyncStorage.setItem(keys.inFlight, FLAG_ON);
  await AsyncStorage.removeItem(keys.pendingReady);
  tellListeners({ uid, inFlight: true, pendingReady: false });
}

/**
 * If the trainer left the workout tab, keep a badge until they come back.
 * @param {string} uid
 * @param {{ userAwayFromWorkout?: boolean }} [options]
 * @returns {Promise<void>}
 */
export async function markWorkoutGenerationSucceeded(uid, options = {}) {
  if (!uid) return;
  const keys = storageKeys(uid);
  await AsyncStorage.removeItem(keys.inFlight);
  if (options.userAwayFromWorkout) {
    await AsyncStorage.setItem(keys.pendingReady, FLAG_ON);
    tellListeners({ uid, inFlight: false, pendingReady: true });
    return;
  }
  await AsyncStorage.removeItem(keys.pendingReady);
  tellListeners({ uid, inFlight: false, pendingReady: false });
}

/**
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function markWorkoutGenerationFailed(uid) {
  if (!uid) return;
  const keys = storageKeys(uid);
  await AsyncStorage.multiRemove([keys.inFlight, keys.pendingReady]);
  tellListeners({ uid, inFlight: false, pendingReady: false });
}

/**
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function clearWorkoutPlanReadyBadge(uid) {
  if (!uid) return;
  await AsyncStorage.removeItem(storageKeys(uid).pendingReady);
  tellListeners({ uid, inFlight: false, pendingReady: false });
}

/**
 * @param {Function} listener
 * @returns {Function}
 */
export function subscribeWorkoutGenerationSession(listener) {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}
