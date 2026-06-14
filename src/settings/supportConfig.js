import Constants from 'expo-constants';

/** Shown in Privacy Policy, Terms, Contact Support, etc. Override with EXPO_PUBLIC_SUPPORT_EMAIL in .env if needed. */
export const DEFAULT_SUPPORT_EMAIL = 'coachconnect@gmail.com';

export function getSupportEmail() {
  const fromEnv = String(Constants.expoConfig?.extra?.supportEmail || '').trim();
  return fromEnv || DEFAULT_SUPPORT_EMAIL;
}
