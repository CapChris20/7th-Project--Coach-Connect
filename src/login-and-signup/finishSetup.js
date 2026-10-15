// The "save my onboarding answers" pipeline, pulled out of the wizard so it can be tested alone.
// Flow: build the final payload → cache it locally first → write users/{uid} in Firestore → POST the API (with retries) → report what succeeded.
// Used by: NewUserSetupScreen's finish handler. LoginGate reads the leftover "pending" flag to retry a failed server sync on next launch.

import { omitRestrictedUserDocFields } from './decideTraineeOrTrainer';

// ===== NAMED CONSTANTS =====

const USER_ROLE_TRAINER = 'trainer';
const USER_ROLE_CLIENT = 'client';
const USERS_COLLECTION = 'users';
const ONBOARDING_COMPLETE_PATH = '/api/onboarding/complete';

// Three device keys, three jobs: raw answers, LoginGate's instant profile, and "retry me later".
const onboardingAnswersKey = (userId) => `onboarding_data_${userId}`;
const pendingOnboardingKey = (userId) => `pending_onboarding_complete_${userId}`;
const defaultProfileCacheKey = (uid) => `auth_profile_${uid}`;

// Manipulate here: 3 total API attempts. Raise for flakier networks; each extra attempt adds delay
// before the user sees an error. LAST_RETRY_INDEX is the last loop index that still waits.
const ONBOARDING_API_ATTEMPTS = 3;
const LAST_RETRY_INDEX = 2;
const RETRY_DELAY_MS_PER_ATTEMPT = 250;

// ===== HELPER FUNCTIONS =====

/**
 * Firestore rejects any `undefined` value outright (null is fine, undefined is not).
 * Form state is full of untouched optional fields, so we walk the tree and drop them.
 * Recursive because onboarding answers nest (arrays of goals, objects of measurements).
 * @param {*} input
 * @returns {*}
 */
function stripUndefinedForFirestore(input) {
  if (input === undefined) return undefined;
  // Primitives and null pass through untouched — null is a legal Firestore value.
  if (input === null || typeof input !== 'object') return input;

  // Arrays: clean each item, then drop the holes. Deleting a key from an object is easy;
  // an array can't have gaps, so we filter instead.
  if (Array.isArray(input)) {
    return input
      .map((item) => stripUndefinedForFirestore(item))
      .filter((item) => item !== undefined);
  }

  const cleanedObject = {};
  // vocab: Object.entries = turns { a: 1 } into [['a', 1]] so we can loop keys and values together.
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const cleanedValue = stripUndefinedForFirestore(value);
    // A nested object can become undefined after cleaning; skip it rather than writing an empty shell.
    if (cleanedValue === undefined) continue;
    cleanedObject[key] = cleanedValue;
  }
  return cleanedObject;
}

/**
 * Trainer vs client for the local profile cache. Anything other than "trainer" is the client shell.
 * @param {string} finalRole
 * @returns {string}
 */
function cachedRoleFromFinalRole(finalRole) {
  const normalizedRole = String(finalRole || '').toLowerCase();
  if (normalizedRole === USER_ROLE_TRAINER) return USER_ROLE_TRAINER;
  return USER_ROLE_CLIENT;
}

/**
 * Local-first write. Runs BEFORE any network call on purpose: if the user kills the app or
 * loses signal mid-save, the device still knows they finished and which role they picked.
 * @returns {Promise<boolean>} true when all three keys were written
 */
async function cacheOnboardingRoleLocally({
  AsyncStorage,
  userId,
  finalRole,
  updateData,
  displayName,
  getProfileCacheKey,
}) {
  if (!AsyncStorage?.setItem || !userId) return false;

  const role = cachedRoleFromFinalRole(finalRole);

  // 1. the raw answers, so the wizard could repopulate
  await AsyncStorage.setItem(onboardingAnswersKey(userId), JSON.stringify(updateData));
  // 2. the profile cache LoginGate reads on launch for instant routing before Firestore answers
  await AsyncStorage.setItem(
    getProfileCacheKey(userId),
    JSON.stringify({
      uid: userId,
      ...updateData,
      role,
      onboardingCompleted: true,
    }),
  );
  // 3. a "still needs syncing" marker — LoginGate retries the server call from this on next launch.
  //    It's deleted the moment the API call succeeds.
  await AsyncStorage.setItem(
    pendingOnboardingKey(userId),
    JSON.stringify({ finalRole: role, onboardingData: updateData, displayName }),
  );
  return true;
}

