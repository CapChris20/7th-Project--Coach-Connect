// Whether this install can show a Stripe card field, and the sentence we show when it cannot.
// Flow: require the native Stripe package → read the publishable key → return the first blocker.
// Used by the card payment wrapper and the pay-trainer popup before they mount CardField.

import Constants from 'expo-constants';

// ===== NAMED CONSTANTS =====

let stripeModule = null;
// The require error is kept so a missing native module is still visible in a debugger.
let _stripeLoadError = null;

try {
  // eslint-disable-next-line global-require
  stripeModule = require('@stripe/stripe-react-native');
} catch (nativeLoadError) {
  _stripeLoadError = nativeLoadError;
  stripeModule = null;
}

// An empty env value falls through to the Expo extra field, then to a blank string.
const STRIPE_PUBLISHABLE_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) ||
  Constants.expoConfig?.extra?.stripePublishableKey ||
  '';

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

// ===== HELPER FUNCTIONS =====

// vocab: appOwnership === 'expo' means the Expo Go app, which cannot load this native card field.
function isRunningInExpoGo() {
  return Constants.appOwnership === 'expo';
}

// Either field is enough. A build can ship CardField, CardForm, or both.
function isCardEntryMissing(nativeModule) {
  return !nativeModule?.CardField && !nativeModule?.CardForm;
}

function isStripeProviderMissing(nativeModule) {
  return !nativeModule?.StripeProvider;
}

// ===== MAIN FUNCTION =====

/**
 * The required Stripe native module, or null when this install could not load it.
 * @returns {object|null}
 */
export function getStripeNativeModule() {
  return stripeModule;
}

/**
 * Publishable key from the env file, or from Expo extra when the env value is blank.
 * @returns {string}
 */
export function getStripePublishableKey() {
  return STRIPE_PUBLISHABLE_KEY;
}

/**
 * First reason card entry is blocked, or null when this phone can take a card.
 * @returns {{ title: string, detail: string } | null}
 */
export function getStripeCardPaymentBlockReason() {
  if (isRunningInExpoGo()) return EXPO_GO_BLOCK;
  if (isCardEntryMissing(stripeModule)) return MISSING_CARD_MODULE_BLOCK;
  if (!STRIPE_PUBLISHABLE_KEY) return MISSING_PUBLISHABLE_KEY_BLOCK;
  if (isStripeProviderMissing(stripeModule)) return MISSING_PROVIDER_BLOCK;
  return null;
}

/**
 * True when getStripeCardPaymentBlockReason has nothing to show.
 * @returns {boolean}
 */
export function isStripeCardPaymentReady() {
  return !getStripeCardPaymentBlockReason();
}
