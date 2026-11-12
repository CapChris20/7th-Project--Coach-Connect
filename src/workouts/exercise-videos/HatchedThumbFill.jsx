// Diagonal hatch fill for video thumbs when no YouTube still exists (PNG placeholders).
// Flow: SVG pattern of soft/chip stripes → full-bleed rect behind play + duration.
// Used by: ShortVideoCard, ExerciseCard. Design Law: hatch = soft + chip, never a gradient rim.

import React, { useId, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { useTheme } from '../../look-and-feel/lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: stripe band width (mockup uses ~10px soft + 10px chip at 135°)
const STRIPE_PX = 10;
const PATTERN_SIZE = STRIPE_PX * 2;

// ===== MAIN FUNCTION =====

/**
 * Absolute-fill hatch matching Design Law `.vid .th` placeholder.
 * @param {{ style?: object }} props
 */
export default function HatchedThumbFill({ style }) {
  const { colors } = useTheme();
  // vocab: useId keeps pattern ids unique when many cards mount together
  const reactId = useId();
  const patternId = useMemo(
    () => `vidHatch_${String(reactId).replace(/[^a-zA-Z0-9]/g, '')}`,
    [reactId],
  );

  return (
    <Svg
      width="100%"
      height="100%"
      style={[styles.fill, style]}
      pointerEvents="none"
    >
      <Defs>
        <Pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width={PATTERN_SIZE}
          height={PATTERN_SIZE}
          patternTransform="rotate(135)"
        >
          <Rect x={0} y={0} width={STRIPE_PX} height={PATTERN_SIZE} fill={colors.nbSoft} />
          <Rect
            x={STRIPE_PX}
            y={0}
            width={STRIPE_PX}
            height={PATTERN_SIZE}
            fill={colors.nbSurfaceChip || colors.nbSurface}
          />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
});
