// Wipes on-device caches so one account never sees another account's data.
// Flow: sign-out or account-switch → drop known cache keys → sweep leftover app-prefixed keys → (sign-out only) unregister push tokens.
// Called from the auth/sign-out path; `dataCacheCleanup.js` is a deprecated alias for this file.

// vocab: AsyncStorage = React Native's key/value store on the device (survives app restarts)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../app-start/cloudConnection';
import { clearPushTokensForUid } from '../notifications/manageAlerts';

// ===== NAMED CONSTANTS =====

// The explicit hit list of global (not uid-scoped) caches.
// Manipulate here: add any new AsyncStorage key you introduce, or it will survive logout
//                  and leak the previous user's data into the next session.
const CACHE_KEYS_TO_CLEAR = [
  // Legacy global AI toggle — per-user preference lives in `user_ai_enabled_<uid>` (see AIPermission).
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

// ===== HELPER FUNCTIONS =====

/**
 * One key at a time so a single bad key cannot abort the rest of the loop.
 * @param {string} key
 */
async function removeCacheKey(key) {
  try {
    await AsyncStorage.removeItem(key);
    console.log(`✅ Cleared cache key: ${key}`);
  } catch (error) {
    console.log(`⚠️ Failed to clear ${key}:`, error.message);
  }
}

/**
 * @param {string} key
 */
async function removeCacheKeyQuiet(key) {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.log(`⚠️ Failed to clear ${key}:`, error.message);
  }
}

/**
 * Manipulate here: these prefixes/substrings define "ours". Too broad deletes another library's data.
 * @param {string} key
 * @returns {boolean}
 */
function isAppCacheKey(key) {
  return (
    key.startsWith(KEY_PREFIX_COACHCONNECT) ||
    key.startsWith(KEY_PREFIX_COACHCONNECT_LOWER) ||
    key.startsWith(KEY_PREFIX_AT_COACHCONNECT) ||
    key.startsWith(KEY_PREFIX_USER_AI) ||
    key.includes(KEY_INCLUDES_USER_DATA) ||
    key.includes(KEY_INCLUDES_DASHBOARD) ||
    key.includes(KEY_INCLUDES_NUTRITION) ||
    key.includes(KEY_INCLUDES_WORKOUT)
  );
}

/**
 * Safety net: delete anything that looks like ours. Does NOT call AsyncStorage.clear()
 * because that would also blow away third-party SDK storage (auth session, analytics).
 */
async function removeMatchingAppKeys() {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const appKeys = allKeys.filter(isAppCacheKey);

    if (appKeys.length > 0) {
      console.log(`🧹 Found ${appKeys.length} additional cache keys to clear...`);
      // vocab: multiRemove = delete many keys in one native round-trip (much faster than a loop)
      await AsyncStorage.multiRemove(appKeys);
      console.log('✅ Cleared additional cache keys');
    }
  } catch (error) {
    console.log('⚠️ Failed to clear additional keys:', error.message);
  }
}

/**
 * Every per-user cache follows `<name>_<uid>`. Manipulate here: add any new uid-scoped key.
 * @param {string} userId
 * @returns {string[]}
 */
function userScopedCacheKeys(userId) {
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

// ===== MAIN FUNCTION =====

/**
 * Full nuke: everything in the hit list plus a best-effort sweep for anything we forgot.
 * Returns true/false instead of throwing, because sign-out must complete even if cleanup fails.
 * @returns {Promise<boolean>}
 */
export async function clearAllUserData() {
  try {
    console.log('🧹 Clearing all user data cache...');

    for (const key of CACHE_KEYS_TO_CLEAR) {
      await removeCacheKey(key);
    }

    await removeMatchingAppKeys();

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

    for (const key of userScopedCacheKeys(userId)) {
      await removeCacheKeyQuiet(key);
    }

    console.log(`✅ Cleared data for user: ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Error clearing user data:', error);
    return false;
  }
}

/**
 * Sign-out entry point. Read the uid and detach push tokens FIRST — auth.currentUser is gone after sign-out.
 * @returns {Promise<void>}
 */
export async function onUserSignOut() {
  console.log('👋 User signing out - clearing cache...');
  const uid = auth?.currentUser?.uid;
  if (uid) {
    try {
      await clearPushTokensForUid(uid);
    } catch (error) {
      console.log('⚠️ Push token cleanup failed:', error?.message || error);
    }
  }
  await clearAllUserData();
}

/**
 * Account-switch entry point. Drops the outgoing user's uid-scoped caches, then shared un-scoped caches.
 * `toUserId` is logged for traceability only — the incoming user's caches are left alone.
 * @param {string} fromUserId
 * @param {string} toUserId
 * @returns {Promise<void>}
 */
export async function onUserSwitch(fromUserId, toUserId) {
  console.log(`🔄 User switching from ${fromUserId} to ${toUserId}`);
  if (fromUserId) {
    try {
      await clearUserSpecificData(fromUserId);
    } catch (error) {
      console.log('⚠️ Failed to clear prior user cache:', error?.message || error);
    }
  }
  for (const key of SHARED_CACHE_KEYS) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.log(`⚠️ Failed to clear shared key ${key}:`, error?.message || error);
    }
  }
}
