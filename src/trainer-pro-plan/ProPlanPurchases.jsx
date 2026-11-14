// Trainer Pro StoreKit purchases: load products, buy, restore, mirror Firestore subscription.
// Flow: listen users/{uid}.subscription → fetch SKUs → purchase → server verify → finish transaction.
// Used by ProPlanSetup when billing is on. Product ids stay in proPlanSwitches (month / year).
//
// vocab: useIAP = expo-iap hook; purchase success/error live in the options object
// vocab: onSnapshot = live Firestore listener; cleanup returns unsubscribe
// vocab: finishTransaction = tell StoreKit we finished so it stops replaying the receipt

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { useIAP, ErrorCode, getAvailablePurchases as getAvailablePurchasesDirect, restorePurchases as restorePurchasesIap } from 'expo-iap';
import { db } from '../app-start/cloudConnection';
import { TRAINER_PRO_MONTHLY_PRODUCT_ID, TRAINER_SUBSCRIPTION_PRODUCT_IDS } from './proPlanSwitches';
import { resolveSubscriptionAccess } from './proAccessRules';
import { restoreAppleSubscriptionOnServer, verifyAppleSubscriptionOnServer } from './verifyProPurchase';
import { SubscriptionContext } from './proPlanStatus';
import NbNoticeSheet from '../look-and-feel/NbNoticeSheet';

// ===== NAMED CONSTANTS =====

const FIRESTORE_USERS_COLLECTION = 'users';
const IOS_PLATFORM = 'ios';
const SUBSCRIPTION_PRODUCT_TYPE = 'subs';
const ERROR_VERIFICATION_FAILED = 'verification_failed';
const ERROR_NETWORK = 'network_error';
const ERROR_NOT_FOUND = 'not_found';
const ERROR_USER_CANCELLED_LEGACY = 'E_USER_CANCELLED';
const NOTICE_UNAVAILABLE_TITLE = 'Unavailable';
const NOTICE_RESTORED_TITLE = 'Restored';
const NOTICE_NO_SUBSCRIPTION_TITLE = 'No subscription found';
const DEFAULT_NOTICE_CONFIRM_LABEL = 'OK';

// ===== HELPER FUNCTIONS =====

/**
 * Context provider + notice sheet shell around IAP children.
 * @param {{ notice: object|null, onCloseNotice: Function, value: object, children: React.ReactNode }} props
 */
function IapProPlanProviderShell({
  notice,
  onCloseNotice,
  value,
  children
}) {
  const noticeIsVisible = !!notice;
  const noticeTitle = (notice == null ? void 0 : notice.title) || '';
  const noticeConfirmLabel = (notice == null ? void 0 : notice.confirmLabel) || DEFAULT_NOTICE_CONFIRM_LABEL;
  return <SubscriptionContext.Provider value={value}>
      {children}
      <NbNoticeSheet visible={noticeIsVisible} onClose={onCloseNotice} title={noticeTitle} message={notice == null ? void 0 : notice.message} confirmLabel={noticeConfirmLabel} cancelLabel={notice == null ? void 0 : notice.cancelLabel} onConfirm={notice == null ? void 0 : notice.onConfirm} />
    </SubscriptionContext.Provider>;
}

// ===== MAIN FUNCTION =====

/**
 * Real App Store IAP + Firestore subscription mirror for Trainer Pro.
 * Hook order is frozen — do not reorder state / effects / memos.
 * @param {{ userId: string|null|undefined, children: React.ReactNode }} props
 */
