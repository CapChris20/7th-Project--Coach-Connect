// Owns the whole push-notification lifecycle on the device.
// Flow: configure once at startup → ask permission → save Expo and native tokens on the user doc → refresh on foreground, clear on logout.
// Called from ClientAppStart, TrainerAppStart, and the settings screen. Notification copy lives in writeAlertText.js.

// vocab: expo-notifications = Expo's wrapper over APNs (iOS) and FCM (Android)
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Linking, Platform } from 'react-native';
import { deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const ANDROID_CHANNEL_ID = 'default';
// Manipulate here: raise this if a cold-start tap navigates before the navigator exists.
const COLD_START_TAP_DELAY_MS = 500;
const TOKEN_LOG_PREFIX_LENGTH = 24;
const TEST_NOTIFICATION_DELAY_SECONDS = 1;
const ANDROID_VIBRATION_PATTERN = [0, 250, 250, 250];
const NOTIFICATION_LED_COLOR = '#FF6B9D';

// ===== HELPER FUNCTIONS =====

// Module-level (not React) state. The OS listener must exist once for the process, not once per component.
let isConfigured = false;
let notificationResponseSubscription = null;

/** @type {((data: Record<string, unknown>) => void) | null} */
// The OS listener is registered once. This slot swaps the navigate function in after the nav tree mounts.
let notificationTapHandler = null;

function userDocRef(uid) {
  return doc(db, USERS_COLLECTION, uid);
}

function isNotificationPermissionGranted(permission) {
  return Boolean(permission?.granted || permission?.status === 'granted');
}

// Dev-only peek. Push tokens are device credentials, so only a prefix is printed.
function logTokenDebug(label, value) {
  if (__DEV__ && value && typeof value === 'string') {
    console.log(`[push] ${label} prefix`, value.slice(0, TOKEN_LOG_PREFIX_LENGTH) + '…');
  }
}

function isSimulatorPushError(error) {
  const messageText = (error?.message || String(error)).toLowerCase();
  return messageText.includes('simulator') || messageText.includes('device');
}

// True only when the user doc explicitly says notifications are off. A read failure returns false
// so we still try to save the token instead of dropping it.
async function isNotificationsDisabled(uid) {
  try {
    const snap = await getDoc(userDocRef(uid));
    return snap.exists() && snap.data()?.notificationsEnabled === false;
  } catch {
    return false;
  }
}

function buildPushTokenPayload(expoPushToken, fcmToken) {
  const now = new Date().toISOString();
  return {
    expoPushToken,
    // pushToken is the legacy field. It mirrors the Expo token so older Cloud Functions keep working.
    pushToken: expoPushToken,
    pushTokenUpdatedAt: now,
    // vocab/symbol: ...(condition ? { key } : {}) = include the key only when we have a value.
    // Writing undefined makes Firestore throw, and the native token is optional.
    ...(fcmToken ? { fcmToken } : {}),
  };
}

async function rememberPendingExpoToken(uid, expoPushToken) {
  if (!expoPushToken) return;
  try {
    await AsyncStorage.setItem(pendingPushTokenStorageKey(uid), expoPushToken);
  } catch (_) {
    /* non-fatal */
  }
}

// Attaches the OS tap listener exactly once. Subscribing twice would navigate twice per tap.
function ensureNotificationResponseSubscription() {
  if (notificationResponseSubscription) return;
  notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data || {};
    if (notificationTapHandler) notificationTapHandler(data);
  });
}

function readExpoProjectId() {
  // vocab: EAS = Expo Application Services. The project id lives in a different place for EAS builds vs the dev client.
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    undefined
  );
}

// ===== MAIN FUNCTION =====

/**
 * Where a token waits when we obtained it but could not save it (offline at launch).
 * Scoped by uid so it cannot attach to the wrong account.
 * @param {string} uid
 * @returns {string}
 */
export function pendingPushTokenStorageKey(uid) {
  return `pending_push_token_${uid}`;
}

