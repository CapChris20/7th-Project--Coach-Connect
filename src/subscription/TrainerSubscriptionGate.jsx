import React from 'react';
import { ActivityIndicator, Platform, View, StyleSheet } from 'react-native';
import { useSubscription } from './SubscriptionProvider';
import TrainerSubscriptionPaywallScreen from './TrainerSubscriptionPaywallScreen';
import SubscriptionExpiredScreen from './SubscriptionExpiredScreen';
import { TRAINER_PLATFORM_SUBSCRIPTION_ENABLED } from './constants';

/**
 * Gates trainer app content by platform subscription state.
 * iOS only — other platforms pass through (Android IAP not in scope).
 */
export default function TrainerSubscriptionGate({ children, onOpenSettings, onOpenTerms, onOpenPrivacy }) {
  const { firestoreLoading, accessState } = useSubscription();

  if (!TRAINER_PLATFORM_SUBSCRIPTION_ENABLED || Platform.OS !== 'ios') {
    return children;
  }

  if (firestoreLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#BE185D" />
      </View>
    );
  }

  if (accessState.access === 'no_subscription') {
    return (
      <TrainerSubscriptionPaywallScreen
        onOpenSettings={onOpenSettings}
        onOpenTerms={onOpenTerms}
        onOpenPrivacy={onOpenPrivacy}
      />
    );
  }

  if (accessState.access === 'expired') {
    return (
      <SubscriptionExpiredScreen
        onOpenSettings={onOpenSettings}
        onOpenTerms={onOpenTerms}
        onOpenPrivacy={onOpenPrivacy}
      />
    );
  }

  return children;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#050508',
  },
});
