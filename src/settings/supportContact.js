// Support inbox address and privacy-policy URL for Settings screens.
// Flow: read Expo config extra → trim whitespace → fall back to shipped defaults when blank.
// Used by email support, Privacy Policy, Terms, Bug Report, Help FAQ, and Contact Support.
// Read order: constants → helpers → mains (getSupportEmail / getPrivacyPolicyUrl).

import Constants from 'expo-constants';

// ===== NAMED CONSTANTS =====

// Manipulate here: override with EXPO_PUBLIC_SUPPORT_EMAIL / app.config.js extra.supportEmail
const DEFAULT_SUPPORT_EMAIL = 'coachconnect0@gmail.com';

// Manipulate here: override with EXPO_PUBLIC_PRIVACY_POLICY_URL for App Store / in-app links.
// Freeze: Firebase hosting path stays on project anatrox-auth — do not rename the project id.
const DEFAULT_PRIVACY_POLICY_URL = 'https://anatrox-auth.web.app/privacy.html';

const EXPO_EXTRA_KEY_SUPPORT_EMAIL = 'supportEmail';
const EXPO_EXTRA_KEY_PRIVACY_POLICY_URL = 'privacyPolicyUrl';

// ===== HELPER FUNCTIONS =====

/**
 * Trim a configured value; empty or missing becomes ''.
 * @param {string|undefined|null} maybeString
 * @returns {string}
 */
function trimConfiguredValue(maybeString) {
  const asString = String(maybeString || '');
  return asString.trim();
}

/**
 * Read one key from Constants.expoConfig.extra (may be missing in tests / bare Node).
 * vocab: Constants.expoConfig.extra = values from app.config.js / EAS injected at build time
 * vocab/symbol: ?. = stop and return undefined if the left side is null/undefined
 * @param {string} extraKey
 * @returns {string|undefined}
 */
function readExpoConfigExtra(extraKey) {
  const expoConfig = Constants.expoConfig;
  if (!expoConfig) {
    return undefined;
  }
  const extraBag = expoConfig.extra;
  if (!extraBag) {
    return undefined;
  }
  return extraBag[extraKey];
}

/**
 * Prefer a trimmed Expo extra; otherwise use the shipped default.
 * @param {string|undefined} configuredValue
 * @param {string} fallbackValue
 * @returns {string}
 */
function pickConfiguredStringOrDefault(configuredValue, fallbackValue) {
  const trimmedValue = trimConfiguredValue(configuredValue);
  if (!trimmedValue) {
    return fallbackValue;
  }
  return trimmedValue;
}

/**
 * Resolve one Settings contact string: Expo extra first, then shipped default.
 * @param {string} extraKey
 * @param {string} shippedDefault
 * @returns {string}
 */
function resolveContactStringFromExpoExtra(extraKey, shippedDefault) {
  const configuredValue = readExpoConfigExtra(extraKey);
  return pickConfiguredStringOrDefault(configuredValue, shippedDefault);
}

// ===== MAIN FUNCTION =====

/**
 * Support inbox address for mailto links and on-screen copy.
 * @returns {string}
 */
export function getSupportEmail() {
  // 1. Pull supportEmail from Expo extra when the build injected it.
  // 2. Empty or missing extra → shipped default Gmail inbox.
  return resolveContactStringFromExpoExtra(
    EXPO_EXTRA_KEY_SUPPORT_EMAIL,
    DEFAULT_SUPPORT_EMAIL,
  );
}

/**
 * Public privacy policy URL for App Store Connect and in-app links.
 * @returns {string}
 */
export function getPrivacyPolicyUrl() {
  // 1. Same pattern as inbox — different key on expoConfig.extra.
  // 2. Empty or missing extra → hosted privacy.html on anatrox-auth.
  return resolveContactStringFromExpoExtra(
    EXPO_EXTRA_KEY_PRIVACY_POLICY_URL,
    DEFAULT_PRIVACY_POLICY_URL,
  );
}

export { DEFAULT_SUPPORT_EMAIL, DEFAULT_PRIVACY_POLICY_URL };
