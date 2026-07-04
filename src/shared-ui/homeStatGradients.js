/**
 * home Stat Gradients
 */
import React from 'react';
import { Text, View } from 'react-native';
import StableGradientText from './StableGradientText';

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

const OUTLINE_RING = [
  [0, -1], [0, 1], [-1, 0], [1, 0],
  [-1, -1], [1, -1], [-1, 1], [1, 1],
];

export const StatGradientText = ({ children, style, colors, start, end, textProps }) => (
  <StableGradientText style={style} colors={colors} start={start} end={end} textProps={textProps}>
    {children}
  </StableGradientText>
);

/** Solid fill (theme) with gradient ring drawn via offset gradient glyphs behind. */
export const GradientOutlineText = ({
  children,
  style,
  colors,
  fillColor,
  stroke = 1.25,
  start,
  end,
  textProps,
}) => (
  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
    {OUTLINE_RING.map(([x, y], i) => (
      <View
        key={`ring-${i}`}
        style={{
          position: 'absolute',
          transform: [{ translateX: x * stroke }, { translateY: y * stroke }],
        }}
        pointerEvents="none"
      >
        <StatGradientText style={style} colors={colors} start={start} end={end} textProps={textProps}>
          {children}
        </StatGradientText>
      </View>
    ))}
    <Text {...textProps} style={[style, { color: fillColor }]}>
      {children}
    </Text>
  </View>
);
