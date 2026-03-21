import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

let isConfigured = false;

export function configureNotifications() {
  if (isConfigured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    // Required for Android 8+ for notifications to show properly
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#5856D6',
    }).catch(() => {});
  }

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
  // iOS + Android supported; on web this is a no-op
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
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
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    return token.data;
  } catch (e) {
    // On iOS Simulator this commonly fails; also fails if projectId isn't available for some setups.
    const msg = e?.message || String(e);
    if (msg.toLowerCase().includes('simulator') || msg.toLowerCase().includes('device')) {
      throw new Error('Push notifications require a physical device (not the iOS Simulator).');
    }
    throw e;
  }
}

export async function sendTestLocalNotificationAsync() {
  configureNotifications();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'CoachConnect',
      body: 'Notifications are enabled ✅',
      sound: true,
    },
    trigger: { seconds: 1 },
  });
}


