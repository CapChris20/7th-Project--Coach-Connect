import React from 'react';
import { Linking, Platform } from 'react-native';
import { useTheme } from '../shared-ui/ThemeContext';
import {
  TRAINER_SUBSCRIPTION_PRICE_LABEL,
  TRAINER_SUBSCRIPTION_TRIAL_LABEL,
} from './constants';
import { useSubscription } from './SubscriptionProvider';
import TrainerProSubscriptionOffer from './TrainerProSubscriptionOffer';

export default function TrainerSubscriptionPaywallScreen({ onOpenSettings }) {
  const { isDark } = useTheme();
  const {
    actionLoading,
    lastError,
    clearError,
    startFreeTrial,
    storeProduct,
    connected,
  } = useSubscription();

  const priceLine =
    storeProduct?.displayPrice != null
      ? `${storeProduct.displayPrice}/month · ${TRAINER_SUBSCRIPTION_TRIAL_LABEL}`
      : `${TRAINER_SUBSCRIPTION_PRICE_LABEL} · ${TRAINER_SUBSCRIPTION_TRIAL_LABEL}`;

  const handleCta = async () => {
    clearError();
    await startFreeTrial();
  };

  const handleContactSupport = () => {
    if (typeof onOpenSettings === 'function') {
      onOpenSettings();
      return;
    }
    Linking.openURL('mailto:coachconnect0@gmail.com?subject=Subscription%20verification%20issue');
  };

  return (
    <TrainerProSubscriptionOffer
      isDark={isDark}
      variant="paywall"
      priceLine={priceLine}
      actionLoading={actionLoading}
      lastError={lastError}
      onPrimary={handleCta}
      onContactSupport={handleContactSupport}
      onOpenSettings={onOpenSettings}
      connected={Platform.OS !== 'ios' || connected}
    />
  );
}