/**
 * Last chance to leave the device recoverable if Firestore threw before caching finished.
 * Failures here are ignored because we are already inside an error path.
 */
async function retryLocalCacheAfterFailure(cacheArgs) {
  try {
    return await cacheOnboardingRoleLocally(cacheArgs);
  } catch (_ignoredError) {
    return cacheArgs.roleCached === true;
  }
}

/**
 * Write users/{uid} with merge so we do not wipe the rest of the profile.
 * ISO timestamps from the payload are replaced with serverTimestamp() (the phone clock can be wrong).
 * @returns {Promise<boolean>}
 */
async function writeOnboardingToFirestore({
  db,
  doc,
  setDoc,
  serverTimestamp,
  userId,
  updateData,
}) {
  if (!db || !setDoc || !doc) return false;

  // vocab/symbol: `const { a: _unused, ...rest } = obj` = destructure-and-drop those two keys.
  const { onboardingCompletedAt: _completedAt, updatedAt: _updatedAt, ...restForFirestore } = updateData;

  await setDoc(
    doc(db, USERS_COLLECTION, userId),
    {
      // Strip undefined (Firestore would reject the whole write), then drop fields
      // security rules forbid clients from setting (role, trainerId, linked) —
      // the server sets those during /api/onboarding/complete.
      ...omitRestrictedUserDocFields(stripUndefinedForFirestore(restForFirestore)),
      onboardingCompleted: true,
      // vocab: serverTimestamp() = a placeholder Firestore replaces with ITS clock, not the phone's.
      onboardingCompletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    // vocab: { merge: true } = update the fields we sent and leave every other field alone.
    { merge: true },
  );
  return true;
}

/**
 * One API attempt. On success the pending marker is deleted so LoginGate will not retry.
 * @returns {Promise<{ ok: boolean, serverResponse: object|null, error: Error|null }>}
 */
async function tryOneOnboardingApiCall({
  postOnboardingApi,
  finalRole,
  updateData,
  displayName,
  AsyncStorage,
  userId,
}) {
  try {
    const serverResponse = await postOnboardingApi(ONBOARDING_COMPLETE_PATH, {
      finalRole,
      onboardingData: updateData,
      displayName,
    });
    if (AsyncStorage?.removeItem) {
      await AsyncStorage.removeItem(pendingOnboardingKey(userId));
    }
    return { ok: true, serverResponse, error: null };
  } catch (error) {
    return { ok: false, serverResponse: null, error };
  }
}

/**
 * Growing delay between retries (250ms then 500ms) so a briefly overloaded server can recover.
 * Not called after the final attempt — nobody is waiting on that sleep.
 */
function waitBeforeOnboardingRetry(attemptIndex) {
  const delayMs = RETRY_DELAY_MS_PER_ATTEMPT * (attemptIndex + 1);
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * The API is the only thing allowed to set `role` on the user doc. Retry instead of failing once
 * so a trainer is not stuck in the client shell.
 * @returns {Promise<{ serverResponse: object|null, error: Error|null }>}
 */
async function postOnboardingWithRetries(apiArgs) {
  let lastError = null;
  let serverResponse = null;

  for (let attempt = 0; attempt < ONBOARDING_API_ATTEMPTS; attempt += 1) {
    const attemptResult = await tryOneOnboardingApiCall(apiArgs);
    if (attemptResult.ok) {
      return { serverResponse: attemptResult.serverResponse, error: null };
    }
    lastError = attemptResult.error;
    if (attempt < LAST_RETRY_INDEX) {
      await waitBeforeOnboardingRetry(attempt);
    }
  }

  return { serverResponse, error: lastError };
}

function onboardingResult({ updateData, firestoreSynced, serverResponse, error, roleCached }) {
  return { updateData, firestoreSynced, serverResponse, error, roleCached };
}

/**
 * Local cache → Firestore → API retries. Progress is mutated so a throw still reports
 * how far we got (cached locally, maybe not yet synced).
 */
async function runOnboardingSaveSteps({ cacheArgs, firestoreArgs, apiArgs, updateData, progress }) {
  progress.roleCached = await cacheOnboardingRoleLocally(cacheArgs);
  progress.firestoreSynced = await writeOnboardingToFirestore(firestoreArgs);
  const apiResult = await postOnboardingWithRetries(apiArgs);
  progress.serverResponse = apiResult.serverResponse;
  return onboardingResult({
    updateData,
    firestoreSynced: progress.firestoreSynced,
    serverResponse: progress.serverResponse,
    error: apiResult.error || null,
    roleCached: progress.roleCached,
  });
}

async function recoverAfterOnboardingFailure({ cacheArgs, progress, updateData, error }) {
  const retryCached = await retryLocalCacheAfterFailure({ ...cacheArgs, roleCached: progress.roleCached });
  return onboardingResult({
    updateData,
    firestoreSynced: progress.firestoreSynced,
    serverResponse: progress.serverResponse,
    error,
    roleCached: retryCached || progress.roleCached,
  });
}

// ===== MAIN FUNCTION =====

/**
 * Assembles the exact object we save everywhere. Kept separate from the writing so tests
 * can assert the shape without mocking Firestore.
 * overrideData is last-second wizard data; spread order matters: override wins.
 * @param {string} finalRole
 * @param {object} onboardingData
 * @param {object|null} [overrideData]
 * @returns {object}
 */
export function buildOnboardingUpdatePayload(finalRole, onboardingData, overrideData = null) {
  const finalOnboardingData = overrideData ? { ...onboardingData, ...overrideData } : onboardingData;
  // One timestamp reused for every field so the record is internally consistent.
  const nowIso = new Date().toISOString();
  return {
    ...finalOnboardingData,
    role: finalRole,
    // These three are the flags LoginGate/profileNeedsOnboarding read to stop showing the wizard.
    onboardingCompleted: true,
    onboardingCompletedAt: nowIso,
    updatedAt: nowIso,
    // Conditional spread: only add startingWeight if they actually entered a weight.
    // vocab/symbol: `...(cond ? {a:1} : {})` = "include this key only when cond is true".
    // Why: startingWeight is the frozen baseline all progress charts compare against.
    ...(finalOnboardingData?.weight != null && finalOnboardingData.weight !== ''
      ? { startingWeight: finalOnboardingData.weight }
      : {}),
  };
}

/**
 * Runs the full save. Every Firebase/storage dependency is passed in rather than imported,
 * which is what lets the unit tests drive this with fakes and no network.
 * Returns { updateData, firestoreSynced, serverResponse, error, roleCached } so the caller
 * can tell partial success (saved locally, server failed) from total failure.
 * @param {object} deps
 * @returns {Promise<object>}
 */
export async function completeOnboardingClient({
  userId,
  finalRole,
  onboardingData,
  overrideData = null,
  db,
  doc,
  setDoc,
  serverTimestamp,
  AsyncStorage,
  postOnboardingApi,
  displayName = null,
  getProfileCacheKey = defaultProfileCacheKey,
}) {
  const updateData = buildOnboardingUpdatePayload(finalRole, onboardingData, overrideData);
  const cacheArgs = { AsyncStorage, userId, finalRole, updateData, displayName, getProfileCacheKey };
  const firestoreArgs = { db, doc, setDoc, serverTimestamp, userId, updateData };
  const apiArgs = { postOnboardingApi, finalRole, updateData, displayName, AsyncStorage, userId };
  // Result flags start pessimistic so an early throw still returns an honest report.
  const progress = { firestoreSynced: false, serverResponse: null, roleCached: false };

  try {
    return await runOnboardingSaveSteps({ cacheArgs, firestoreArgs, apiArgs, updateData, progress });
  } catch (error) {
    return recoverAfterOnboardingFailure({ cacheArgs, progress, updateData, error });
  }
}
