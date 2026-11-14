// Full-screen offer when a trainer's Pro subscription has lapsed.
// Flow: theme + subscription context → resubscribe clears error and starts trial → mailto support.
// Used by ProAccessCheck when Firestore accessState.access === "expired".

import React from 'react';
import { Linking } from 'react-native';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { useSubscription } from './ProPlanSetup';
import ProUpgradeOffer from './ProUpgradeOffer';

// ===== NAMED CONSTANTS =====

// Manipulate here: must match the variant string ProUpgradeOffer expects for the expired copy
const EXPIRED_VARIANT = 'expired';
// Manipulate here: support inbox opened from the expired-Pro contact link
const SUPPORT_MAIL_URL = 'mailto:coachconnect0@gmail.com';

// ===== LAYOUT (no hooks) =====

/**
 * Pure layout — paints the expired offer. Hooks stay in the exported screen below.
 * @param {object} props
 * @returns {JSX.Element}
 */
function ProExpiredScreenLayout({
  isDark,
  actionLoading,
  lastError,
  onResubscribe,
  onRestorePurchases,
  onOpenSettings,
  onOpenTerms,
  onOpenPrivacy,
  onContactSupport,
}) {
  return (
    <ProUpgradeOffer
      isDark={isDark}
      variant={EXPIRED_VARIANT}
      actionLoading={actionLoading}
      lastError={lastError}
      onPrimary={onResubscribe}
      onRestore={onRestorePurchases}
      onOpenSettings={onOpenSettings}
      onOpenTerms={onOpenTerms}
      onOpenPrivacy={onOpenPrivacy}
      onContactSupport={onContactSupport}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Expired-Pro screen: resubscribe (same path as paywall trial), restore, or email support.
 * @param {{ onOpenSettings?: Function, onOpenTerms?: Function, onOpenPrivacy?: Function }} props
 * @returns {JSX.Element}
 */
export default function ProExpiredScreen({ onOpenSettings, onOpenTerms, onOpenPrivacy }) {
  // vocab: useTheme = app light/dark; isDark drives ProUpgradeOffer colors
  const { isDark } = useTheme();
  // vocab: useSubscription = shared Pro purchase state (loading, last StoreKit error, trial + restore)
  const { actionLoading, lastError, clearError, startFreeTrial, restorePurchases } = useSubscription();

  // 1. Resubscribe — clear any stale IAP error, then reuse the free-trial purchase path.
  const handleResubscribe = async () => {
    clearError();
    await startFreeTrial();
  };

  // 2. Support — open the shared mailto (no personal data in the URL).
  const handleContactSupport = () => {
    openExpiredProSupportMail();
  };

  return (
    <ProExpiredScreenLayout
      isDark={isDark}
      actionLoading={actionLoading}
      lastError={lastError}
      onResubscribe={handleResubscribe}
      onRestorePurchases={restorePurchases}
      onOpenSettings={onOpenSettings}
      onOpenTerms={onOpenTerms}
      onOpenPrivacy={onOpenPrivacy}
      onContactSupport={handleContactSupport}
    />
  );
}

// ===== PLUMBING — skip unless debugging =====

/**
 * Opens the support inbox in the device mail app.
 * @returns {void}
 */
function openExpiredProSupportMail() {
  // vocab: Linking.openURL = hand a mailto: / https: URL to the OS
  Linking.openURL(SUPPORT_MAIL_URL);
}
