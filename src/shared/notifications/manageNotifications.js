/**
 * notifications Service
 *
 * Purpose: Data/service layer: notifications Service. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: setNotificationTapHandler, flushInitialNotificationResponse, configureNotifications, getNotificationPermissionsAsync, requestNotificationPermissionsAsync, openSystemSettingsAsync, getNativeDevicePushTokenAsync, getExpoPushTokenAsync
 *
 * @file-header
 */
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Linking, Platform } from 'react-native';
import { deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../app/config';

export function pendingPushTokenStorageKey(uid) {
  return `pending_push_token_${uid}`;
}

let isConfigured = false;
let notificationResponseSubscription = null;

/** @type {((data: Record<string, unknown>) => void) | null} */
let notificationTapHandler = null;

/**
 * Register handler for notification taps (set from ClientApp / TrainerApp after mount).
 * Pass null on unmount to detach.
 */
export function setNotificationTapHandler(handler) {
  notificationTapHandler = typeof handler === 'function' ? handler : null;
}

function ensureNotificationResponseSubscription() {
  if (notificationResponseSubscription) return;
  notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data || {};
    if (notificationTapHandler) notificationTapHandler(data);
  });
}

/**
 * If app was opened from a notification, deliver payload once to the current tap handler.
 * Call after ClientApp/TrainerApp registers `setNotificationTapHandler`.
 */
export function flushInitialNotificationResponse(delayMs = 500) {
  try {
    const last = Notifications.getLastNotificationResponse?.();
    if (!last?.notification?.request?.content?.data) return () => {};
    const data = last.notification.request.content.data || {};
    const t = setTimeout(() => {
      if (notificationTapHandler) notificationTapHandler(data);
    }, delayMs);
    return () => clearTimeout(t);
  } catch {
    return () => {};
  }
}

export function configureNotifications() {
  if (isConfigured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'CoachConnect',
      description: 'Notifications from your AI Fitness Coach',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableLights: true,
      lightColor: '#FF6B9D',
      enableVibrate: true,
    }).catch(() => {});
  }

  ensureNotificationResponseSubscription();
  isConfigured = true;
}

export async function getNotificationPermissionsAsync() {
  return Notifications.getPermissionsAsync();
}

export async function requestNotificationPermissionsAsync() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing?.granted || existing?.status === 'granted') return existing;

  return Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowAnnouncements: false,
    },
  });
}

export async function openSystemSettingsAsync() {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

function logTokenDebug(label, value) {
  if (__DEV__ && value && typeof value === 'string') {
    console.log(`[push] ${label} prefix`, value.slice(0, 24) + '…');
  }
}

/**
 * Native device push token (Android: FCM registration token when using FCM; iOS: device token string).
 * Used only for Firebase Admin `messaging().send` — stored as `fcmToken` on the user doc.
 */
export async function getNativeDevicePushTokenAsync() {
  try {
    const device = await Notifications.getDevicePushTokenAsync();
    const token = device?.data != null ? String(device.data) : null;
    if (token) logTokenDebug('native', token);
    return token;
  } catch (e) {
    const msg = e?.message || String(e);
    if (__DEV__) console.warn('[push] native device token unavailable:', msg);
    return null;
  }
}

export async function getExpoPushTokenAsync() {
  const perm = await requestNotificationPermissionsAsync();
  if (!perm?.granted && perm?.status !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    undefined;

  try {
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const data = token.data;
    logTokenDebug('expo', data);
    return data;
  } catch (e) {
    const msg = e?.message || String(e);
    if (msg.toLowerCase().includes('simulator') || msg.toLowerCase().includes('device')) {
      throw new Error('Push notifications require a physical device (not the iOS Simulator).');
    }
    throw e;
  }
}

/**
 * Persist Expo + native tokens. Keeps legacy `pushToken` mirroring Expo for older readers.
 * @param {string} uid
 * @param {{ skipIfDisabled?: boolean, pendingExpoToken?: string } | string} [optionsOrPendingToken]
 *   skipIfDisabled defaults true — respects `notificationsEnabled: false`.
 *   Pass a string to flush a previously cached Expo token from AsyncStorage.
 */
export async function persistPushTokensForUid(uid, optionsOrPendingToken = {}) {
  const options =
    typeof optionsOrPendingToken === 'string'
      ? { pendingExpoToken: optionsOrPendingToken }
      : optionsOrPendingToken;
  const skipIfDisabled = options.skipIfDisabled !== false;
  if (!uid || !db) return;

  if (skipIfDisabled) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists() && snap.data()?.notificationsEnabled === false) return;
    } catch {
      // continue — best effort
    }
  }

  const userRef = doc(db, 'users', uid);
  let expoPushToken = null;

  try {
    expoPushToken = options.pendingExpoToken || (await getExpoPushTokenAsync());
    const fcmToken = await getNativeDevicePushTokenAsync();
    const now = new Date().toISOString();

    const payload = {
      expoPushToken,
      pushToken: expoPushToken,
      pushTokenUpdatedAt: now,
      ...(fcmToken ? { fcmToken } : {}),
    };

    await setDoc(userRef, payload, { merge: true });
    await AsyncStorage.removeItem(pendingPushTokenStorageKey(uid)).catch(() => {});
    if (__DEV__) {
      console.log('[push] tokens saved', { hasExpo: !!expoPushToken, hasFcm: !!fcmToken });
    }
  } catch (error) {
    console.warn('Push token save failed, retrying on next launch:', error?.message || error);
    if (expoPushToken) {
      try {
        await AsyncStorage.setItem(pendingPushTokenStorageKey(uid), expoPushToken);
      } catch (_) {
        /* non-fatal */
      }
    }
  }
}

export async function clearPushTokensForUid(uid) {
  if (!uid || !db) return;
  try {
    await updateDoc(doc(db, 'users', uid), {
      expoPushToken: deleteField(),
      fcmToken: deleteField(),
      pushToken: deleteField(),
    });
    if (__DEV__) console.log('[push] tokens cleared for user');
  } catch (e) {
    if (__DEV__) console.warn('[push] clearPushTokensForUid failed:', e?.message || e);
  }
}

/**
 * Subscribe to app foreground: re-persist tokens (handles token rotation / permission changes).
 */
export function subscribePushTokenRefreshOnResume(uid, shouldRun) {
  const sub = AppState.addEventListener('change', (next) => {
    if (next !== 'active' || !uid || !shouldRun?.()) return;
    persistPushTokensForUid(uid, { skipIfDisabled: true }).catch(() => {});
  });
  return () => sub.remove();
}

export async function sendTestLocalNotificationAsync() {
  configureNotifications();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'CoachConnect',
      body: 'Notifications are enabled.',
      sound: true,
    },
    trigger: { seconds: 1 },
  });
}
