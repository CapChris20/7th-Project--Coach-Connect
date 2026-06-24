import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  useIAP,
  ErrorCode,
  getAvailablePurchases as getAvailablePurchasesDirect,
  restorePurchases as restorePurchasesIap,
} from 'expo-iap';
import { db } from '../app-start/config';
import { TRAINER_PRO_MONTHLY_PRODUCT_ID } from './constants';
import { resolveSubscriptionAccess } from './subscriptionState';
import {
  restoreAppleSubscriptionOnServer,
  verifyAppleSubscriptionOnServer,
} from './subscriptionApi';

const SubscriptionContext = createContext(null);

/**
 * @param {import('expo-iap').Purchase} purchase
 */
async function processVerifiedPurchase(purchase, finishTransaction) {
  await verifyAppleSubscriptionOnServer(purchase);
  await finishTransaction({ purchase, isConsumable: false });
}

export function SubscriptionProvider({ userId, children }) {
  const [firestoreSubscription, setFirestoreSubscription] = useState(null);
  const [firestoreLoading, setFirestoreLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastError, setLastError] = useState(null);
  const processingRef = useRef(new Set());

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      const key = purchase?.transactionId || purchase?.purchaseToken;
      if (key && processingRef.current.has(key)) return;
      if (key) processingRef.current.add(key);

      try {
        setActionLoading(true);
        setLastError(null);
        await processVerifiedPurchase(purchase, finishTransaction);
      } catch (e) {
        const code = e?.code || 'purchase_failed';
        if (code === 'verification_failed') {
          setLastError({
            type: 'verification',
            message: 'Purchase verification failed. Contact support if this continues.',
          });
        } else if (code === 'network_error') {
          setLastError({ type: 'network', message: e.message || 'Network error' });
        } else {
          setLastError({ type: 'generic', message: e?.message || 'Purchase failed' });
        }
      } finally {
        setActionLoading(false);
        if (key) processingRef.current.delete(key);
      }
    },
    onPurchaseError: (error) => {
      if (error?.code === ErrorCode.UserCancelled) return;
      const isNetwork = error?.code === ErrorCode.NetworkError;
      setLastError({
        type: isNetwork ? 'network' : 'generic',
        message: error?.message || 'Purchase failed',
      });
    },
  });

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

  useEffect(() => {
    if (!connected || Platform.OS !== 'ios') return;
    fetchProducts({
      skus: [TRAINER_PRO_MONTHLY_PRODUCT_ID],
      type: 'subs',
    }).catch(() => {});
  }, [connected, fetchProducts]);

  const accessState = useMemo(
    () => resolveSubscriptionAccess(firestoreSubscription),
    [firestoreSubscription],
  );

  const storeProduct = useMemo(
    () => subscriptions?.find((s) => s.id === TRAINER_PRO_MONTHLY_PRODUCT_ID) || null,
    [subscriptions],
  );

  const startFreeTrial = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Unavailable', 'Subscriptions are available on iOS.');
      return;
    }
    if (!connected) {
      setLastError({ type: 'network', message: 'Store not connected. Check your connection and try again.' });
      return;
    }

    setActionLoading(true);
    setLastError(null);
    try {
      await requestPurchase({
        request: { apple: { sku: TRAINER_PRO_MONTHLY_PRODUCT_ID } },
        type: 'subs',
      });
    } catch (e) {
      if (e?.code !== ErrorCode.UserCancelled) {
        setLastError({
          type: e?.code === ErrorCode.NetworkError ? 'network' : 'generic',
          message: e?.message || 'Could not start purchase',
        });
      }
    } finally {
      setActionLoading(false);
    }
  }, [connected, requestPurchase]);

  const restorePurchases = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Unavailable', 'Restore is available on iOS.');
      return false;
    }

    setActionLoading(true);
    setLastError(null);
    try {
      await restorePurchasesIap();
      const purchases = await getAvailablePurchasesDirect({
        onlyIncludeActiveItemsIOS: true,
      });
      const relevant = (purchases || []).filter(
        (p) => p.productId === TRAINER_PRO_MONTHLY_PRODUCT_ID,
      );
      if (!relevant.length) {
        Alert.alert('No subscription found', 'We could not find an active Coach Connect Pro subscription for this Apple ID.');
        return false;
      }
      await restoreAppleSubscriptionOnServer(relevant);
      Alert.alert('Restored', 'Your subscription has been restored.');
      return true;
    } catch (e) {
      const code = e?.code || 'restore_failed';
      if (code === 'verification_failed') {
        setLastError({
          type: 'verification',
          message: 'Could not verify restored purchases. Contact support.',
        });
      } else if (code === 'network_error') {
        setLastError({ type: 'network', message: e.message || 'Network error' });
      } else if (code === 'not_found') {
        Alert.alert('No subscription found', e.message || 'No active subscription to restore.');
      } else {
        setLastError({ type: 'generic', message: e?.message || 'Restore failed' });
      }
      return false;
    } finally {
      setActionLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setLastError(null), []);

  const value = useMemo(
    () => ({
      firestoreSubscription,
      firestoreLoading,
      actionLoading,
      lastError,
      clearError,
      accessState,
      storeProduct,
      connected,
      startFreeTrial,
      restorePurchases,
      retryLastAction: startFreeTrial,
    }),
    [
      firestoreSubscription,
      firestoreLoading,
      actionLoading,
      lastError,
      clearError,
      accessState,
      storeProduct,
      connected,
      startFreeTrial,
      restorePurchases,
    ],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return ctx;
}
