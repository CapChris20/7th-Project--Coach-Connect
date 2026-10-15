// Wraps the app in Stripe's provider so card fields can create a token.
// Flow: if this phone has no Stripe module or no publishable key, render the children plain → otherwise wrap them.
// Used by: the root of the app. Stripe hooks crash without this ancestor.

import React from 'react';
import {
  getStripeNativeModule,
  getStripePublishableKey,
} from './canThisPhoneTakeCards';

// ===== NAMED CONSTANTS =====

const MERCHANT_IDENTIFIER = 'merchant.com.coachconnect';

// ===== HELPER FUNCTIONS =====

const stripeModule = getStripeNativeModule();
const PUBLISHABLE_KEY = getStripePublishableKey();
const StripeProvider = stripeModule?.StripeProvider || null;

/**
 * @returns {boolean}
 */
function canTakeCardPayments() {
  return Boolean(StripeProvider && PUBLISHABLE_KEY);
}

// ===== MAIN FUNCTION =====

/**
 * Wrap the app so Stripe card fields can create a token.
 * Flow: 1. no module/key → children plain  2. wrap with StripeProvider
 * @param {{ children: import('react').ReactNode }} props
 */
export function CardPaymentWrapper({ children }) {
  // 1. No Stripe module or publishable key → render children without a provider.
  //    Stripe hooks crash if they mount without this ancestor, so callers check canTakeCardPayments first.
  if (!canTakeCardPayments()) {
    if (__DEV__) {
      const hasProvider = Boolean(StripeProvider);
      const hasPublishableKey = Boolean(PUBLISHABLE_KEY);
      console.warn('[Stripe] Card payments disabled:', { hasProvider, hasPublishableKey });
    }
    return <>{children}</>;
  }

  // 2. Wrap so CardField / createToken work. merchantIdentifier is the Apple Pay merchant id.
  return (
    <StripeProvider publishableKey={PUBLISHABLE_KEY} merchantIdentifier={MERCHANT_IDENTIFIER}>
      {children}
    </StripeProvider>
  );
}
