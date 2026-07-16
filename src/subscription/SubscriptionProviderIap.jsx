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

function productSku(product) {
  return String(product?.id || product?.productId || '').trim();
}

function purchaseSku(purchase) {
  return String(purchase?.productId || purchase?.id || '').trim();
}

/**
 * @param {import('expo-iap').Purchase} purchase
 */
async function processVerifiedPurchase(purchase, finishTransaction) {
  await verifyAppleSubscriptionOnServer(purchase);
  try {
    await finishTransaction({ purchase, isConsumable: false });
  } catch (finishErr) {
    // Verification already succeeded — don't fail the whole flow if finish is flaky.
    if (__DEV__) {
      console.warn('[SubscriptionProvider] finishTransaction:', finishErr?.message || finishErr);
    }
  }
}

export function IapSubscriptionProvider({ userId, children }) {
  const [firestoreSubscription, setFirestoreSubscription] = useState(null);
  const [firestoreLoading, setFirestoreLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [productsAttempted, setProductsAttempted] = useState(false);
  const processingRef = useRef(new Set());

  const {
    connected,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      const key = purchase?.transactionId || purchase?.purchaseToken || purchaseSku(purchase);
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
      if (String(error?.code || '') === 'E_USER_CANCELLED') return;
      const isNetwork =
        error?.code === ErrorCode.NetworkError ||
        String(error?.code || '').includes('NETWORK');
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

  const loadStoreProducts = useCallback(async () => {
    if (Platform.OS !== 'ios') return;
    if (!connected) {
      setLastError({
        type: 'network',
        message: 'App Store not connected yet. Wait a moment, then try again.',
      });
      return;
    }
    setProductsAttempted(true);
    try {
      await fetchProducts({
        skus: TRAINER_SUBSCRIPTION_PRODUCT_IDS,
        type: 'subs',
      });
      setLastError(null);
    } catch (error) {
      if (__DEV__) {
        console.warn('[SubscriptionProvider] fetchProducts failed:', error?.message || error);
      }
      setLastError({
        type: 'generic',
        message:
          `Could not load subscriptions from the App Store. Confirm ${TRAINER_PRO_MONTHLY_PRODUCT_ID} is Ready to Submit in App Store Connect, and this device is signed into a Sandbox Apple ID.`,
      });
    }
  }, [connected, fetchProducts]);

  useEffect(() => {
    if (!connected || Platform.OS !== 'ios') return;
    loadStoreProducts();
  }, [connected, loadStoreProducts]);

  const accessState = useMemo(
    () => resolveSubscriptionAccess(firestoreSubscription),
    [firestoreSubscription],
  );

  const storeProducts = useMemo(() => {
    const map = {};
    for (const sub of subscriptions || []) {
      const sku = productSku(sub);
      if (TRAINER_SUBSCRIPTION_PRODUCT_IDS.includes(sku)) {
        map[sku] = sub;
      }
    }
    return map;
  }, [subscriptions]);

  const storeProduct = useMemo(
    () => storeProducts[TRAINER_PRO_MONTHLY_PRODUCT_ID] || null,
    [storeProducts],
  );

  const startFreeTrial = useCallback(async (productId) => {
    const sku = TRAINER_SUBSCRIPTION_PRODUCT_IDS.includes(productId)
      ? productId
      : TRAINER_PRO_MONTHLY_PRODUCT_ID;
    if (Platform.OS !== 'ios') {
      Alert.alert('Unavailable', 'Subscriptions are available on iOS.');
      return;
    }
    if (!connected) {
      setLastError({
        type: 'network',
        message: 'Store not connected. Check your connection and try again.',
      });
      return;
    }

    // Best-effort refresh products before purchase (fixes stale StoreKit cache).
    if (!storeProducts[sku]) {
      try {
        await loadStoreProducts();
      } catch (_) {
        /* lastError already set */
      }
    }

    if (!storeProducts[sku] && !subscriptions?.some((s) => productSku(s) === sku)) {
      setLastError({
        type: 'generic',
        message:
          `SKU not found: "${sku}". In App Store Connect → your app → Subscriptions, create/open the subscription whose Product ID is exactly "${sku}" (and "${TRAINER_SUBSCRIPTION_PRODUCT_IDS.join('" / "')}"). Status must not be Missing Metadata. Paid Apps Agreement must be Active.`,
      });
      return;
    }

    setActionLoading(true);
    setLastError(null);
    try {
      await requestPurchase({
        request: {
          apple: { sku },
          ios: { sku },
        },
        type: 'subs',
      });
    } catch (e) {
      const code = e?.code;
      if (code === ErrorCode.UserCancelled || String(code || '') === 'E_USER_CANCELLED') {
        return;
      }
      const msg = String(e?.message || '');
      if (/sku not found/i.test(msg) || /product.*(not found|invalid)/i.test(msg)) {
        setLastError({
          type: 'generic',
          message:
            `SKU not found: "${sku}". Open App Store Connect → Monetization → Subscriptions and confirm a Product ID of exactly "${sku}" exists.`,
        });
        return;
      }
      setLastError({
        type: code === ErrorCode.NetworkError ? 'network' : 'generic',
        message: e?.message || 'Could not start purchase',
      });
    } finally {
      setActionLoading(false);
    }
  }, [connected, requestPurchase, storeProducts, loadStoreProducts, subscriptions]);

  const restorePurchases = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Unavailable', 'Restore is available on iOS.');
      return false;
    }

    setActionLoading(true);
    setLastError(null);
    try {
      try {
        await restorePurchasesIap();
      } catch (restoreHookErr) {
        // Some StoreKit builds throw even when purchases exist — still query local entitlements.
        if (__DEV__) {
          console.warn('[SubscriptionProvider] restorePurchasesIap:', restoreHookErr?.message || restoreHookErr);
        }
      }
      const purchases = await getAvailablePurchasesDirect({
        onlyIncludeActiveItemsIOS: true,
      });
      const relevant = (purchases || []).filter((p) =>
        TRAINER_SUBSCRIPTION_PRODUCT_IDS.includes(purchaseSku(p)),
      );
      if (!relevant.length) {
        Alert.alert(
          'No subscription found',
          'We could not find an active Coach Connect Pro subscription for this Apple ID.',
        );
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
      productsAttempted,
      startFreeTrial,
      restorePurchases,
      retryLastAction: startFreeTrial,
      refreshProducts: loadStoreProducts,
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
      productsAttempted,
      startFreeTrial,
      restorePurchases,
      loadStoreProducts,
    ],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}
