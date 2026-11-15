// Boot loading lock — one overlay stays mounted for the whole cold start.
// Flow: provider counts locks → screens acquire/release → overlay opacity toggles; prism bar keeps looping.
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

// Starts at 1 so the overlay is visible on first paint, before any screen acquires a lock.
const INITIAL_LOCK_COUNT = 1;
// Manipulate here: bar width on the boot splash.
const LOADING_BAR_WIDTH = 280;
const STATUS_BAR_STYLE_LIGHT = 'light-content';
const LOADING_COPY = 'Loading App Now!';
const BRAND_LINE_1 = 'COACH';
const BRAND_LINE_2 = 'CONNECT';
const BRAND_TAGLINE = 'One Day or Day One!';

// Manipulate here: bounce timing for the three startup dots (loading-and-errors PNG 01).
const DOT_BOUNCE_UP_MS = 280;
const DOT_BOUNCE_DOWN_MS = 280;
const DOT_LOOP_PAUSE_MS = 420;
const DOT_TWO_DELAY_MS = 120;
const DOT_THREE_DELAY_MS = 240;
const DOT_LIFT_PX = 10;
const DOT_TWO_EXTRA_LIFT_PX = 2;
const DOT_THREE_EXTRA_LIFT_PX = 4;

// vocab: createContext = shared acquire/release/visible bag for every screen under the provider
const StartupLoadingCoverContext = createContext({
  acquire: () => { },
  release: () => { },
  visible: true,
});

// ===== HELPER FUNCTIONS =====
// Provider, lock hook, and poster pieces sit here; the always-mounted overlay is MAIN below.

/**
 * Holds the lock count and whether the shared overlay should show.
 * @param {{ children: * }} props
 */
export function StartupLoadingCoverProvider({ children }) {
  // vocab: useRef = mutable box that survives re-renders without painting again
  const lockCountRef = useRef(INITIAL_LOCK_COUNT);
  // vocab: useState = React state; changing it re-paints children that read `visible`
  const [overlayVisible, setOverlayVisible] = useState(true);

  // vocab: useCallback = stable function identity so child effects do not re-fire every paint
  const acquire = useCallback(() => {
    lockCountRef.current += 1;
    setOverlayVisible(true);
  }, []);

  const release = useCallback(() => {
    const countAfterRelease = lockCountAfterOneRelease(lockCountRef.current);
    lockCountRef.current = countAfterRelease;
    const atLeastOneHolderRemains = countAfterRelease > 0;
    setOverlayVisible(atLeastOneHolderRemains);
  }, []);

  // vocab: useMemo = rebuild the context value only when acquire/release/visible change
  const contextValue = useMemo(
    () => ({
      acquire,
      release,
      visible: overlayVisible,
    }),
    [acquire, release, overlayVisible],
  );

  // 1. acquire adds a holder; release drops one; visible means "at least one holder".
  // 2. Share acquire, release, and visible with every child under this provider.
  return (
    <StartupLoadingCoverContext.Provider value={contextValue}>
      {children}
    </StartupLoadingCoverContext.Provider>
  );
}

/**
 * Read acquire / release / visible from the boot overlay provider.
 * @returns {{ acquire: Function, release: Function, visible: boolean }}
 */
export function useStartupLoadingCover() {
  // vocab: useContext = read the nearest StartupLoadingCoverProvider value
  return useContext(StartupLoadingCoverContext);
}

/**
 * Hold the boot overlay while `active` is true.
 * @param {boolean} active
 */
export function useStartupLoadingCoverLock(active) {
  const { acquire, release } = useStartupLoadingCover();
  const isHoldingCoverRef = useRef(false);

  // vocab: useLayoutEffect = run before paint so the overlay is on before the first frame
  useLayoutEffect(() => {
    applyActiveFlagToCoverLock(active, isHoldingCoverRef, acquire, release);
    return () => dropCoverLockIfStillHeld(isHoldingCoverRef, release);
  }, [active, acquire, release]);
}

/** Three bouncing squares under the brand (loading-and-errors PNG 01). */
function BouncingDots() {
  const dotOneProgress = useRef(new Animated.Value(0)).current;
  const dotTwoProgress = useRef(new Animated.Value(0)).current;
  const dotThreeProgress = useRef(new Animated.Value(0)).current;

  // vocab: useEffect = start loops after mount; cleanup stops them when this unmounts
  useEffect(() => {
    const runningLoops = startAllThreeDotBounceLoops(
      dotOneProgress,
      dotTwoProgress,
      dotThreeProgress,
    );
    return () => stopAllDotBounceLoops(runningLoops);
  }, [dotOneProgress, dotTwoProgress, dotThreeProgress]);

  const dotOneStyle = translateStyleForDotProgress(dotOneProgress, 0);
  const dotTwoStyle = translateStyleForDotProgress(dotTwoProgress, DOT_TWO_EXTRA_LIFT_PX);
  const dotThreeStyle = translateStyleForDotProgress(dotThreeProgress, DOT_THREE_EXTRA_LIFT_PX);

  return (
    <View style={styles.dotsRow}>
      <Animated.View style={[styles.dot, dotOneStyle]} />
      <Animated.View style={[styles.dot, styles.dotMid, dotTwoStyle]} />
      <Animated.View style={[styles.dot, styles.dotLow, dotThreeStyle]} />
    </View>
  );
}

