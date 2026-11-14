// The "save my onboarding answers" pipeline, pulled out of the wizard so it can be tested alone.
// Flow: build payload → cache on phone first → write users/{uid} → POST API (retries) → report what worked.
// Used by: NewUserSetupScreen finish handler. LoginGate retries leftover "pending" on next launch.

import { omitRestrictedUserDocFields } from './decideTraineeOrTrainer';

// ===== NAMED CONSTANTS =====

const USER_ROLE_TRAINER = 'trainer';
const USER_ROLE_CLIENT = 'client';
const USERS_COLLECTION = 'users';
const ONBOARDING_COMPLETE_PATH = '/api/onboarding/complete';

// Manipulate here: 3 total API attempts. Raise for flakier networks; each extra attempt
// adds delay before the user sees an error. LAST_RETRY_INDEX is the last wait-then-retry slot.
const ONBOARDING_API_ATTEMPTS = 3;
const LAST_RETRY_INDEX = 2;
const RETRY_DELAY_MS_PER_ATTEMPT = 250;

// ===== MAIN FUNCTION =====

/**
 * Assemble the exact object we save everywhere — tests can assert the shape without mocking Firestore.
 * overrideData wins over onboardingData when both carry the same keys.
 * Flow: 1. merge answers  2. stamp ISO times  3. freeze startingWeight when weight exists
 * @param {string} finalRole
 * @param {object} onboardingData
 * @param {object|null} [overrideData]
 * @returns {object}
 */
export function buildOnboardingUpdatePayload(finalRole, onboardingData, overrideData = null) {
  // 1. Merge wizard answers with any last-second override from the finish button.
  const mergedAnswers = mergeWizardAnswersWithOverride(onboardingData, overrideData);

  // 2. One ISO timestamp so every field on the record agrees.
  const nowIso = new Date().toISOString();
  const payload = {
    ...mergedAnswers,
    role: finalRole,
    onboardingCompleted: true,
    onboardingCompletedAt: nowIso,
    updatedAt: nowIso,
  };

  // 3. startingWeight is the frozen baseline for progress charts — only when they entered a weight.
  if (weightShouldBecomeStartingWeight(mergedAnswers?.weight)) {
    payload.startingWeight = mergedAnswers.weight;
  }

  return payload;
}

