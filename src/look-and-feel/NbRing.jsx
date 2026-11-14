// Design Law circular progress ring — soft track, fill stroke (solid ink or accent gradient).
// Flow: clamp progress → measure radius/circumference → SVG track + arc → center value/label.
// Where used: nutrition kcal-left ring and other circular progress callouts.
//
// vocab: strokeDashoffset = how much of the arc is “hidden”; larger offset = less fill painted
//        strokeDasharray = full circle length; together they reveal progress as an arc
// Manipulate here: DEFAULT_SIZE 120, DEFAULT_STROKE 12; PNG calorie ring stays variant="ink"

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { accentGradients, nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: PNG calorie ring is solid fill; gradient is for accent-only rings
const DEFAULT_SIZE = 120;
const DEFAULT_STROKE = 12;
const LARGE_RING_SIZE_CUTOFF = 130;
const LARGE_VALUE_FONT_SIZE = 28;
const SMALL_VALUE_FONT_SIZE = 22;
const VARIANT_GRADIENT = 'gradient';
const VARIANT_INK = 'ink';

// ===== HELPER FUNCTIONS =====

/**
 * Clamp progress into 0–1. Missing / NaN becomes 0 so dash math stays finite.
 */
function clampProgressFraction(rawProgress) {
  const asNumber = Number(rawProgress) || 0;
  const notBelowZero = Math.max(0, asNumber);
  return Math.min(1, notBelowZero);
}

/**
 * Radius sits inside the stroke; circumference is the full dash length.
 */
function computeRingMeasurements(ringSize, strokeWidth) {
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  return { radius, circumference };
}

/**
 * Hide the unfinished portion of the arc.
 * vocab: (1 - progress) of the circumference stays undrawn
 */
function computeStrokeDashOffset(circumference, progressFraction) {
  return circumference * (1 - progressFraction);
}

/**
 * Unique SVG gradient id so multiple rings on one screen do not collide.
 */
function buildGradientDefinitionId(ringSize, strokeWidth, gradientIndex) {
  return `ringGradient_${ringSize}_${strokeWidth}_${gradientIndex}`;
}

/**
 * Explicit colors prop wins. Otherwise rotate accentGradients by index.
 */
function pickGradientColorPair(customColors, gradientIndex) {
  if (customColors) {
    return customColors;
  }
  const paletteIndex = gradientIndex % accentGradients.length;
  return accentGradients[paletteIndex];
}

function pickCenterValueFontSize(ringSize) {
  if (ringSize > LARGE_RING_SIZE_CUTOFF) {
    return LARGE_VALUE_FONT_SIZE;
  }
  return SMALL_VALUE_FONT_SIZE;
}

function centerValueShouldShow(centerValue) {
  if (centerValue == null) {
    return false;
  }
  if (centerValue === '') {
    return false;
  }
  return true;
}

function pickProgressStrokePaint(useGradientFill, gradientDefinitionId, inkFillColor) {
  if (useGradientFill) {
    return `url(#${gradientDefinitionId})`;
  }
  return inkFillColor;
}

function buildSpinArcToTopTransform(ringSize) {
  // vocab: SVG rotate(-90 cx cy) = start the arc at 12 o'clock instead of 3 o'clock
  return `rotate(-90 ${ringSize / 2} ${ringSize / 2})`;
}

// ===== SMALL UI PIECES =====

function RingGradientDefinition({ definitionId, colorPair }) {
  return (
    <Defs>
      <SvgGradient id={definitionId} x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor={colorPair[0]} />
        <Stop offset="100%" stopColor={colorPair[1]} />
      </SvgGradient>
    </Defs>
  );
}

function RingTrackCircle({ ringSize, radius, strokeWidth, trackColor }) {
  return (
    <Circle
      cx={ringSize / 2}
      cy={ringSize / 2}
      r={radius}
      stroke={trackColor}
      strokeWidth={strokeWidth}
      fill="none"
    />
  );
}

function RingProgressArc({
  ringSize,
  radius,
  strokeWidth,
  circumference,
  strokeDashoffset,
  strokePaint,
}) {
  const spinToTop = buildSpinArcToTopTransform(ringSize);

  return (
    <Circle
      cx={ringSize / 2}
      cy={ringSize / 2}
      r={radius}
      stroke={strokePaint}
      strokeWidth={strokeWidth}
      strokeDasharray={circumference}
      strokeDashoffset={strokeDashoffset}
      strokeLinecap="round"
      fill="none"
      transform={spinToTop}
    />
  );
}

function RingCenterContent({ ringSize, centerValue, label, inkColor, mutedColor }) {
  const showValue = centerValueShouldShow(centerValue);
  const valueFontSize = pickCenterValueFontSize(ringSize);

  let valueNode = null;
  if (showValue) {
    valueNode = (
      <Text style={[styles.value, { color: inkColor, fontSize: valueFontSize }]}>
        {centerValue}
      </Text>
    );
  }

  let labelNode = null;
  if (label) {
    labelNode = (
      <Text style={[styles.label, { color: mutedColor }]} numberOfLines={2}>
        {label}
      </Text>
    );
  }

  return (
    <View style={styles.center} pointerEvents="none">
      {valueNode}
      {labelNode}
    </View>
  );
}

/**
 * Soft track + progress arc. Gradient defs only when variant is gradient.
 */
function RingSvgLayers({
  ringSize,
  strokeWidth,
  radius,
  circumference,
  strokeDashoffset,
  useGradientFill,
  gradientDefinitionId,
  gradientColorPair,
  trackColor,
  progressStrokePaint,
}) {
  let gradientDefinitionNode = null;
  if (useGradientFill) {
    gradientDefinitionNode = (
      <RingGradientDefinition
        definitionId={gradientDefinitionId}
        colorPair={gradientColorPair}
      />
    );
  }

  return (
    <Svg width={ringSize} height={ringSize}>
      {gradientDefinitionNode}
      <RingTrackCircle
        ringSize={ringSize}
        radius={radius}
        strokeWidth={strokeWidth}
        trackColor={trackColor}
      />
      <RingProgressArc
        ringSize={ringSize}
        radius={radius}
        strokeWidth={strokeWidth}
        circumference={circumference}
        strokeDashoffset={strokeDashoffset}
        strokePaint={progressStrokePaint}
      />
    </Svg>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Circular Design Law progress ring with optional center value + label.
 *
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
  variant = VARIANT_INK,
  colors: gradientColors,
  index = 0,
  style,
}) {
  // vocab: useTheme = ThemeProvider hook → light/dark Design Law color bag
  const { colors: themeColors } = useTheme();

  // 1. Turn the incoming fraction into safe ring math (radius, circumference, dash hide).
  const progressFraction = clampProgressFraction(progress);
  const { radius, circumference } = computeRingMeasurements(size, strokeWidth);
  const strokeDashoffset = computeStrokeDashOffset(circumference, progressFraction);

  // 2. Decide ink vs gradient stroke paint — gradient needs a unique SVG id per instance.
  const useGradientFill = variant === VARIANT_GRADIENT;
  const gradientDefinitionId = buildGradientDefinitionId(size, strokeWidth, index);
  const gradientColorPair = pickGradientColorPair(gradientColors, index);
  const progressStrokePaint = pickProgressStrokePaint(
    useGradientFill,
    gradientDefinitionId,
    themeColors.nbFill,
  );

  // 3. Stack soft track, progress arc, then optional center value + label.
  const ringBoxStyle = { width: size, height: size };

  return (
    <View style={[styles.container, ringBoxStyle, style]}>
      <RingSvgLayers
        ringSize={size}
        strokeWidth={strokeWidth}
        radius={radius}
        circumference={circumference}
        strokeDashoffset={strokeDashoffset}
        useGradientFill={useGradientFill}
        gradientDefinitionId={gradientDefinitionId}
        gradientColorPair={gradientColorPair}
        trackColor={themeColors.nbSoft}
        progressStrokePaint={progressStrokePaint}
      />
      <RingCenterContent
        ringSize={size}
        centerValue={value}
        label={label}
        inkColor={themeColors.nbInk}
        mutedColor={themeColors.nbMuted}
      />
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

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
