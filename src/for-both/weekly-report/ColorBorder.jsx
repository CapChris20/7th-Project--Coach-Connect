// A gradient ring around a card. The inner view is the solid fill.
// Flow: the gradient is the border thickness → the inner view sits inside that padding.
// Used by: weekly report cards.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ===== NAMED CONSTANTS =====

const DEFAULT_BORDER_WIDTH = 1.5;
const DEFAULT_RADIUS = 20;
const DEFAULT_GRADIENT_START = { x: 0, y: 0 };
const DEFAULT_GRADIENT_END = { x: 1, y: 1 };

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * @param {object} props
 */
export function ColorBorder({
  colors,
  borderWidth = DEFAULT_BORDER_WIDTH,
  radius = DEFAULT_RADIUS,
  style,
  innerStyle,
  innerBackground,
  start = DEFAULT_GRADIENT_START,
  end = DEFAULT_GRADIENT_END,
  children,
}) {
  const innerRadius = radius - borderWidth;
  return (
    <LinearGradient
      colors={colors}
      start={start}
      end={end}
      style={[{ borderRadius: radius, padding: borderWidth }, style]}
    >
      <View
        style={[
          styles.inner,
          { borderRadius: innerRadius, backgroundColor: innerBackground },
          innerStyle,
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  inner: {
    overflow: 'hidden',
  },
});