function BootBrandBlock() {
  return (
    <View style={styles.brandBlock}>
      <Text style={styles.brand}>{BRAND_LINE_1}</Text>
      <Text style={styles.brand}>{BRAND_LINE_2}</Text>
      <Text style={styles.tagline}>{BRAND_TAGLINE}</Text>
    </View>
  );
}

function BootLoaderBlock() {
  return (
    <View style={styles.loaderBlock}>
      <BouncingDots />
      <LoadingBarAnimation width={LOADING_BAR_WIDTH} />
      <Text style={styles.loadingCopy}>{LOADING_COPY}</Text>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Always mounted. Opacity toggles only — the prism animation keeps running underneath.
 * @returns {React.ReactElement}
 */
export function StartupLoadingCoverOverlay() {
  const { visible } = useStartupLoadingCover();
  const overlayIsHidden = !visible;
  const blockTouches = visible;
  const overlayStyleList = [styles.overlay];
  if (overlayIsHidden) {
    overlayStyleList.push(styles.hidden);
  }
  const touchMode = blockTouches ? 'auto' : 'none';

  // 1. Stay mounted; hide with opacity so the bar never restarts when lockCount hits 0.
  // 2. Poster brand + bouncing dots + prism bar match Design Law startup PNG.
  return (
    <View
      style={overlayStyleList}
      pointerEvents={touchMode}
      collapsable={false}
    >
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle={STATUS_BAR_STYLE_LIGHT} />
        <View style={styles.poster}>
          <BootBrandBlock />
          <BootLoaderBlock />
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
  // 1. Hold the overlay for the whole lazy load.
  // 2. Paint a dark fill underneath so nothing flashes white behind the poster.
  useStartupLoadingCoverLock(true);
  return <View style={styles.fill} />;
}

// ===== PLUMBING — skip unless debugging =====

function lockCountAfterOneRelease(lockCount) {
  if (lockCount <= 0) {
    return 0;
  }
  return lockCount - 1;
}

function applyActiveFlagToCoverLock(active, isHoldingCoverRef, acquire, release) {
  const alreadyHolding = isHoldingCoverRef.current;

  if (active && !alreadyHolding) {
    acquire();
    isHoldingCoverRef.current = true;
    return;
  }

  if (!active && alreadyHolding) {
    release();
    isHoldingCoverRef.current = false;
  }
}

function dropCoverLockIfStillHeld(isHoldingCoverRef, release) {
  if (!isHoldingCoverRef.current) {
    return;
  }
  release();
  isHoldingCoverRef.current = false;
}

function buildOneDotBounceLoop(dotValue, startDelayMs) {
  // vocab: Animated.loop / sequence = RN timing chain that repeats forever until stop()
  return Animated.loop(
    Animated.sequence([
      Animated.delay(startDelayMs),
      Animated.timing(dotValue, {
        toValue: 1,
        duration: DOT_BOUNCE_UP_MS,
        useNativeDriver: true,
      }),
      Animated.timing(dotValue, {
        toValue: 0,
        duration: DOT_BOUNCE_DOWN_MS,
        useNativeDriver: true,
      }),
      Animated.delay(DOT_LOOP_PAUSE_MS),
    ]),
  );
}

function startAllThreeDotBounceLoops(dotOneProgress, dotTwoProgress, dotThreeProgress) {
  const dotOneLoop = buildOneDotBounceLoop(dotOneProgress, 0);
  const dotTwoLoop = buildOneDotBounceLoop(dotTwoProgress, DOT_TWO_DELAY_MS);
  const dotThreeLoop = buildOneDotBounceLoop(dotThreeProgress, DOT_THREE_DELAY_MS);
  const runningLoops = [dotOneLoop, dotTwoLoop, dotThreeLoop];
  for (let loopIndex = 0; loopIndex < runningLoops.length; loopIndex += 1) {
    runningLoops[loopIndex].start();
  }
  return runningLoops;
}

function stopAllDotBounceLoops(runningLoops) {
  for (let loopIndex = 0; loopIndex < runningLoops.length; loopIndex += 1) {
    runningLoops[loopIndex].stop();
  }
}

function translateStyleForDotProgress(dotValue, extraLiftPx) {
  const peakLift = DOT_LIFT_PX + extraLiftPx;
  return {
    transform: [
      {
        // vocab: interpolate = map 0→1 progress into pixels of upward lift
        translateY: dotValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -peakLift],
        }),
      },
    ],
  };
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
