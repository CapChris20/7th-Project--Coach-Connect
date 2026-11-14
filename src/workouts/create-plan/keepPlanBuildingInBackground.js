// Remembers that a workout plan is still being built after the user leaves the screen.
// Flow: write phone flags → tell open screens → clear flags when the plan finishes or fails.
// Used by CreateWorkoutPlanScreen, ClientMainScreen, and workoutPlanCreation.
// AsyncStorage key letters stay frozen so old in-flight / ready badges still match.

import AsyncStorage from '@react-native-async-storage/async-storage';

// ===== NAMED CONSTANTS =====

// Manipulate here: stored string meaning “generation still running” or “badge waiting”
const FLAG_ON = '1';

// ===== HELPER FUNCTIONS =====
// (storage keys + listeners live under PLUMBING; exports below are the recipes)

// ===== MAIN FUNCTION =====

/**
 * Read whether this user still has generation in flight or a “plan ready” badge waiting.
 * @param {string} uid
 * @returns {Promise<{ inFlight: boolean, pendingReady: boolean }>}
 */
export async function readWorkoutGenerationSession(uid) {
  // 1. No uid → treat as idle (never invent flags for a blank user).
  if (!uid) {
    return { inFlight: false, pendingReady: false };
  }

  // 2. Load both phone keys for this user.
  const rawFlags = await loadBothGenerationFlagStrings(uid);

  // 3. Turn raw strings into booleans the UI can trust.
  return {
    inFlight: rawFlags.inFlightRaw === FLAG_ON,
    pendingReady: rawFlags.pendingReadyRaw === FLAG_ON,
  };
}

/**
 * User tapped generate — mark in flight and drop any stale “ready” badge.
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function markWorkoutGenerationStarted(uid) {
  // 1. Refuse blank uid — nothing to store.
  if (!uid) return;

  // 2. Write in-flight ON and clear any leftover ready badge.
  const storageKeys = workoutGenerationStorageKeys(uid);
  await AsyncStorage.setItem(storageKeys.inFlight, FLAG_ON);
  await AsyncStorage.removeItem(storageKeys.pendingReady);

  // 3. Tell every subscribed screen so spinners update without a remount.
  tellGenerationSessionListeners({ uid, inFlight: true, pendingReady: false });
}

/**
 * Plan finished. If the user left the workout tab, keep a badge until they return.
 * @param {string} uid
 * @param {{ userAwayFromWorkout?: boolean }} [options]
 * @returns {Promise<void>}
 */
export async function markWorkoutGenerationSucceeded(uid, options = {}) {
  // 1. Refuse blank uid.
  if (!uid) return;

  // 2. Always clear in-flight — generation is done either way.
  const storageKeys = workoutGenerationStorageKeys(uid);
  await AsyncStorage.removeItem(storageKeys.inFlight);

  // 3. Away from the workout tab → leave a ready badge; otherwise clear it.
  const userIsAwayFromWorkout = options.userAwayFromWorkout === true;
  if (userIsAwayFromWorkout) {
    await writeReadyBadgeAndTellListeners(uid, storageKeys);
    return;
  }

  await clearReadyBadgeAndTellListeners(uid, storageKeys);
}

/**
 * Generation failed or was canceled — clear all flags for this user.
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function markWorkoutGenerationFailed(uid) {
  // 1. Refuse blank uid.
  if (!uid) return;

  // 2. Wipe both keys in one shot.
  const storageKeys = workoutGenerationStorageKeys(uid);
  await AsyncStorage.multiRemove([storageKeys.inFlight, storageKeys.pendingReady]);

  // 3. Screens go idle.
  tellGenerationSessionListeners({ uid, inFlight: false, pendingReady: false });
}

/**
 * User saw the new plan — clear only the “ready” badge (in-flight already off).
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function clearWorkoutPlanReadyBadge(uid) {
  // 1. Refuse blank uid.
  if (!uid) return;

  // 2. Drop the badge key and notify.
  const storageKeys = workoutGenerationStorageKeys(uid);
  await AsyncStorage.removeItem(storageKeys.pendingReady);
  tellGenerationSessionListeners({ uid, inFlight: false, pendingReady: false });
}

/**
 * Register a callback for in-memory session updates. Returns unsubscribe.
 * vocab: subscribe = add a listener; the return function removes that same listener.
 * @param {Function} listener
 * @returns {Function}
 */
export function subscribeWorkoutGenerationSession(listener) {
  generationSessionListeners.add(listener);
  return function unsubscribeGenerationSession() {
    generationSessionListeners.delete(listener);
  };
}

// ===== PLUMBING — skip unless debugging =====

// vocab: Set = unique bag of callbacks — any screen can listen for flag changes in memory
const generationSessionListeners = new Set();

/**
 * These keys are stored on the phone. The letters stay the same so old flags still match.
 * @param {string} uid
 * @returns {{ inFlight: string, pendingReady: string }}
 */
function workoutGenerationStorageKeys(uid) {
  return {
    inFlight: `@cc_workout_gen_inflight_${uid}`,
    pendingReady: `@cc_workout_plan_ready_${uid}`,
  };
}

/**
 * Read both AsyncStorage flag strings for one user (not in the recipe — keeps mains free of Promise.all).
 * @param {string} uid
 * @returns {Promise<{ inFlightRaw: string|null, pendingReadyRaw: string|null }>}
 */
async function loadBothGenerationFlagStrings(uid) {
  const storageKeys = workoutGenerationStorageKeys(uid);
  const inFlightRaw = await AsyncStorage.getItem(storageKeys.inFlight);
  const pendingReadyRaw = await AsyncStorage.getItem(storageKeys.pendingReady);
  return { inFlightRaw, pendingReadyRaw };
}

/**
 * User finished generation while away — keep the ready badge on.
 * @param {string} uid
 * @param {{ inFlight: string, pendingReady: string }} storageKeys
 * @returns {Promise<void>}
 */
async function writeReadyBadgeAndTellListeners(uid, storageKeys) {
  await AsyncStorage.setItem(storageKeys.pendingReady, FLAG_ON);
  tellGenerationSessionListeners({ uid, inFlight: false, pendingReady: true });
}

/**
 * User is on the workout tab — no badge needed.
 * @param {string} uid
 * @param {{ inFlight: string, pendingReady: string }} storageKeys
 * @returns {Promise<void>}
 */
async function clearReadyBadgeAndTellListeners(uid, storageKeys) {
  await AsyncStorage.removeItem(storageKeys.pendingReady);
  tellGenerationSessionListeners({ uid, inFlight: false, pendingReady: false });
}

/**
 * Fan out one session snapshot to every subscribed screen.
 * One broken listener must not stop the others.
 * @param {{ uid: string, inFlight: boolean, pendingReady: boolean }} sessionSnapshot
 */
function tellGenerationSessionListeners(sessionSnapshot) {
  for (const listener of generationSessionListeners) {
    try {
      listener(sessionSnapshot);
    } catch (_listenerError) {
      // Ignore — other screens still need the update.
    }
  }
}
