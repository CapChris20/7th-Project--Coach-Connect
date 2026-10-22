// Trainer Pro in-app purchases: load StoreKit products, buy, restore, and mirror status from Firestore.
// Flow: listen to users/{uid}.subscription → fetch App Store SKUs → purchase → verify on the server → finish the transaction.
// Used by ProPlanSetup. Product ids stay in proPlanSwitches (com.coachconnect.month / com.coachconnect.year).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  useIAP,
  ErrorCode,
  getAvailablePurchases as getAvailablePurchasesDirect,
  restorePurchases as restorePurchasesIap,
} from 'expo-iap';
import { db } from '../app-start/cloudConnection';
import {
  TRAINER_PRO_MONTHLY_PRODUCT_ID,
  TRAINER_SUBSCRIPTION_PRODUCT_IDS,
} from './proPlanSwitches';
import { resolveSubscriptionAccess } from './proAccessRules';
import {
  restoreAppleSubscriptionOnServer,
  verifyAppleSubscriptionOnServer,
} from './verifyProPurchase';
import { SubscriptionContext } from './proPlanStatus';

// ===== NAMED CONSTANTS =====

const FIRESTORE_USERS_COLLECTION = 'users';
const IOS_PLATFORM = 'ios';
const SUBSCRIPTION_TYPE = 'subs';
const ERROR_VERIFICATION_FAILED = 'verification_failed';
const ERROR_NETWORK = 'network_error';
const ERROR_NOT_FOUND = 'not_found';
const ERROR_USER_CANCELLED_LEGACY = 'E_USER_CANCELLED';
const UNAVAILABLE_TITLE = 'Unavailable';
const RESTORED_TITLE = 'Restored';
const NO_SUBSCRIPTION_TITLE = 'No subscription found';

// ===== HELPER FUNCTIONS =====

/**
 * StoreKit sometimes puts the SKU on `id`, sometimes on `productId`.
 * @param {object} product
 * @returns {string}
 */
function productSku(product) {
  return String(product?.id || product?.productId || '').trim();
}

/**
 * @param {object} purchase
 * @returns {string}
 */
function purchaseSku(purchase) {
  return String(purchase?.productId || purchase?.id || '').trim();
}

/**
 * Dedup key so a StoreKit double-callback does not verify the same receipt twice.
 * @param {object} purchase
 * @returns {string}
 */
function purchaseProcessingKey(purchase) {
  return purchase?.transactionId || purchase?.purchaseToken || purchaseSku(purchase);
}

/**
 * Server verify first, then tell Apple the transaction is done. Finish failures are logged, not fatal.
 * @param {import('expo-iap').Purchase} purchase
 * @param {Function} finishTransaction
 */
async function processVerifiedPurchase(purchase, finishTransaction) {
  await verifyAppleSubscriptionOnServer(purchase);
  try {
    await finishTransaction({ purchase, isConsumable: false });
  } catch (finishErr) {
    if (__DEV__) {
      console.warn('[ProPlanSetup] finishTransaction:', finishErr?.message || finishErr);
    }
  }
}

/**
 * @param {object} error
 * @returns {{ type: string, message: string }}
 */
function purchaseErrorState(error) {
  const code = error?.code || 'purchase_failed';
  if (code === ERROR_VERIFICATION_FAILED) {
    return {
      type: 'verification',
      message: 'Purchase verification failed. Contact support if this continues.',
    };
  }
  if (code === ERROR_NETWORK) {
    return { type: 'network', message: error.message || 'Network error' };
  }
  return { type: 'generic', message: error?.message || 'Purchase failed' };
}

/**
 * @param {object} error
 * @returns {{ type: string, message: string }}
 */
function restoreErrorState(error) {
  const code = error?.code || 'restore_failed';
  if (code === ERROR_VERIFICATION_FAILED) {
    return {
      type: 'verification',
      message: 'Could not verify restored purchases. Contact support.',
    };
  }
  if (code === ERROR_NETWORK) {
    return { type: 'network', message: error.message || 'Network error' };
  }
  return { type: 'generic', message: error?.message || 'Restore failed' };
}

/**
 * @param {object} error
 * @returns {boolean}
 */
