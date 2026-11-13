// Boot loading lock — one overlay stays mounted for the whole cold start
// so the loader never remounts between App → LoginGate → ClientAppStart.
// Flow: provider starts held → screens acquire/release → overlay opacity toggles, animation keeps running.
// Used by: App.js (provider + overlay), LoginGate and ClientAppStart (lock while that tree is booting).

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingBarAnimation from './LoadingBarAnimation';

// ===== NAMED CONSTANTS =====

// Starts at 1 so the overlay is visible on first paint, before any screen has acquired a lock.
const INITIAL_LOCK_COUNT = 1;
// Manipulate here: bar width on the boot splash.
const LOADING_BAR_WIDTH = 280;
const STATUS_BAR_STYLE_LIGHT = 'light-content';
const LOADING_COPY = 'Loading your plan and logs';
const BRAND_LINE_1 = 'COACH';
const BRAND_LINE_2 = 'CONNECT';
const BRAND_TAGLINE = 'One Day or Day One!';

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

/** Three bouncing squares under the brand (loading-and-errors PNG 01). */
function BouncingDots() {
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const c = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (value, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: 280, useNativeDriver: true }),
          Animated.delay(420),
        ]),
      );
    const anims = [bounce(a, 0), bounce(b, 120), bounce(c, 240)];
    anims.forEach((x) => x.start());
    return () => anims.forEach((x) => x.stop());
  }, [a, b, c]);

  const styleFor = (value, offsetY) => ({
    transform: [
      {
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -10 - offsetY],
        }),
      },
    ],
  });

  return (
    <View style={styles.dotsRow}>
      <Animated.View style={[styles.dot, styleFor(a, 0)]} />
      <Animated.View style={[styles.dot, styles.dotMid, styleFor(b, 2)]} />
      <Animated.View style={[styles.dot, styles.dotLow, styleFor(c, 4)]} />
    </View>
  );
}

/**
 * Always mounted. Opacity toggles only — animation keeps running.
 * @returns {React.ReactElement}
 */
export function StartupLoadingCoverOverlay() {
  const { visible } = useStartupLoadingCover();

  // 1. Stay mounted. Hide with opacity so the bar keeps looping while lockCount is 0.
  // 2. Poster brand + bouncing dots + prism bar match Design Law startup PNG.
  return (
    <View
      style={[styles.overlay, !visible && styles.hidden]}
      pointerEvents={visible ? 'auto' : 'none'}
      collapsable={false}
    >
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle={STATUS_BAR_STYLE_LIGHT} />
        <View style={styles.poster}>
          <View style={styles.brandBlock}>
            <Text style={styles.brand}>{BRAND_LINE_1}</Text>
            <Text style={styles.brand}>{BRAND_LINE_2}</Text>
            <Text style={styles.tagline}>{BRAND_TAGLINE}</Text>
          </View>
          <View style={styles.loaderBlock}>
            <BouncingDots />
            <LoadingBarAnimation width={LOADING_BAR_WIDTH} />
            <Text style={styles.loadingCopy}>{LOADING_COPY}</Text>
          </View>
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
  },
  poster: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 56,
    justifyContent: 'space-between',
  },
  brandBlock: { gap: 4 },
  brand: {
    color: '#FFFFFF',
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.2,
    lineHeight: 48,
  },
  tagline: {
    marginTop: 10,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  loaderBlock: { gap: 14, alignItems: 'flex-start' },
  dotsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 28 },
  dot: { width: 10, height: 10, backgroundColor: '#FFFFFF', borderRadius: 2 },
  dotMid: { marginBottom: 4 },
  dotLow: { marginBottom: 8 },
  loadingCopy: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
