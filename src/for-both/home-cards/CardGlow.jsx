// A flat colored wash and shadow behind a hero card. It does not draw blobs.
// Flow: one absolutely positioned plate, tinted for light or dark.
// Used by: home cards.

import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

// ===== NAMED CONSTANTS =====

const DEFAULT_BORDER_RADIUS = 24;
const GLOW_EXTRA_RADIUS = 8;
const DARK_PLATE_COLOR = 'rgba(194, 65, 12, 0.16)';
const LIGHT_PLATE_COLOR = 'rgba(255, 107, 157, 0.10)';
const SHADOW_COLOR = '#C2410C';
const DARK_SHADOW_OPACITY = 0.55;
const LIGHT_SHADOW_OPACITY = 0.32;

// ===== HELPER FUNCTIONS =====

/**
 * @param {boolean} isDark
 * @param {number} borderRadius
 * @returns {object}
 */
function plateStyle(isDark, borderRadius) {
  let plateColor = LIGHT_PLATE_COLOR;
  let shadowOpacity = LIGHT_SHADOW_OPACITY;
  if (isDark) {
    plateColor = DARK_PLATE_COLOR;
    shadowOpacity = DARK_SHADOW_OPACITY;
  }
  const glowRadius = borderRadius + GLOW_EXTRA_RADIUS;
  return {
    borderRadius: glowRadius,
    backgroundColor: plateColor,
    ...Platform.select({
      ios: {
        shadowColor: SHADOW_COLOR,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity,
        shadowRadius: 22,
      },
      android: { elevation: 10 },
    }),
  };
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ isDark?: boolean, borderRadius?: number }} props
 */
export default function CardGlow({ isDark = true, borderRadius = DEFAULT_BORDER_RADIUS }) {
  // 1. One plate behind the card, tinted for light or dark. It does not catch taps.
  return <View style={[styles.plate, plateStyle(isDark, borderRadius)]} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  plate: {
    position: 'absolute',
    top: 10,
    left: 6,
    right: 6,
    bottom: 2,
    zIndex: 0,
  },
});
