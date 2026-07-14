import React from 'react';
import { ActivityIndicator, Platform, View, StyleSheet } from 'react-native';
import { useSubscription } from './SubscriptionProvider';
import SubscriptionExpiredScreen from './SubscriptionExpiredScreen';
import { TRAINER_PLATFORM_SUBSCRIPTION_ENABLED } from './constants';

/**
 * Gates trainer app when a *prior* subscription has expired.
 * Does NOT block login for trainers with no subscription yet — Pro IAP is
 * offered in onboarding / Settings, not as a hard login wall (legacy accounts
 * and TestFlight trainers otherwise get stuck on payment forever).
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

  // Only lock the app if they had Pro and it expired — not if they've never subscribed.
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
