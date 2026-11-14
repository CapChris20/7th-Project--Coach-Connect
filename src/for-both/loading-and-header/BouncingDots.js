// Five-dot bouncing loader (brand "thinking" spinner).
// Flow: one Animated.Value per dot → staggered rise/fall loops → jump + scale + purple fade overlay.
// Used for full-screen and inline "working on it" states.

import React from 'react';
import { StyleSheet, View, Animated } from 'react-native';

// ===== NAMED CONSTANTS =====

// Manipulate here: lower = faster bounce; higher = slow lava-lamp feel.
const BOUNCE_DURATION_MS = 800;
// Manipulate here: stagger between dots so they chase each other left → right.
const DOT_1_DELAY_MS = 100;
const DOT_2_DELAY_MS = 200;
const DOT_3_DELAY_MS = 300;
const DOT_4_DELAY_MS = 400;
const DOT_5_DELAY_MS = 500;
const DOT_STAGGER_DELAYS_MS = [
  DOT_1_DELAY_MS,
  DOT_2_DELAY_MS,
  DOT_3_DELAY_MS,
  DOT_4_DELAY_MS,
  DOT_5_DELAY_MS,
];
const DOT_COUNT = 5;
// Manipulate here: more negative = higher jump (raise styles.loader height to match).
const DOT_JUMP_PX = -48;
// Manipulate here: 1.9 ≈ double size at peak; toward 1 removes the pop.
const DOT_PEAK_SCALE = 1.9;
const DOT_REST_SCALE = 1;
const DOT_REST_COLOR = '#16b0c1';
const DOT_PEAK_COLOR = '#661e92';

// ===== HELPER FUNCTIONS =====

/**
 * Forever loop: delay → rise to 1 → fall to 0.
 * @param {Animated.Value} animatedValue
 * @param {number} delayMs
 * @returns {Animated.CompositeAnimation}
 */
function createDotBounceLoop(animatedValue, delayMs) {
  // vocab: Animated.loop + sequence = rise then fall, forever.
  // vocab: useNativeDriver = run on the UI thread so JS jank does not stutter motion.
  const riseAnimation = Animated.timing(animatedValue, {
    toValue: 1,
    duration: BOUNCE_DURATION_MS,
    delay: delayMs,
    useNativeDriver: true,
  });
  const fallAnimation = Animated.timing(animatedValue, {
    toValue: 0,
    duration: BOUNCE_DURATION_MS,
    delay: 0,
    useNativeDriver: true,
  });
  return Animated.loop(Animated.sequence([riseAnimation, fallAnimation]));
}

/**
 * Map a 0→1 driver into jump (translateY) and scale for one dot.
 * @param {Animated.Value} animatedValue
 */
function buildJumpAndScaleFromDriver(animatedValue) {
  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, DOT_JUMP_PX],
  });
  const scale = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [DOT_REST_SCALE, DOT_PEAK_SCALE],
  });
  return { translateY, scale };
}

/**
 * Start one bounce loop per driver using DOT_STAGGER_DELAYS_MS.
 * @param {Animated.Value[]} dotDrivers
 * @returns {Animated.CompositeAnimation[]}
 */
function startAllDotLoops(dotDrivers) {
  const runningLoops = [];
  for (let index = 0; index < dotDrivers.length; index += 1) {
    const delayMs = DOT_STAGGER_DELAYS_MS[index];
    const driver = dotDrivers[index];
    const loop = createDotBounceLoop(driver, delayMs);
    loop.start();
    runningLoops.push(loop);
  }
  return runningLoops;
}

/**
 * Stop every running loop (unmount cleanup).
 * @param {Animated.CompositeAnimation[]} runningLoops
 */
function stopAllDotLoops(runningLoops) {
  for (let index = 0; index < runningLoops.length; index += 1) {
    runningLoops[index].stop();
  }
}

/**
 * Build jump/scale motion objects for each driver (keeps .map out of the main recipe).
 * @param {Animated.Value[]} dotDrivers
 */
function buildMotionsForAllDots(dotDrivers) {
  const motions = [];
  for (let index = 0; index < dotDrivers.length; index += 1) {
    motions.push(buildJumpAndScaleFromDriver(dotDrivers[index]));
  }
  return motions;
}

// ===== SMALL LAYOUT PIECES =====

/**
 * One bouncing dot: teal base + purple overlay whose opacity follows the same driver.
 */
function BouncingDot({ translateY, scale, opacityDriver }) {
  const transformStyle = {
    transform: [{ translateY }, { scale }],
  };
  const overlayStyle = {
    opacity: opacityDriver,
    backgroundColor: DOT_PEAK_COLOR,
  };

  return (
    <Animated.View style={[styles.dot, transformStyle]}>
      <View style={[styles.dotBase, { backgroundColor: DOT_REST_COLOR }]} />
      <Animated.View style={[styles.dotOverlay, overlayStyle]} />
    </Animated.View>
  );
}

/**
 * Paint all five dots from pre-built motions + drivers.
 */
function FiveBouncingDotsRow({ motions, drivers }) {
  const dots = [];
  for (let index = 0; index < DOT_COUNT; index += 1) {
    const motion = motions[index];
    const opacityDriver = drivers[index];
    const dotKey = `bounce-dot-${index}`;
    dots.push(
      <BouncingDot
        key={dotKey}
        translateY={motion.translateY}
        scale={motion.scale}
        opacityDriver={opacityDriver}
      />,
    );
  }
  return <View style={styles.loader}>{dots}</View>;
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen (or flex:1) five-dot bouncing loader.
 * Hook order: five useState drivers → useEffect start/stop loops → paint.
 */
function Loader() {
  // vocab: useState(() => new Animated.Value(0)) = create the driver once; setter unused on purpose.
  const [dot1Driver] = React.useState(() => new Animated.Value(0));
  const [dot2Driver] = React.useState(() => new Animated.Value(0));
  const [dot3Driver] = React.useState(() => new Animated.Value(0));
  const [dot4Driver] = React.useState(() => new Animated.Value(0));
  const [dot5Driver] = React.useState(() => new Animated.Value(0));

  const dotDrivers = [dot1Driver, dot2Driver, dot3Driver, dot4Driver, dot5Driver];

  // Start loops after paint; stop on unmount so we do not leak native animations.
  // vocab: useEffect cleanup = return a function React runs when this component leaves the tree.
  React.useEffect(() => {
    const runningLoops = startAllDotLoops(dotDrivers);
    return () => {
      stopAllDotLoops(runningLoops);
    };
  }, [dot1Driver, dot2Driver, dot3Driver, dot4Driver, dot5Driver]);

  // 1. Five drivers, one per dot, created once each.
  // 2. Staggered bounce loops tied to DOT_STAGGER_DELAYS_MS.
  // 3. Paint five layered dots (teal base + purple opacity overlay).
  const dotMotions = buildMotionsForAllDots(dotDrivers);

  return (
    <View style={styles.container}>
      <FiveBouncingDotsRow motions={dotMotions} drivers={dotDrivers} />
    </View>
  );
}

export default Loader;

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  // Manipulate here: flex 1 = full-screen; remove for inline usage.
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // alignItems flex-end pins dots on the floor; height must cover dot + jump.
  loader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 68,
  },
  dot: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#212121',
    marginHorizontal: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  dotBase: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    backgroundColor: DOT_REST_COLOR,
  },
  dotOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    backgroundColor: DOT_PEAK_COLOR,
  },
});
