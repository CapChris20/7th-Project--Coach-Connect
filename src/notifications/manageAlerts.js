// Owns the whole push-notification lifecycle on the device.
// Flow: configureNotifications() once at startup (display rules + Android channel + tap
//       listener) → ask permission → fetch the Expo and native tokens → save them on the
//       user doc so the server can target this device → refresh on foreground, clear on logout.
// Called from ClientAppStart/TrainerAppStart and the settings screen. Notification COPY lives in
// writeAlertText.js; this file only deals with plumbing.

// vocab: expo-notifications = Expo's wrapper over APNs (iOS) and FCM (Android)
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Linking, Platform } from 'react-native';
import { deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';

// Where a token waits when we obtained it but couldn't save it (offline at launch).
// uid-scoped so a pending token can never be attached to the wrong account.
export function pendingPushTokenStorageKey(uid) {
  return `pending_push_token_${uid}`;
}

// Module-level (not React) state, because notifications are a per-PROCESS concern:
// the OS listener must exist once for the app, not once per component.
let isConfigured = false;
let notificationResponseSubscription = null;

/** @type {((data: Record<string, unknown>) => void) | null} */
// Indirection layer: the OS listener is registered once and forever, but the function it
// should call (navigate to a chat, open a session) only exists after the nav tree mounts.
// This slot lets the app swap the handler in and out without touching the subscription.
let notificationTapHandler = null;

/**
 * Register handler for notification taps (set from ClientAppStart / TrainerAppStart after mount).
 * Pass null on unmount to detach.
 */
export function setNotificationTapHandler(handler) {
  // The typeof check normalizes anything non-callable (including null) to null, so
  // `if (notificationTapHandler)` below is always a safe test.
  notificationTapHandler = typeof handler === 'function' ? handler : null;
}

// Attaches the OS tap listener exactly once — the early return is what makes that true.
// Subscribing twice would fire the handler twice per tap and double-navigate.
function ensureNotificationResponseSubscription() {
  if (notificationResponseSubscription) return;
  // The useful part of a tap is the `data` payload the server attached (e.g.
  // { type: 'message', threadId }); the handler uses it to decide where to navigate.
  notificationResponseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response?.notification?.request?.content?.data || {};
    if (notificationTapHandler) notificationTapHandler(data);
  });
}

/**
 * If app was opened from a notification, deliver payload once to the current tap handler.
 * Call after ClientAppStart/TrainerAppStart registers `setNotificationTapHandler`.
 */
// Handles the cold-start case: the app was LAUNCHED by tapping a notification, so the tap
// listener wasn't alive when the OS delivered it. Call this after the nav tree registers
// its handler; it replays that initial payload once.
// Returns a cleanup function in every branch (even the no-op ones) so callers can treat
// it uniformly inside a useEffect.
export function flushInitialNotificationResponse(delayMs = 500) {
  try {
    // vocab: getLastNotificationResponse() = "what notification, if any, opened this app?"
    //        `?.` because it doesn't exist on all platforms/SDK versions.
    const last = Notifications.getLastNotificationResponse?.();
    if (!last?.notification?.request?.content?.data) return () => {};
    const data = last.notification.request.content.data || {};
    // The delay gives navigation time to finish mounting. Firing instantly would attempt
    // to navigate to a screen whose navigator doesn't exist yet and silently do nothing.
    // Manipulate here: raise delayMs if deep links from a cold start don't land
    const t = setTimeout(() => {
      if (notificationTapHandler) notificationTapHandler(data);
    }, delayMs);
    return () => clearTimeout(t);
  } catch {
    return () => {};
  }
}

// One-time startup setup. The `isConfigured` guard makes it safe to call from several
// places (both app shells, settings screen) without re-registering anything.
export function configureNotifications() {
  if (isConfigured) return;

  // Decides what happens when a push arrives while the app is in the FOREGROUND.
  // By default the OS shows nothing in that case, which looks like a bug to users.
  // Manipulate here: shouldSetBadge is false because the app-icon badge is driven by our
  //                  own unread index (see unreadAlertCount), not by push count —
  //                  turning it on would double-count.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  // Android requires a "channel" before any notification can display; the user then
  // controls sound/vibration per channel in system settings. iOS has no equivalent.
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      // Manipulate here: `name`/`description` are shown to users in Android settings.
      //                  Renaming the channel ID ('default') orphans existing preferences.
      name: 'CoachConnect',
      description: 'Notifications from your AI Fitness Coach',
      // MAX = heads-up banner with sound. Lower it to DEFAULT for silent tray-only alerts.
      importance: Notifications.AndroidImportance.MAX,
      // vibrationPattern = [wait, vibrate, wait, vibrate] in milliseconds
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      enableLights: true,
      lightColor: '#FF6B9D',   // notification LED color on phones that have one
      enableVibrate: true,
    // Swallow failures: an unconfigurable channel shouldn't block app startup.
    }).catch(() => {});
  }

  ensureNotificationResponseSubscription();
  isConfigured = true;
}

