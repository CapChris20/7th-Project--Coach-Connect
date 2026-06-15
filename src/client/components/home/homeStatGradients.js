/**
 * home Stat Gradients
 *
 * Purpose: home Stat Gradients — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: HOME_STAT_WORKOUT_GRADIENT, HOME_STAT_WATER_GRADIENT, HOME_STAT_SLEEP_GRADIENT, HOME_STAT_SORENESS_GRADIENT, HOME_STAT_ENERGY_GRADIENT, HOME_STAT_STRESS_GRADIENT, HOME_STAT_MOOD_GRADIENT, StatGradientText
 *
 * @file-header
 */
import React from 'react';
import { Text, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

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
  <MaskedView
    style={{ alignSelf: 'center' }}
    maskElement={
      <Text {...textProps} style={[style, { backgroundColor: 'transparent' }]}>
        {children}
      </Text>
    }
  >
    <LinearGradient colors={colors} start={start ?? { x: 0, y: 0 }} end={end ?? { x: 1, y: 0 }}>
      <Text {...textProps} style={[style, { opacity: 0 }]}>
        {children}
      </Text>
    </LinearGradient>
  </MaskedView>
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
