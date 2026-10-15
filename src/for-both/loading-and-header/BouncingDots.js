// Five-dot bouncing loader (the brand "thinking" spinner).
// Flow: one Animated.Value per dot → each loops 0→1→0 on a staggered delay →
//       that 0..1 number is mapped into a vertical jump + a scale-up + a purple fade-in.
// Used anywhere a full-screen/inline "working on it" state is needed.

import React from 'react';
import { StyleSheet, View, Animated } from 'react-native';

// ===== NAMED CONSTANTS =====

// Manipulate here: lower duration = faster, more frantic bounce; raise = slow lava-lamp feel.
const BOUNCE_DURATION_MS = 800;
// Manipulate here: widen these gaps for a lazier wave, tighten them for a tighter ripple.
const DOT_1_DELAY_MS = 100;
const DOT_2_DELAY_MS = 200;
const DOT_3_DELAY_MS = 300;
const DOT_4_DELAY_MS = 400;
const DOT_5_DELAY_MS = 500;
// Manipulate here: bigger negative number = higher jump (styles.loader height must grow to match).
const DOT_JUMP_PX = -48;
// Manipulate here: 1.9 = nearly double size at the top; drop toward 1 to remove the pop.
const DOT_PEAK_SCALE = 1.9;
const DOT_REST_SCALE = 1;
const DOT_REST_COLOR = '#16b0c1';
const DOT_PEAK_COLOR = '#661e92';

// ===== HELPER FUNCTIONS =====

/**
 * One forever-bounce: rise to 1, settle back to 0, repeat.
 * The delay is what makes the dots look like a wave instead of all jumping together.
 * vocab: Animated.loop = replay the inner animation endlessly
 * vocab: Animated.sequence = run these steps one after another (not at the same time)
 * vocab: useNativeDriver = hand the animation to the native UI thread so JS lag cannot stutter it
 * @param {Animated.Value} animatedValue
 * @param {number} delayMs
 */
function createDotBounceLoop(animatedValue, delayMs) {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: BOUNCE_DURATION_MS,
        delay: delayMs,
        useNativeDriver: true,
      }),
      // Down leg has no delay, otherwise the dot would hang in mid-air.
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: BOUNCE_DURATION_MS,
        delay: 0,
        useNativeDriver: true,
      }),
    ]),
  );
}

/**
 * Translate the raw 0..1 driver into hop + pop. Runs as Animated interpolations on the UI thread.
 * vocab: interpolate = when the driver goes from inputRange[0]→[1], move this style from outputRange[0]→[1]
 * @param {Animated.Value} animatedValue
 */
function interpolateDotMotion(animatedValue) {
  return {
    translateY: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0, DOT_JUMP_PX],
    }),
    scale: animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [DOT_REST_SCALE, DOT_PEAK_SCALE],
    }),
  };
}

/**
 * Three-layer sandwich: hop wrapper, always-visible teal circle, purple overlay whose opacity IS the 0..1 driver.
 * Manipulate here: swap DOT_REST_COLOR / DOT_PEAK_COLOR to rebrand.
 * @param {object} props
 */
function startStaggeredDotLoops(dot1Anim, dot2Anim, dot3Anim, dot4Anim, dot5Anim) {
  const animations = [
    createDotBounceLoop(dot1Anim, DOT_1_DELAY_MS),
    createDotBounceLoop(dot2Anim, DOT_2_DELAY_MS),
    createDotBounceLoop(dot3Anim, DOT_3_DELAY_MS),
    createDotBounceLoop(dot4Anim, DOT_4_DELAY_MS),
    createDotBounceLoop(dot5Anim, DOT_5_DELAY_MS),
  ];
  for (let i = 0; i < animations.length; i += 1) {
    animations[i].start();
  }
  return animations;
}

function stopStaggeredDotLoops(animations) {
  for (let i = 0; i < animations.length; i += 1) {
    animations[i].stop();
  }
}

function BouncingDot({ translateY, scale, opacityDriver }) {
  return (
    <Animated.View
      style={[
        styles.dot,
        {
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <View style={[styles.dotBase, { backgroundColor: DOT_REST_COLOR }]} />
      <Animated.View
        style={[
          styles.dotOverlay,
          {
            opacity: opacityDriver,
            backgroundColor: DOT_PEAK_COLOR,
          },
        ]}
      />
    </Animated.View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Brand five-dot bounce. Each dot's Animated.Value is created once and kept for the component's life.
 */
function Loader() {
  // vocab: Animated.Value = a number React Native can animate on the native side without re-rendering React
  // vocab: React.useState(new Animated.Value(0)) = make this value once and keep it (we never use the setter)
  const [dot1Anim] = React.useState(new Animated.Value(0));
  const [dot2Anim] = React.useState(new Animated.Value(0));
  const [dot3Anim] = React.useState(new Animated.Value(0));
  const [dot4Anim] = React.useState(new Animated.Value(0));
  const [dot5Anim] = React.useState(new Animated.Value(0));

  // Why an effect: starting animations during render would leak a running loop on every re-render.
  // vocab: React.useEffect = hook that runs after paint, and runs its returned function on cleanup
  React.useEffect(() => {
    const animations = startStaggeredDotLoops(dot1Anim, dot2Anim, dot3Anim, dot4Anim, dot5Anim);
    return () => {
      stopStaggeredDotLoops(animations);
    };
  }, [dot1Anim, dot2Anim, dot3Anim, dot4Anim, dot5Anim]);

  const dot1Motion = interpolateDotMotion(dot1Anim);
  const dot2Motion = interpolateDotMotion(dot2Anim);
  const dot3Motion = interpolateDotMotion(dot3Anim);
  const dot4Motion = interpolateDotMotion(dot4Anim);
  const dot5Motion = interpolateDotMotion(dot5Anim);

  // 1. One Animated.Value per dot, created once.
  // 2. Start the staggered bounce loops after paint; stop them when we leave.
  // 3. Map each 0..1 driver into a hop + pop and paint five dots.
  return (
    <View style={styles.container}>
      <View style={styles.loader}>
        <BouncingDot translateY={dot1Motion.translateY} scale={dot1Motion.scale} opacityDriver={dot1Anim} />
        <BouncingDot translateY={dot2Motion.translateY} scale={dot2Motion.scale} opacityDriver={dot2Anim} />
        <BouncingDot translateY={dot3Motion.translateY} scale={dot3Motion.scale} opacityDriver={dot3Anim} />
        <BouncingDot translateY={dot4Motion.translateY} scale={dot4Motion.scale} opacityDriver={dot4Anim} />
        <BouncingDot translateY={dot5Motion.translateY} scale={dot5Motion.scale} opacityDriver={dot5Anim} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Manipulate here: `flex: 1` is what makes this a full-screen loader — remove it to use inline
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // alignItems flex-end pins dots to the floor. If you change DOT_JUMP_PX, change this height too.
  loader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 68, // 20px dot + 48px jump space
  },
  // overflow hidden + borderRadius keeps the purple overlay circular.
  // Manipulate here: height/width/borderRadius must stay in a 20/20/10 ratio to stay a circle
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
    backgroundColor: '#16b0c1',
  },
  dotOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    backgroundColor: '#661e92',
  },
});

export default Loader;
