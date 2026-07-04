import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  useIAP,
  ErrorCode,
  getAvailablePurchases as getAvailablePurchasesDirect,
  restorePurchases as restorePurchasesIap,
} from 'expo-iap';
import { db } from '../app-start/config';
import {
  TRAINER_PRO_MONTHLY_PRODUCT_ID,
  TRAINER_SUBSCRIPTION_PRODUCT_IDS,
} from './constants';
import { resolveSubscriptionAccess } from './subscriptionState';
import {
  restoreAppleSubscriptionOnServer,
  verifyAppleSubscriptionOnServer,
} from './subscriptionApi';
import { SubscriptionContext } from './subscriptionContext';

/**
 * @param {import('expo-iap').Purchase} purchase
 */
async function processVerifiedPurchase(purchase, finishTransaction) {
  await verifyAppleSubscriptionOnServer(purchase);
  await finishTransaction({ purchase, isConsumable: false });
}

export function IapSubscriptionProvider({ userId, children }) {
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
    onError: (error) => {
      if (__DEV__) {
        console.warn('[SubscriptionProvider] IAP error:', error?.message || error);
      }
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
      skus: TRAINER_SUBSCRIPTION_PRODUCT_IDS,
      type: 'subs',
    }).catch((error) => {
      if (__DEV__) {
        console.warn('[SubscriptionProvider] fetchProducts failed:', error?.message || error);
      }
      setLastError({
        type: 'generic',
        message:
          `Could not load subscriptions from the App Store. Confirm ${TRAINER_PRO_MONTHLY_PRODUCT_ID} exists in App Store Connect and you are signed into a Sandbox account on this device.`,
      });
    });
  }, [connected, fetchProducts]);

  const accessState = useMemo(
    () => resolveSubscriptionAccess(firestoreSubscription),
    [firestoreSubscription],
  );

  const storeProduct = useMemo(
    () => subscriptions?.find((s) => s.id === TRAINER_PRO_MONTHLY_PRODUCT_ID) || null,
    [subscriptions],
  );

  /** All trainer platform products returned by StoreKit, keyed by product ID. */
  const storeProducts = useMemo(() => {
    const map = {};
    for (const sub of subscriptions || []) {
      if (TRAINER_SUBSCRIPTION_PRODUCT_IDS.includes(sub.id)) {
        map[sub.id] = sub;
      }
    }
    return map;
  }, [subscriptions]);

  const startFreeTrial = useCallback(async (productId) => {
    const sku = TRAINER_SUBSCRIPTION_PRODUCT_IDS.includes(productId)
      ? productId
      : TRAINER_PRO_MONTHLY_PRODUCT_ID;
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
        request: { apple: { sku } },
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
        (p) => TRAINER_SUBSCRIPTION_PRODUCT_IDS.includes(p.productId),
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
      storeProducts,
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
      storeProducts,
      connected,
      startFreeTrial,
      restorePurchases,
    ],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}