// Read-only permission check — used by the settings screen to show current state
// WITHOUT triggering the system prompt.
export async function getNotificationPermissionsAsync() {
  return Notifications.getPermissionsAsync();
}

export async function requestNotificationPermissionsAsync() {
  // Check before asking. iOS only ever shows the permission dialog once, so re-requesting
  // when already granted is wasted work (and on denial it silently resolves as denied).
  const existing = await Notifications.getPermissionsAsync();
  if (existing?.granted || existing?.status === 'granted') return existing;

  // Manipulate here: which iOS capabilities we ask for. allowAnnouncements (Siri reading
  //                  notifications aloud over AirPods) is off as it's rarely wanted here.
  return Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
      allowAnnouncements: false,
    },
  });
}

// Escape hatch for a previously-denied user: the OS won't re-prompt, so the only path to
// enabling notifications is the system settings app.
export async function openSystemSettingsAsync() {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

// Dev-only token peek. Logs just the first 24 characters — push tokens are device
// credentials, so the full value should never be printed.
function logTokenDebug(label, value) {
  if (__DEV__ && value && typeof value === 'string') {
    console.log(`[push] ${label} prefix`, value.slice(0, 24) + '…');
  }
}

/**
 * Native device push token (Android: FCM registration token when using FCM; iOS: device token string).
 * Used only for Firebase Admin `messaging().send` — stored as `fcmToken` on the user doc.
 */
// Token #1 of 2: the RAW platform token (FCM registration token on Android, APNs device
// token on iOS). Needed because our server sends some notifications through Firebase Admin
// `messaging().send`, which speaks native tokens, not Expo ones.
// Returns null instead of throwing — this token is optional, and the Expo token below is
// enough to deliver a notification on its own.
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

// Token #2 of 2: the Expo push token, used by Expo's push service. This one is REQUIRED,
// so unlike the native token it throws on failure.
export async function getExpoPushTokenAsync() {
  // Permission must come first — requesting a token without it fails at the OS level.
  const perm = await requestNotificationPermissionsAsync();
  if (!perm?.granted && perm?.status !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  // Expo needs to know WHICH project the token belongs to. The id lives in a different
  // place depending on build type (EAS build vs dev client), hence both lookups.
  // vocab: EAS = Expo Application Services, Expo's cloud build/submit system
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId ||
    undefined;

  try {
    // Passing `undefined` (rather than `{ projectId: undefined }`) lets Expo auto-detect.
    const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const data = token.data;
    logTokenDebug('expo', data);
    return data;
  } catch (e) {
    // Translate the SDK's vague simulator error into something actionable, since this is
    // the single most common failure while developing — simulators can't receive push.
    const msg = e?.message || String(e);
    if (msg.toLowerCase().includes('simulator') || msg.toLowerCase().includes('device')) {
      throw new Error('Push notifications require a physical device (not the iOS Simulator).');
    }
    // Anything else is a real error — rethrow untouched so the cause isn't hidden.
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
  // Overloaded signature for backwards compatibility: older call sites pass a token
  // string directly, newer ones pass an options object. Normalize to the object form.
  const options =
    typeof optionsOrPendingToken === 'string'
      ? { pendingExpoToken: optionsOrPendingToken }
      : optionsOrPendingToken;
  // Defaults to TRUE — note `!== false`, so only an explicit `false` opts out. Callers
  // that genuinely want to force a save (the settings toggle turning notifications ON)
  // must say so, since at that moment the doc still reads `notificationsEnabled: false`.
  const skipIfDisabled = options.skipIfDisabled !== false;
  if (!uid || !db) return;

  // Respect the user's own opt-out: don't store a token for someone who turned
  // notifications off, or the server would keep targeting this device.
  if (skipIfDisabled) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists() && snap.data()?.notificationsEnabled === false) return;
    } catch {
      // Best effort — if we can't read the preference, proceed rather than lose the token.
      // continue — best effort
    }
  }

  const userRef = doc(db, 'users', uid);
  // Declared OUTSIDE the try so the catch block can still see it and stash it for retry.
  let expoPushToken = null;

  try {
    // Reuse a previously cached token when one was passed in, otherwise fetch fresh.
    expoPushToken = options.pendingExpoToken || (await getExpoPushTokenAsync());
    const fcmToken = await getNativeDevicePushTokenAsync();
    const now = new Date().toISOString();

    const payload = {
      expoPushToken,
      // `pushToken` is the legacy field name, kept mirroring the Expo token so older
      // server code and existing Cloud Functions keep working.
      pushToken: expoPushToken,
      pushTokenUpdatedAt: now,
      // vocab/symbol: ...(cond ? {x} : {}) = conditionally include a key. Used because
      //               fcmToken is optional and writing `undefined` would make Firestore throw.
      ...(fcmToken ? { fcmToken } : {}),
    };

    await setDoc(userRef, payload, { merge: true });
    // Save succeeded → drop any pending breadcrumb from an earlier failed attempt.
    await AsyncStorage.removeItem(pendingPushTokenStorageKey(uid)).catch(() => {});
    if (__DEV__) {
      console.log('[push] tokens saved', { hasExpo: !!expoPushToken, hasFcm: !!fcmToken });
    }
  } catch (error) {
    // Usually offline. Warn rather than throw — failing to save a token must never
    // break app startup.
    console.warn('Push token save failed, retrying on next launch:', error?.message || error);
    // If we got the token but the WRITE failed, cache it locally. Next launch passes it
    // back in as `pendingExpoToken`, which skips the permission/fetch round trip.
    if (expoPushToken) {
      try {
        await AsyncStorage.setItem(pendingPushTokenStorageKey(uid), expoPushToken);
      } catch (_) {
        /* non-fatal */
      }
    }
  }
}

