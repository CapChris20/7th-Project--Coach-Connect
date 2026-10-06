// Screen shown when a trainer's Pro plan has expired.
// Flow: read theme and subscription → the resubscribe button starts a trial again → mail opens support.
// Used by: the Pro plan flow after the subscription lapses.

import React from 'react';
import { Linking } from 'react-native';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { useSubscription } from './ProPlanSetup';
import ProUpgradeOffer from './ProUpgradeOffer';

// ===== NAMED CONSTANTS =====

const EXPIRED_VARIANT = 'expired';
const SUPPORT_MAIL_URL = 'mailto:coachconnect0@gmail.com';

// ===== HELPER FUNCTIONS =====

function openSupportMail() {
  Linking.openURL(SUPPORT_MAIL_URL);
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ onOpenSettings?: Function, onOpenTerms?: Function, onOpenPrivacy?: Function }} props
 */
export default function ProExpiredScreen({ onOpenSettings, onOpenTerms, onOpenPrivacy }) {
  const { isDark } = useTheme();
  const { actionLoading, lastError, clearError, startFreeTrial, restorePurchases } = useSubscription();

  const handleResubscribe = async () => {
    clearError();
    await startFreeTrial();
  };

  return (
    <ProUpgradeOffer
      isDark={isDark}
      variant={EXPIRED_VARIANT}
      actionLoading={actionLoading}
      lastError={lastError}
      onPrimary={handleResubscribe}
      onRestore={restorePurchases}
      onOpenSettings={onOpenSettings}
      onOpenTerms={onOpenTerms}
      onOpenPrivacy={onOpenPrivacy}
      onContactSupport={openSupportMail}
    />
  );
}