function isUserCancelledPurchase(error) {
  const code = error?.code;
  return code === ErrorCode.UserCancelled || String(code || '') === ERROR_USER_CANCELLED_LEGACY;
}

/**
 * @param {object} error
 * @returns {boolean}
 */
function isNetworkPurchaseError(error) {
  return (
    error?.code === ErrorCode.NetworkError ||
    String(error?.code || '').includes('NETWORK')
  );
}

/**
 * @param {object} error
 * @returns {boolean}
 */
function isSkuNotFoundMessage(error) {
  const messageText = String(error?.message || '');
  return /sku not found/i.test(messageText) || /product.*(not found|invalid)/i.test(messageText);
}

/**
 * @param {string} sku
 * @returns {{ type: string, message: string }}
 */
function skuNotFoundError(sku) {
  return {
    type: 'generic',
    message:
      `SKU not found: "${sku}". In App Store Connect → your app → Subscriptions, create/open the subscription whose Product ID is exactly "${sku}" (and "${TRAINER_SUBSCRIPTION_PRODUCT_IDS.join('" / "')}"). Status must not be Missing Metadata. Paid Apps Agreement must be Active.`,
  };
}

/**
 * @param {string} sku
 * @returns {{ type: string, message: string }}
 */
function skuMissingInConnectError(sku) {
  return {
    type: 'generic',
    message:
      `SKU not found: "${sku}". Open App Store Connect → Monetization → Subscriptions and confirm a Product ID of exactly "${sku}" exists.`,
  };
}

/**
 * @param {Array} subscriptions
 * @returns {object}
 */
function storeProductMap(subscriptions) {
  const map = {};
  for (const subscription of subscriptions || []) {
    const sku = productSku(subscription);
    if (TRAINER_SUBSCRIPTION_PRODUCT_IDS.includes(sku)) {
      map[sku] = subscription;
    }
  }
  return map;
}

/**
 * @param {Array} purchases
 * @returns {Array}
 */
function relevantSubscriptionPurchases(purchases) {
  return (purchases || []).filter((purchase) =>
    TRAINER_SUBSCRIPTION_PRODUCT_IDS.includes(purchaseSku(purchase)),
  );
}

/**
 * @param {string} productId
 * @returns {string}
 */
function skuForPurchaseRequest(productId) {
  if (TRAINER_SUBSCRIPTION_PRODUCT_IDS.includes(productId)) return productId;
  return TRAINER_PRO_MONTHLY_PRODUCT_ID;
}

/**
 * @param {object} storeProducts
 * @param {Array} subscriptions
 * @param {string} sku
 * @returns {boolean}
 */
function isSkuMissingFromStore(storeProducts, subscriptions, sku) {
  if (storeProducts[sku]) return false;
  return !subscriptions?.some((subscription) => productSku(subscription) === sku);
}

/**
 * Some StoreKit builds throw even when purchases exist — still query local entitlements after this.
 */
async function tryRestorePurchasesIap() {
  try {
    await restorePurchasesIap();
  } catch (restoreHookErr) {
    warnRestoreHookError(restoreHookErr);
  }
}

/**
 * @param {object} restoreHookErr
 */
function warnRestoreHookError(restoreHookErr) {
  if (!__DEV__) return;
  console.warn('[ProPlanSetup] restorePurchasesIap:', restoreHookErr?.message || restoreHookErr);
}

// ===== MAIN FUNCTION =====

/**
 * Provides subscription state to trainer screens. Children read it through SubscriptionContext.
 * vocab: onSnapshot = live Firestore listener. The function it returns is the unsubscribe — keep that cleanup.
 * vocab: useIAP = expo-iap hook. Purchase success/error callbacks live in this options object.
 * @param {{ userId?: string, children: import('react').ReactNode }} props
 */