// Logout / opt-out: remove every token field so the server stops targeting this device.
// Uses deleteField() rather than writing null, so the fields disappear entirely and
// server-side `if (user.expoPushToken)` checks read false.
export async function clearPushTokensForUid(uid) {
  if (!uid || !db) return;
  try {
    // updateDoc (not setDoc) on purpose: it fails loudly if the doc is missing, and
    // there's nothing to clear in that case anyway.
    await updateDoc(doc(db, 'users', uid), {
      expoPushToken: deleteField(),
      fcmToken: deleteField(),
      pushToken: deleteField(),
    });
    if (__DEV__) console.log('[push] tokens cleared for user');
  } catch (e) {
    // Swallowed because this runs during sign-out — see clearDataOnLogout.js. A failure
    // here must not block the user from logging out.
    if (__DEV__) console.warn('[push] clearPushTokensForUid failed:', e?.message || e);
  }
}

/**
 * Subscribe to app foreground: re-persist tokens (handles token rotation / permission changes).
 */
// Re-saves tokens whenever the app comes back to the foreground.
// Why: push tokens ROTATE (OS reinstalls, restores, backups) and permission can be
// revoked in system settings while the app is backgrounded. Without this, a stale token
// would silently stop receiving notifications with no visible error.
export function subscribePushTokenRefreshOnResume(uid, shouldRun) {
  // vocab: AppState 'change' = fires on background/foreground transitions;
  //        'active' means we're now in the foreground.
  const sub = AppState.addEventListener('change', (next) => {
    // `shouldRun` is a callback, not a boolean, so it's evaluated fresh at resume time —
    // the caller can gate on current state (signed in, onboarding finished) rather than
    // on whatever was true when the subscription was created.
    if (next !== 'active' || !uid || !shouldRun?.()) return;
    persistPushTokensForUid(uid, { skipIfDisabled: true }).catch(() => {});
  });
  // Caller must invoke this on unmount or the listener leaks across account switches.
  return () => sub.remove();
}

// "Send test notification" button in settings. Local, not a server push — it proves the
// OS permission and channel setup work without needing the backend involved.
export async function sendTestLocalNotificationAsync() {
  // Ensures the Android channel exists even if the user reached settings before startup
  // configuration ran; without a channel Android would silently drop this.
  configureNotifications();

  await Notifications.scheduleNotificationAsync({
    // Manipulate here: the test notification's title/body copy
    content: {
      title: 'CoachConnect',
      body: 'Notifications are enabled.',
      sound: true,
    },
    // 1-second delay, not immediate: it gives the user a moment to see the banner
    // arrive as a real notification rather than it flashing during the tap.
    trigger: { seconds: 1 },
  });
}
