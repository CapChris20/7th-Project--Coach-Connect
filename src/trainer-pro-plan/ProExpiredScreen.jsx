import React from 'react';
import { Linking } from 'react-native';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { useSubscription } from './ProPlanSetup';
import ProUpgradeOffer from './ProUpgradeOffer';

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
      variant="expired"
      actionLoading={actionLoading}
      lastError={lastError}
      onPrimary={handleResubscribe}
      onRestore={restorePurchases}
      onOpenSettings={onOpenSettings}
      onOpenTerms={onOpenTerms}
      onOpenPrivacy={onOpenPrivacy}
      onContactSupport={() => Linking.openURL('mailto:coachconnect0@gmail.com')}
    />
  );
}
