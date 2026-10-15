// Support inbox and privacy-policy address shown in Settings.
// Flow: read Expo config extra → trim → fall back to the shipped default.
// Used by: the support mail button and the privacy policy link.

import Constants from 'expo-constants';

// ===== NAMED CONSTANTS =====

/** Shown in Privacy Policy, Terms, and Contact Support. Override with EXPO_PUBLIC_SUPPORT_EMAIL. */
const DEFAULT_SUPPORT_EMAIL = 'coachconnect0@gmail.com';

/** Public HTTPS policy for App Store Connect. Override with EXPO_PUBLIC_PRIVACY_POLICY_URL. */
const DEFAULT_PRIVACY_POLICY_URL = 'https://anatrox-auth.web.app/privacy.html';

// ===== HELPER FUNCTIONS =====

/**
 * Trim a configured string; empty becomes ''.
 * @param {string|undefined|null} rawValue
 * @returns {string}
 */
function trimmedConfigValue(rawValue) {
  return String(rawValue || '').trim();
}

/**
 * Prefer the Expo extra value; otherwise use the shipped default.
 * @param {string|undefined} configuredValue
 * @param {string} fallbackValue
 * @returns {string}
 */
function configuredOrDefault(configuredValue, fallbackValue) {
  const trimmed = trimmedConfigValue(configuredValue);
  if (trimmed) return trimmed;
  return fallbackValue;
}

/**
 * Read one key from Constants.expoConfig.extra (may be missing in tests).
 * @param {string} key
 * @returns {string|undefined}
 */
function readExpoExtra(key) {
  return Constants.expoConfig?.extra?.[key];
}

// ===== MAIN FUNCTION =====

/**
 * Support inbox address for mailto and on-screen copy.
 * @returns {string}
 */
export function getSupportEmail() {
  return configuredOrDefault(readExpoExtra('supportEmail'), DEFAULT_SUPPORT_EMAIL);
}

/**
 * Public privacy policy URL for App Store / in-app links.
 * @returns {string}
 */
export function getPrivacyPolicyUrl() {
  return configuredOrDefault(readExpoExtra('privacyPolicyUrl'), DEFAULT_PRIVACY_POLICY_URL);
}

export { DEFAULT_SUPPORT_EMAIL, DEFAULT_PRIVACY_POLICY_URL };
