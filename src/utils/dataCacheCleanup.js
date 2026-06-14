// Fix data leakage by clearing all cached data when user switches
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEYS_TO_CLEAR = [
  // Legacy global AI toggle — per-user preference lives in `user_ai_enabled_<uid>` (see AIContext).
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

export async function clearAllUserData() {
  try {
    console.log('🧹 Clearing all user data cache...');
    
    // Clear all known cache keys
    for (const key of CACHE_KEYS_TO_CLEAR) {
      try {
        await AsyncStorage.removeItem(key);
        console.log(`✅ Cleared cache key: ${key}`);
      } catch (e) {
        console.log(`⚠️ Failed to clear ${key}:`, e.message);
      }
    }
    
    // Get all AsyncStorage keys and clear any remaining app-specific ones
    try {
      const allKeys = await AsyncStorage.getAllKeys();
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

export async function clearUserSpecificData(userId) {
  try {
    console.log(`🧹 Clearing data for user: ${userId}`);
    
    // Clear user-specific cache keys
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

// Function to call when user signs out
export async function onUserSignOut() {
  console.log('👋 User signing out - clearing cache...');
  await clearAllUserData();
}

// Function to call when user switches accounts
export async function onUserSwitch(fromUserId, toUserId) {
  console.log(`🔄 User switching from ${fromUserId} to ${toUserId}`);
  await clearUserSpecificData(fromUserId);
  await clearAllUserData(); // Also clear any shared cache
}
