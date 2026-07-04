/**
 * support Config
 *
 * Purpose: support Config — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/settings
 * Key exports: getSupportEmail, DEFAULT_SUPPORT_EMAIL
 *
 * @file-header
 */
import Constants from 'expo-constants';

/** Shown in Privacy Policy, Terms, Contact Support, etc. Override with EXPO_PUBLIC_SUPPORT_EMAIL in .env if needed. */
export const DEFAULT_SUPPORT_EMAIL = 'coachconnect0@gmail.com';

export function getSupportEmail() {
  const fromEnv = String(Constants.expoConfig?.extra?.supportEmail || '').trim();
  return fromEnv || DEFAULT_SUPPORT_EMAIL;
}
