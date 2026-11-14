// Design Law hatched skeleton block (loading-and-errors PNG 05).
// Flow: safe SVG pattern id → soft opacity pulse (no shimmer) → bordered hatch shell.
// Where used: inbox and list loading states. Prefer this over ActivityIndicator for layout shells.
//
// vocab: soft pulse = opacity loop only — Design Law forbids sliding shimmer bars
// Manipulate here: STRIPE_PX, PULSE_MS, PULSE_MIN / PULSE_MAX

import React, { useEffect, useId, useMemo, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { useTheme } from './lightDarkMode';
import { borderRadius, nb } from './colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: hatch stripe width (mockup ~10px soft + 10px chip)
const STRIPE_PX = 10;
const PATTERN_SIZE = STRIPE_PX * 2;
// Manipulate here: pulse duration — slower = calmer; Design Law is soft, not flashy
const PULSE_MS = 1100;
const PULSE_MIN = 0.55;
const PULSE_MAX = 1;
// Manipulate here: inbox message-row chrome (avatar + two bars)
const MESSAGE_ROW_AVATAR_SIZE = 44;
const MESSAGE_ROW_BAR_HEIGHT = 12;
const MESSAGE_ROW_NAME_BAR_WIDTH = '42%';
const MESSAGE_ROW_PREVIEW_BAR_WIDTH = '78%';
const MESSAGE_ROW_GAP = 12;
const MESSAGE_ROW_PAD_VERTICAL = 14;
const MESSAGE_ROW_PAD_HORIZONTAL = 14;
const MESSAGE_TEXT_COLUMN_GAP = 8;

// ===== HELPER FUNCTIONS =====

/**
 * React useId can include colons — SVG pattern ids must be alphanumeric-safe.
 * vocab: useId = React hook that returns a unique id string for this component instance
 */
function buildSafePatternId(reactGeneratedId) {
  const stripped = String(reactGeneratedId).replace(/[^a-zA-Z0-9]/g, '');
  return `nbSkel_${stripped}`;
}

/**
 * Circle avatar shell vs rounded bar — width follows height when circle.
 */
function buildShellSizeStyle(isCircle, width, height, cornerRadius) {
  if (isCircle) {
    return {
      width: height,
      height,
      borderRadius: height / 2,
    };
  }
  return {
    width,
    height,
    borderRadius: cornerRadius,
  };
}

/**
 * Soft opacity loop: fade down to PULSE_MIN, fade back to PULSE_MAX, repeat.
 * vocab: useNativeDriver = run the animation on the native thread (smoother)
 */
function createOpacityPulseLoop(opacityAnimatedValue) {
  const fadeDown = Animated.timing(opacityAnimatedValue, {
    toValue: PULSE_MIN,
    duration: PULSE_MS,
    useNativeDriver: true,
  });
  const fadeUp = Animated.timing(opacityAnimatedValue, {
    toValue: PULSE_MAX,
    duration: PULSE_MS,
    useNativeDriver: true,
  });
  return Animated.loop(Animated.sequence([fadeDown, fadeUp]));
}

/**
 * Diagonal hatch fill — soft stripe + chip stripe, rotated 135° like PNG 05.
 * vocab: Pattern = SVG tile that repeats; url(#id) paints the full rect with that tile
 */
function HatchedPatternSvg({ patternId, softColor, chipColor }) {
  const fillUrl = `url(#${patternId})`;

  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width={PATTERN_SIZE}
          height={PATTERN_SIZE}
          patternTransform="rotate(135)"
        >
          <Rect x="0" y="0" width={STRIPE_PX} height={PATTERN_SIZE} fill={softColor} />
          <Rect x={STRIPE_PX} y="0" width={STRIPE_PX} height={PATTERN_SIZE} fill={chipColor} />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={fillUrl} />
    </Svg>
  );
}

/**
 * Start the soft pulse when allowed; stop on unmount or when pulse flips off.
 * Callers that respect reduce-motion pass pulse={false}.
 */
function startSoftPulseIfAllowed(shouldPulse, opacityAnimatedValue) {
  if (!shouldPulse) {
    return undefined;
  }
  const pulseLoop = createOpacityPulseLoop(opacityAnimatedValue);
  pulseLoop.start();
  return () => pulseLoop.stop();
}

/**
 * Border + soft fill bag shared by the animated shell.
 */
function buildShellChromeStyle(borderColor, softBackgroundColor, opacityAnimatedValue) {
  return {
    borderColor,
    backgroundColor: softBackgroundColor,
    opacity: opacityAnimatedValue,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Hatched skeleton placeholder block.
 *
 * @param {{ width?: number|string, height?: number, radius?: number, circle?: boolean, style?: object, pulse?: boolean }} props
 */
export default function NbSkeleton({
  width = '100%',
  height = 16,
  radius = borderRadius.nbChip,
  circle = false,
  style,
  pulse = true,
}) {
  // Hook order frozen: theme → useId → useMemo → useRef → useEffect
  const { colors } = useTheme();
  const reactGeneratedId = useId();
  // vocab: useMemo = remember the safe pattern id until reactGeneratedId changes
  const patternId = useMemo(
    () => buildSafePatternId(reactGeneratedId),
    [reactGeneratedId],
  );
  const opacityAnimated = useRef(new Animated.Value(PULSE_MAX)).current;

  // 1. Optional soft pulse — respect reduce-motion callers that pass pulse={false}.
  useEffect(() => {
    return startSoftPulseIfAllowed(pulse, opacityAnimated);
  }, [opacityAnimated, pulse]);

  // 2. Shell size (circle avatar vs bar) + themed border / soft fill.
  const shellSizeStyle = buildShellSizeStyle(circle, width, height, radius);
  const shellChromeStyle = buildShellChromeStyle(
    colors.nbBorder,
    colors.nbSoft,
    opacityAnimated,
  );

  // 3. Hatch SVG sits inside the bordered shell — matches loading PNG 05.
  return (
    <Animated.View style={[styles.shell, shellSizeStyle, shellChromeStyle, style]}>
      <HatchedPatternSvg
        patternId={patternId}
        softColor={colors.nbSoft}
        chipColor={colors.nbSurfaceChip}
      />
    </Animated.View>
  );
}

/**
 * One inbox-style skeleton row: avatar circle + two staggered text bars.
 *
 * @param {{ style?: object }} props
 */
export function NbSkeletonMessageRow({ style }) {
  const { colors } = useTheme();

  // 1. Row divider uses nbBorder; avatar + two bars stand in for a message preview.
  const rowDividerStyle = {
    borderBottomColor: colors.nbBorder,
  };

  return (
    <View style={[styles.msgRow, rowDividerStyle, style]}>
      <NbSkeleton circle height={MESSAGE_ROW_AVATAR_SIZE} />
      <View style={styles.msgTextColumn}>
        <NbSkeleton width={MESSAGE_ROW_NAME_BAR_WIDTH} height={MESSAGE_ROW_BAR_HEIGHT} />
        <NbSkeleton width={MESSAGE_ROW_PREVIEW_BAR_WIDTH} height={MESSAGE_ROW_BAR_HEIGHT} />
      </View>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  shell: {
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: MESSAGE_ROW_GAP,
    paddingVertical: MESSAGE_ROW_PAD_VERTICAL,
    paddingHorizontal: MESSAGE_ROW_PAD_HORIZONTAL,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  msgTextColumn: {
    flex: 1,
    gap: MESSAGE_TEXT_COLUMN_GAP,
  },
});
