// Trainer paywall screen — price line, free trial CTA, restore, and support escape hatch.
// Flow: subscription hook → build price text → hand props to ProUpgradeOffer → trial or restore.
// Used when a trainer still needs an Apple subscription before full Pro features unlock.
//
// vocab: useSubscription = ProPlanSetup hook (storeProduct, startFreeTrial, restorePurchases, …)
// vocab: displayPrice = StoreKit localized price string when the product loaded

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

const PAYWALL_VARIANT = 'paywall';
const IOS_PLATFORM = 'ios';
// Manipulate here: subject is percent-encoded so mail clients keep the words intact
const SUPPORT_MAIL_URL =
  'mailto:coachconnect0@gmail.com?subject=Subscription%20verification%20issue';

// ===== HELPER FUNCTIONS =====

/**
 * Prefer live StoreKit price; fall back to static labels from proPlanSwitches.
 * @param {object|null|undefined} storeProduct
 * @returns {string}
 */
function priceLineFromStoreOrStaticLabels(storeProduct) {
  const nativePrice = storeProduct?.displayPrice;
  const hasNativePrice = nativePrice != null;
  if (hasNativePrice) {
    return `${nativePrice}/month · ${TRAINER_SUBSCRIPTION_TRIAL_LABEL}`;
  }
  return `${TRAINER_SUBSCRIPTION_PRICE_LABEL} · ${TRAINER_SUBSCRIPTION_TRIAL_LABEL}`;
}

/**
 * Non-iOS always looks “connected”; iOS mirrors StoreKit connected flag.
 * @param {boolean} isStoreConnected
 * @returns {boolean}
 */
function paywallShouldLookStoreConnected(isStoreConnected) {
  const runningOnIos = Platform.OS === IOS_PLATFORM;
  if (!runningOnIos) {
    return true;
  }
  return isStoreConnected;
}

/**
 * True when the shell passed a real Settings opener.
 * @param {Function|undefined} onOpenSettings
 * @returns {boolean}
 */
function shellPassedSettingsHandler(onOpenSettings) {
  return typeof onOpenSettings === 'function';
}

/**
 * Clear any stale IAP error, then kick off the free-trial purchase path.
 * @param {Function} clearError
 * @param {Function} startFreeTrial
 */
async function runFreeTrialAfterClearingError(clearError, startFreeTrial) {
  clearError();
  await startFreeTrial();
}

/**
 * Settings handler wins; otherwise open the support mailto.
 * @param {Function|undefined} onOpenSettings
 */
function openSupportMailWhenNoSettingsHandler(onOpenSettings) {
  if (shellPassedSettingsHandler(onOpenSettings)) {
    onOpenSettings();
    return;
  }
  Linking.openURL(SUPPORT_MAIL_URL);
}

/**
 * Pure layout — chrome only; actions come from the screen below.
 * @param {object} props
 */
function ProUpgradeScreenLayout({
  isDark,
  priceLine,
  actionLoading,
  lastError,
  storeReadyForCard,
  onPrimary,
  onRestore,
  onContactSupport,
  onOpenSettings,
  onOpenTerms,
  onOpenPrivacy,
}) {
  return (
    <ProUpgradeOffer
      isDark={isDark}
      variant={PAYWALL_VARIANT}
      priceLine={priceLine}
      actionLoading={actionLoading}
      lastError={lastError}
      onPrimary={onPrimary}
      onRestore={onRestore}
      onContactSupport={onContactSupport}
      onOpenSettings={onOpenSettings}
      onOpenTerms={onOpenTerms}
      onOpenPrivacy={onOpenPrivacy}
      connected={storeReadyForCard}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Paywall screen. ProUpgradeOffer draws chrome; this file wires store actions and support.
 * @param {{ onOpenSettings?: Function, onOpenTerms?: Function, onOpenPrivacy?: Function }} props
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

  // 1. Price line — StoreKit displayPrice when loaded, else static labels.
  const priceLine = priceLineFromStoreOrStaticLabels(storeProduct);
  const storeReadyForCard = paywallShouldLookStoreConnected(isStoreConnected);

  // 2. Primary CTA — clear last error, then start the free-trial purchase.
  const handlePrimaryCta = () => runFreeTrialAfterClearingError(clearError, startFreeTrial);

  // 3. Support — Settings if the shell passed one, otherwise mailto.
  const handleContactSupport = () => openSupportMailWhenNoSettingsHandler(onOpenSettings);

  return (
    <ProUpgradeScreenLayout
      isDark={isDark}
      priceLine={priceLine}
      actionLoading={actionLoading}
      lastError={lastError}
      storeReadyForCard={storeReadyForCard}
      onPrimary={handlePrimaryCta}
      onRestore={restorePurchases}
      onContactSupport={handleContactSupport}
      onOpenSettings={onOpenSettings}
      onOpenTerms={onOpenTerms}
      onOpenPrivacy={onOpenPrivacy}
    />
  );
}
