// Thin gradient ring around a compact input on nutrition modals.
// Flow: pick the dark or light border colors → paint the gradient ring → nest the field inside.
// Used by the edit-serving popup so those inputs match the food-search border.
// Redesigned with neobrutalist nb.borderWidth.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { nb, gradients } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const GRADIENT_LOCATIONS = [0, 0.5, 1];
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

// ===== HELPER FUNCTIONS =====

/**
 * Use ink gradient for neobrutalist styling.
 * @param {boolean} isDark
 * @returns {string[]}
 */
function borderColorsForTheme(isDark) {
  return gradients.ink.colors;
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
  const ringStyle = [styles.ring, style];
  return (
    // vocab: LinearGradient = a view painted with color stops instead of one flat background.
    <LinearGradient
      colors={borderGradientColors}
      start={GRADIENT_START}
      end={GRADIENT_END}
      locations={GRADIENT_LOCATIONS}
      style={ringStyle}
    >
      <View style={styles.inner}>{children}</View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderRadius: 14,
    padding: nb.borderWidth,
  },
  inner: {
    borderRadius: 12,
    overflow: 'hidden',
  },
});
