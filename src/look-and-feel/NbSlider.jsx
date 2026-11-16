// Design Law check-in slider — gradient track + hard black knob with grip lines.
// Flow: measure track → pan finger → clamp ratio → shared progress + onChange integer.
// Where used: Daily check-in on Client Home (energy / soreness / stress style rows).
//
// vocab: shared value = Reanimated number on the UI thread (no React re-render per frame)
// Manipulate here: TRACK_HEIGHT, KNOB_SIZE, DEFAULT_MIN / DEFAULT_MAX

import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { accentGradients, nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: track/knob sizes from DESIGN-SYSTEM §6 Slider
const TRACK_HEIGHT = 18;
const KNOB_SIZE = 40;
const DEFAULT_MIN = 1;
const DEFAULT_MAX = 8;
const KNOB_CORNER_RADIUS = 10;
const KNOB_ELEVATION = 4;
const GRIP_LINE_WIDTH = 2;
const GRIP_LINE_HEIGHT = 14;
const GRIP_LINE_RADIUS = 1;
const GRIP_LINE_OPACITY = 0.85;
const GRIP_LINE_GAP = 3;
const LABEL_ROW_GAP_BELOW = 8;
const LABEL_FONT_SIZE = 15;
const VALUE_FONT_SIZE = 13;
const TRACK_PILL_RADIUS = 999;

// ===== HELPER FUNCTIONS =====

/**
 * Span of the slider range — never zero so ratio math stays safe.
 */
function safeSpanBetweenMinAndMax(minimum, maximum) {
  return Math.max(1, maximum - minimum);
}

/**
 * Clamp a raw number into [minimum, maximum]. Non-numbers fall back to minimum.
 */
function clampNumberBetween(minimum, maximum, rawNumber) {
  const asNumber = Number(rawNumber) || minimum;
  return Math.min(maximum, Math.max(minimum, asNumber));
}

/**
 * Turn a stepped value into a 0–1 progress ratio along the track.
 */
function progressRatioFromValue(currentValue, minimum, maximum) {
  const span = safeSpanBetweenMinAndMax(minimum, maximum);
  const clamped = clampNumberBetween(minimum, maximum, currentValue);
  return (clamped - minimum) / span;
}

/**
 * Turn a 0–1 ratio back into a stepped integer the parent understands.
 */
function steppedValueFromRatio(ratio, minimum, maximum) {
  const span = safeSpanBetweenMinAndMax(minimum, maximum);
  const snapped = Math.round(minimum + ratio * span);
  return clampNumberBetween(minimum, maximum, snapped);
}

/**
 * Finger X on the track → clamped 0–1 ratio.
 */
function fingerXToClampedRatio(fingerX, trackWidthPixels) {
  'worklet';
  const safeWidth = Math.max(1, trackWidthPixels);
  return Math.min(1, Math.max(0, fingerX / safeWidth));
}

/**
 * Knob translateX from ratio — clamped so the knob never hangs past either end.
 */
function knobTranslateXFromRatio(ratio, trackWidthPixels) {
  'worklet';
  const safeWidth = Math.max(1, trackWidthPixels);
  const rawX = ratio * safeWidth - KNOB_SIZE / 2;
  const maxX = safeWidth - KNOB_SIZE;
  return Math.min(maxX, Math.max(0, rawX));
}

/**
 * Fill width percent (0–100) from progress ratio.
 */
function fillWidthPercentFromRatio(ratio) {
  'worklet';
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  return `${clampedRatio * 100}%`;
}

/**
 * Label row above the track when the parent passes label and/or value copy.
 */
function SliderLabelRow({ label, valueLabel, inkColor, mutedColor }) {
  const showRow = Boolean(label || valueLabel);
  if (!showRow) {
    return null;
  }

  const labelStyle = { color: inkColor };
  const valueStyle = { color: mutedColor };

  let leftSide = <View />;
  if (label) {
    leftSide = <Text style={[styles.label, labelStyle]}>{label}</Text>;
  }

  let rightSide = null;
  if (valueLabel) {
    rightSide = <Text style={[styles.value, valueStyle]}>{valueLabel}</Text>;
  }

  return (
    <View style={styles.labelRow}>
      {leftSide}
      {rightSide}
    </View>
  );
}

/**
 * Three grip lines on the knob — Design Law detail so the control reads as draggable.
 */
function SliderKnobGripLines({ lineColor }) {
  const gripStyle = { backgroundColor: lineColor };

  return (
    <>
      <View style={[styles.grip, gripStyle]} />
      <View style={[styles.grip, gripStyle]} />
      <View style={[styles.grip, gripStyle]} />
    </>
  );
}

/**
 * Remember track pixel width from onLayout so ratio math uses real geometry.
 */
function rememberTrackWidthFromLayout(layoutEvent, trackWidthShared) {
  trackWidthShared.value = layoutEvent.nativeEvent.layout.width;
}

// ===== MAIN FUNCTION =====

/**
 * Neo-brutalist slider for Design Law check-in rows.
 *
 * @param {{ value: number, min?: number, max?: number, onChange?: (n: number) => void, colors?: string[], label?: string, valueLabel?: string, style?: object }} props
 */
export default function NbSlider({
  value,
  min = DEFAULT_MIN,
  max = DEFAULT_MAX,
  onChange,
  colors,
  label,
  valueLabel,
  style,
}) {
  // Hook order frozen: theme → shared trackWidth → shared progress → effect → animated styles
  const { colors: theme } = useTheme();
  const gradientColors = colors || accentGradients[0];
  const trackWidth = useSharedValue(1);
  const progress = useSharedValue(0);

  // 1. When the parent value changes (load from storage, reset row), move the knob without waiting for a drag.
  useEffect(() => {
    progress.value = progressRatioFromValue(value, min, max);
  }, [value, min, max, progress]);

  // 2. Bridge from the UI-thread gesture to React — parent only cares about the stepped integer.
  const tellParentAboutNewRatio = (ratio) => {
    if (typeof onChange !== 'function') {
      return;
    }
    const nextValue = steppedValueFromRatio(ratio, min, max);
    onChange(nextValue);
  };

  // 3. Pan gesture: onBegin + onUpdate both set progress and notify (tap-at-x and drag behave the same).
  // vocab: Gesture.Pan = finger drag; runOnJS jumps from worklet thread back to JS for onChange
  const panGesture = Gesture.Pan()
    .onBegin((event) => {
      const ratio = fingerXToClampedRatio(event.x, trackWidth.value);
      progress.value = ratio;
      runOnJS(tellParentAboutNewRatio)(ratio);
    })
    .onUpdate((event) => {
      const ratio = fingerXToClampedRatio(event.x, trackWidth.value);
      progress.value = ratio;
      runOnJS(tellParentAboutNewRatio)(ratio);
    });

  // 4. Animated fill width follows progress (0–100%).
  const fillStyle = useAnimatedStyle(() => ({
    width: fillWidthPercentFromRatio(progress.value),
  }));

  // 5. Animated knob position — clamped so it never hangs past the track ends.
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: knobTranslateXFromRatio(progress.value, trackWidth.value) }],
  }));

  // 6. Paint labels, track, gradient fill, knob (named chrome locals above JSX).
  const trackChromeStyle = {
    borderColor: theme.nbBorder,
    backgroundColor: theme.nbSoft,
  };
  const knobChromeStyle = {
    borderColor: theme.nbBorder,
    backgroundColor: theme.nbFill,
    shadowColor: theme.nbShadow,
  };

  return (
    <View style={style}>
      <SliderLabelRow
        label={label}
        valueLabel={valueLabel}
        inkColor={theme.nbInk}
        mutedColor={theme.nbMuted}
      />
      <GestureDetector gesture={panGesture}>
        <View
          style={[styles.track, trackChromeStyle]}
          onLayout={(layoutEvent) => {
            rememberTrackWidthFromLayout(layoutEvent, trackWidth);
          }}
        >
          <Animated.View style={[styles.fillClip, fillStyle]}>
            <LinearGradient
              colors={gradientColors}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
          <Animated.View style={[styles.knob, knobChromeStyle, knobStyle]}>
            <SliderKnobGripLines lineColor={theme.nbOnFill} />
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: LABEL_ROW_GAP_BELOW,
  },
  label: {
    fontSize: LABEL_FONT_SIZE,
    fontWeight: '800',
  },
  value: {
    fontSize: VALUE_FONT_SIZE,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_PILL_RADIUS,
    borderWidth: nb.borderWidth,
    overflow: 'visible',
    justifyContent: 'center',
  },
  fillClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: TRACK_PILL_RADIUS,
    overflow: 'hidden',
  },
  knob: {
    position: 'absolute',
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_CORNER_RADIUS,
    borderWidth: nb.borderWidth,
    // Manipulate here: hard shadow offset = Design Law small shadow (3)
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: KNOB_ELEVATION,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: GRIP_LINE_GAP,
  },
  grip: {
    width: GRIP_LINE_WIDTH,
    height: GRIP_LINE_HEIGHT,
    borderRadius: GRIP_LINE_RADIUS,
    opacity: GRIP_LINE_OPACITY,
  },
});
