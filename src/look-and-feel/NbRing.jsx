// Neobrutalist circular progress ring with gradient stroke
// Flow: renders circular progress indicator using SVG with animated gradient stroke
// Where used: calorie tracking, goal progress, dashboard metrics
//
// vocab: ring = circular progress indicator showing percentage completion

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColorScheme } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { lightColors, darkColors, gradients, nb } from './colorPalette';

/**
 * Circular progress ring with gradient stroke.
 * 
 * @param {object} props
 * @param {number} props.progress - progress value (0-1)
 * @param {number} [props.size] - diameter in pixels (default 120)
 * @param {number} [props.strokeWidth] - stroke width (default 8)
 * @param {string} [props.label] - center label text
 * @param {string} [props.value] - center value text
 * @param {object} [props.style] - additional container styles
 */
export default function NbRing({ progress, size = 120, strokeWidth = 8, label, value, style }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);
  
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={gradients.brand.colors[0]} />
            <Stop offset="100%" stopColor={gradients.brand.colors[1]} />
          </SvgGradient>
        </Defs>
        
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.nbSurfaceChip}
          strokeWidth={strokeWidth}
          fill="none"
        />
        
        {/* Progress circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ringGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      
      <View style={styles.center}>
        {value && (
          <Text
            style={[
              styles.value,
              { color: colors.nbInk },
            ]}
          >
            {value}
          </Text>
        )}
        {label && (
          <Text
            style={[
              styles.label,
              { color: colors.nbMuted },
            ]}
          >
            {label}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 24,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.1,
    marginTop: 2,
  },
});
