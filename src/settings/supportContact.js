// Support inbox and privacy-policy address shown in Settings.
// Flow: prefer the value from app config → otherwise use the shipped default.
// Used by: the support mail button and the privacy policy link.

import Constants from 'expo-constants';

// ===== NAMED CONSTANTS =====

/** Shown in Privacy Policy, Terms, and Contact Support. Override with EXPO_PUBLIC_SUPPORT_EMAIL. */
const DEFAULT_SUPPORT_EMAIL = 'coachconnect0@gmail.com';

/** Public HTTPS policy for App Store Connect. Override with EXPO_PUBLIC_PRIVACY_POLICY_URL. */
const DEFAULT_PRIVACY_POLICY_URL = 'https://anatrox-auth.web.app/privacy.html';

// ===== HELPER FUNCTIONS =====

/**
 * @param {string|undefined} configuredValue
 * @param {string} fallbackValue
 * @returns {string}
 */
function configuredOrDefault(configuredValue, fallbackValue) {
  const trimmed = String(configuredValue || '').trim();
  return trimmed || fallbackValue;
}

// ===== MAIN FUNCTION =====

/**
 * @returns {string}
 */
export function getSupportEmail() {
  return configuredOrDefault(Constants.expoConfig?.extra?.supportEmail, DEFAULT_SUPPORT_EMAIL);
}

/**
 * @returns {string}
 */
export function getPrivacyPolicyUrl() {
  return configuredOrDefault(Constants.expoConfig?.extra?.privacyPolicyUrl, DEFAULT_PRIVACY_POLICY_URL);
}

export { DEFAULT_SUPPORT_EMAIL, DEFAULT_PRIVACY_POLICY_URL };
