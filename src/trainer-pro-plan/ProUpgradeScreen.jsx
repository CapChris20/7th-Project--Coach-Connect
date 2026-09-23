import React from 'react';
import { Linking, Platform } from 'react-native';
import { useTheme } from '../look-and-feel/lightDarkMode';
import {
  TRAINER_SUBSCRIPTION_PRICE_LABEL,
  TRAINER_SUBSCRIPTION_TRIAL_LABEL,
} from './proPlanSwitches';
import { useSubscription } from './ProPlanSetup';
import ProUpgradeOffer from './ProUpgradeOffer';

export default function ProUpgradeScreen({ onOpenSettings, onOpenTerms, onOpenPrivacy }) {
  const { isDark } = useTheme();
  const {
    actionLoading,
    lastError,
    clearError,
    startFreeTrial,
    restorePurchases,
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
      connected={Platform.OS !== 'ios' || connected}
    />
  );
}
