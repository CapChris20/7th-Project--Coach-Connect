// Five-dot bouncing loader (the brand "thinking" spinner).
// Flow: one Animated.Value per dot → each loops 0→1→0 on a staggered delay →
//       that 0..1 number is mapped into a vertical jump + a scale-up + a purple fade-in.
// Used anywhere a full-screen/inline "working on it" state is needed.

import React from 'react';
import { StyleSheet, View, Animated } from 'react-native';

const Loader = () => {
  // One driver value per dot. Each stays between 0 (resting on the floor) and 1 (top of its jump).
  // vocab: Animated.Value = a number React Native can animate on the native side without re-rendering React
  // vocab: React.useState(new Animated.Value(0)) = "make this value once and keep it for the component's life"
  //        (we only read the value, never the setter — that's why there's no second array slot)
  const [dot1Anim] = React.useState(new Animated.Value(0));
  const [dot2Anim] = React.useState(new Animated.Value(0));
  const [dot3Anim] = React.useState(new Animated.Value(0));
  const [dot4Anim] = React.useState(new Animated.Value(0));
  const [dot5Anim] = React.useState(new Animated.Value(0));

  // Start the bounce loops on mount and stop them on unmount.
  // Why an effect: animations are a side effect — starting them during render would
  // leak a running loop every time React re-renders this component.
  // vocab: React.useEffect = hook that runs after paint, and runs its returned function on cleanup
  React.useEffect(() => {
    // Builds one dot's forever-bounce: rise to 1, settle back to 0, repeat.
    // The `delay` is what makes the dots look like a wave instead of all jumping together.
    const animateDot = (animatedValue, delay) => {
      // vocab: Animated.loop = replay the inner animation endlessly
      // vocab: Animated.sequence = run these steps one after another (not at the same time)
      return Animated.loop(
        Animated.sequence([
          // Up leg: 0 → 1 over 800ms, after waiting out this dot's stagger delay.
          Animated.timing(animatedValue, {
            toValue: 1,
            // Manipulate here: lower duration = faster, more frantic bounce; raise = slow lava-lamp feel
            duration: 800,
            delay: delay,
            // vocab: useNativeDriver = hand the animation to the native UI thread so JS lag can't stutter it
            useNativeDriver: true,
          }),
          // Down leg: 1 → 0. No delay here, otherwise the dot would hang in mid-air.
          Animated.timing(animatedValue, {
            toValue: 0,
            duration: 800,
            delay: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Stagger the five dots 100ms apart so the bounce reads left-to-right as a wave.
    // Manipulate here: widen the gaps (100/300/500...) for a lazier wave, tighten them for a tighter ripple
    const animations = [
      animateDot(dot1Anim, 100),
      animateDot(dot2Anim, 200),
      animateDot(dot3Anim, 300),
      animateDot(dot4Anim, 400),
      animateDot(dot5Anim, 500),
    ];

    animations.forEach(anim => anim.start());

    // Cleanup: kill every loop when the loader leaves the screen.
    // Without this the loops keep ticking forever in the background.
    return () => {
      animations.forEach(anim => anim.stop());
    };
  }, [dot1Anim, dot2Anim, dot3Anim, dot4Anim, dot5Anim]);

  // Each dot's raw 0..1 value gets translated into two visual effects below.
  // vocab: interpolate = "when the driver value goes from inputRange[0]→[1], move this style from outputRange[0]→[1]"
  // The pattern repeats identically for dots 2–5; only the driver value changes.

  // Vertical hop: 0 = sitting on the baseline, 1 = 48px above it (negative Y is up).
  // Manipulate here: bigger negative number = higher jump (styles.loader height must grow to match)
  const dot1Transform = dot1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -48], // -3rem ≈ -48px
  });

  // Grow-at-the-peak effect, so the airborne dot reads as "closer" to the viewer.
  // Manipulate here: 1.9 = nearly double size at the top; drop toward 1 to remove the pop
  const dot1Scale = dot1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });

  const dot2Transform = dot2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -48],
  });

  const dot2Scale = dot2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });

  const dot3Transform = dot3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -48],
  });

  const dot3Scale = dot3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });

  const dot4Transform = dot4Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -48],
  });

  const dot4Scale = dot4Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });

  const dot5Transform = dot5Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -48],
  });

  const dot5Scale = dot5Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.9],
  });

  return (
    <View style={styles.container}>
      {/* Row of five dots, bottom-aligned so the jump reads as leaving the floor. */}
      <View style={styles.loader}>
        {/*
          Each dot is the same three-layer sandwich:
          1. Animated.View  — carries the hop (translateY) and the pop (scale)
          2. dotBase        — the always-visible teal circle
          3. dotOverlay     — a purple circle whose opacity IS the raw 0..1 driver value,
                              so the dot fades teal → purple as it rises and back on the way down.
          Manipulate here: swap '#16b0c1' (teal resting color) / '#661e92' (purple peak color) to rebrand.
        */}
        <Animated.View
          style={[
            styles.dot,
            {
              transform: [
                { translateY: dot1Transform },
                { scale: dot1Scale }
              ],
            }
          ]}
        >
          <View style={[styles.dotBase, { backgroundColor: '#16b0c1' }]} />
          <Animated.View 
            style={[
              styles.dotOverlay, 
              { 
                opacity: dot1Anim,
                backgroundColor: '#661e92'
              }
            ]} 
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.dot,
            {
              transform: [
                { translateY: dot2Transform },
                { scale: dot2Scale }
              ],
            }
          ]}
        >
          <View style={[styles.dotBase, { backgroundColor: '#16b0c1' }]} />
          <Animated.View 
            style={[
              styles.dotOverlay, 
              { 
                opacity: dot2Anim,
                backgroundColor: '#661e92'
              }
            ]} 
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.dot,
            {
              transform: [
                { translateY: dot3Transform },
                { scale: dot3Scale }
              ],
            }
          ]}
        >
          <View style={[styles.dotBase, { backgroundColor: '#16b0c1' }]} />
          <Animated.View 
            style={[
              styles.dotOverlay, 
              { 
                opacity: dot3Anim,
                backgroundColor: '#661e92'
              }
            ]} 
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.dot,
            {
              transform: [
                { translateY: dot4Transform },
                { scale: dot4Scale }
              ],
            }
          ]}
        >
          <View style={[styles.dotBase, { backgroundColor: '#16b0c1' }]} />
          <Animated.View 
            style={[
              styles.dotOverlay, 
              { 
                opacity: dot4Anim,
                backgroundColor: '#661e92'
              }
            ]} 
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.dot,
            {
              transform: [
                { translateY: dot5Transform },
                { scale: dot5Scale }
              ],
            }
          ]}
        >
          <View style={[styles.dotBase, { backgroundColor: '#16b0c1' }]} />
          <Animated.View 
            style={[
              styles.dotOverlay, 
              { 
                opacity: dot5Anim,
                backgroundColor: '#661e92'
              }
            ]} 
          />
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Fills whatever it's dropped into and centers the dot row.
  // Manipulate here: `flex: 1` is what makes this a full-screen loader — remove it to use inline
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // `alignItems: 'flex-end'` pins the dots to the bottom of this box, and the fixed
  // height reserves the airspace above them. If you change the -48 jump, change this too,
  // or the dots will get clipped at the top of their arc.
  loader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 68, // 20px dot + 48px jump space
  },
  // `overflow: 'hidden'` + borderRadius is what keeps the purple overlay circular
  // instead of leaking out as a square.
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
