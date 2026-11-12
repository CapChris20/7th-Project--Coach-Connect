// Design Law circular progress ring — soft track, fill stroke (solid ink or accent gradient).
// Flow: clamp progress → SVG track + arc → value/label centered. Used by nutrition kcal left.
// vocab: strokeDashoffset = how much of the arc is “hidden”; larger offset = less fill painted

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { accentGradients, nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: PNG calorie ring is solid fill; gradient is for accent-only rings
const DEFAULT_SIZE = 120;
const DEFAULT_STROKE = 12;

// ===== MAIN FUNCTION =====

/**
 * @param {object} props
 * @param {number} props.progress - 0–1 fraction complete
 * @param {number} [props.size]
 * @param {number} [props.strokeWidth]
 * @param {string} [props.label] - small caps under the value (e.g. KCAL LEFT)
 * @param {string|number} [props.value] - big center number
 * @param {'ink'|'gradient'} [props.variant] - ink = nbFill (PNG daily log); gradient = accent
 * @param {string[]} [props.colors] - optional gradient stops when variant is gradient
 * @param {number} [props.index] - which accentGradients pair when colors omitted
 * @param {object} [props.style]
 */
export default function NbRing({
  progress,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE,
  label,
  value,
  variant = 'ink',
  colors: gradientColors,
  index = 0,
  style,
}) {
  const { colors } = useTheme();

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, Number(progress) || 0));
  const strokeDashoffset = circumference * (1 - clamped);
  const gradId = `ringGradient_${size}_${strokeWidth}_${index}`;
  const ramp = gradientColors || accentGradients[index % accentGradients.length];
  const useGradient = variant === 'gradient';

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        {useGradient ? (
          <Defs>
            <SvgGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={ramp[0]} />
              <Stop offset="100%" stopColor={ramp[1]} />
            </SvgGradient>
          </Defs>
        ) : null}

        {/* Soft track behind the progress arc */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.nbSoft}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress arc — ink matches PNG kcal ring; gradient is accent-only */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={useGradient ? `url(#${gradId})` : colors.nbFill}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View style={styles.center} pointerEvents="none">
        {value != null && value !== '' ? (
          <Text style={[styles.value, { color: colors.nbInk, fontSize: size > 130 ? 28 : 22 }]}>
            {value}
          </Text>
        ) : null}
        {label ? (
          <Text style={[styles.label, { color: colors.nbMuted }]} numberOfLines={2}>
            {label}
          </Text>
        ) : null}
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
    paddingHorizontal: 10,
  },
  value: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
    textAlign: 'center',
    // Design Law: never below 12 — bump via line; 11 used only when ring is tiny
    minFontSize: nb.minTouchTarget ? 12 : 12,
  },
});
