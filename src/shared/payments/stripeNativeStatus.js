/**
 * Detect whether Stripe native (CardField / useStripe) is usable in this build.
 */
import Constants from 'expo-constants';

let stripeModule = null;
let loadError = null;

try {
  // eslint-disable-next-line global-require
  stripeModule = require('@stripe/stripe-react-native');
} catch (e) {
  loadError = e;
  stripeModule = null;
}

const PUBLISHABLE_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) ||
  Constants.expoConfig?.extra?.stripePublishableKey ||
  '';

export function getStripeNativeModule() {
  return stripeModule;
}

export function getStripePublishableKey() {
  return PUBLISHABLE_KEY;
}

/** Human-readable reason card payments are blocked + what to do. */
export function getStripeCardPaymentBlockReason() {
  if (Constants.appOwnership === 'expo') {
    return {
      title: 'Expo Go cannot take card payments',
      detail: 'Install your Coach Connect dev build on this device, then reload.',
    };
  }

  if (!stripeModule?.CardField) {
    return {
      title: 'Stripe card module missing from this app install',
      detail:
        'Your dev client was built before Stripe was added (or needs a rebuild). Run: npm run ios:run — then reopen the app.',
    };
  }

  if (!PUBLISHABLE_KEY) {
    return {
      title: 'Stripe publishable key not configured',
      detail: 'Add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env, restart Metro (npm start), and reload.',
    };
  }

  if (!stripeModule?.StripeProvider) {
    return {
      title: 'Stripe provider unavailable',
      detail: 'Rebuild the native app: npm run ios:run',
    };
  }

  return null;
}

export function isStripeCardPaymentReady() {
  return !getStripeCardPaymentBlockReason();
}
