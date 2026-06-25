import React from 'react';
import { Linking } from 'react-native';
import { useTheme } from '../shared-ui/ThemeContext';
import { useSubscription } from './SubscriptionProvider';
import TrainerProSubscriptionOffer from './TrainerProSubscriptionOffer';

export default function SubscriptionExpiredScreen({ onOpenSettings }) {
  const { isDark } = useTheme();
  const { actionLoading, lastError, clearError, startFreeTrial, restorePurchases } = useSubscription();

  const handleResubscribe = async () => {
    clearError();
    await startFreeTrial();
  };

  return (
    <TrainerProSubscriptionOffer
      isDark={isDark}
      variant="expired"
      actionLoading={actionLoading}
      lastError={lastError}
      onPrimary={handleResubscribe}
      onRestore={restorePurchases}
      onOpenSettings={onOpenSettings}
      onContactSupport={() => Linking.openURL('mailto:coachconnect0@gmail.com')}
    />
  );
}
