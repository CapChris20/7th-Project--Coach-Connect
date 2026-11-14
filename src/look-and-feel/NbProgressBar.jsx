// Design Law progress bar — soft track, gradient fill, hard 3px right edge on the fill.
// Flow: clamp caller fraction → pick gradient ramp → paint track → grow fill from the left.
// Where used: nutrition macro rows and any single continuous percent bar.
//
// vocab: progress = fraction 0–1 (0 empty, 1 full); LinearGradient = Expo fill that blends two+ colors
// Manipulate here: BAR_HEIGHT 16 (DESIGN-SYSTEM §6); edge width = nb.borderWidth

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { accentGradients, nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: Design Law progress bar is 16 tall — do not shrink below min touch guidance elsewhere
const BAR_HEIGHT = 16;
const MIN_FILL_PERCENT = 0;
const MAX_FILL_PERCENT = 100;
const GRADIENT_START = { x: 0, y: 0.5 };
const GRADIENT_END = { x: 1, y: 0.5 };

// ===== HELPER FUNCTIONS =====

/**
 * Turn a 0–1 fraction into a whole percent width for the fill View.
 * Bad / missing numbers become 0 so the bar never NaNs.
 */
function clampProgressToWholePercent(progressFraction) {
  const asNumber = Number(progressFraction) || 0;
  const asPercent = Math.round(asNumber * 100);
  const notBelowZero = Math.max(MIN_FILL_PERCENT, asPercent);
  return Math.min(MAX_FILL_PERCENT, notBelowZero);
}

/**
 * Explicit colors prop wins. Otherwise rotate accentGradients by index.
 */
function pickFillGradientColors(customColors, accentIndex) {
  if (customColors) {
    return customColors;
  }
  const paletteIndex = accentIndex % accentGradients.length;
  return accentGradients[paletteIndex];
}

/**
 * Build the width style the fill wrapper uses (percent of track).
 */
function buildFillWidthStyle(fillPercent) {
  return { width: `${fillPercent}%` };
}

function buildTrackThemeStyle(themeColors) {
  return {
    borderColor: themeColors.nbBorder,
    backgroundColor: themeColors.nbSoft,
  };
}

// ===== SMALL UI PIECES =====

/**
 * Gradient slab + hard right edge. Width comes from the parent percent.
 * vocab: StyleSheet.absoluteFillObject = stretch this child to every edge of the parent
 */
function ProgressBarFill({ fillPercent, gradientColors, edgeColor }) {
  const fillWidthStyle = buildFillWidthStyle(fillPercent);

  return (
    <View style={[styles.fillWrap, fillWidthStyle]}>
      <LinearGradient
        colors={gradientColors}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.edge, { backgroundColor: edgeColor }]} />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Continuous Design Law progress bar (track + gradient fill + hard edge).
 *
 * @param {object} props
 * @param {number} [props.progress=0] - fraction complete 0–1
 * @param {string[]} [props.colors] - optional gradient stops (overrides index ramp)
 * @param {number} [props.index=0] - which accentGradients pair when colors omitted
 * @param {object} [props.style] - extra styles on the track
 */
export default function NbProgressBar({
  progress = 0,
  colors: customGradientColors,
  index = 0,
  style,
}) {
  // vocab: useTheme = ThemeProvider hook → light/dark Design Law color bag
  const { colors: themeColors } = useTheme();

  // 1. Clamp the caller fraction into a safe 0–100 width percent.
  const fillPercent = clampProgressToWholePercent(progress);

  // 2. Pick the fill ramp — explicit colors win over rotating accentGradients.
  const gradientColors = pickFillGradientColors(customGradientColors, index);

  // 3. Track uses soft fill + border; overflow hidden clips the growing fill.
  const trackThemeStyle = buildTrackThemeStyle(themeColors);
  const hardEdgeColor = themeColors.nbBorder;

  return (
    <View style={[styles.track, trackThemeStyle, style]}>
      <ProgressBarFill
        fillPercent={fillPercent}
        gradientColors={gradientColors}
        edgeColor={hardEdgeColor}
      />
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  track: {
    height: BAR_HEIGHT,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  fillWrap: {
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 999,
  },
  edge: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: nb.borderWidth,
  },
});
