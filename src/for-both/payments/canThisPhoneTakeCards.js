// Whether this install can show a Stripe card field, and the sentence we show when it cannot.
// Flow: load the native Stripe package → read the publishable key → return the first blocker.
// Used by the card payment wrapper and the pay-trainer popup before they mount CardField.

import Constants from 'expo-constants';

// ===== NAMED CONSTANTS =====

// Manipulate here: user-facing copy when this phone cannot show CardField — order matches getStripeCardPaymentBlockReason steps.
const EXPO_GO_BLOCK = {
  title: 'Expo Go cannot take card payments',
  detail: 'Install your Coach Connect dev build on this device, then reload.',
};

const MISSING_CARD_MODULE_BLOCK = {
  title: 'Stripe card module missing from this app install',
  detail:
    'Your dev client was built before Stripe was added (or needs a rebuild). Run: npm run ios:run — then reopen the app.',
};

const MISSING_PUBLISHABLE_KEY_BLOCK = {
  title: 'Stripe publishable key not configured',
  detail: 'Add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env, restart Metro (npm start), and reload.',
};

const MISSING_PROVIDER_BLOCK = {
  title: 'Stripe provider unavailable',
  detail: 'Rebuild the native app: npm run ios:run',
};

const ENV_PUBLISHABLE_KEY_NAME = 'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY';
const EXPO_APP_OWNERSHIP_GO = 'expo';

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging native Stripe load or publishable-key config

// Loaded once at import time. null means this binary never shipped Stripe.
let stripeNativeModuleOrNull = null;
// Kept so a missing native module is still visible in a debugger.
let stripeNativeLoadError = null;

function tryLoadStripeNativeModule() {
  try {
    // eslint-disable-next-line global-require
    const stripePackage = require('@stripe/stripe-react-native');
    return stripePackage;
  } catch (nativeLoadError) {
    stripeNativeLoadError = nativeLoadError;
    return null;
  }
}

stripeNativeModuleOrNull = tryLoadStripeNativeModule();

// An empty env value falls through to the Expo extra field, then to a blank string.
function readStripePublishableKeyFromEnvironment() {
  let keyFromProcessEnv = '';
  const processExists = typeof process !== 'undefined';
  if (processExists && process.env) {
    keyFromProcessEnv = process.env[ENV_PUBLISHABLE_KEY_NAME] || '';
  }
  if (keyFromProcessEnv) {
    return keyFromProcessEnv;
  }

  const expoConfig = Constants.expoConfig;
  if (!expoConfig) {
    return '';
  }
  if (!expoConfig.extra) {
    return '';
  }

  const keyFromExpoExtra = expoConfig.extra.stripePublishableKey;
  if (keyFromExpoExtra) {
    return keyFromExpoExtra;
  }

  return '';
}

const stripePublishableKeyFromConfig = readStripePublishableKeyFromEnvironment();

// vocab: appOwnership === 'expo' means the Expo Go app, which cannot load this native card field.
function phoneIsRunningInExpoGo() {
  return Constants.appOwnership === EXPO_APP_OWNERSHIP_GO;
}

// Either field is enough. A build can ship CardField, CardForm, or both.
function nativeModuleHasNoCardEntry(stripeModule) {
  if (!stripeModule) {
    return true;
  }
  if (stripeModule.CardField) {
    return false;
  }
  if (stripeModule.CardForm) {
    return false;
  }
  return true;
}

function nativeModuleHasNoStripeProvider(stripeModule) {
  if (!stripeModule) {
    return true;
  }
  if (stripeModule.StripeProvider) {
    return false;
  }
  return true;
}

// ===== MAIN FUNCTION =====

/**
 * The required Stripe native module, or null when this install could not load it.
 * @returns {object|null}
 */
export function getStripeNativeModule() {
  return stripeNativeModuleOrNull;
}

/**
 * Publishable key from the env file, or from Expo extra when the env value is blank.
 * @returns {string}
 */
export function getStripePublishableKey() {
  return stripePublishableKeyFromConfig;
}

/**
 * First reason card entry is blocked, or null when this phone can take a card.
 * @returns {{ title: string, detail: string } | null}
 */
export function getStripeCardPaymentBlockReason() {
  // 1. Expo Go cannot load this native card field.
  if (phoneIsRunningInExpoGo()) {
    return EXPO_GO_BLOCK;
  }

  // 2. Dev client built before Stripe was added (or needs a rebuild).
  const cardEntryMissing = nativeModuleHasNoCardEntry(stripeNativeModuleOrNull);
  if (cardEntryMissing) {
    return MISSING_CARD_MODULE_BLOCK;
  }

  // 3. Missing publishable key — .env was blank and Expo extra was blank.
  if (!stripePublishableKeyFromConfig) {
    return MISSING_PUBLISHABLE_KEY_BLOCK;
  }

  // 4. Module loaded but StripeProvider is missing from this install.
  const providerMissing = nativeModuleHasNoStripeProvider(stripeNativeModuleOrNull);
  if (providerMissing) {
    return MISSING_PROVIDER_BLOCK;
  }

  // 5. This phone can take a card.
  return null;
}

/**
 * True when getStripeCardPaymentBlockReason has nothing to show.
 * @returns {boolean}
 */
export function isStripeCardPaymentReady() {
  // 1. Ready only when the blocker recipe returns null.
  const blockReason = getStripeCardPaymentBlockReason();
  const phoneCanTakeCards = !blockReason;
  return phoneCanTakeCards;
}
