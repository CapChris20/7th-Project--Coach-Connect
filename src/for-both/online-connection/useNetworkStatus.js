// Live online/offline flag for Design Law OfflineBanner.
// Flow: load NetInfo only when the native bridge exists → isOffline + refresh() for Retry.
// Used by ClientMainScreen / TrainerMainScreen shells.
// Why lazy require: a bare `import NetInfo` CRASHES when this Expo binary was built
//   without RNCNetInfo — treat the phone as online and skip the banner instead.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { NativeModules, Platform } from 'react-native';

// ===== NAMED CONSTANTS =====

// vocab: RNCNetInfo = bridged native object @react-native-community/netinfo expects
const NATIVE_NETINFO_MODULE_KEY = 'RNCNetInfo';
// Older Expo Go / community builds sometimes expose this alternate key instead.
const LEGACY_NETINFO_MODULE_KEY = 'RNNetInfo';

// ===== HELPER FUNCTIONS =====

/**
 * True when this binary can talk to a NetInfo native module (or we are on web).
 * @returns {boolean}
 */
function nativeNetInfoBridgeExists() {
  const hasModernBridge = Boolean(NativeModules?.[NATIVE_NETINFO_MODULE_KEY]);
  const hasLegacyBridge = Boolean(NativeModules?.[LEGACY_NETINFO_MODULE_KEY]);
  const hasReactNativeBridge = hasModernBridge || hasLegacyBridge;
  const isWebWithNavigator =
    Platform.OS === 'web' && typeof navigator !== 'undefined';
  return hasReactNativeBridge || isWebWithNavigator;
}

/**
 * Require NetInfo only after the native bridge is present.
 * Returns null when missing so callers stay "online" instead of crashing login.
 * @returns {null | { fetch: Function, addEventListener: Function }}
 */
function loadNetInfoWhenNativeExists() {
  if (!nativeNetInfoBridgeExists() && Platform.OS !== 'web') {
    return null;
  }

  try {
    // eslint-disable-next-line global-require
    const netInfoModule = require('@react-native-community/netinfo');
    // vocab/symbol: ?? = use the right side only when left is null/undefined
    const netInfoHandle = netInfoModule?.default ?? netInfoModule ?? null;
    const canFetchReachability = netInfoHandle && typeof netInfoHandle.fetch === 'function';
    if (!canFetchReachability) {
      return null;
    }
    return netInfoHandle;
  } catch (_loadError) {
    return null;
  }
}

/**
 * Offline when the OS says disconnected, or reachability is explicitly false.
 * Manipulate here: null isInternetReachable stays online (common brief iOS blip).
 * @param {object|null|undefined} reachabilityState
 * @returns {boolean}
 */
function phoneLooksOffline(reachabilityState) {
  const osSaysDisconnected = reachabilityState?.isConnected === false;
  const reachabilitySaysNoInternet = reachabilityState?.isInternetReachable === false;
  return osSaysDisconnected || reachabilitySaysNoInternet;
}

// ===== MAIN FUNCTION =====

/**
 * Live online/offline flag + Retry refresh for OfflineBanner.
 * @returns {{ isOffline: boolean, refreshing: boolean, refresh: () => Promise<void>, netInfoAvailable: boolean }}
 */
export default function useNetworkStatus() {
  // vocab: useState = React hook that holds a value across renders
  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Resolve NetInfo once per mount — avoid re-require thrash on every render.
  // vocab: useMemo = run the factory once (empty deps) and reuse the result
  const netInfo = useMemo(() => loadNetInfoWhenNativeExists(), []);

  // vocab: useEffect = run after paint; return a cleanup when the screen unmounts
  useEffect(() => {
    if (!netInfo) {
      return undefined;
    }

    let stillMounted = true;

    const applyReachabilityToBanner = (reachabilityState) => {
      if (!stillMounted) {
        return;
      }
      setIsOffline(phoneLooksOffline(reachabilityState));
    };

    // 1. Snapshot current reachability, then listen for Wi‑Fi / cellular changes.
    netInfo
      .fetch()
      .then(applyReachabilityToBanner)
      .catch(() => {
        // Missing reachability → stay online so OfflineBanner does not false-positive.
        if (stillMounted) {
          setIsOffline(false);
        }
      });

    const stopListening = netInfo.addEventListener(applyReachabilityToBanner);

    return () => {
      stillMounted = false;
      if (typeof stopListening === 'function') {
        stopListening();
      }
    };
  }, [netInfo]);

  // vocab: useCallback = stable function identity so child Retry buttons do not rebind every paint
  const refresh = useCallback(async () => {
    // 1. No native module in this binary — treat as online; rebuild client to enable the banner.
    if (!netInfo) {
      setIsOffline(false);
      return;
    }

    // 2. Re-fetch reachability for the Offline Retry chip.
    setRefreshing(true);
    try {
      const reachabilityState = await netInfo.fetch();
      setIsOffline(phoneLooksOffline(reachabilityState));
    } catch (_refreshError) {
      // Keep the last known offline/online flag — a failed Retry should not flip the banner.
    } finally {
      setRefreshing(false);
    }
  }, [netInfo]);

  // 3. Without NetInfo, never show OfflineBanner (bannerShowsOffline stays false).
  const bannerShowsOffline = netInfo ? isOffline : false;

  return {
    isOffline: bannerShowsOffline,
    refreshing,
    refresh,
    netInfoAvailable: Boolean(netInfo),
  };
}