export function IapProPlanSetup({ userId, children }) {
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
      const key = purchaseProcessingKey(purchase);
      if (key && processingRef.current.has(key)) return;
      if (key) processingRef.current.add(key);

      try {
        setActionLoading(true);
        setLastError(null);
        await processVerifiedPurchase(purchase, finishTransaction);
      } catch (error) {
        setLastError(purchaseErrorState(error));
      } finally {
        setActionLoading(false);
        if (key) processingRef.current.delete(key);
      }
    },
    onPurchaseError: (error) => {
      if (isUserCancelledPurchase(error)) return;
      setLastError({
        type: isNetworkPurchaseError(error) ? 'network' : 'generic',
        message: error?.message || 'Purchase failed',
      });
    },
    onError: (error) => {
      if (__DEV__) {
        console.warn('[ProPlanSetup] IAP error:', error?.message || error);
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
      doc(db, FIRESTORE_USERS_COLLECTION, userId),
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
    if (Platform.OS !== IOS_PLATFORM) return;
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
        type: SUBSCRIPTION_TYPE,
      });
      setLastError(null);
    } catch (error) {
      if (__DEV__) {
        console.warn('[ProPlanSetup] fetchProducts failed:', error?.message || error);
      }
      setLastError({
        type: 'generic',
        message:
          `Could not load subscriptions from the App Store. Confirm ${TRAINER_PRO_MONTHLY_PRODUCT_ID} is Ready to Submit in App Store Connect, and this device is signed into a Sandbox Apple ID.`,
      });
    }
  }, [connected, fetchProducts]);

  useEffect(() => {
    if (!connected || Platform.OS !== IOS_PLATFORM) return;
    loadStoreProducts();
  }, [connected, loadStoreProducts]);

  const accessState = useMemo(
    () => resolveSubscriptionAccess(firestoreSubscription),
    [firestoreSubscription],
  );

  const storeProducts = useMemo(
    () => storeProductMap(subscriptions),
    [subscriptions],
  );

  const storeProduct = useMemo(
    () => storeProducts[TRAINER_PRO_MONTHLY_PRODUCT_ID] || null,
    [storeProducts],
  );

  const startFreeTrial = useCallback(async (productId) => {
    const sku = skuForPurchaseRequest(productId);
    if (Platform.OS !== IOS_PLATFORM) {
      Alert.alert(UNAVAILABLE_TITLE, 'Subscriptions are available on iOS.');
      return;
    }
    if (!connected) {
      setLastError({
        type: 'network',
        message: 'Store not connected. Check your connection and try again.',
      });
      return;
    }

    if (!storeProducts[sku]) {
      try {
        await loadStoreProducts();
      } catch (ignoredError) {
        /* lastError already set */
      }
    }

    if (isSkuMissingFromStore(storeProducts, subscriptions, sku)) {
      setLastError(skuNotFoundError(sku));
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
        type: SUBSCRIPTION_TYPE,
      });
    } catch (error) {
      if (isUserCancelledPurchase(error)) return;
      if (isSkuNotFoundMessage(error)) {
        setLastError(skuMissingInConnectError(sku));
        return;
      }
      setLastError({
        type: error?.code === ErrorCode.NetworkError ? 'network' : 'generic',
        message: error?.message || 'Could not start purchase',
      });
    } finally {
      setActionLoading(false);
    }
  }, [connected, requestPurchase, storeProducts, loadStoreProducts, subscriptions]);

  const restorePurchases = useCallback(async () => {
    if (Platform.OS !== IOS_PLATFORM) {
      Alert.alert(UNAVAILABLE_TITLE, 'Restore is available on iOS.');
      return false;
    }

    setActionLoading(true);
    setLastError(null);
    try {
      await tryRestorePurchasesIap();
      const purchases = await getAvailablePurchasesDirect({
        onlyIncludeActiveItemsIOS: true,
      });
      const relevant = relevantSubscriptionPurchases(purchases);
      if (!relevant.length) {
        Alert.alert(
          NO_SUBSCRIPTION_TITLE,
          'We could not find an active Coach Connect Pro subscription for this Apple ID.',
        );
        return false;
      }
      await restoreAppleSubscriptionOnServer(relevant);
      Alert.alert(RESTORED_TITLE, 'Your subscription has been restored.');
      return true;
    } catch (error) {
      if (error?.code === ERROR_NOT_FOUND) {
        Alert.alert(NO_SUBSCRIPTION_TITLE, error.message || 'No active subscription to restore.');
        return false;
      }
      setLastError(restoreErrorState(error));
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
