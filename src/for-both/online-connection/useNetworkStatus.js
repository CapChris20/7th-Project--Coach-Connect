// Live online/offline flag for Design Law OfflineBanner.
// Flow: load NetInfo only if the native module exists → isOffline + refresh() for Retry.
// Used by ClientMainScreen / TrainerMainScreen shells.
//
// vocab: NetInfo = @react-native-community/netinfo reachability listener
// Why lazy/require: a bare `import NetInfo` CRASHES when the current Expo
//   dev client was built without the native RNCNetInfo binary. Until you
//   rebuild the client (`npx expo prebuild` / EAS / pod install), we treat
//   the phone as online and skip the banner instead of taking down login.
// Manipulate here: treat null isInternetReachable as online (common on iOS briefly)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { NativeModules, Platform } from 'react-native';

// ===== HELPERS =====

/**
 * Safe NetInfo handle, or null when the native module is missing from this binary.
 * @returns {null | { fetch: Function, addEventListener: Function }}
 */
function loadNetInfoOrNull() {
  // vocab: NativeModules.RNCNetInfo = the bridged native object NetInfo needs
  // Some Expo Go / older clients expose the module under a slightly different key.
  const hasNativeBridge = Boolean(
    NativeModules?.RNCNetInfo ||
      NativeModules?.RNNetInfo ||
      (Platform.OS === 'web' && typeof navigator !== 'undefined'),
  );
  if (!hasNativeBridge && Platform.OS !== 'web') return null;
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const mod = require('@react-native-community/netinfo');
    const netInfo = mod?.default ?? mod ?? null;
    if (!netInfo || typeof netInfo.fetch !== 'function') return null;
    return netInfo;
  } catch (_err) {
    return null;
  }
}

/**
 * Offline when OS says disconnected, or reachability is explicitly false.
 * @param {object|null|undefined} state
 * @returns {boolean}
 */
function isOfflineFromState(state) {
  return state?.isConnected === false || state?.isInternetReachable === false;
}

// ===== MAIN =====

/**
 * @returns {{ isOffline: boolean, refreshing: boolean, refresh: () => Promise<void>, netInfoAvailable: boolean }}
 */
export default function useNetworkStatus() {
  const [isOffline, setIsOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // Resolve once per mount — avoid re-require thrash on every render
  const netInfo = useMemo(() => loadNetInfoOrNull(), []);

  useEffect(() => {
    if (!netInfo) return undefined;

    let mounted = true;
    const apply = (state) => {
      if (!mounted) return;
      setIsOffline(isOfflineFromState(state));
    };

    netInfo.fetch().then(apply).catch(() => {
      // Missing reachability → stay online so OfflineBanner does not false-positive
      if (mounted) setIsOffline(false);
    });
    const unsub = netInfo.addEventListener(apply);
    return () => {
      mounted = false;
      if (typeof unsub === 'function') unsub();
    };
  }, [netInfo]);

  const refresh = useCallback(async () => {
    if (!netInfo) {
      // No native module in this binary — treat as online; rebuild client to enable banner
      setIsOffline(false);
      return;
    }
    setRefreshing(true);
    try {
      const state = await netInfo.fetch();
      setIsOffline(isOfflineFromState(state));
    } catch (_err) {
      /* keep last known */
    } finally {
      setRefreshing(false);
    }
  }, [netInfo]);

  return {
    isOffline: netInfo ? isOffline : false,
    refreshing,
    refresh,
    netInfoAvailable: Boolean(netInfo),
  };
}
