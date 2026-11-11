// Neobrutalist pill badge — small rounded badge with text
// Flow: renders compact pill for tags, badges, counts
// Where used: status indicators, tags, counts, labels
//
// vocab: pill = small rounded badge, typically for status or tags

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { nb, gradients, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

/**
 * Small pill badge with optional gradient.
 * 
 * @param {object} props
 * @param {string} props.children - pill text
 * @param {'brand' | 'water' | 'sleep' | 'energy' | 'plain'} [props.variant] - color variant
 * @param {object} [props.style] - additional container styles
 */
export default function NbPill({ children, variant = 'plain', style }) {
  const { colors } = useTheme();
  
  const gradient = variant !== 'plain' ? gradients[variant] : null;
  const textColor = variant === 'plain' ? colors.nbInk : '#0A0A0F';
  
  if (gradient) {
    return (
      <LinearGradient
        colors={gradient.colors}
        start={gradient.start}
        end={gradient.end}
        style={[
          styles.pill,
          {
            borderColor: '#0A0A0F',
          },
          style,
        ]}
      >
        <Text style={[styles.text, { color: textColor }]}>{children}</Text>
      </LinearGradient>
    );
  }
  
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: colors.nbSurfaceChip,
          borderColor: colors.nbBorder,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: textColor }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.1,
  },
});