/**
 * Runs local cache → Firestore → API retries. Dependencies are injected for unit tests.
 * Flow: 1. build shared payload  2. device then Firestore then API  3. on throw, leave device recoverable
 * @param {object} deps
 * @returns {Promise<{ updateData: object, firestoreSynced: boolean, serverResponse: *, error: *, roleCached: boolean }>}
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
  // 1. Build the payload every downstream step will share.
  const updateData = buildOnboardingUpdatePayload(finalRole, onboardingData, overrideData);

  const deviceCacheArgs = {
    AsyncStorage,
    userId,
    finalRole,
    updateData,
    displayName,
    getProfileCacheKey,
  };
  const firestoreWriteArgs = { db, doc, setDoc, serverTimestamp, userId, updateData };
  const apiCallArgs = { postOnboardingApi, finalRole, updateData, displayName, AsyncStorage, userId };

  const progressSoFar = {
    firestoreSynced: false,
    serverResponse: null,
    roleCached: false,
  };

  try {
    // 2. Happy path: device first, then Firestore, then server (with retries).
    return await runLocalThenFirestoreThenApi({
      deviceCacheArgs,
      firestoreWriteArgs,
      apiCallArgs,
      updateData,
      progressSoFar,
    });
  } catch (error) {
    // 3. Something threw mid-pipeline — still try to leave the device recoverable.
    return reportOnboardingFailureWithCacheRetry({
      deviceCacheArgs,
      progressSoFar,
      updateData,
      error,
    });
  }
}

// ===== HELPER FUNCTIONS =====

function mergeWizardAnswersWithOverride(onboardingData, overrideData) {
  if (!overrideData) return onboardingData;
  return { ...onboardingData, ...overrideData };
}

function weightShouldBecomeStartingWeight(weight) {
  if (weight == null) return false;
  if (weight === '') return false;
  return true;
}

function roleForLocalProfileCache(finalRole) {
  const roleText = String(finalRole || '').toLowerCase();
  if (roleText === USER_ROLE_TRAINER) return USER_ROLE_TRAINER;
  return USER_ROLE_CLIENT;
}

function buildOnboardingSaveResult({
  updateData,
  firestoreSynced,
  serverResponse,
  error,
  roleCached,
}) {
  return { updateData, firestoreSynced, serverResponse, error, roleCached };
}

async function runLocalThenFirestoreThenApi({
  deviceCacheArgs,
  firestoreWriteArgs,
  apiCallArgs,
  updateData,
  progressSoFar,
}) {
  // Device first so a crash mid-save still knows they finished onboarding.
  progressSoFar.roleCached = await writeOnboardingToDeviceStorage(deviceCacheArgs);
  progressSoFar.firestoreSynced = await writeOnboardingToFirestore(firestoreWriteArgs);

  const apiResult = await callOnboardingCompleteApiWithRetries(apiCallArgs);
  progressSoFar.serverResponse = apiResult.serverResponse;

  return buildOnboardingSaveResult({
    updateData,
    firestoreSynced: progressSoFar.firestoreSynced,
    serverResponse: progressSoFar.serverResponse,
    error: apiResult.error || null,
    roleCached: progressSoFar.roleCached,
  });
}

async function reportOnboardingFailureWithCacheRetry({
  deviceCacheArgs,
  progressSoFar,
  updateData,
  error,
}) {
  const roleCachedNow = await tryWriteDeviceStorageAgain({
    ...deviceCacheArgs,
    roleWasCachedBefore: progressSoFar.roleCached,
  });
  const roleCached = roleCachedNow || progressSoFar.roleCached;

  return buildOnboardingSaveResult({
    updateData,
    firestoreSynced: progressSoFar.firestoreSynced,
    serverResponse: progressSoFar.serverResponse,
    error,
    roleCached,
  });
}

// ===== PLUMBING — skip unless debugging =====

// Three device keys, three jobs: raw answers, LoginGate's instant profile, and "retry me later".
function onboardingAnswersKey(userId) {
  return `onboarding_data_${userId}`;
}

function pendingOnboardingKey(userId) {
  return `pending_onboarding_complete_${userId}`;
}

function defaultProfileCacheKey(uid) {
  return `auth_profile_${uid}`;
}

// Firestore rejects `undefined` (null is fine). Walk the tree and drop holes before any write.
function stripUndefinedForFirestore(input) {
  if (input === undefined) return undefined;
  if (input === null || typeof input !== 'object') return input;

  if (Array.isArray(input)) {
    return stripUndefinedFromArray(input);
  }

  return stripUndefinedFromObject(input);
}

function stripUndefinedFromArray(inputArray) {
  const cleanedItems = [];
  for (let index = 0; index < inputArray.length; index += 1) {
    const cleanedItem = stripUndefinedForFirestore(inputArray[index]);
    if (cleanedItem === undefined) continue;
    cleanedItems.push(cleanedItem);
  }
  return cleanedItems;
}

function stripUndefinedFromObject(inputObject) {
  const cleanedObject = {};
  // vocab: Object.entries = [['key', value], ...] so we can loop keys and values together
  for (const [key, value] of Object.entries(inputObject)) {
    if (value === undefined) continue;
    const cleanedValue = stripUndefinedForFirestore(value);
    if (cleanedValue === undefined) continue;
    cleanedObject[key] = cleanedValue;
  }
  return cleanedObject;
}

// Local-first write before any network: if the app dies mid-save, the device still knows they finished.
async function writeOnboardingToDeviceStorage({
  AsyncStorage,
  userId,
  finalRole,
  updateData,
  displayName,
  getProfileCacheKey,
}) {
  if (!AsyncStorage?.setItem || !userId) return false;

  const roleForCache = roleForLocalProfileCache(finalRole);

  await AsyncStorage.setItem(onboardingAnswersKey(userId), JSON.stringify(updateData));

  await AsyncStorage.setItem(
    getProfileCacheKey(userId),
    JSON.stringify({
      uid: userId,
      ...updateData,
      role: roleForCache,
      onboardingCompleted: true,
    }),
  );

  // LoginGate deletes this key once /api/onboarding/complete succeeds.
  await AsyncStorage.setItem(
    pendingOnboardingKey(userId),
    JSON.stringify({
      finalRole: roleForCache,
      onboardingData: updateData,
      displayName,
    }),
  );
  return true;
}

async function tryWriteDeviceStorageAgain(cacheArgsWithPriorFlag) {
  try {
    return await writeOnboardingToDeviceStorage(cacheArgsWithPriorFlag);
  } catch {
    return cacheArgsWithPriorFlag.roleWasCachedBefore === true;
  }
}

async function writeOnboardingToFirestore({
  db,
  doc,
  setDoc,
  serverTimestamp,
  userId,
  updateData,
}) {
  if (!db || !setDoc || !doc) return false;

  // Drop ISO timestamps from the payload — the server clock replaces them.
  const {
    onboardingCompletedAt: _completedAt,
    updatedAt: _updatedAt,
    ...restForFirestore
  } = updateData;

  const safeForFirestore = stripUndefinedForFirestore(restForFirestore);
  const withoutRestricted = omitRestrictedUserDocFields(safeForFirestore);

  await setDoc(
    doc(db, USERS_COLLECTION, userId),
    {
      ...withoutRestricted,
      onboardingCompleted: true,
      // vocab: serverTimestamp() = Firestore's clock, not the phone's
      onboardingCompletedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    // vocab: { merge: true } = patch fields we send; leave every other field alone
    { merge: true },
  );
  return true;
}

async function callOnboardingCompleteApiOnce({
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
    return { callSucceeded: true, serverResponse, error: null };
  } catch (error) {
    return { callSucceeded: false, serverResponse: null, error };
  }
}

function sleepBeforeApiRetry(attemptIndex) {
  const delayMs = RETRY_DELAY_MS_PER_ATTEMPT * (attemptIndex + 1);
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function callOnboardingCompleteApiWithRetries(apiCallArgs) {
  let lastError = null;
  let serverResponse = null;

  for (let attempt = 0; attempt < ONBOARDING_API_ATTEMPTS; attempt += 1) {
    const attemptResult = await callOnboardingCompleteApiOnce(apiCallArgs);
    if (attemptResult.callSucceeded) {
      return { serverResponse: attemptResult.serverResponse, error: null };
    }
    lastError = attemptResult.error;
    const shouldWaitBeforeNextTry = attempt < LAST_RETRY_INDEX;
    if (shouldWaitBeforeNextTry) {
      await sleepBeforeApiRetry(attempt);
    }
  }

  return { serverResponse, error: lastError };
}
