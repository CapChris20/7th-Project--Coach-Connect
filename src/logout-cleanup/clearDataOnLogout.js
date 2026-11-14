// Wipes on-device caches so one account never sees another account's data.
// Flow: sign-out or account-switch → drop known cache keys → sweep leftover app-prefixed keys → (sign-out only) unregister push tokens.
// Called from the auth/sign-out path; dataCacheCleanup.js is a deprecated alias for this file.
// Read order: constants → main recipes → PLUMBING at the bottom.

// vocab: AsyncStorage = React Native's key/value store on the device (survives app restarts)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../app-start/cloudConnection';
import { clearPushTokensForUid } from '../notifications/manageAlerts';

// ===== NAMED CONSTANTS =====

// The explicit hit list of global (not uid-scoped) caches.
// Manipulate here: add any new AsyncStorage key you introduce, or it will survive logout
//                  and leak the previous user's data into the next session.
const CACHE_KEYS_TO_CLEAR = [
  // Legacy global AI toggle — per-user preference lives in user_ai_enabled_<uid> (see AIPermission).
  'aiEnabled',
  'COACHCONNECT_FOOD_CACHE',
  'COACHCONNECT_USER_PREFERENCES',
  'COACHCONNECT_DASHBOARD_STATE',
  'COACHCONNECT_NUTRITION_CACHE',
  'COACHCONNECT_WORKOUT_CACHE',
  'COACHCONNECT_CHAT_HISTORY',
  'COACHCONNECT_THEME_PREFERENCES',
  'COACHCONNECT_NOTIFICATION_SETTINGS',
  'COACHCONNECT_ONBOARDING_STATE',
  'COACHCONNECT_TRAINER_DATA',
  'COACHCONNECT_CLIENT_DATA',
];

/** Shared keys cleared on account switch (not other users' uid-scoped data). */
const SHARED_CACHE_KEYS = [
  'COACHCONNECT_FOOD_CACHE',
  'COACHCONNECT_CHAT_HISTORY',
  'COACHCONNECT_DASHBOARD_STATE',
  'COACHCONNECT_NUTRITION_CACHE',
  'COACHCONNECT_WORKOUT_CACHE',
];

const KEY_PREFIX_COACHCONNECT = 'COACHCONNECT_';
const KEY_PREFIX_COACHCONNECT_LOWER = 'coachconnect_';
const KEY_PREFIX_AT_COACHCONNECT = '@COACHCONNECT_';
const KEY_PREFIX_USER_AI = 'user_ai_';
const KEY_INCLUDES_USER_DATA = 'user_data';
const KEY_INCLUDES_DASHBOARD = 'dashboard';
const KEY_INCLUDES_NUTRITION = 'nutrition';
const KEY_INCLUDES_WORKOUT = 'workout';

// ===== MAIN FUNCTION =====

/**
 * Full nuke: everything in the hit list plus a best-effort sweep for anything we forgot.
 * Returns true/false instead of throwing — sign-out must complete even if cleanup fails.
 * @returns {Promise<boolean>}
 */
export async function clearAllUserData() {
  try {
    console.log('🧹 Clearing all user data cache...');

    // 1. Walk the explicit hit list one key at a time.
    await removeEachKeyWithLog(CACHE_KEYS_TO_CLEAR);

    // 2. Catch any prefixed keys we forgot to list.
    await sweepLeftoverCoachConnectKeys();

    console.log('✅ All user data cache cleared successfully');
    return true;
  } catch (error) {
    console.error('❌ Error clearing user data cache:', error);
    return false;
  }
}

/**
 * Surgical version: clears only the keys belonging to ONE uid.
 * Used on account switch, where the incoming user's cached data must stay intact.
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function clearUserSpecificData(userId) {
  try {
    console.log(`🧹 Clearing data for user: ${userId}`);

    // 1. Build the per-user key list for this uid.
    const keysForThisPerson = buildPerUserStorageKeys(userId);

    // 2. Remove each key quietly (account-switch logs less noise than full sign-out).
    await removeEachKeyQuiet(keysForThisPerson);

    console.log(`✅ Cleared data for user: ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Error clearing user data:', error);
    return false;
  }
}

/**
 * Sign-out entry point. Read the uid and detach push tokens FIRST —
 * auth.currentUser is gone after sign-out.
 * @returns {Promise<void>}
 */
export async function onUserSignOut() {
  console.log('👋 User signing out - clearing cache...');

  // 1. Grab uid while Firebase still knows who is signed in.
  const signedInUid = auth && auth.currentUser ? auth.currentUser.uid : null;

  // 2. Stop push notifications for that uid (best-effort).
  await detachPushTokensForSignedOutUser(signedInUid);

  // 3. Drop every local cache key for a full sign-out.
  await clearAllUserData();
}

/**
 * Account-switch entry point. Drops the outgoing user's uid-scoped caches, then shared caches.
 * `toUserId` is logged for traceability only — the incoming user's caches are left alone.
 * @param {string} fromUserId
 * @param {string} toUserId
 * @returns {Promise<void>}
 */
