// Shares the trainer's Pro status with every screen under this provider.
// Flow: billing flag on → wrap children in StoreKit IAP → billing off → open access + alert stubs.
// Used at trainer app root. Screens read state via useSubscription().
//
// vocab: SubscriptionContext = React context object from proPlanStatus (same shape either path)
// vocab: TRAINER_PLATFORM_SUBSCRIPTION_ENABLED = kill switch in proPlanSwitches

import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';
import { TRAINER_PLATFORM_SUBSCRIPTION_ENABLED } from './proPlanSwitches';
import { SubscriptionContext } from './proPlanStatus';
import { IapProPlanSetup } from './ProPlanPurchases';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
// When billing is off, every screen still gets a full-access shape so UI does not gate.
const OPEN_ACCESS_WHEN_BILLING_OFF = {
  access: 'active',
  hasFullAccess: true,
  status: 'active',
  trialEndsAt: null,
  expiresAt: null,
  nextBillingDate: null,
  trialCountdownMs: null,
};
const UNAVAILABLE_TITLE = 'Unavailable';
// Manipulate here: copy shown when someone taps Subscribe / Restore in a billing-off build
const UNAVAILABLE_MESSAGE = 'Trainer subscriptions are not enabled in this build.';

// ===== HELPER FUNCTIONS =====

/**
 * Apply one users/{uid} snapshot into subscription state.
 * @param {import('firebase/firestore').DocumentSnapshot} snapshot
 * @param {Function} setFirestoreSubscription
 * @param {Function} setFirestoreLoading
 */
function applyUserSubscriptionSnapshot(snapshot, setFirestoreSubscription, setFirestoreLoading) {
  const userData = snapshot.exists() ? snapshot.data() : null;
  setFirestoreSubscription(userData?.subscription || null);
  setFirestoreLoading(false);
}

// ===== MAIN FUNCTION =====

/**
 * Routes children through real IAP or the billing-disabled stub.
 * @param {{ userId: string|null|undefined, children: React.ReactNode }} props
 */
export function ProPlanSetup({ userId, children }) {
  // 1. Real builds sell Pro through App Store IAP + Firestore mirror.
  if (TRAINER_PLATFORM_SUBSCRIPTION_ENABLED) {
    return <IapProPlanSetup userId={userId}>{children}</IapProPlanSetup>;
  }

  // 2. Dev / legacy builds skip billing but still expose the same context shape.
  return <DisabledProPlanSetup userId={userId}>{children}</DisabledProPlanSetup>;
}

/**
 * Reads SubscriptionContext; throws when used outside ProPlanSetup.
 * @returns {object}
 */
export function useSubscription() {
  // vocab: useContext = React hook that reads the nearest matching Provider value
  const subscriptionValue = useContext(SubscriptionContext);
  if (!subscriptionValue) {
    throw new Error('useSubscription must be used within ProPlanSetup');
  }
  return subscriptionValue;
}

// PLUMBING — skip unless debugging

/**
 * Billing disabled: keep hook order frozen (state → listener → callbacks → memo).
 * Screens still call startFreeTrial / restorePurchases; those just Alert.
 * @param {{ userId: string|null|undefined, children: React.ReactNode }} props
 */
function DisabledProPlanSetup({ userId, children }) {
  // Hook order frozen: subscription state → loading → onSnapshot → clearError → showUnavailable → value memo.
  const [firestoreSubscription, setFirestoreSubscription] = useState(null);
  const [firestoreLoading, setFirestoreLoading] = useState(true);

  // vocab: onSnapshot = live Firestore listener; return value is unsubscribe for cleanup
  useEffect(() => {
    const missingUserOrDb = !userId || !db;
    if (missingUserOrDb) {
      setFirestoreSubscription(null);
      setFirestoreLoading(false);
      return undefined;
    }

    setFirestoreLoading(true);
    const userDocRef = doc(db, USERS_COLLECTION, userId);
    const unsubscribe = onSnapshot(
      userDocRef,
      (snapshot) => {
        applyUserSubscriptionSnapshot(snapshot, setFirestoreSubscription, setFirestoreLoading);
      },
      () => {
        setFirestoreLoading(false);
      },
    );

    return unsubscribe;
  }, [userId]);

  const clearError = useCallback(() => {}, []);

  const showUnavailable = useCallback(() => {
    Alert.alert(UNAVAILABLE_TITLE, UNAVAILABLE_MESSAGE);
  }, []);

  const subscriptionValue = useMemo(
    () => ({
      firestoreSubscription,
      firestoreLoading,
      actionLoading: false,
      lastError: null,
      clearError,
      accessState: OPEN_ACCESS_WHEN_BILLING_OFF,
      storeProduct: null,
      storeProducts: {},
      connected: false,
      startFreeTrial: showUnavailable,
      restorePurchases: async () => {
        showUnavailable();
        return false;
      },
      retryLastAction: showUnavailable,
    }),
    [firestoreSubscription, firestoreLoading, clearError, showUnavailable],
  );

  return (
    <SubscriptionContext.Provider value={subscriptionValue}>
      {children}
    </SubscriptionContext.Provider>
  );
}
