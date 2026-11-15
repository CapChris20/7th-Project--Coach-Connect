// Owns the whole push-notification lifecycle on the device.
// Flow: configure once → ask permission → save Expo + native tokens on users/{uid} → refresh on foreground → clear on logout.
// Used by: ClientAppStart, TrainerAppStart, settings screen. Alert copy lives in writeAlertText.js.
// Read order: constants → exported recipes → PLUMBING at the bottom.

// vocab: expo-notifications = Expo's wrapper over APNs (iOS) and FCM (Android)
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Linking, Platform } from 'react-native';
import { deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';
import { lightColors } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
// Manipulate here: Android channel id — changing it orphans prefs the user already set
const ANDROID_CHANNEL_ID = 'default';
// Manipulate here: raise if a cold-start tap navigates before the navigator exists
const COLD_START_TAP_DELAY_MS = 500;
const TOKEN_LOG_PREFIX_LENGTH = 24;
const TEST_NOTIFICATION_DELAY_SECONDS = 1;
const ANDROID_VIBRATION_PATTERN = [0, 250, 250, 250];
const NOTIFICATION_LED_COLOR = lightColors.primary;
const CLEARED_PUSH_TOKEN_FIELDS = {
  expoPushToken: deleteField(),
  fcmToken: deleteField(),
  pushToken: deleteField(),
};

// Module-level (not React) state — OS listener must exist once for the process, not once per screen.
let notificationsAlreadyConfigured = false;
let notificationResponseSubscription = null;
/** @type {((data: Record<string, unknown>) => void) | null} */
// Slot for the navigate function; OS listener is registered once, then this swaps in after nav mounts.
let notificationTapHandler = null;

// ===== HELPER FUNCTIONS =====
// Small helpers sit under PLUMBING. Exported recipes follow.

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
  const handlerIsCallable = typeof handler === 'function';
  notificationTapHandler = handlerIsCallable ? handler : null;
}

/**
 * Replay the notification that launched the app, once the nav tree has a tap handler.
 * Returns a cleanup function in every branch so a useEffect can always call it.
 * @param {number} [delayMs]
 * @returns {Function}
 */
