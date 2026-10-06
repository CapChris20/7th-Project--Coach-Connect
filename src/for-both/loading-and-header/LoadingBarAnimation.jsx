// The prism loading bar, drawn from a sprite sheet so it does not stall like a video.
// Flow: start a looping frame counter → pick the column and row → slide the sheet under a window.
// Used by the app loading cover.

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

// ===== NAMED CONSTANTS =====

const SPRITE_SHEET = require('../../assets/animations/loading-prism-sheet.png');

const FRAME_WIDTH = 480;
const FRAME_HEIGHT = 120;
const SHEET_COLUMNS = 5;
const FRAME_COUNT = 30;
const SHEET_ROWS = 6;
const LOOP_MS = 1000;
const DEFAULT_BAR_WIDTH = 300;
const REPEAT_FOREVER = -1;

// ===== HELPER FUNCTIONS =====

// The frame math stays inside the animated style. That callback runs off the JavaScript thread.

// ===== MAIN FUNCTION =====

/**
 * Hooks stay in this order: shared progress, the loop effect, then the animated style.
 * @param {{ width?: number, isDark?: boolean }} props
 * @returns {import('react').ReactElement}
 */
export default function LoadingBarAnimation({ width = DEFAULT_BAR_WIDTH }) {
  const height = Math.round(width * (FRAME_HEIGHT / FRAME_WIDTH));
  const scale = width / FRAME_WIDTH;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(FRAME_COUNT, { duration: LOOP_MS, easing: Easing.linear }),
      REPEAT_FOREVER,
      false,
    );
    return () => cancelAnimation(progress);
  }, [progress]);

  const sheetStyle = useAnimatedStyle(() => {
    const frameIndex = Math.min(FRAME_COUNT - 1, Math.max(0, Math.floor(progress.value)));
    const columnIndex = frameIndex % SHEET_COLUMNS;
    const rowIndex = Math.floor(frameIndex / SHEET_COLUMNS);
    return {
      transform: [
        { translateX: -columnIndex * FRAME_WIDTH * scale },
        { translateY: -rowIndex * FRAME_HEIGHT * scale },
      ],
    };
  }, [scale]);

  return (
    <View style={[styles.viewport, { width, height }]} accessibilityLabel="Loading" collapsable={false}>
      <Animated.Image
        source={SPRITE_SHEET}
        style={[
          {
            width: FRAME_WIDTH * SHEET_COLUMNS * scale,
            height: FRAME_HEIGHT * SHEET_ROWS * scale,
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

/**
 * Kept so older imports still resolve. The sheet is bundled, so there is nothing to preload.
 * @returns {Promise<void>}
 */
export function preloadLoadingPrism() {
  return Promise.resolve();
}

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
    alignSelf: 'center',
  },
});
