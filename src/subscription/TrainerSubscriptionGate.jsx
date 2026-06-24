import React from 'react';
import { ActivityIndicator, Platform, View, StyleSheet } from 'react-native';
import { useSubscription } from './SubscriptionProvider';
import TrainerSubscriptionPaywallScreen from './TrainerSubscriptionPaywallScreen';
import SubscriptionExpiredScreen from './SubscriptionExpiredScreen';

/**
 * Gates trainer app content by platform subscription state.
 * iOS only — other platforms pass through (Android IAP not in scope).
 */
export default function TrainerSubscriptionGate({ children, onOpenSettings }) {
  const { firestoreLoading, accessState } = useSubscription();

  if (Platform.OS !== 'ios') {
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
    return <TrainerSubscriptionPaywallScreen onOpenSettings={onOpenSettings} />;
  }

  if (accessState.access === 'expired') {
    return <SubscriptionExpiredScreen onOpenSettings={onOpenSettings} />;
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
