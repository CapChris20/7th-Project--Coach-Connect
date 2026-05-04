import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/** Soft violet→mauve→steel border (matches FoodSearchScreen, not harsh rainbow). */
const BORDER_DARK = ['#6D62CE', '#9468A8', '#4F87BA'];
const BORDER_LIGHT = ['#7D72D4', '#9E72A4', '#5F92C4'];

/**
 * Thin gradient ring around a field — use for compact inputs on nutrition modals.
 */
export default function GradientFieldFrame({ isDark, style, children }) {
  const colors = isDark ? BORDER_DARK : BORDER_LIGHT;
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      locations={[0, 0.5, 1]}
      style={[styles.ring, style]}
    >
      <View style={styles.inner}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderRadius: 14,
    padding: 1.25,
  },
  inner: {
    borderRadius: 13,
    overflow: 'hidden',
  },
});
