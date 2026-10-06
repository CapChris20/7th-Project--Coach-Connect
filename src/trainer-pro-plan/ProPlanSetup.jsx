// Shares the trainer's Pro status with the screens under it.
// Flow: if this build sells Pro, use the store setup → otherwise read the user doc and leave access open.
// Used by the trainer app root. Screens call useSubscription().

import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';
import { TRAINER_PLATFORM_SUBSCRIPTION_ENABLED } from './proPlanSwitches';
import { SubscriptionContext } from './proPlanStatus';
import { IapProPlanSetup } from './ProPlanPurchases';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const OPEN_ACCESS_STATE = {
  access: 'active',
  hasFullAccess: true,
  status: 'active',
  trialEndsAt: null,
  expiresAt: null,
  nextBillingDate: null,
  trialCountdownMs: null,
};
const UNAVAILABLE_TITLE = 'Unavailable';
const UNAVAILABLE_MESSAGE = 'Trainer subscriptions are not enabled in this build.';

// ===== HELPER FUNCTIONS =====

/**
 * Builds without the store still need the context. Access stays open and the buttons explain why.
 * Hooks stay in this order: two state values, the user-doc listener, two callbacks, then the memo.
 * @param {{ userId?: string, children: import('react').ReactNode }} props
 * @returns {import('react').ReactElement}
 */
function DisabledProPlanSetup({ userId, children }) {
  const [firestoreSubscription, setFirestoreSubscription] = useState(null);
  const [firestoreLoading, setFirestoreLoading] = useState(true);

  useEffect(() => {
    if (!userId || !db) {
      setFirestoreSubscription(null);
      setFirestoreLoading(false);
      return undefined;
    }

    setFirestoreLoading(true);
    const unsubscribe = onSnapshot(
      doc(db, USERS_COLLECTION, userId),
      (snapshot) => {
        const userData = snapshot.exists() ? snapshot.data() : null;
        setFirestoreSubscription(userData?.subscription || null);
        setFirestoreLoading(false);
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
      accessState: OPEN_ACCESS_STATE,
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
    <SubscriptionContext.Provider value={subscriptionValue}>{children}</SubscriptionContext.Provider>
  );
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ userId?: string, children: import('react').ReactNode }} props
 * @returns {import('react').ReactElement}
 */
export function ProPlanSetup({ userId, children }) {
  if (TRAINER_PLATFORM_SUBSCRIPTION_ENABLED) {
    return <IapProPlanSetup userId={userId}>{children}</IapProPlanSetup>;
  }
  return <DisabledProPlanSetup userId={userId}>{children}</DisabledProPlanSetup>;
}

/**
 * @returns {object}
 */
export function useSubscription() {
  const subscriptionValue = useContext(SubscriptionContext);
  if (!subscriptionValue) {
    throw new Error('useSubscription must be used within ProPlanSetup');
  }
  return subscriptionValue;
}
