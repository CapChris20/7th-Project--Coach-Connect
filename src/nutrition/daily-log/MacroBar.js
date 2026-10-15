// One protein / carb / fat bar on the daily food log.
// Flow: turn current vs target into a percent → animate the fill if a shared Animated.Value was passed → paint the bar.
// Used by: the client's daily food log screen.

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../look-and-feel/lightDarkMode';

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
  return StyleSheet.create({
    container: {
      marginBottom: 16,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    label: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    value: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    barContainer: {
      height: 8,
      backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(26,26,26,0.08)',
      borderRadius: 4,
      overflow: 'hidden',
    },
    bar: {
      height: '100%',
      borderRadius: 4,
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

  const barColor = barColorForFill(current, target, color);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label} selectable={true}>{label}</Text>
        <Text style={styles.value} selectable={true}>
          {current.toFixed(1)}/{target.toFixed(1)}g
        </Text>
      </View>
      <View style={styles.barContainer}>
        <Animated.View
          style={[
            styles.bar,
            {
              width: animatedWidth,
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
    </View>
  );
}
