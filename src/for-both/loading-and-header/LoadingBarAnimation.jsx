// The prism loading bar — one sprite sheet, no video decode stall.
// Flow: loop a frame counter on the UI thread → clip the sheet → slide the active cell into view.
// Used by StartupLoadingCover and any screen that needs the Design Law prism loader.

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
import { useTheme } from '../../look-and-feel/lightDarkMode';

// ===== NAMED CONSTANTS =====

const SPRITE_SHEET = require('../../assets/animations/loading-prism-sheet.png');

// Manipulate here: sheet geometry — must match loading-prism-sheet.png cell layout.
const FRAME_WIDTH = 480;
const FRAME_HEIGHT = 120;
const SHEET_COLUMNS = 5;
const FRAME_COUNT = 30;
const SHEET_ROWS = 6;
// Manipulate here: one full walk through all frames (ms). Lower = faster loop.
const LOOP_MS = 1000;
const DEFAULT_BAR_WIDTH = 300;
// vocab: withRepeat count -1 = loop forever (Reanimated).
const REPEAT_FOREVER = -1;
const FIRST_FRAME_INDEX = 0;
const LAST_FRAME_INDEX = FRAME_COUNT - 1;

// ===== HELPER FUNCTIONS =====

// Bar height stays proportional to caller width so the prism never looks stretched.
function barHeightFromBarWidth(barWidth) {
  const heightRatio = FRAME_HEIGHT / FRAME_WIDTH;
  return Math.round(barWidth * heightRatio);
}

function scaleForBarWidth(barWidth) {
  return barWidth / FRAME_WIDTH;
}

function fullSheetPixelSize(scale) {
  return {
    sheetWidth: FRAME_WIDTH * SHEET_COLUMNS * scale,
    sheetHeight: FRAME_HEIGHT * SHEET_ROWS * scale,
  };
}

function startForeverFrameLoop(frameProgressShared) {
  frameProgressShared.value = FIRST_FRAME_INDEX;
  // vocab: withTiming = animate a shared value over duration; Easing.linear = constant speed.
  frameProgressShared.value = withRepeat(
    withTiming(FRAME_COUNT, { duration: LOOP_MS, easing: Easing.linear }),
    REPEAT_FOREVER,
    false,
  );
}

function stopFrameLoop(frameProgressShared) {
  cancelAnimation(frameProgressShared);
}

// ===== MAIN FUNCTION =====

/**
 * Animated prism loader clipped to one cell of the sprite sheet.
 * Hook order is frozen: shared progress → loop effect → animated style.
 * @param {{ width?: number, isDark?: boolean }} props
 * @returns {import('react').ReactElement}
 */
export default function LoadingBarAnimation({ width = DEFAULT_BAR_WIDTH }) {
  // Callers may still pass isDark; the sheet art is theme-agnostic so we ignore it.
  // useTheme stays imported for the same module graph as before (unused on purpose).

  const barHeight = barHeightFromBarWidth(width);
  const sheetScale = scaleForBarWidth(width);
  const { sheetWidth, sheetHeight } = fullSheetPixelSize(sheetScale);

  // vocab: useSharedValue = number Reanimated drives on the UI thread (not plain useState).
  const frameProgress = useSharedValue(FIRST_FRAME_INDEX);

  useEffect(() => {
    startForeverFrameLoop(frameProgress);
    return () => stopFrameLoop(frameProgress);
  }, [frameProgress]);

  // Frame index math must stay inside useAnimatedStyle — this callback runs off the JS thread.
  // Do not extract into a plain helper: Reanimated needs this body as a worklet.
  // vocab: useAnimatedStyle = Reanimated hook; returned styles update without React re-render.
  const slidingSpriteStyle = useAnimatedStyle(() => {
    const rawIndex = Math.floor(frameProgress.value);
    const safeIndex = Math.min(LAST_FRAME_INDEX, Math.max(FIRST_FRAME_INDEX, rawIndex));
    const columnIndex = safeIndex % SHEET_COLUMNS;
    const rowIndex = Math.floor(safeIndex / SHEET_COLUMNS);
    const shiftX = -columnIndex * FRAME_WIDTH * sheetScale;
    const shiftY = -rowIndex * FRAME_HEIGHT * sheetScale;

    return {
      transform: [{ translateX: shiftX }, { translateY: shiftY }],
    };
  }, [sheetScale]);

  // 1. Size the viewport from the caller width (height follows aspect).
  // 2. Start the frame loop after mount; cancel when we unmount.
  // 3. Paint the full sheet, clip it, and slide so one prism frame shows.
  const viewportSizeStyle = { width, height: barHeight };
  const sheetSizeStyle = { width: sheetWidth, height: sheetHeight };

  return (
    <View
      style={[styles.viewport, viewportSizeStyle]}
      accessibilityLabel="Loading"
      collapsable={false}
    >
      <Animated.Image
        source={SPRITE_SHEET}
        style={[sheetSizeStyle, slidingSpriteStyle]}
        resizeMode="stretch"
        fadeDuration={0}
        pointerEvents="none"
      />
    </View>
  );
}

/**
 * Kept so older imports still resolve. The sheet is bundled — nothing to prefetch.
 * @returns {Promise<void>}
 */
export function preloadLoadingPrism() {
  return Promise.resolve();
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
    alignSelf: 'center',
  },
});
