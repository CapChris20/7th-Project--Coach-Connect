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
 * @param {{ children: import('react').ReactNode }} props
 */
export function CardPaymentWrapper({ children }) {
  if (!canTakeCardPayments()) {
    if (__DEV__) {
      console.warn('[Stripe] Card payments disabled:', {
        hasProvider: !!StripeProvider,
        hasPublishableKey: !!PUBLISHABLE_KEY,
      });
    }
    return <>{children}</>;
  }
  return (
    <StripeProvider publishableKey={PUBLISHABLE_KEY} merchantIdentifier={MERCHANT_IDENTIFIER}>
      {children}
    </StripeProvider>
  );
}
