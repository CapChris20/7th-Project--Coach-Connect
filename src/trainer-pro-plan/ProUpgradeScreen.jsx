// Trainer paywall: price line, free-trial button, restore, and the support fallback.
// Flow: read the store product → build the price line → start the trial or open mail.
// Used by the trainer pro-plan flow when a trainer still needs a subscription.

import React from 'react';
import { Linking, Platform } from 'react-native';
import { useTheme } from '../look-and-feel/lightDarkMode';
import {
  TRAINER_SUBSCRIPTION_PRICE_LABEL,
  TRAINER_SUBSCRIPTION_TRIAL_LABEL,
} from './proPlanSwitches';
import { useSubscription } from './ProPlanSetup';
import ProUpgradeOffer from './ProUpgradeOffer';

// ===== NAMED CONSTANTS =====

// Subject is percent-encoded so the mail app keeps the words "Subscription verification issue".
const SUPPORT_MAIL_URL =
  'mailto:coachconnect0@gmail.com?subject=Subscription%20verification%20issue';

// ===== HELPER FUNCTIONS =====

// The store price wins when the native product has loaded. Otherwise show the label we ship in the app.
function priceLineForStore(storeProduct) {
  const hasStorePrice = storeProduct?.displayPrice != null;
  if (hasStorePrice) {
    return `${storeProduct.displayPrice}/month · ${TRAINER_SUBSCRIPTION_TRIAL_LABEL}`;
  }
  return `${TRAINER_SUBSCRIPTION_PRICE_LABEL} · ${TRAINER_SUBSCRIPTION_TRIAL_LABEL}`;
}

// Android and web have no App Store connection flag. Only iOS should look disconnected.
function isCardStoreReady(isStoreConnected) {
  if (Platform.OS !== 'ios') return true;
  return isStoreConnected;
}

function canOpenSettings(onOpenSettings) {
  return typeof onOpenSettings === 'function';
}

// ===== MAIN FUNCTION =====

/**
 * Paywall screen. The offer component draws the buttons; this screen wires trial, restore, and support.
 * @param {{ onOpenSettings?: function, onOpenTerms?: function, onOpenPrivacy?: function }} props
 * @returns {import('react').ReactElement}
 */
export default function ProUpgradeScreen({ onOpenSettings, onOpenTerms, onOpenPrivacy }) {
  const { isDark } = useTheme();
  const {
    actionLoading,
    lastError,
    clearError,
    startFreeTrial,
    restorePurchases,
    storeProduct,
    connected: isStoreConnected,
  } = useSubscription();

  const priceLine = priceLineForStore(storeProduct);

  const handleCta = async () => {
    clearError();
    await startFreeTrial();
  };

  // Settings wins when the shell passed a handler. Otherwise mail support from this screen.
  const handleContactSupport = () => {
    if (canOpenSettings(onOpenSettings)) {
      onOpenSettings();
      return;
    }
    Linking.openURL(SUPPORT_MAIL_URL);
  };

  return (
    <ProUpgradeOffer
      isDark={isDark}
      variant="paywall"
      priceLine={priceLine}
      actionLoading={actionLoading}
      lastError={lastError}
      onPrimary={handleCta}
      onRestore={restorePurchases}
      onContactSupport={handleContactSupport}
      onOpenSettings={onOpenSettings}
      onOpenTerms={onOpenTerms}
      onOpenPrivacy={onOpenPrivacy}
      connected={isCardStoreReady(isStoreConnected)}
    />
  );
}
