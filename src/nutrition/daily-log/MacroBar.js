/**
 * Macro Bar
 *
 * Purpose: Macro Bar — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: MacroBar
 *
 * @file-header
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../shared-ui/ThemeContext';

export default function MacroBar({ label, current, target, color = '#10B981', animatedValue }) {
  const { colors, spacing, isDark } = useTheme();
  const styles = createStyles(spacing, colors, isDark);
  
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const widthAnim = animatedValue || new Animated.Value(0);

  useEffect(() => {
    if (animatedValue) {
      Animated.timing(animatedValue, {
        toValue: percentage / 100,
        duration: 800,
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

  const isComplete = current >= target;
  const barColor = isComplete ? '#10B981' : color;

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

const createStyles = (spacing, colors, isDark) =>
  StyleSheet.create({
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

