// Wraps the app in Stripe's provider so card fields can create a token.
// Flow: no Stripe module or key → children render plain → otherwise StripeProvider wraps them.
// Used by: app root. Stripe hooks crash without this ancestor — see canThisPhoneTakeCards
//   before showing card UI.

import React from 'react';
import {
  getStripeNativeModule,
  getStripePublishableKey,
} from './canThisPhoneTakeCards';

// ===== NAMED CONSTANTS =====

// Manipulate here: Apple Pay merchant id passed into StripeProvider.
const MERCHANT_IDENTIFIER = 'merchant.com.coachconnect';

// ===== HELPER FUNCTIONS =====

/**
 * Read the StripeProvider component and publishable key for this install.
 * vocab: publishable key = Stripe's public key safe to ship in the app binary
 * @returns {{ providerComponent: Function|null, publishableKey: string|null }}
 */
function readStripeProviderPieces() {
  const nativeStripe = getStripeNativeModule();
  const providerComponent = nativeStripe?.StripeProvider || null;
  const publishableKey = getStripePublishableKey();
  return { providerComponent, publishableKey };
}

/**
 * Dev-only console warning when card payments cannot mount a provider.
 * @param {{ providerComponent: Function|null, publishableKey: string|null }} stripePieces
 */
function logStripeDisabledInDev(stripePieces) {
  if (!__DEV__) {
    return;
  }
  console.warn('[Stripe] Card payments disabled:', {
    hasProvider: Boolean(stripePieces.providerComponent),
    hasPublishableKey: Boolean(stripePieces.publishableKey),
  });
}

// ===== MAIN FUNCTION =====

/**
 * Wrap children in StripeProvider when this phone can take cards.
 * Flow: 1. missing module/key → plain children  2. wrap with publishable key + merchant id
 * @param {{ children: import('react').ReactNode }} props
 * @returns {import('react').ReactElement}
 */
export function CardPaymentWrapper({ children }) {
  const stripePieces = readStripeProviderPieces();

  // 1. Missing native module or publishable key — render children without a provider.
  const paymentsAllowed =
    stripePieces.providerComponent && stripePieces.publishableKey;
  if (!paymentsAllowed) {
    logStripeDisabledInDev(stripePieces);
    return <>{children}</>;
  }

  // 2. Wrap so CardField and createToken work under this tree.
  const StripeProvider = stripePieces.providerComponent;
  return (
    <StripeProvider
      publishableKey={stripePieces.publishableKey}
      merchantIdentifier={MERCHANT_IDENTIFIER}
    >
      {children}
    </StripeProvider>
  );
}