/**
 * Register the function that runs when a notification is tapped.
 * Pass null on unmount to detach. Anything that is not a function is stored as null.
 * @param {Function|null} handler
 */
export function setNotificationTapHandler(handler) {
  notificationTapHandler = typeof handler === 'function' ? handler : null;
}

/**
 * Replay the notification that launched the app, once the nav tree has a tap handler.
 * Returns a cleanup function in every branch so a useEffect can always call it.
 * @param {number} [delayMs]
 * @returns {Function}
 */
export function flushInitialNotificationResponse(delayMs = COLD_START_TAP_DELAY_MS) {
  try {
    // vocab: getLastNotificationResponse() = which notification, if any, opened this app.
    const lastResponse = Notifications.getLastNotificationResponse?.();
    if (!lastResponse?.notification?.request?.content?.data) return () => {};
    const data = lastResponse.notification.request.content.data || {};
    // The delay lets navigation finish mounting. Firing instantly navigates into a tree that is not there yet.
    const timeoutId = setTimeout(() => {
      if (notificationTapHandler) notificationTapHandler(data);
    }, delayMs);
    return () => clearTimeout(timeoutId);
  } catch {
    return () => {};
  }
}

/**
 * One-time startup setup. Safe to call from both app shells and the settings screen.
 */
export function configureNotifications() {
  if (isConfigured) return;

  // Foreground pushes show a banner. The app-icon badge is driven by our own unread count, not by push count.
  // Manipulate here: shouldSetBadge stays false so push count and the unread index are not added together.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  // Android needs a channel before any notification can show. iOS has no equivalent.
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      // Manipulate here: name and description are what the user sees in Android settings.
      // Changing the channel id ('default') orphans the preferences they already set.
      name: 'CoachConnect',
      description: 'Notifications from your AI Fitness Coach',
      // MAX = heads-up banner with sound. DEFAULT would be a silent tray alert.
      importance: Notifications.AndroidImportance.MAX,
      // vibrationPattern = [wait, vibrate, wait, vibrate] in milliseconds
      vibrationPattern: ANDROID_VIBRATION_PATTERN,
      sound: 'default',
      enableLights: true,
      lightColor: NOTIFICATION_LED_COLOR,
      enableVibrate: true,
    }).catch(() => {});
  }

  ensureNotificationResponseSubscription();
  isConfigured = true;
}

/**
 * Current permission, without showing the system prompt.
 * @returns {Promise<object>}
 */
export async function getNotificationPermissionsAsync() {
  return Notifications.getPermissionsAsync();
}

/**
 * Ask for notification permission. If it is already granted, the system dialog is not shown again.
 * @returns {Promise<object>}
 */
export async function requestNotificationPermissionsAsync() {
  const existing = await Notifications.getPermissionsAsync();
  if (isNotificationPermissionGranted(existing)) return existing;

  // Manipulate here: iOS capabilities we ask for. Announcements (Siri reading alerts) stay off.
  return Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowAnnouncements: false,
    },
  });
}

/**
 * Open the system settings app. The OS will not show the permission dialog again after a denial.
 * @returns {Promise<boolean>}
 */
