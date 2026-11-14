// Design Law switch — solid fill when on, surface when off (no brand gradient).
// Flow: press → flip value → animate knob slide. Used by onboarding Health, Settings, filters.
//
// vocab: switch = on/off toggle; Design Law size is 56×34 with a 22 knob (DESIGN-SYSTEM.md)
// Manipulate here: TRACK_W / TRACK_H / KNOB / travel so press targets stay ≥44

import React from 'react';
import { View, Pressable, StyleSheet, Animated } from 'react-native';

import { nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: match DESIGN-SYSTEM Switch row (56 × 34, knob 22)
const TRACK_WIDTH = 56;
const TRACK_HEIGHT = 34;
const KNOB_SIZE = 22;
const KNOB_PAD = 3;
const KNOB_TRAVEL =
  TRACK_WIDTH - KNOB_SIZE - KNOB_PAD * 2 - nb.borderWidth * 2;
// Manipulate here: lower = snappier flip; raise = softer slide
const KNOB_ANIMATION_MS = 200;
const MIN_HIT_TARGET = 44;

// ===== HELPER FUNCTIONS =====

/**
 * Map the 0–1 animated value to horizontal pixel travel inside the track.
 * vocab: interpolate = Animated maps input range → output range every frame
 */
function knobSlideInterpolation(animatedOnOff) {
  return animatedOnOff.interpolate({
    inputRange: [0, 1],
    outputRange: [KNOB_PAD, KNOB_TRAVEL],
  });
}

/**
 * Animate the knob toward on (1) or off (0).
 * vocab: useNativeDriver = run transform on the native thread
 */
function startKnobSlideAnimation(animatedOnOff, switchIsOn) {
  const targetValue = switchIsOn ? 1 : 0;
  Animated.timing(animatedOnOff, {
    toValue: targetValue,
    duration: KNOB_ANIMATION_MS,
    useNativeDriver: true,
  }).start();
}

/**
 * Design Law colors: on = fill track + onFill thumb (never green / brand gradient).
 */
function readTrackAndThumbColors(switchIsOn, colors) {
  let trackBackground = colors.nbSurface;
  let thumbBackground = colors.nbInk;
  if (switchIsOn) {
    trackBackground = colors.nbFill;
    thumbBackground = colors.nbOnFill;
  }
  return { trackBackground, thumbBackground };
}

/**
 * Initial animated position from the parent value (1 = on / right, 0 = off / left).
 */
function initialKnobAnimatedValue(switchIsOn) {
  return new Animated.Value(switchIsOn ? 1 : 0);
}

/**
 * Flip the boolean and hand it to the parent. Parent owns the source of truth.
 */
function tellParentValueFlipped(currentValue, onValueChange) {
  onValueChange(!currentValue);
}

/**
 * Hit-target wrapper style — min 44×44 even though the track is smaller.
 */
function buildHitTargetStyle(extraStyle) {
  return [
    {
      minWidth: MIN_HIT_TARGET,
      minHeight: MIN_HIT_TARGET,
      justifyContent: 'center',
    },
    extraStyle,
  ];
}

// ===== MAIN FUNCTION =====

/**
 * Design Law switch (fill track when on).
 *
 * @param {object} props
 * @param {boolean} props.value - on/off state
 * @param {Function} props.onValueChange - (boolean) => void
 * @param {object} [props.style] - additional container styles
 */
export default function NbSwitch({ value, onValueChange, style }) {
  const { colors } = useTheme();

  // 1. Knob position: 0 = off (left pad), 1 = on (full travel) — ref survives re-renders.
  // Hook order frozen: theme → useRef → useEffect → render
  const knobPosition = React.useRef(initialKnobAnimatedValue(value)).current;

  // 2. When parent `value` flips, animate the thumb.
  React.useEffect(() => {
    startKnobSlideAnimation(knobPosition, value);
  }, [value, knobPosition]);

  // 3. Map 0–1 animation to horizontal pixel travel inside the track.
  const thumbTranslateX = knobSlideInterpolation(knobPosition);

  // 4. Design Law colors for track + thumb from current on/off.
  const { trackBackground, thumbBackground } = readTrackAndThumbColors(
    value,
    colors,
  );

  // 5. Press flips the value; parent re-render drives the effect above.
  const handlePress = () => {
    tellParentValueFlipped(value, onValueChange);
  };

  const hitTargetStyle = buildHitTargetStyle(style);
  const trackChromeStyle = {
    backgroundColor: trackBackground,
    borderColor: colors.nbBorder,
  };
  const thumbChromeStyle = {
    backgroundColor: thumbBackground,
    borderColor: colors.nbBorder,
    transform: [{ translateX: thumbTranslateX }],
  };
  const accessibilityState = { checked: !!value };

  // 6. Paint hit target and track + sliding thumb.
  return (
    <Pressable
      onPress={handlePress}
      style={hitTargetStyle}
      accessibilityRole="switch"
      accessibilityState={accessibilityState}
    >
      <View style={[styles.track, trackChromeStyle]}>
        <Animated.View style={[styles.thumb, thumbChromeStyle]} />
      </View>
    </Pressable>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: nb.borderWidth,
    justifyContent: 'center',
  },
  thumb: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    borderWidth: nb.borderWidth,
  },
});
