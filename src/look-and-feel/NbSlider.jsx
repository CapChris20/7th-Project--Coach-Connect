// Design Law check-in slider — gradient track + hard black knob with grip lines.
// Flow: pan/tap on track → clamp value → call onChange. Used by Daily check-in on Client Home.
// vocab: shared value = Reanimated number that updates on the UI thread without React re-renders

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

// ===== MAIN FUNCTION =====

/**
 * Neo-brutalist slider for Design Law check-in rows.
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
  const { colors: theme } = useTheme();
  const ramp = colors || accentGradients[0];
  const trackWidth = useSharedValue(1);
  const progress = useSharedValue(0);

  // Keep the knob in sync when the parent saves a new value (e.g. after load from storage).
  useEffect(() => {
    const span = Math.max(1, max - min);
    const clamped = Math.min(max, Math.max(min, Number(value) || min));
    progress.value = (clamped - min) / span;
  }, [value, min, max, progress]);

  const emit = (ratio) => {
    if (typeof onChange !== 'function') return;
    const span = Math.max(1, max - min);
    const next = Math.round(min + ratio * span);
    onChange(Math.min(max, Math.max(min, next)));
  };

  // vocab: Gesture.Pan = finger drag; simultaneousWithExternalGesture not needed — we own the track
  const pan = Gesture.Pan()
    .onBegin((e) => {
      const w = Math.max(1, trackWidth.value);
      const ratio = Math.min(1, Math.max(0, e.x / w));
      progress.value = ratio;
      runOnJS(emit)(ratio);
    })
    .onUpdate((e) => {
      const w = Math.max(1, trackWidth.value);
      const ratio = Math.min(1, Math.max(0, e.x / w));
      progress.value = ratio;
      runOnJS(emit)(ratio);
    });

  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.min(100, Math.max(0, progress.value * 100))}%`,
  }));

  const knobStyle = useAnimatedStyle(() => {
    const w = Math.max(1, trackWidth.value);
    const x = progress.value * w - KNOB_SIZE / 2;
    return { transform: [{ translateX: Math.min(w - KNOB_SIZE, Math.max(0, x)) }] };
  });

  return (
    <View style={style}>
      {(label || valueLabel) ? (
        <View style={styles.labelRow}>
          {label ? <Text style={[styles.label, { color: theme.nbInk }]}>{label}</Text> : <View />}
          {valueLabel ? <Text style={[styles.value, { color: theme.nbMuted }]}>{valueLabel}</Text> : null}
        </View>
      ) : null}
      <GestureDetector gesture={pan}>
        <View
          style={[styles.track, { borderColor: theme.nbBorder, backgroundColor: theme.nbSoft }]}
          onLayout={(e) => {
            trackWidth.value = e.nativeEvent.layout.width;
          }}
        >
          <Animated.View style={[styles.fillClip, fillStyle]}>
            <LinearGradient
              colors={ramp}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.knob,
              {
                borderColor: theme.nbBorder,
                backgroundColor: theme.nbFill,
                shadowColor: theme.nbShadow,
              },
              knobStyle,
            ]}
          >
            {/* Grip lines — Design Law knob detail so the control reads as draggable */}
            <View style={[styles.grip, { backgroundColor: theme.nbOnFill }]} />
            <View style={[styles.grip, { backgroundColor: theme.nbOnFill }]} />
            <View style={[styles.grip, { backgroundColor: theme.nbOnFill }]} />
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    overflow: 'visible',
    justifyContent: 'center',
  },
  fillClip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 999,
    overflow: 'hidden',
  },
  knob: {
    position: 'absolute',
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    // Manipulate here: hard shadow offset = Design Law small shadow (3)
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  grip: {
    width: 2,
    height: 14,
    borderRadius: 1,
    opacity: 0.85,
  },
});
