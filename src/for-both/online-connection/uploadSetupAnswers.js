// Holds onboarding answers on the phone when the finish call cannot reach the server, then retries later.
// Flow: queue the payload under the uid → on next launch, POST the wizard queue, then the finish-setup cache.
// Used by NewUserSetupScreen (queue) and LoginGate (flush). A missing uid on flush means "nothing to do".

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseCandidates } from './whereToConnect';

// ===== NAMED CONSTANTS =====

// Manipulate here: these prefixes must match the keys finishSetup and the wizard write, or the retry never finds them.
const PENDING_SYNC_KEY_PREFIX = 'pending_onboarding_sync_';
const PENDING_COMPLETE_KEY_PREFIX = 'pending_onboarding_complete_';
const ONBOARDING_COMPLETE_PATH = '/api/onboarding/complete';
const MISSING_ID_TOKEN_MESSAGE = 'Missing ID token';

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} uid
 * @returns {string}
 */
function pendingSyncStorageKey(uid) {
  return `${PENDING_SYNC_KEY_PREFIX}${uid}`;
}

/**
 * @param {string} uid
 * @returns {string}
 */
function pendingCompleteStorageKey(uid) {
  return `${PENDING_COMPLETE_KEY_PREFIX}${uid}`;
}

/**
 * @param {string} storageKey
 * @returns {Promise<string|null>}
 */
async function readStoredText(storageKey) {
  try {
    return await AsyncStorage.getItem(storageKey);
  } catch (_) {
    return null;
  }
}

/**
 * @param {string} storageKey
 * @returns {Promise<void>}
 */
async function removeStoredItem(storageKey) {
  try {
    await AsyncStorage.removeItem(storageKey);
  } catch (_) {
    // A failed delete leaves the item queued. The next flush will try again.
  }
}

/**
 * @param {string} rawText
 * @returns {{ storedValue: object|null, isCorrupt: boolean }}
 */
function parseStoredJson(rawText) {
  try {
    return { storedValue: JSON.parse(rawText), isCorrupt: false };
  } catch (_) {
    return { storedValue: null, isCorrupt: true };
  }
}

// vocab: getIdToken(true) = force a fresh Firebase ID token. A cached one may already be expired
// after the app sat in the background through onboarding.
// Each base is a full attempt: reload, new token, POST. A non-OK response tries the next base.
/**
 * @param {object} firebaseUser
 * @param {string} apiBase
 * @param {string} path
 * @param {object} body
 * @returns {Promise<boolean>}
 */
async function tryPostToBase(firebaseUser, apiBase, path, body) {
  await firebaseUser.reload();
  const idToken = await firebaseUser.getIdToken(true);
  if (!idToken) throw new Error(MISSING_ID_TOKEN_MESSAGE);

  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body ?? {}),
  });

  return response.ok;
}

/**
 * Unreachable bases return false so the walker can try the next candidate.
 * @param {object} firebaseUser
 * @param {string} apiBase
 * @param {string} path
 * @param {object} body
 * @returns {Promise<boolean>}
 */
async function tryPostToBaseCatching(firebaseUser, apiBase, path, body) {
  try {
    return await tryPostToBase(firebaseUser, apiBase, path, body);
  } catch (_) {
    return false;
  }
}

/**
 * @param {object} firebaseUser
 * @param {string} path
 * @param {object} body
 * @returns {Promise<boolean>}
 */
async function postWithAuth(firebaseUser, path, body) {
  const apiBases = getApiBaseCandidates();
  for (const apiBase of apiBases) {
    const didPostSucceed = await tryPostToBaseCatching(firebaseUser, apiBase, path, body);
    if (didPostSucceed) return true;
  }
  return false;
}

// Wizard queue shape: { queuedAt, payload: { path, body } }.
// Corrupt JSON is deleted so it cannot block every future launch. A valid row with no path is left alone.
/**
 * @param {object} firebaseUser
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
async function flushQueuedSyncPayload(firebaseUser, uid) {
  const storageKey = pendingSyncStorageKey(uid);
  const rawText = await readStoredText(storageKey);
  if (!rawText) return true;

  const { storedValue, isCorrupt } = parseStoredJson(rawText);
  if (isCorrupt) {
    await removeStoredItem(storageKey);
    return true;
  }

  const payload = storedValue?.payload;
  const path = payload?.path;
  const body = payload?.body;
  if (!path) return true;

  const didPostSucceed = await postWithAuth(firebaseUser, path, body ?? {});
  if (didPostSucceed) {
    await removeStoredItem(storageKey);
    return true;
  }
  return false;
}

// finishSetup writes a different key: { finalRole, onboardingData, displayName }.
// Without finalRole or onboardingData there is nothing the complete endpoint can save.
/**
 * @param {object} firebaseUser
 * @param {string} uid
 * @returns {Promise<boolean>}
 */
async function flushQueuedCompletePayload(firebaseUser, uid) {
  const storageKey = pendingCompleteStorageKey(uid);
  const rawText = await readStoredText(storageKey);
  if (!rawText) return true;

  const { storedValue, isCorrupt } = parseStoredJson(rawText);
  if (isCorrupt) {
    await removeStoredItem(storageKey);
    return true;
  }

  const hasCompleteFields = Boolean(storedValue && (storedValue.finalRole || storedValue.onboardingData));
  if (!hasCompleteFields) return true;

  const didPostSucceed = await postWithAuth(firebaseUser, ONBOARDING_COMPLETE_PATH, {
    finalRole: storedValue.finalRole,
    onboardingData: storedValue.onboardingData,
    displayName: storedValue.displayName,
  });
  if (didPostSucceed) {
    await removeStoredItem(storageKey);
    return true;
  }
  return false;
}

// ===== MAIN FUNCTION =====

/**
 * Save onboarding answers locally so a later launch can upload them.
 * Best-effort: a storage failure is ignored so signup itself still finishes.
 * @param {string} uid
 * @param {object} payload
 * @returns {Promise<void>}
 */
export async function queuePendingOnboardingSync(uid, payload) {
  if (!uid) return;
  try {
    const queuedRecord = {
      queuedAt: new Date().toISOString(),
      payload,
    };
    await AsyncStorage.setItem(pendingSyncStorageKey(uid), JSON.stringify(queuedRecord));
  } catch (_) {
    // ignore
  }
}

/**
 * Upload any onboarding that was saved locally and could not be sent.
 * Returns true when both queues are done (or empty). Returns false if a POST still failed.
 * @param {object} firebaseUser
 * @returns {Promise<boolean>}
 */
export async function flushPendingOnboardingSync(firebaseUser) {
  const uid = firebaseUser?.uid;
  if (!uid) return true;

  // Both queues run even when the first POST fails. One success should not hide the other pending row.
  const isSyncFlushed = await flushQueuedSyncPayload(firebaseUser, uid);
  const isCompleteFlushed = await flushQueuedCompletePayload(firebaseUser, uid);
  return isSyncFlushed && isCompleteFlushed;
}
