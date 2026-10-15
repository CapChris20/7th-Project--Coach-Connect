// Boot loading lock — one overlay stays mounted for the whole cold start
// so the loader never remounts between App → LoginGate → ClientAppStart.
// Flow: provider starts held → screens acquire/release → overlay opacity toggles, animation keeps running.
// Used by: App.js (provider + overlay), LoginGate and ClientAppStart (lock while that tree is booting).

import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingBarAnimation from './LoadingBarAnimation';

// ===== NAMED CONSTANTS =====

// Starts at 1 so the overlay is visible on first paint, before any screen has acquired a lock.
const INITIAL_LOCK_COUNT = 1;
// Manipulate here: bar width on the boot splash.
const LOADING_BAR_WIDTH = 300;
const STATUS_BAR_STYLE_LIGHT = 'light-content';

const StartupLoadingCoverContext = createContext({
  acquire: () => {},
  release: () => {},
  visible: true,
});

// ===== HELPER FUNCTIONS =====

/**
 * @param {number} lockCount
 * @returns {number}
 */
function decrementLockCount(lockCount) {
  return Math.max(0, lockCount - 1);
}

function applyCoverLock(active, isHoldingCover, acquire, release) {
  if (active && !isHoldingCover.current) {
    acquire();
    isHoldingCover.current = true;
    return;
  }
  if (!active && isHoldingCover.current) {
    release();
    isHoldingCover.current = false;
  }
}

function releaseCoverIfHolding(isHoldingCover, release) {
  if (!isHoldingCover.current) return;
  release();
  isHoldingCover.current = false;
}

// ===== MAIN FUNCTION =====

/**
 * Holds the lock count and whether the shared overlay should show.
 * @param {{ children: * }} props
 */
export function StartupLoadingCoverProvider({ children }) {
  const lockCountRef = useRef(INITIAL_LOCK_COUNT);
  const [visible, setVisible] = useState(true);

  const acquire = useCallback(() => {
    lockCountRef.current += 1;
    setVisible(true);
  }, []);

  const release = useCallback(() => {
    lockCountRef.current = decrementLockCount(lockCountRef.current);
    setVisible(lockCountRef.current > 0);
  }, []);

  const value = useMemo(() => ({ acquire, release, visible }), [acquire, release, visible]);

  // 1. acquire adds a holder. release drops one. visible is "at least one holder".
  // 2. Share those three with every screen under this provider.
  return <StartupLoadingCoverContext.Provider value={value}>{children}</StartupLoadingCoverContext.Provider>;
}

/**
 * Read acquire / release / visible from the boot overlay provider.
 * @returns {{ acquire: Function, release: Function, visible: boolean }}
 */
export function useStartupLoadingCover() {
  // 1. Read acquire / release / visible from the nearest provider.
  return useContext(StartupLoadingCoverContext);
}

/**
 * Hold the boot overlay while `active` is true.
 * @param {boolean} active
 */
export function useStartupLoadingCoverLock(active) {
  const { acquire, release } = useStartupLoadingCover();
  const isHoldingCover = useRef(false);

  // vocab: useLayoutEffect = run before the browser paints, so the overlay is on before the first frame.
  useLayoutEffect(() => {
    // 1. Acquire when this screen needs the overlay. Release when it does not.
    applyCoverLock(active, isHoldingCover, acquire, release);
    return () => {
      releaseCoverIfHolding(isHoldingCover, release);
    };
  }, [active, acquire, release]);
}

/**
 * Always mounted. Opacity toggles only — animation keeps running.
 * @returns {React.ReactElement}
 */
export function StartupLoadingCoverOverlay() {
  const { visible } = useStartupLoadingCover();

  // 1. Stay mounted. Hide with opacity so the bar keeps looping while lockCount is 0.
  return (
    <View
      style={[styles.overlay, !visible && styles.hidden]}
      pointerEvents={visible ? 'auto' : 'none'}
      collapsable={false}
    >
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle={STATUS_BAR_STYLE_LIGHT} />
        <View style={styles.content}>
          <LoadingBarAnimation width={LOADING_BAR_WIDTH} />
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * Suspense fallback that keeps the shared overlay locked.
 * @returns {React.ReactElement}
 */
export function BootSuspenseFallback() {
  // 1. Hold the overlay for the whole lazy-load, and paint a matching dark fill underneath.
  useStartupLoadingCoverLock(true);
  return <View style={styles.fill} />;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  hidden: {
    opacity: 0,
  },
  fill: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  screen: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});
