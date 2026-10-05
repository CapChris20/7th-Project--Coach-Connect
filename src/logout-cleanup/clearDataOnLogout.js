// Wipes on-device caches so one account never sees another account's data.
// Flow: sign-out or account-switch → drop known cache keys → sweep any leftover app-prefixed keys → (sign-out only) unregister push tokens.
// Called from the auth/sign-out path; `dataCacheCleanup.js` is a deprecated alias for this file.

// vocab: AsyncStorage = React Native's key/value store on the device (survives app restarts)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../app-start/cloudConnection';
import { clearPushTokensForUid } from '../notifications/manageAlerts';

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

// Full nuke: everything in the hit list plus a best-effort sweep for anything we forgot.
// Returns true/false instead of throwing, because sign-out must complete even if cleanup fails.
export async function clearAllUserData() {
  try {
    console.log('🧹 Clearing all user data cache...');
    
    // Pass 1 — the known keys, one at a time.
    // Each removal has its own try/catch so a single bad key can't abort the whole loop
    // and leave the rest of the caches behind.
    for (const key of CACHE_KEYS_TO_CLEAR) {
      try {
        await AsyncStorage.removeItem(key);
        console.log(`✅ Cleared cache key: ${key}`);
      } catch (e) {
        console.log(`⚠️ Failed to clear ${key}:`, e.message);
      }
    }
    
    // Pass 2 — the safety net. Reads every key on the device and deletes anything that
    // *looks* like ours. This catches uid-suffixed and ad-hoc keys nobody added to the list above.
    // Deliberately does NOT call AsyncStorage.clear(), which would also blow away
    // third-party SDK storage (auth session, analytics) and break the app.
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      // Manipulate here: these prefixes/substrings define "ours". Too broad and you'd
      // delete another library's data; too narrow and user data leaks across accounts.
      const appKeys = allKeys.filter(key => 
        key.startsWith('COACHCONNECT_') || 
        key.startsWith('coachconnect_') ||
        key.startsWith('@COACHCONNECT_') ||
        key.startsWith('user_ai_') ||
        key.includes('user_data') ||
        key.includes('dashboard') ||
        key.includes('nutrition') ||
        key.includes('workout')
      );
      
      if (appKeys.length > 0) {
        console.log(`🧹 Found ${appKeys.length} additional cache keys to clear...`);
        // vocab: multiRemove = delete many keys in one native round-trip (much faster than a loop)
        await AsyncStorage.multiRemove(appKeys);
        console.log('✅ Cleared additional cache keys');
      }
    } catch (e) {
      console.log('⚠️ Failed to clear additional keys:', e.message);
    }
    
    console.log('✅ All user data cache cleared successfully');
    return true;
  } catch (error) {
    console.error('❌ Error clearing user data cache:', error);
    return false;
  }
}

// Surgical version: clears only the keys belonging to ONE uid.
// Used on account switch, where the incoming user's cached data must stay intact.
export async function clearUserSpecificData(userId) {
  try {
    console.log(`🧹 Clearing data for user: ${userId}`);
    
    // Every per-user cache follows a `<name>_<uid>` naming convention, so the uid
    // gets templated into each key here.
    // Manipulate here: any new uid-scoped AsyncStorage key must be added to this list
    const userSpecificKeys = [
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
    
    for (const key of userSpecificKeys) {
      try {
        await AsyncStorage.removeItem(key);
      } catch (e) {
        console.log(`⚠️ Failed to clear ${key}:`, e.message);
      }
    }
    
    console.log(`✅ Cleared data for user: ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Error clearing user data:', error);
    return false;
  }
}

// Sign-out entry point. Order matters: read the uid and detach push tokens FIRST,
// because `auth.currentUser` is gone once Firebase actually signs out, and a stale token
// would keep delivering this user's notifications to the device.
export async function onUserSignOut() {
  console.log('👋 User signing out - clearing cache...');
  // vocab/symbol: ?. = optional chaining — safely read through a value that might be null
  const uid = auth?.currentUser?.uid;
  if (uid) {
    try {
      await clearPushTokensForUid(uid);
    } catch (e) {
      // Non-fatal: a failed token cleanup must not block the user from logging out.
      console.log('⚠️ Push token cleanup failed:', e?.message || e);
    }
  }
  await clearAllUserData();
}

/** Shared keys cleared on account switch (not other users' uid-scoped data). */
// These are the caches with no uid in the name, so they'd show the wrong user's
// content after a switch. Manipulate here: keep this a subset of CACHE_KEYS_TO_CLEAR
const SHARED_CACHE_KEYS = [
  'COACHCONNECT_FOOD_CACHE',
  'COACHCONNECT_CHAT_HISTORY',
  'COACHCONNECT_DASHBOARD_STATE',
  'COACHCONNECT_NUTRITION_CACHE',
  'COACHCONNECT_WORKOUT_CACHE',
];

// Account-switch entry point. Two-step on purpose:
// 1. drop the OUTGOING user's uid-scoped caches (their private data)
// 2. drop the shared, un-scoped caches (so the new user doesn't inherit stale screens)
// `toUserId` is logged for traceability only — the incoming user's caches are left alone.
export async function onUserSwitch(fromUserId, toUserId) {
  console.log(`🔄 User switching from ${fromUserId} to ${toUserId}`);
  if (fromUserId) {
    try {
      await clearUserSpecificData(fromUserId);
    } catch (e) {
      console.log('⚠️ Failed to clear prior user cache:', e?.message || e);
    }
  }
  // Per-key try/catch again so one failure doesn't skip the remaining shared keys.
  for (const key of SHARED_CACHE_KEYS) {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.log(`⚠️ Failed to clear shared key ${key}:`, e?.message || e);
    }
  }
}
