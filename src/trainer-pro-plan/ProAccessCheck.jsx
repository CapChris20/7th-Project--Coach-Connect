// Gate around the trainer app: open, wait for Firestore, or lock on expired Pro.
// Flow: billing off / not iOS → skip → spinner while subscription loads → expired Pro only → app.
// Used by TrainerMainScreen. Everyone else (trial, never subscribed, active) still enters.

import React from 'react';
import { ActivityIndicator, Platform, View, StyleSheet, useColorScheme } from 'react-native';
import { useSubscription } from './ProPlanSetup';
import ProExpiredScreen from './ProExpiredScreen';
import { TRAINER_PLATFORM_SUBSCRIPTION_ENABLED } from './proPlanSwitches';
import { lightColors, darkColors } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: must match the "expired" string ProPlanSetup writes into accessState.access
const ACCESS_EXPIRED = 'expired';
const IOS_PLATFORM = 'ios';
const LOADING_SPINNER_SIZE = 'large';

// ===== MAIN FUNCTION =====

/**
 * Wraps the trainer experience. Only trainers who had Pro and lost it see the lock screen.
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {Function} props.onOpenSettings
 * @param {Function} props.onOpenTerms
 * @param {Function} props.onOpenPrivacy
 * @returns {React.ReactNode}
 */
export default function ProAccessCheck({ children, onOpenSettings, onOpenTerms, onOpenPrivacy }) {
  // vocab: useSubscription = ProPlanSetup context (Firestore accessState + loading flag)
  const { firestoreLoading, accessState } = useSubscription();

  // 1. Pro IAP is iOS-only; kill switch or Android/web skips this wrapper entirely.
  const billingGateIsOff = proBillingGateIsDisabled();
  if (billingGateIsOff) {
    return children;
  }

  // 2. Still reading the subscription doc — spinner so we do not flash the app then yank it.
  if (firestoreLoading) {
    return <ProGateLoadingSpinner />;
  }

  // 3. Lock only when access === "expired". Trial / missing doc / active Pro still enter.
  const trainerProHasExpired = accessStateSaysProExpired(accessState);
  if (trainerProHasExpired) {
    return (
      <ProExpiredScreen
        onOpenSettings={onOpenSettings}
        onOpenTerms={onOpenTerms}
        onOpenPrivacy={onOpenPrivacy}
      />
    );
  }

  // 4. Active, trial, or never subscribed — render the trainer app.
  return children;
}

// ===== PLUMBING — skip unless debugging =====

/**
 * True when the app should not run the Pro gate at all.
 * @returns {boolean}
 */
function proBillingGateIsDisabled() {
  const subscriptionFeatureIsOff = !TRAINER_PLATFORM_SUBSCRIPTION_ENABLED;
  const deviceIsNotIos = Platform.OS !== IOS_PLATFORM;
  return subscriptionFeatureIsOff || deviceIsNotIos;
}

/**
 * True only for the Firestore access value that means "had Pro, lost it."
 * @param {{ access?: string }} accessState
 * @returns {boolean}
 */
function accessStateSaysProExpired(accessState) {
  return accessState.access === ACCESS_EXPIRED;
}

/**
 * Full-screen spinner while ProPlanSetup reads subscription state from Firestore.
 * @returns {JSX.Element}
 */
function ProGateLoadingSpinner() {
  // vocab: useColorScheme = OS light/dark; palette.nb* = Design Law ink/background tokens
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === 'dark';
  const palette = isDarkMode ? darkColors : lightColors;

  return (
    <View style={[styles.loading, { backgroundColor: palette.nbBackground }]}>
      <ActivityIndicator size={LOADING_SPINNER_SIZE} color={palette.nbInk} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