export async function openSystemSettingsAsync() {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

/**
 * Native device token. Android: FCM registration token. iOS: APNs device token string.
 * Stored as fcmToken. Returns null instead of throwing — the Expo token can deliver on its own.
 * @returns {Promise<string|null>}
 */
export async function getNativeDevicePushTokenAsync() {
  try {
    const device = await Notifications.getDevicePushTokenAsync();
    const token = device?.data != null ? String(device.data) : null;
    if (token) logTokenDebug('native', token);
    return token;
  } catch (error) {
    const messageText = error?.message || String(error);
    if (__DEV__) console.warn('[push] native device token unavailable:', messageText);
    return null;
  }
}

/**
 * Expo push token. Permission is required. Throws on a simulator or any other failure.
 * @returns {Promise<string>}
 */
export async function getExpoPushTokenAsync() {
  const permission = await requestNotificationPermissionsAsync();
  if (!isNotificationPermissionGranted(permission)) {
    throw new Error('Notification permission was not granted.');
  }

  const projectId = readExpoProjectId();

  try {
    // Passing undefined (not { projectId: undefined }) lets Expo detect the project itself.
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const tokenData = token.data;
    logTokenDebug('expo', tokenData);
    return tokenData;
  } catch (error) {
    if (isSimulatorPushError(error)) {
      throw new Error('Push notifications require a physical device (not the iOS Simulator).');
    }
    throw error;
  }
}

/**
 * Save the Expo token and, when we have one, the native token.
 * Keeps legacy pushToken mirroring the Expo token.
 * skipIfDisabled defaults to true — it respects notificationsEnabled: false.
 * Pass a string to flush a token that was cached in AsyncStorage.
 * @param {string} uid
 * @param {{ skipIfDisabled?: boolean, pendingExpoToken?: string } | string} [optionsOrPendingToken]
 */
export async function persistPushTokensForUid(uid, optionsOrPendingToken = {}) {
  const options =
    typeof optionsOrPendingToken === 'string'
      ? { pendingExpoToken: optionsOrPendingToken }
      : optionsOrPendingToken;
  // Only an explicit false opts out. Turning notifications ON must pass false, because the doc still says off.
  const skipIfDisabled = options.skipIfDisabled !== false;
  if (!uid || !db) return;

  if (skipIfDisabled && (await isNotificationsDisabled(uid))) return;

  const userRef = userDocRef(uid);
  let expoPushToken = null;

  try {
    expoPushToken = options.pendingExpoToken || (await getExpoPushTokenAsync());
    const fcmToken = await getNativeDevicePushTokenAsync();
    await setDoc(userRef, buildPushTokenPayload(expoPushToken, fcmToken), { merge: true });
    await AsyncStorage.removeItem(pendingPushTokenStorageKey(uid)).catch(() => {});
    if (__DEV__) {
      console.log('[push] tokens saved', { hasExpo: !!expoPushToken, hasFcm: !!fcmToken });
    }
  } catch (error) {
    console.warn('Push token save failed, retrying on next launch:', error?.message || error);
    await rememberPendingExpoToken(uid, expoPushToken);
  }
}

/**
 * Remove every token field so the server stops targeting this device.
 * deleteField makes `if (user.expoPushToken)` read false. A failure must not block sign-out.
 * @param {string} uid
 */
export async function clearPushTokensForUid(uid) {
  if (!uid || !db) return;
  try {
    await updateDoc(userDocRef(uid), {
      expoPushToken: deleteField(),
      fcmToken: deleteField(),
      pushToken: deleteField(),
    });
    if (__DEV__) console.log('[push] tokens cleared for user');
  } catch (error) {
    if (__DEV__) console.warn('[push] clearPushTokensForUid failed:', error?.message || error);
  }
}

/**
 * Re-save tokens when the app returns to the foreground.
 * Tokens rotate, and permission can change in system settings while we are backgrounded.
 * Call the returned function on unmount so the listener does not leak across accounts.
 * @param {string} uid
 * @param {Function} shouldRun evaluated at resume time, not when the subscription was created
 * @returns {Function}
 */
export function subscribePushTokenRefreshOnResume(uid, shouldRun) {
  // vocab: AppState 'change' fires on background and foreground. 'active' means foreground.
  const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState !== 'active' || !uid || !shouldRun?.()) return;
    persistPushTokensForUid(uid, { skipIfDisabled: true }).catch(() => {});
  });
  return () => appStateSubscription.remove();
}

/**
 * Local test banner from the settings screen. It does not call the server.
 */
export async function sendTestLocalNotificationAsync() {
  configureNotifications();

  await Notifications.scheduleNotificationAsync({
    // Manipulate here: the test notification title and body.
    content: {
      title: 'CoachConnect',
      body: 'Notifications are enabled.',
      sound: true,
    },
    // One second, not immediate, so the banner arrives as a real notification instead of flashing on the tap.
    trigger: { seconds: TEST_NOTIFICATION_DELAY_SECONDS },
  });
}
