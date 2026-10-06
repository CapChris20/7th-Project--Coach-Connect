// Decides whether the trainer app opens, waits, or shows the expired-Pro screen.
// Flow: skip the gate when Pro billing is off or this is not iOS → wait while the subscription loads → lock only an expired Pro account.
// Used by the trainer main screen around the rest of the trainer app.

import React from 'react';
import { ActivityIndicator, Platform, View, StyleSheet } from 'react-native';
import { useSubscription } from './ProPlanSetup';
import ProExpiredScreen from './ProExpiredScreen';
import { TRAINER_PLATFORM_SUBSCRIPTION_ENABLED } from './proPlanSwitches';

// ===== NAMED CONSTANTS =====

const ACCESS_EXPIRED = 'expired';
const IOS_PLATFORM = 'ios';
const LOADING_SPINNER_SIZE = 'large';
const LOADING_SPINNER_COLOR = '#BE185D';

// ===== HELPER FUNCTIONS =====

/**
 * Pro billing is an iOS in-app purchase. The kill switch and every other platform render the app with no gate.
 * @returns {boolean}
 */
function shouldBypassProGate() {
  return !TRAINER_PLATFORM_SUBSCRIPTION_ENABLED || Platform.OS !== IOS_PLATFORM;
}

/**
 * The lock is only for a trainer who had Pro and lost it. A missing subscription is a different access value.
 * @param {{ access?: string }} accessState
 * @returns {boolean}
 */
function isExpiredProAccess(accessState) {
  return accessState.access === ACCESS_EXPIRED;
}

// ===== MAIN FUNCTION =====

/**
 * Wraps the trainer app. Expired Pro sees the paywall screen. Everyone else sees the app.
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {Function} props.onOpenSettings
 * @param {Function} props.onOpenTerms
 * @param {Function} props.onOpenPrivacy
 * @returns {React.ReactNode}
 */
export default function ProAccessCheck({ children, onOpenSettings, onOpenTerms, onOpenPrivacy }) {
  const { firestoreLoading, accessState } = useSubscription();

  if (shouldBypassProGate()) {
    return children;
  }

  if (firestoreLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size={LOADING_SPINNER_SIZE} color={LOADING_SPINNER_COLOR} />
      </View>
    );
  }

  // Trainers who never subscribed still get in. The lock runs only after a paid Pro period has ended.
  if (isExpiredProAccess(accessState)) {
    return (
      <ProExpiredScreen
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