export function flushInitialNotificationResponse(delayMs = COLD_START_TAP_DELAY_MS) {
  try {
    // vocab: getLastNotificationResponse() = which notification, if any, opened this app
    const getLastResponse = Notifications.getLastNotificationResponse;
    let lastResponse = undefined;
    if (getLastResponse) {
      lastResponse = getLastResponse();
    }

    const tapPayload = readNotificationTapPayload(lastResponse);
    if (!tapPayload) return () => {};

    const notificationData = tapPayload || {};
    // Delay lets navigation finish mounting — firing instantly navigates into a missing tree.
    const timeoutId = setTimeout(() => {
      if (notificationTapHandler) notificationTapHandler(notificationData);
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
  if (notificationsAlreadyConfigured) return;

  // 1. Foreground pushes show a banner. Badge count comes from our unread index, not push count.
  // Manipulate here: shouldSetBadge stays false so push count and unread index are not added together
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  // 2. Android channel (no-op on iOS).
  createAndroidNotificationChannelIfNeeded();

  // 3. Tap listener once per process.
  attachNotificationTapListenerOnce();
  notificationsAlreadyConfigured = true;
}

/**
 * Current permission, without showing the system prompt.
 * @returns {Promise<object>}
 */
export async function getNotificationPermissionsAsync() {
  return Notifications.getPermissionsAsync();
}

/**
 * Ask for notification permission. If already granted, the system dialog is not shown again.
 * @returns {Promise<object>}
 */
export async function requestNotificationPermissionsAsync() {
  const existingPermission = await Notifications.getPermissionsAsync();
  if (permissionIsGranted(existingPermission)) return existingPermission;

  // Manipulate here: iOS capabilities we ask for — Announcements (Siri reading alerts) stay off
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
 * Stored as fcmToken. Returns null instead of throwing — the Expo token can deliver alone.
 * @returns {Promise<string|null>}
 */
export async function getNativeDevicePushTokenAsync() {
  try {
    const deviceTokenResult = await Notifications.getDevicePushTokenAsync();
    let rawToken = undefined;
    if (deviceTokenResult) {
      rawToken = deviceTokenResult.data;
    }
    const tokenAsString = rawToken != null ? String(rawToken) : null;
    if (tokenAsString) logPushTokenPrefix('native', tokenAsString);
    return tokenAsString;
  } catch (error) {
    const errorMessage = readErrorMessage(error);
    if (__DEV__) console.warn('[push] native device token unavailable:', errorMessage);
    return null;
  }
}

/**
 * Expo push token. Permission is required. Throws on a simulator or any other failure.
 * @returns {Promise<string>}
 */
export async function getExpoPushTokenAsync() {
  // 1. Refuse when the user has not granted alerts.
  const permission = await requestNotificationPermissionsAsync();
  if (!permissionIsGranted(permission)) {
    throw new Error('Notification permission was not granted.');
  }

  // 2. Ask Expo for the token (pass project id only when we actually have one).
  const expoProjectId = readExpoProjectId();
  try {
    // Passing undefined (not { projectId: undefined }) lets Expo detect the project itself.
    const tokenOptions = expoProjectId ? { projectId: expoProjectId } : undefined;
    const tokenResult = await Notifications.getExpoPushTokenAsync(tokenOptions);
    const expoTokenString = tokenResult.data;
    logPushTokenPrefix('expo', expoTokenString);
    return expoTokenString;
  } catch (error) {
    if (errorLooksLikeSimulator(error)) {
      throw new Error('Push notifications require a physical device (not the iOS Simulator).');
    }
    throw error;
  }
}

/**
 * Save the Expo token and, when we have one, the native token.
 * Keeps legacy pushToken mirroring the Expo token.
 * skipIfDisabled defaults to true — respects notificationsEnabled: false.
 * Pass a string to flush a token that was cached in AsyncStorage.
 * @param {string} uid
 * @param {{ skipIfDisabled?: boolean, pendingExpoToken?: string } | string} [optionsOrPendingToken]
 */
export async function persistPushTokensForUid(uid, optionsOrPendingToken = {}) {
  const options = normalizePersistOptions(optionsOrPendingToken);
  // Only an explicit false opts out. Turning notifications ON must pass false — the doc still says off.
  const shouldSkipWhenDisabled = options.skipIfDisabled !== false;

  // 1. Bail when there is nowhere to save, or the user turned alerts off.
  if (!uid || !db) return;
  if (shouldSkipWhenDisabled) {
    const alertsAreOff = await userHasNotificationsDisabled(uid);
    if (alertsAreOff) return;
  }

  const userRef = firestoreUserDoc(uid);
  let expoPushToken = null;

  // 2. Obtain tokens, merge into users/{uid}, clear any pending cache.
  try {
    expoPushToken = options.pendingExpoToken || (await getExpoPushTokenAsync());
    const fcmToken = await getNativeDevicePushTokenAsync();
    const tokenFields = buildPushTokenFields(expoPushToken, fcmToken);
    await setDoc(userRef, tokenFields, { merge: true });
    await AsyncStorage.removeItem(pendingPushTokenStorageKey(uid)).catch(() => {});
    if (__DEV__) {
      console.log('[push] tokens saved', {
        hasExpo: !!expoPushToken,
        hasFcm: !!fcmToken,
      });
    }
  } catch (error) {
    // 3. Offline or transient failure — stash Expo token for the next launch.
    console.warn('Push token save failed, retrying on next launch:', readErrorMessage(error) || error);
    await stashPendingExpoToken(uid, expoPushToken);
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
    await updateDoc(firestoreUserDoc(uid), { ...CLEARED_PUSH_TOKEN_FIELDS });
    if (__DEV__) console.log('[push] tokens cleared for user');
  } catch (error) {
    if (__DEV__) console.warn('[push] clearPushTokensForUid failed:', readErrorMessage(error) || error);
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
  const onAppStateChange = (nextAppState) => {
    const shouldRefresh = shouldRefreshTokensOnForeground(nextAppState, uid, shouldRun);
    if (!shouldRefresh) return;
    persistPushTokensForUid(uid, { skipIfDisabled: true }).catch(() => {});
  };
  const appStateSubscription = AppState.addEventListener('change', onAppStateChange);
  return () => appStateSubscription.remove();
}

/**
 * Local test banner from the settings screen. It does not call the server.
 */
export async function sendTestLocalNotificationAsync() {
  configureNotifications();

  await Notifications.scheduleNotificationAsync({
    // Manipulate here: the test notification title and body
    content: {
      title: 'CoachConnect',
      body: 'Notifications are enabled.',
      sound: true,
    },
    // One second, not immediate, so the banner arrives as a real notification instead of flashing on tap.
    trigger: { seconds: TEST_NOTIFICATION_DELAY_SECONDS },
  });
}

// ===== PLUMBING — skip unless debugging =====

function firestoreUserDoc(uid) {
  return doc(db, USERS_COLLECTION, uid);
}

/**
 * Pull .data off a notification response chain with named locals.
 * Path: response.notification.request.content.data
 * @param {object|null|undefined} response
 * @returns {object|undefined}
 */
function readNotificationTapPayload(response) {
  if (!response) return undefined;
  const notification = response.notification;
  if (!notification) return undefined;
  const request = notification.request;
  if (!request) return undefined;
  const content = request.content;
  if (!content) return undefined;
  return content.data;
}

/**
 * Error.message when present; otherwise String(error).
 * @param {unknown} error
 * @returns {string}
 */
function readErrorMessage(error) {
  if (error && typeof error === 'object' && error.message) {
    return error.message;
  }
  if (error == null) return '';
  return String(error);
}

function permissionIsGranted(permission) {
  let grantedFlag = false;
  let statusIsGranted = false;
  if (permission) {
    grantedFlag = Boolean(permission.granted);
    statusIsGranted = permission.status === 'granted';
  }
  return Boolean(grantedFlag || statusIsGranted);
}

// Dev-only peek. Push tokens are device credentials, so only a prefix is printed.
function logPushTokenPrefix(label, value) {
  if (!__DEV__) return;
  if (!value || typeof value !== 'string') return;
  const tokenPrefix = value.slice(0, TOKEN_LOG_PREFIX_LENGTH);
  console.log(`[push] ${label} prefix`, tokenPrefix + '…');
}

function errorLooksLikeSimulator(error) {
  const messageText = (readErrorMessage(error) || String(error)).toLowerCase();
  const mentionsSimulator = messageText.includes('simulator');
  const mentionsDevice = messageText.includes('device');
  return mentionsSimulator || mentionsDevice;
}

// True only when the user doc explicitly says notifications are off.
// A read failure returns false so we still try to save the token instead of dropping it.
async function userHasNotificationsDisabled(uid) {
  try {
    const userSnap = await getDoc(firestoreUserDoc(uid));
    if (!userSnap.exists()) return false;
    const userData = userSnap.data();
    if (!userData) return false;
    return userData.notificationsEnabled === false;
  } catch {
    return false;
  }
}

function optionalFcmField(fcmToken) {
  // vocab/symbol: returning {} vs { fcmToken } = include the key only when we have a value.
  // Writing undefined makes Firestore throw, and the native token is optional.
  if (!fcmToken) return {};
  return { fcmToken };
}

function buildPushTokenFields(expoPushToken, fcmToken) {
  const updatedAtIso = new Date().toISOString();
  return {
    expoPushToken,
    // pushToken is the legacy field. It mirrors the Expo token so older Cloud Functions keep working.
    pushToken: expoPushToken,
    pushTokenUpdatedAt: updatedAtIso,
    ...optionalFcmField(fcmToken),
  };
}

async function stashPendingExpoToken(uid, expoPushToken) {
  if (!expoPushToken) return;
  try {
    await AsyncStorage.setItem(pendingPushTokenStorageKey(uid), expoPushToken);
  } catch (_) {
    /* non-fatal */
  }
}

// Attaches the OS tap listener exactly once. Subscribing twice would navigate twice per tap.
function attachNotificationTapListenerOnce() {
  if (notificationResponseSubscription) return;
  notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const notificationData = readNotificationTapPayload(response) || {};
      if (notificationTapHandler) notificationTapHandler(notificationData);
    },
  );
}

function readExpoProjectId() {
  // vocab: EAS = Expo Application Services. Project id lives in a different place for EAS builds vs the dev client.
  let fromExpoConfig = undefined;
  if (Constants && Constants.expoConfig && Constants.expoConfig.extra) {
    const easBlock = Constants.expoConfig.extra.eas;
    if (easBlock) {
      fromExpoConfig = easBlock.projectId;
    }
  }
  if (fromExpoConfig) return fromExpoConfig;

  let fromEasConfig = undefined;
  if (Constants && Constants.easConfig) {
    fromEasConfig = Constants.easConfig.projectId;
  }
  if (fromEasConfig) return fromEasConfig;
  return undefined;
}

function shouldRefreshTokensOnForeground(nextAppState, uid, shouldRun) {
  // vocab: AppState 'change' fires on background and foreground. 'active' means foreground.
  if (nextAppState !== 'active') return false;
  if (!uid) return false;
  if (!shouldRun) return false;
  return Boolean(shouldRun());
}

function normalizePersistOptions(optionsOrPendingToken) {
  if (typeof optionsOrPendingToken === 'string') {
    return { pendingExpoToken: optionsOrPendingToken };
  }
  return optionsOrPendingToken;
}

async function createAndroidNotificationChannelIfNeeded() {
  if (Platform.OS !== 'android') return;

  // Android needs a channel before any notification can show. iOS has no equivalent.
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    // Manipulate here: name and description are what the user sees in Android settings
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
