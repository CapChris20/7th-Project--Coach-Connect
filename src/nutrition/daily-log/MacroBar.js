// One protein / carb / fat bar on the daily food log.
// Flow: turn current vs target into a percent → animate the fill if a shared Animated.Value was passed → paint the bar.
// Used by: the client's daily food log screen.
// Redesigned with neobrutalist gradient bars with thick borders and hard shadows.

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { lightColors, darkColors, nb, gradients } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_BAR_COLOR = '#10B981';
const COMPLETE_BAR_COLOR = '#10B981';
const PERCENT_MAX = 100;
// Manipulate here: higher = slower fill animation when the parent passes animatedValue.
const FILL_ANIMATION_MS = 800;

// ===== HELPER FUNCTIONS =====

/**
 * How full the bar should be. Target 0 would divide by zero, so that reads as 0%.
 * @param {number} current
 * @param {number} target
 * @returns {number}
 */
function macroFillPercent(current, target) {
  if (target > 0) return Math.min((current / target) * PERCENT_MAX, PERCENT_MAX);
  return 0;
}

/**
 * Hitting the target turns the bar green even when the caller passed a different color.
 * @param {number} current
 * @param {number} target
 * @param {string} color
 * @returns {string}
 */
function barColorForFill(current, target, color) {
  const isComplete = current >= target;
  return isComplete ? COMPLETE_BAR_COLOR : color;
}

/**
 * @param {object} spacing
 * @param {object} colors
 * @param {boolean} isDark
 */
function createStyles(spacing, colors, isDark) {
  const themeColors = isDark ? darkColors : lightColors;
  return StyleSheet.create({
    container: {
      marginBottom: 12,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    label: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 13,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: themeColors.nbInk,
    },
    value: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: themeColors.nbMuted,
      fontVariant: ['tabular-nums'],
    },
    barContainer: {
      height: 14,
      backgroundColor: themeColors.nbSurfaceChip,
      borderRadius: 8,
      borderWidth: nb.borderWidth,
      borderColor: themeColors.nbBorder,
      overflow: 'hidden',
    },
    bar: {
      height: '100%',
    },
  });
}

// ===== MAIN FUNCTION =====

/**
 * Food-log macro bar (grams current / grams target) with an optional shared fill animation.
 * @param {{ label: string, current: number, target: number, color?: string, animatedValue?: object }} props
 */
export default function MacroBar({
  label,
  current,
  target,
  color = DEFAULT_BAR_COLOR,
  animatedValue,
}) {
  const { colors, spacing, isDark } = useTheme();
  const styles = createStyles(spacing, colors, isDark);

  const percentage = macroFillPercent(current, target);
  // Keep a local Animated.Value when the parent did not pass one, matching the original render path.
  const widthAnim = animatedValue || new Animated.Value(0);

  useEffect(() => {
    if (animatedValue) {
      // vocab: useNativeDriver false because width is a layout property, not transform/opacity.
      Animated.timing(animatedValue, {
        toValue: percentage / PERCENT_MAX,
        duration: FILL_ANIMATION_MS,
        useNativeDriver: false,
      }).start();
    }
  }, [current, target, animatedValue]);

  const animatedWidth = animatedValue
    ? animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', `${percentage}%`],
      })
    : `${percentage}%`;

  // vocab: gradient bar uses brand gradient for macro visualization
  const gradientColors = gradients.brand.colors;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label} selectable={true}>{label}</Text>
        <Text style={styles.value} selectable={true}>
          {Math.round(current)}/{Math.round(target)}g
        </Text>
      </View>
      <View style={styles.barContainer}>
        <Animated.View
          style={[
            styles.bar,
            {
              width: animatedWidth,
            },
          ]}
        >
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </View>
  );
}
