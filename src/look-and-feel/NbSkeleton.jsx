// Design Law hatched skeleton block (loading-and-errors PNG 05).
// Flow: SVG diagonal hatch → soft opacity pulse (no shimmer) → same layout as the real screen.
// Used by inbox and list loading states. Prefer this over ActivityIndicator for layout shells.
//
// vocab: soft pulse = opacity loop only — Design Law forbids sliding shimmer bars

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

// ===== MAIN FUNCTION =====

/**
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
  const { colors } = useTheme();
  const reactId = useId();
  const patternId = useMemo(
    () => `nbSkel_${String(reactId).replace(/[^a-zA-Z0-9]/g, '')}`,
    [reactId],
  );
  const opacity = useRef(new Animated.Value(PULSE_MAX)).current;

  useEffect(() => {
    if (!pulse) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: PULSE_MIN,
          duration: PULSE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: PULSE_MAX,
          duration: PULSE_MS,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, pulse]);

  const sizeStyle = circle
    ? { width: height, height, borderRadius: height / 2 }
    : { width, height, borderRadius: radius };

  return (
    <Animated.View
      style={[
        styles.shell,
        sizeStyle,
        { borderColor: colors.nbBorder, backgroundColor: colors.nbSoft, opacity },
        style,
      ]}
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={PATTERN_SIZE}
            height={PATTERN_SIZE}
            patternTransform="rotate(135)"
          >
            <Rect x="0" y="0" width={STRIPE_PX} height={PATTERN_SIZE} fill={colors.nbSoft} />
            <Rect x={STRIPE_PX} y="0" width={STRIPE_PX} height={PATTERN_SIZE} fill={colors.nbSurfaceChip} />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
      </Svg>
    </Animated.View>
  );
}

/**
 * One inbox-style skeleton row: avatar + two bars.
 */
export function NbSkeletonMessageRow({ style }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.msgRow,
        { borderBottomColor: colors.nbBorder },
        style,
      ]}
    >
      <NbSkeleton circle height={44} />
      <View style={{ flex: 1, gap: 8 }}>
        <NbSkeleton width="42%" height={12} />
        <NbSkeleton width="78%" height={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
