// Thin violet-to-steel ring around a compact input on nutrition modals.
// Flow: pick the dark or light border colors → paint the gradient ring → nest the field inside.
// Used by the edit-serving popup so those inputs match the food-search border.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ===== NAMED CONSTANTS =====

const BORDER_DARK = ['#6D62CE', '#9468A8', '#4F87BA'];
const BORDER_LIGHT = ['#7D72D4', '#9E72A4', '#5F92C4'];
const GRADIENT_LOCATIONS = [0, 0.5, 1];
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

// ===== HELPER FUNCTIONS =====

/**
 * Light mode uses the lighter violet set so the ring stays visible on a white field.
 * @param {boolean} isDark
 * @returns {string[]}
 */
function borderColorsForTheme(isDark) {
  if (isDark) return BORDER_DARK;
  return BORDER_LIGHT;
}

// ===== MAIN FUNCTION =====

/**
 * Gradient ring around one compact nutrition input.
 * @param {object} props
 * @param {boolean} props.isDark
 * @param {object} [props.style]
 * @param {React.ReactNode} props.children
 * @returns {JSX.Element}
 */
export default function ColorFieldFrame({ isDark, style, children }) {
  const borderGradientColors = borderColorsForTheme(isDark);
  return (
    // vocab: LinearGradient = a view painted with color stops instead of one flat background.
    <LinearGradient
      colors={borderGradientColors}
      start={GRADIENT_START}
      end={GRADIENT_END}
      locations={GRADIENT_LOCATIONS}
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