export function IapProPlanSetup({
  userId,
  children
}) {
  // Hook order frozen: six state slots → showNotice → dedupe ref → useIAP → Firestore → products → access → purchase/restore → context value.
  const [firestoreSubscription, setFirestoreSubscription] = useState(null);
  const [firestoreLoading, setFirestoreLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [productsAttempted, setProductsAttempted] = useState(false);
  const [notice, setNotice] = useState(null);
  const showNotice = useCallback((title, message, extras = {}) => {
    setNotice({
      title,
      message,
      ...extras
    });
  }, []);

  // Dedup set so a StoreKit double-callback does not verify the same receipt twice.
  const purchaseIdsAlreadyVerifying = useRef(new Set());
  const {
    connected: storeKitIsConnected,
    subscriptions: storeKitSubscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction
  } = useIAP({
    onPurchaseSuccess: async purchase => {
      await handlePurchaseSuccess({
        purchase,
        finishTransaction,
        purchaseIdsAlreadyVerifying,
        setActionLoading,
        setLastError
      });
    },
    onPurchaseError: error => {
      applyPurchaseErrorToState(error, setLastError);
    },
    onError: error => {
      warnIapDevError(error);
    }
  });

  // 1. Mirror users/{uid}.subscription from Firestore for access gating elsewhere.
  useEffect(() => {
    const missingUserOrDb = !userId || !db;
    if (missingUserOrDb) {
      setFirestoreSubscription(null);
      setFirestoreLoading(false);
      return undefined;
    }
    setFirestoreLoading(true);
    const userDocRef = doc(db, FIRESTORE_USERS_COLLECTION, userId);
    const unsubscribe = onSnapshot(userDocRef, snapshot => {
      applyFirestoreUserSnapshot(snapshot, setFirestoreSubscription, setFirestoreLoading);
    }, () => {
      setFirestoreLoading(false);
    });
    return unsubscribe;
  }, [userId]);
  const loadStoreProducts = useCallback(async () => {
    await fetchSubscriptionProductsFromStore({
      storeKitIsConnected,
      fetchProducts,
      setProductsAttempted,
      setLastError
    });
  }, [storeKitIsConnected, fetchProducts]);

  // 2. Once StoreKit connects on iOS, pull subscription SKUs from the App Store.
  useEffect(() => {
    const readyToFetchOnIos = storeKitIsConnected && Platform.OS === IOS_PLATFORM;
    if (!readyToFetchOnIos) {
      return;
    }
    loadStoreProducts();
  }, [storeKitIsConnected, loadStoreProducts]);
  const accessState = useMemo(() => resolveSubscriptionAccess(firestoreSubscription), [firestoreSubscription]);
  const storeProducts = useMemo(() => mapKnownSubscriptionProducts(storeKitSubscriptions), [storeKitSubscriptions]);
  const storeProduct = useMemo(() => storeProducts[TRAINER_PRO_MONTHLY_PRODUCT_ID] || null, [storeProducts]);

  // 3. Primary CTA — request purchase for monthly (or explicit product id) after products load.
  const startFreeTrial = useCallback(async productId => {
    await requestProSubscriptionPurchase({
      productId,
      storeKitIsConnected,
      storeProducts,
      storeKitSubscriptions,
      loadStoreProducts,
      requestPurchase,
      setActionLoading,
      setLastError,
      showNotice
    });
  }, [storeKitIsConnected, requestPurchase, storeProducts, loadStoreProducts, storeKitSubscriptions, showNotice]);

  // 4. Restore — query local entitlements, verify on server, show notice sheet.
  const restorePurchases = useCallback(async () => {
    return restoreProSubscriptionPurchases({
      setActionLoading,
      setLastError,
      showNotice
    });
  }, [showNotice]);
  const clearError = useCallback(() => setLastError(null), []);
  const value = useMemo(() => ({
    firestoreSubscription,
    firestoreLoading,
    actionLoading,
    lastError,
    clearError,
    accessState,
    storeProduct,
    storeProducts,
    connected: storeKitIsConnected,
    productsAttempted,
    startFreeTrial,
    restorePurchases,
    retryLastAction: startFreeTrial,
    refreshProducts: loadStoreProducts
  }), [firestoreSubscription, firestoreLoading, actionLoading, lastError, clearError, accessState, storeProduct, storeProducts, storeKitIsConnected, productsAttempted, startFreeTrial, restorePurchases, loadStoreProducts]);
  return <IapProPlanProviderShell notice={notice} onCloseNotice={() => setNotice(null)} value={value}>
      {children}
    </IapProPlanProviderShell>;
}

// PLUMBING — skip unless debugging

function productSkuFromStoreItem(product) {
  return String((product == null ? void 0 : product.id) || (product == null ? void 0 : product.productId) || '').trim();
}
function productSkuFromPurchase(purchase) {
  return String((purchase == null ? void 0 : purchase.productId) || (purchase == null ? void 0 : purchase.id) || '').trim();
}
function purchaseDedupeKey(purchase) {
  return (purchase == null ? void 0 : purchase.transactionId) || (purchase == null ? void 0 : purchase.purchaseToken) || productSkuFromPurchase(purchase);
}
async function handlePurchaseSuccess({
  purchase,
  finishTransaction,
  purchaseIdsAlreadyVerifying,
  setActionLoading,
  setLastError
}) {
  const dedupeKey = purchaseDedupeKey(purchase);
  const alreadyProcessing = dedupeKey && purchaseIdsAlreadyVerifying.current.has(dedupeKey);
  if (alreadyProcessing) {
    return;
  }
  if (dedupeKey) {
    purchaseIdsAlreadyVerifying.current.add(dedupeKey);
  }
  try {
    setActionLoading(true);
    setLastError(null);
    await verifyPurchaseThenFinishTransaction(purchase, finishTransaction);
  } catch (error) {
    setLastError(errorStateForFailedPurchase(error));
  } finally {
    setActionLoading(false);
    if (dedupeKey) {
      purchaseIdsAlreadyVerifying.current.delete(dedupeKey);
    }
  }
}
async function verifyPurchaseThenFinishTransaction(purchase, finishTransaction) {
  await verifyAppleSubscriptionOnServer(purchase);
  try {
    await finishTransaction({
      purchase,
      isConsumable: false
    });
  } catch (finishError) {
    warnFinishTransactionDevError(finishError);
  }
}
function applyPurchaseErrorToState(error, setLastError) {
  if (purchaseWasUserCancelled(error)) {
    return;
  }
  const errorIsNetworkFailure = purchaseErrorIsNetwork(error);
  const errorType = errorIsNetworkFailure ? 'network' : 'generic';
  setLastError({
    type: errorType,
    message: (error == null ? void 0 : error.message) || 'Purchase failed'
  });
}
function applyFirestoreUserSnapshot(snapshot, setFirestoreSubscription, setFirestoreLoading) {
  const userData = snapshot.exists() ? snapshot.data() : null;
  setFirestoreSubscription((userData == null ? void 0 : userData.subscription) || null);
  setFirestoreLoading(false);
}
async function fetchSubscriptionProductsFromStore({
  storeKitIsConnected,
  fetchProducts,
  setProductsAttempted,
  setLastError
}) {
  if (Platform.OS !== IOS_PLATFORM) {
    return;
  }
  if (!storeKitIsConnected) {
    setLastError({
      type: 'network',
      message: 'App Store not connected yet. Wait a moment, then try again.'
    });
    return;
  }
  setProductsAttempted(true);
  try {
    await fetchProducts({
      skus: TRAINER_SUBSCRIPTION_PRODUCT_IDS,
      type: SUBSCRIPTION_PRODUCT_TYPE
    });
    setLastError(null);
  } catch (error) {
    warnFetchProductsDevError(error);
    setLastError({
      type: 'generic',
      message: `Could not load subscriptions from the App Store. Confirm ${TRAINER_PRO_MONTHLY_PRODUCT_ID} is Ready to Submit in App Store Connect, and this device is signed into a Sandbox Apple ID.`
    });
  }
}
async function requestProSubscriptionPurchase({
  productId,
  storeKitIsConnected,
  storeProducts,
  storeKitSubscriptions,
  loadStoreProducts,
  requestPurchase,
  setActionLoading,
  setLastError,
  showNotice
}) {
  const storeKitSku = skuForPurchaseRequest(productId);
  if (Platform.OS !== IOS_PLATFORM) {
    showNotice(NOTICE_UNAVAILABLE_TITLE, 'Subscriptions are available on iOS.');
    return;
  }
  if (!storeKitIsConnected) {
    setLastError({
      type: 'network',
      message: 'Store not connected. Check your connection and try again.'
    });
    return;
  }
  if (!storeProducts[storeKitSku]) {
    try {
      await loadStoreProducts();
    } catch (ignoredError) {
      /* lastError already set inside loadStoreProducts */
    }
  }
  const skuStillMissing = isSkuMissingFromStore(storeProducts, storeKitSubscriptions, storeKitSku);
  if (skuStillMissing) {
    setLastError(errorForMissingSku(storeKitSku));
    return;
  }
  setActionLoading(true);
  setLastError(null);
  try {
    await requestPurchase({
      request: {
        apple: {
          sku: storeKitSku
        },
        ios: {
          sku: storeKitSku
        }
      },
      type: SUBSCRIPTION_PRODUCT_TYPE
    });
  } catch (error) {
    applyRequestPurchaseCatch(error, storeKitSku, setLastError);
  } finally {
    setActionLoading(false);
  }
}
function applyRequestPurchaseCatch(error, storeKitSku, setLastError) {
  if (purchaseWasUserCancelled(error)) {
    return;
  }
  if (errorMessageSaysSkuNotFound(error)) {
    setLastError(errorForSkuMissingInConnect(storeKitSku));
    return;
  }
  const errorIsNetworkFailure = (error == null ? void 0 : error.code) === ErrorCode.NetworkError;
  const errorType = errorIsNetworkFailure ? 'network' : 'generic';
  setLastError({
    type: errorType,
    message: (error == null ? void 0 : error.message) || 'Could not start purchase'
  });
}
async function restoreProSubscriptionPurchases({
  setActionLoading,
  setLastError,
  showNotice
}) {
  if (Platform.OS !== IOS_PLATFORM) {
    showNotice(NOTICE_UNAVAILABLE_TITLE, 'Restore is available on iOS.');
    return false;
  }
  setActionLoading(true);
  setLastError(null);
  try {
    await tryRestorePurchasesIapQuietly();
    const availablePurchases = await getAvailablePurchasesDirect({
      onlyIncludeActiveItemsIOS: true
    });
    const matchingProPurchases = filterProSubscriptionPurchases(availablePurchases);
    if (!matchingProPurchases.length) {
      showNotice(NOTICE_NO_SUBSCRIPTION_TITLE, 'We could not find an active Coach Connect Pro subscription for this Apple ID.');
      return false;
    }
    await restoreAppleSubscriptionOnServer(matchingProPurchases);
    showNotice(NOTICE_RESTORED_TITLE, 'Your subscription has been restored.');
    return true;
  } catch (error) {
    return applyRestoreCatch(error, setLastError, showNotice);
  } finally {
    setActionLoading(false);
  }
}
function applyRestoreCatch(error, setLastError, showNotice) {
  if ((error == null ? void 0 : error.code) === ERROR_NOT_FOUND) {
    showNotice(NOTICE_NO_SUBSCRIPTION_TITLE, error.message || 'No active subscription to restore.');
    return false;
  }
  setLastError(errorStateForFailedRestore(error));
  return false;
}
function errorStateForFailedPurchase(error) {
  const errorCode = (error == null ? void 0 : error.code) || 'purchase_failed';
  if (errorCode === ERROR_VERIFICATION_FAILED) {
    return {
      type: 'verification',
      message: 'Purchase verification failed. Contact support if this continues.'
    };
  }
  if (errorCode === ERROR_NETWORK) {
    return {
      type: 'network',
      message: error.message || 'Network error'
    };
  }
  return {
    type: 'generic',
    message: (error == null ? void 0 : error.message) || 'Purchase failed'
  };
}
function errorStateForFailedRestore(error) {
  const errorCode = (error == null ? void 0 : error.code) || 'restore_failed';
  if (errorCode === ERROR_VERIFICATION_FAILED) {
    return {
      type: 'verification',
      message: 'Could not verify restored purchases. Contact support.'
    };
  }
  if (errorCode === ERROR_NETWORK) {
    return {
      type: 'network',
      message: error.message || 'Network error'
    };
  }
  return {
    type: 'generic',
    message: (error == null ? void 0 : error.message) || 'Restore failed'
  };
}
function purchaseWasUserCancelled(error) {
  const errorCode = error == null ? void 0 : error.code;
  const cancelledByExpo = errorCode === ErrorCode.UserCancelled;
  const cancelledByLegacyCode = String(errorCode || '') === ERROR_USER_CANCELLED_LEGACY;
  return cancelledByExpo || cancelledByLegacyCode;
}
function purchaseErrorIsNetwork(error) {
  const isExpoNetwork = (error == null ? void 0 : error.code) === ErrorCode.NetworkError;
  const codeLooksLikeNetwork = String((error == null ? void 0 : error.code) || '').includes('NETWORK');
  return isExpoNetwork || codeLooksLikeNetwork;
}
function errorMessageSaysSkuNotFound(error) {
  const messageText = String((error == null ? void 0 : error.message) || '');
  return /sku not found/i.test(messageText) || /product.*(not found|invalid)/i.test(messageText);
}
function errorForMissingSku(storeKitSku) {
  return {
    type: 'generic',
    message: `SKU not found: "${storeKitSku}". In App Store Connect → your app → Subscriptions, create/open the subscription whose Product ID is exactly "${storeKitSku}" (and "${TRAINER_SUBSCRIPTION_PRODUCT_IDS.join('" / "')}"). Status must not be Missing Metadata. Paid Apps Agreement must be Active.`
  };
}
function errorForSkuMissingInConnect(storeKitSku) {
  return {
    type: 'generic',
    message: `SKU not found: "${storeKitSku}". Open App Store Connect → Monetization → Subscriptions and confirm a Product ID of exactly "${storeKitSku}" exists.`
  };
}
function mapKnownSubscriptionProducts(storeKitSubscriptions) {
  const productsBySku = {};
  for (const subscription of storeKitSubscriptions || []) {
    const storeKitSku = productSkuFromStoreItem(subscription);
    if (TRAINER_SUBSCRIPTION_PRODUCT_IDS.includes(storeKitSku)) {
      productsBySku[storeKitSku] = subscription;
    }
  }
  return productsBySku;
}
function filterProSubscriptionPurchases(purchases) {
  return (purchases || []).filter(purchase => TRAINER_SUBSCRIPTION_PRODUCT_IDS.includes(productSkuFromPurchase(purchase)));
}
function skuForPurchaseRequest(productId) {
  if (TRAINER_SUBSCRIPTION_PRODUCT_IDS.includes(productId)) {
    return productId;
  }
  return TRAINER_PRO_MONTHLY_PRODUCT_ID;
}
function isSkuMissingFromStore(storeProducts, storeKitSubscriptions, storeKitSku) {
  var _optFn;
  if (storeProducts[storeKitSku]) {
    return false;
  }
  const foundInRawList = (_optFn = storeKitSubscriptions == null ? void 0 : storeKitSubscriptions.some) == null ? void 0 : _optFn(subscription => productSkuFromStoreItem(subscription) === storeKitSku);
  return !foundInRawList;
}
async function tryRestorePurchasesIapQuietly() {
  try {
    await restorePurchasesIap();
  } catch (restoreHookError) {
    warnRestoreHookDevError(restoreHookError);
  }
}
function warnIapDevError(error) {
  if (!__DEV__) {
    return;
  }
  console.warn('[ProPlanSetup] IAP error:', (error == null ? void 0 : error.message) || error);
}
function warnFinishTransactionDevError(finishError) {
  if (!__DEV__) {
    return;
  }
  console.warn('[ProPlanSetup] finishTransaction:', (finishError == null ? void 0 : finishError.message) || finishError);
}
function warnFetchProductsDevError(error) {
  if (!__DEV__) {
    return;
  }
  console.warn('[ProPlanSetup] fetchProducts failed:', (error == null ? void 0 : error.message) || error);
}
function warnRestoreHookDevError(restoreHookError) {
  if (!__DEV__) {
    return;
  }
  console.warn('[ProPlanSetup] restorePurchasesIap:', (restoreHookError == null ? void 0 : restoreHookError.message) || restoreHookError);
}
