// Gradient icon chip — small accent only (handoff). Owner icon art sits inside.
// Flow: LinearGradient square → Image/children centered. Used on dashboard number cards and nav-adjacent chrome.

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { accentGradients, borderRadius, nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

const DEFAULT_SIZE = 44;
const ICON_SIZE = 28;

// ===== MAIN FUNCTION =====

/**
 * @param {{ source?: number|object, children?: import('react').ReactNode, colors?: string[], size?: number, style?: object, index?: number }} props
 */
export default function NbIconChip({ source, children, colors, size = DEFAULT_SIZE, style, index = 0 }) {
  const { colors: theme } = useTheme();
  const ramp = colors || accentGradients[index % accentGradients.length];
  // Design Law: chip outline follows theme border (white in dark), never a fixed purple/black-only stroke
  return (
    <LinearGradient
      colors={ramp}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.chip,
        {
          width: size,
          height: size,
          borderRadius: borderRadius.nbIconChip,
          borderWidth: nb.borderWidth,
          borderColor: theme.nbBorder,
        },
        style,
      ]}
    >
      {source ? (
        <Image source={source} style={{ width: ICON_SIZE, height: ICON_SIZE }} resizeMode="contain" />
      ) : (
        children
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
