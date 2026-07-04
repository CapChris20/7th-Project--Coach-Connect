#!/usr/bin/env node
/**
 * Behavioral tests for workout plan generation session state machine.
 * Mirrors src/workouts/plan-generator/workoutPlanGenerationSession.js in Node
 * (in-memory AsyncStorage). Update both if session logic changes.
 *
 * Run: node scripts/testWorkoutPlanGenerationSession.js
 */

const store = new Map();
const listeners = new Set();

const AsyncStorage = {
  async getItem(key) {
    return store.has(key) ? store.get(key) : null;
  },
  async setItem(key, value) {
    store.set(key, value);
  },
  async removeItem(key) {
    store.delete(key);
  },
  async multiRemove(keys) {
    keys.forEach((k) => store.delete(k));
  },
};

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

async function readWorkoutGenerationSession(uid) {
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

async function markWorkoutGenerationStarted(uid) {
  if (!uid) return;
  const k = storageKeys(uid);
  await AsyncStorage.setItem(k.inFlight, '1');
  await AsyncStorage.removeItem(k.pendingReady);
  emit({ uid, inFlight: true, pendingReady: false });
}

async function markWorkoutGenerationSucceeded(uid, opts = {}) {
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

async function markWorkoutGenerationFailed(uid) {
  if (!uid) return;
  const k = storageKeys(uid);
  await AsyncStorage.multiRemove([k.inFlight, k.pendingReady]);
  emit({ uid, inFlight: false, pendingReady: false });
}

async function clearWorkoutPlanReadyBadge(uid) {
  if (!uid) return;
  await AsyncStorage.removeItem(storageKeys(uid).pendingReady);
  emit({ uid, inFlight: false, pendingReady: false });
}

function subscribeWorkoutGenerationSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let passed = 0;
let failed = 0;

function assert(name, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`✅ PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`❌ FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function run() {
  console.log('Workout plan generation session — behavioral tests\n');

  const uid = 'test-user-abc';

  store.clear();
  listeners.clear();

  await markWorkoutGenerationStarted(uid);
  let state = await readWorkoutGenerationSession(uid);
  assert('started → inFlight true', state.inFlight === true);
  assert('started → pendingReady false', state.pendingReady === false);

  await markWorkoutGenerationSucceeded(uid, { userAwayFromWorkout: false });
  state = await readWorkoutGenerationSession(uid);
  assert('succeed on tab → inFlight false', state.inFlight === false);
  assert('succeed on tab → no badge', state.pendingReady === false);

  await markWorkoutGenerationStarted(uid);
  await markWorkoutGenerationSucceeded(uid, { userAwayFromWorkout: true });
  state = await readWorkoutGenerationSession(uid);
  assert('succeed away → pendingReady true', state.pendingReady === true);
  assert('succeed away → inFlight false', state.inFlight === false);

  await clearWorkoutPlanReadyBadge(uid);
  state = await readWorkoutGenerationSession(uid);
  assert('clear badge → pendingReady false', state.pendingReady === false);

  await markWorkoutGenerationStarted(uid);
  await markWorkoutGenerationFailed(uid);
  state = await readWorkoutGenerationSession(uid);
  assert('failed → inFlight false', state.inFlight === false);
  assert('failed → pendingReady false', state.pendingReady === false);

  const events = [];
  const unsub = subscribeWorkoutGenerationSession((p) => events.push({ ...p }));
  await markWorkoutGenerationStarted(uid);
  await markWorkoutGenerationSucceeded(uid, { userAwayFromWorkout: true });
  unsub();
  assert('listener receives start event', events.some((e) => e.inFlight === true));
  assert('listener receives ready event', events.some((e) => e.pendingReady === true));

  console.log('\n────────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log('Workout plan session behavioral tests passed.');
}

run().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
