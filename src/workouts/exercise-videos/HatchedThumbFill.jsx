// Diagonal hatch fill for video thumbs when no YouTube still exists (PNG placeholders).
// Flow: theme soft/chip colors → unique SVG pattern id → full-bleed striped rect.
// Used by: ShortVideoCard, ExerciseCard. Design Law: hatch = soft + chip stripes, never a gradient rim.

import React, { useId, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { useTheme } from '../../look-and-feel/lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: stripe band width (mockup uses ~10px soft + 10px chip at 135°)
const STRIPE_WIDTH_PX = 10;
const PATTERN_TILE_WIDTH_PX = STRIPE_WIDTH_PX * 2;
const HATCH_ROTATE_DEGREES = 135;
const PATTERN_ID_PREFIX = 'vidHatch_';

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
});

// ===== HELPER FUNCTIONS =====

/**
 * Strip React’s useId punctuation so the string is safe inside `url(#...)`.
 * vocab: useId can include colons; SVG pattern ids must stay letter/number only
 * @param {string} reactElementId
 * @returns {string}
 */
function lettersAndNumbersOnly(reactElementId) {
  return String(reactElementId).replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Build a stable SVG pattern id unique to this mount (many cards share one list).
 * @param {string} reactElementId
 * @returns {string}
 */
function buildHatchPatternId(reactElementId) {
  return `${PATTERN_ID_PREFIX}${lettersAndNumbersOnly(reactElementId)}`;
}

/**
 * Soft band + chip band — Design Law placeholder stripes (never a brand gradient).
 * @param {{ nbSoft: string, nbSurfaceChip?: string, nbSurface: string }} colors
 * @returns {{ softStripeColor: string, chipStripeColor: string }}
 */
function stripeColorsFromTheme(colors) {
  const softStripeColor = colors.nbSoft;
  // vocab/symbol: || = chip token missing → fall back to surface (empty string still uses surface)
  const chipStripeColor = colors.nbSurfaceChip || colors.nbSurface;
  return { softStripeColor, chipStripeColor };
}

// ===== MAIN FUNCTION =====

/**
 * Absolute-fill hatch matching Design Law `.vid .th` placeholder.
 * Flow: theme colors → unique pattern id → soft/chip stripe tile → full rect fill.
 * @param {{ style?: object }} props
 */
export default function HatchedThumbFill({ style }) {
  const { colors } = useTheme();

  // vocab: useId = React assigns a stable id per mount so pattern refs never collide in long lists
  const reactElementId = useId();

  // 1. Turn the React id into something safe inside `url(#...)`
  const hatchPatternId = useMemo(
    () => buildHatchPatternId(reactElementId),
    [reactElementId],
  );

  // 2. Soft stripe + chip stripe from the active theme (light / dark)
  const { softStripeColor, chipStripeColor } = stripeColorsFromTheme(colors);

  // 3. Paint the full thumb area with the rotated hatch pattern
  const patternFillUrl = `url(#${hatchPatternId})`;
  const patternTransform = `rotate(${HATCH_ROTATE_DEGREES})`;
  const svgStyle = [styles.fill, style];

  return (
    <Svg
      width="100%"
      height="100%"
      style={svgStyle}
      pointerEvents="none"
    >
      <Defs>
        <Pattern
          id={hatchPatternId}
          patternUnits="userSpaceOnUse"
          width={PATTERN_TILE_WIDTH_PX}
          height={PATTERN_TILE_WIDTH_PX}
          patternTransform={patternTransform}
        >
          <Rect
            x={0}
            y={0}
            width={STRIPE_WIDTH_PX}
            height={PATTERN_TILE_WIDTH_PX}
            fill={softStripeColor}
          />
          <Rect
            x={STRIPE_WIDTH_PX}
            y={0}
            width={STRIPE_WIDTH_PX}
            height={PATTERN_TILE_WIDTH_PX}
            fill={chipStripeColor}
          />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={patternFillUrl} />
    </Svg>
  );
}
