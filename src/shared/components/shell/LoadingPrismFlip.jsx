/**
 * IconScout-style loading bar via compact spritesheet + Reanimated (UI thread).
 * No video — no buffer stalls / remount pauses.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const SHEET = require('../../../assets/animations/loading-prism-sheet.png');

const FRAME_W = 480;
const FRAME_H = 120;
const COLS = 5;
const FRAME_COUNT = 30;
const LOOP_MS = 1000;

/**
 * @param {{ width?: number, isDark?: boolean }} props
 */
export default function LoadingPrismFlip({ width = 300 }) {
  const height = Math.round(width * (FRAME_H / FRAME_W));
  const scale = width / FRAME_W;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(FRAME_COUNT, { duration: LOOP_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [progress]);

  const sheetStyle = useAnimatedStyle(() => {
    const frame = Math.min(FRAME_COUNT - 1, Math.max(0, Math.floor(progress.value)));
    const col = frame % COLS;
    const row = Math.floor(frame / COLS);
    return {
      transform: [
        { translateX: -col * FRAME_W * scale },
        { translateY: -row * FRAME_H * scale },
      ],
    };
  }, [scale]);

  return (
    <View style={[styles.viewport, { width, height }]} accessibilityLabel="Loading" collapsable={false}>
      <Animated.Image
        source={SHEET}
        style={[
          {
            width: FRAME_W * COLS * scale,
            height: FRAME_H * 6 * scale,
          },
          sheetStyle,
        ]}
        resizeMode="stretch"
        fadeDuration={0}
        pointerEvents="none"
      />
    </View>
  );
}

/** No-op kept so existing imports of preloadLoadingPrism() still work. */
export function preloadLoadingPrism() {
  return Promise.resolve();
}

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
    alignSelf: 'center',
  },
});
