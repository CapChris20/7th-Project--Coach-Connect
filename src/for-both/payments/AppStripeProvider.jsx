/**
 * App Stripe Provider
 *
 * Purpose: Wrap the app in Stripe's provider so CardField / createToken work.
 * Why it matters: Stripe React Native hooks require a StripeProvider ancestor with the publishable key.
 * Area: src/shared
 * Key exports: AppStripeProvider
 *
 * @file-header
 */
import React from 'react';
import {
  getStripeNativeModule,
  getStripePublishableKey,
} from './stripeNativeStatus';

const stripeModule = getStripeNativeModule();
const PUBLISHABLE_KEY = getStripePublishableKey();
const StripeProvider = stripeModule?.StripeProvider || null;

export function AppStripeProvider({ children }) {
  if (!StripeProvider || !PUBLISHABLE_KEY) {
    if (__DEV__) {
      console.warn('[Stripe] Card payments disabled:', {
        hasProvider: !!StripeProvider,
        hasPublishableKey: !!PUBLISHABLE_KEY,
      });
    }
    return <>{children}</>;
  }
  return (
    <StripeProvider publishableKey={PUBLISHABLE_KEY} merchantIdentifier="merchant.com.coachconnect">
      {children}
    </StripeProvider>
  );
}