export async function onUserSwitch(fromUserId, toUserId) {
  console.log(`🔄 User switching from ${fromUserId} to ${toUserId}`);

  // 1. Only wipe the outgoing person's uid-scoped rows.
  if (fromUserId) {
    await tryClearOutgoingUserCaches(fromUserId);
  }

  // 2. Shared caches cannot belong to two accounts — clear them on switch.
  await clearSharedKeysAfterAccountSwitch();
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging which AsyncStorage keys get wiped.

/**
 * One key at a time so a single bad key cannot abort the rest of the loop.
 * @param {string} storageKey
 */
async function tryRemoveOneCacheKey(storageKey) {
  try {
    await AsyncStorage.removeItem(storageKey);
    console.log(`✅ Cleared cache key: ${storageKey}`);
  } catch (error) {
    console.log(`⚠️ Failed to clear ${storageKey}:`, error.message);
  }
}

/**
 * Same as tryRemoveOneCacheKey but without the success log (account-switch path).
 * @param {string} storageKey
 */
async function tryRemoveOneCacheKeyQuiet(storageKey) {
  try {
    await AsyncStorage.removeItem(storageKey);
  } catch (error) {
    console.log(`⚠️ Failed to clear ${storageKey}:`, error.message);
  }
}

/**
 * Remove every key in the list, logging each success.
 * @param {string[]} storageKeys
 */
async function removeEachKeyWithLog(storageKeys) {
  for (const storageKey of storageKeys) {
    await tryRemoveOneCacheKey(storageKey);
  }
}

/**
 * Remove every key in the list without success logs.
 * @param {string[]} storageKeys
 */
async function removeEachKeyQuiet(storageKeys) {
  for (const storageKey of storageKeys) {
    await tryRemoveOneCacheKeyQuiet(storageKey);
  }
}

/**
 * Does this AsyncStorage key look like ours?
 * Manipulate here: these prefixes/substrings define "ours". Too broad deletes another library's data.
 * @param {string} storageKey
 * @returns {boolean}
 */
function storageKeyBelongsToCoachConnect(storageKey) {
  if (storageKey.startsWith(KEY_PREFIX_COACHCONNECT)) return true;
  if (storageKey.startsWith(KEY_PREFIX_COACHCONNECT_LOWER)) return true;
  if (storageKey.startsWith(KEY_PREFIX_AT_COACHCONNECT)) return true;
  if (storageKey.startsWith(KEY_PREFIX_USER_AI)) return true;

  if (storageKey.includes(KEY_INCLUDES_USER_DATA)) return true;
  if (storageKey.includes(KEY_INCLUDES_DASHBOARD)) return true;
  if (storageKey.includes(KEY_INCLUDES_NUTRITION)) return true;
  if (storageKey.includes(KEY_INCLUDES_WORKOUT)) return true;

  return false;
}

/**
 * Safety net: delete anything that looks like ours.
 * Does NOT call AsyncStorage.clear() — that would also blow away third-party SDK storage.
 */
async function sweepLeftoverCoachConnectKeys() {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const coachConnectKeys = allKeys.filter(storageKeyBelongsToCoachConnect);
    if (coachConnectKeys.length === 0) return;

    console.log(`🧹 Found ${coachConnectKeys.length} additional cache keys to clear...`);
    // vocab: multiRemove = delete many keys in one native round-trip (faster than a loop)
    await AsyncStorage.multiRemove(coachConnectKeys);
    console.log('✅ Cleared additional cache keys');
  } catch (error) {
    console.log('⚠️ Failed to clear additional keys:', error.message);
  }
}

/**
 * Every per-user cache follows `<name>_<uid>`. Manipulate here: add any new uid-scoped key.
 * @param {string} userId
 * @returns {string[]}
 */
function buildPerUserStorageKeys(userId) {
  return [
    `COACHCONNECT_USER_DATA_${userId}`,
    `COACHCONNECT_DASHBOARD_${userId}`,
    `COACHCONNECT_NUTRITION_${userId}`,
    `COACHCONNECT_WORKOUTS_${userId}`,
    `COACHCONNECT_TRAINER_${userId}`,
    `COACHCONNECT_CLIENT_${userId}`,
    `user_ai_enabled_${userId}`,
    `user_ai_toggle_events_${userId}`,
    `user_ai_freeze_off_until_${userId}`,
  ];
}

/**
 * Best-effort push token detach for the user who is about to sign out.
 * @param {string|null} uid
 */
async function detachPushTokensForSignedOutUser(uid) {
  if (!uid) return;
  try {
    await clearPushTokensForUid(uid);
  } catch (error) {
    const message = error && error.message ? error.message : error;
    console.log('⚠️ Push token cleanup failed:', message);
  }
}

/**
 * Clear the shared (not uid-scoped) caches after an account switch.
 */
async function clearSharedKeysAfterAccountSwitch() {
  for (const sharedKey of SHARED_CACHE_KEYS) {
    try {
      await AsyncStorage.removeItem(sharedKey);
    } catch (error) {
      const message = error && error.message ? error.message : error;
      console.log(`⚠️ Failed to clear shared key ${sharedKey}:`, message);
    }
  }
}

/**
 * Clear the outgoing user's caches; swallow errors so switch still continues.
 * @param {string} fromUserId
 */
async function tryClearOutgoingUserCaches(fromUserId) {
  try {
    await clearUserSpecificData(fromUserId);
  } catch (error) {
    const message = error && error.message ? error.message : error;
    console.log('⚠️ Failed to clear prior user cache:', message);
  }
}
