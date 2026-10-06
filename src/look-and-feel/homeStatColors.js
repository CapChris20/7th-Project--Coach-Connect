// Gradient pairs for home stat labels, plus a solid word with a gradient outline.
// Flow: pick a gradient pair → draw eight shifted copies → paint the solid fill on top.
// Used by home stat numbers that need a colored ring around theme-colored type.

import React from 'react';
import { Text, View } from 'react-native';
import ColorText from './ColorText';

// ===== NAMED CONSTANTS =====

/** Today workout — gold + pink */
export const HOME_STAT_WORKOUT_GRADIENT = ['#FBBF24', '#FB7185'];
/** Water intake — cyan → deep blue */
export const HOME_STAT_WATER_GRADIENT = ['#22D3EE', '#1D4ED8'];
/** Sleep — dark orange + dark purple */
export const HOME_STAT_SLEEP_GRADIENT = ['#C2410C', '#6D28D9'];
/** Soreness — dark orange + dark pink */
export const HOME_STAT_SORENESS_GRADIENT = ['#C2410C', '#DB2777'];
/** Energy — cyan + purple */
export const HOME_STAT_ENERGY_GRADIENT = ['#22D3EE', '#6D28D9'];
/** Stress — gold + pink */
export const HOME_STAT_STRESS_GRADIENT = ['#FBBF24', '#FB7185'];
/** Mood — cyan → orange */
export const HOME_STAT_MOOD_GRADIENT = ['#06B6D4', '#F97316'];

// Eight directions, including diagonals. Each pair is one copy of the gradient word behind the fill.
// Manipulate here: these are steps of 1 before they are multiplied by the stroke width.
const OUTLINE_OFFSETS = [
  [0, -1], [0, 1], [-1, 0], [1, 0],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];

// Manipulate here: higher stroke pushes the ring farther out and makes the outline thicker.
const DEFAULT_OUTLINE_WIDTH = 1.25;

// ===== HELPER FUNCTIONS =====

// Absolute copies sit under the solid word. pointerEvents none so the ring does not steal taps.
function outlineCopyStyle(offsetX, offsetY, strokeWidth) {
  return {
    position: 'absolute',
    transform: [{ translateX: offsetX * strokeWidth }, { translateY: offsetY * strokeWidth }],
  };
}

// ===== MAIN FUNCTION =====

/**
 * Gradient text with the same props ColorText already takes. Home stats call this name.
 * @param {{ children?: import('react').ReactNode, style?: object, colors?: string[], start?: object, end?: object, textProps?: object }} props
 * @returns {import('react').ReactElement}
 */
export const StatColorText = ({ children, style, colors, start, end, textProps }) => (
  <ColorText style={style} colors={colors} start={start} end={end} textProps={textProps}>
    {children}
  </ColorText>
);

/**
 * Solid fillColor text with a gradient ring made from shifted copies of the same word.
 * @param {{ children?: import('react').ReactNode, style?: object, colors?: string[], fillColor?: string, stroke?: number, start?: object, end?: object, textProps?: object }} props
 * @returns {import('react').ReactElement}
 */
export const GradientOutlineText = ({
  children,
  style,
  colors,
  fillColor,
  stroke = DEFAULT_OUTLINE_WIDTH,
  start,
  end,
  textProps,
}) => (
  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
    {OUTLINE_OFFSETS.map(([offsetX, offsetY], ringIndex) => (
      <View
        key={`ring-${ringIndex}`}
        style={outlineCopyStyle(offsetX, offsetY, stroke)}
        pointerEvents="none"
      >
        <StatColorText style={style} colors={colors} start={start} end={end} textProps={textProps}>
          {children}
        </StatColorText>
      </View>
    ))}
    <Text {...textProps} style={[style, { color: fillColor }]}>
      {children}
    </Text>
  </View>
);
