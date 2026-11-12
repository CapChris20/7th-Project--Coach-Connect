// Design Law progress bar — 16 tall, 3px border, gradient fill with a hard right edge.
// Flow: clamp progress 0–1 → paint soft track → fill with accent gradient. Used by nutrition macros.
// vocab: progress = fraction complete (0 empty, 1 full)

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { accentGradients, nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: DESIGN-SYSTEM §6 Progress bar height
const BAR_HEIGHT = 16;

// ===== MAIN FUNCTION =====

/**
 * @param {{ progress: number, colors?: string[], index?: number, style?: object }} props
 */
export default function NbProgressBar({ progress = 0, colors, index = 0, style }) {
  const { colors: theme } = useTheme();
  const ramp = colors || accentGradients[index % accentGradients.length];
  const pct = Math.min(100, Math.max(0, Math.round((Number(progress) || 0) * 100)));

  return (
    <View
      style={[
        styles.track,
        {
          borderColor: theme.nbBorder,
          backgroundColor: theme.nbSoft,
        },
        style,
      ]}
    >
      <View style={[styles.fillWrap, { width: `${pct}%` }]}>
        <LinearGradient
          colors={ramp}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Hard right edge on the fill — Design Law “3px right edge” accent */}
        <View style={[styles.edge, { backgroundColor: theme.nbBorder }]} />
      </View>
    </View>
  );
}

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
