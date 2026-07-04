import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../app-start/config';
import { TRAINER_PLATFORM_SUBSCRIPTION_ENABLED } from './constants';
import { SubscriptionContext } from './subscriptionContext';
import { IapSubscriptionProvider } from './SubscriptionProviderIap';

const OPEN_ACCESS_STATE = {
  access: 'active',
  hasFullAccess: true,
  status: 'active',
  trialEndsAt: null,
  expiresAt: null,
  nextBillingDate: null,
  trialCountdownMs: null,
};

function DisabledSubscriptionProvider({ userId, children }) {
  const [firestoreSubscription, setFirestoreSubscription] = useState(null);
  const [firestoreLoading, setFirestoreLoading] = useState(true);

  useEffect(() => {
    if (!userId || !db) {
      setFirestoreSubscription(null);
      setFirestoreLoading(false);
      return undefined;
    }

    setFirestoreLoading(true);
    const unsub = onSnapshot(
      doc(db, 'users', userId),
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        setFirestoreSubscription(data?.subscription || null);
        setFirestoreLoading(false);
      },
      () => {
        setFirestoreLoading(false);
      },
    );

    return unsub;
  }, [userId]);

  const clearError = useCallback(() => {}, []);

  const unavailable = useCallback(() => {
    Alert.alert('Unavailable', 'Trainer subscriptions are not enabled in this build.');
  }, []);

  const value = useMemo(
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
      startFreeTrial: unavailable,
      restorePurchases: async () => {
        unavailable();
        return false;
      },
      retryLastAction: unavailable,
    }),
    [firestoreSubscription, firestoreLoading, clearError, unavailable],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function SubscriptionProvider({ userId, children }) {
  if (TRAINER_PLATFORM_SUBSCRIPTION_ENABLED) {
    return <IapSubscriptionProvider userId={userId}>{children}</IapSubscriptionProvider>;
  }

  return <DisabledSubscriptionProvider userId={userId}>{children}</DisabledSubscriptionProvider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return ctx;
}
