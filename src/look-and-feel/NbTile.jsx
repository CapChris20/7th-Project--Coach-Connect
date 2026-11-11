// Neobrutalist status tile with gradient background
// Flow: renders small tile with gradient (water/sleep/energy), icon, value, label
// Where used: dashboard, stats displays, status indicators
//
// vocab: tile = compact card showing a single metric or status

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, nb, gradients, spacing } from './colorPalette';

/**
 * Gradient status tile with icon, value, and label.
 * 
 * @param {object} props
 * @param {'water' | 'sleep' | 'energy'} props.gradient - which gradient to use
 * @param {React.ReactNode} [props.icon] - icon component
 * @param {string} props.value - main value text
 * @param {string} props.label - label text
 * @param {object} [props.style] - additional container styles
 */
export default function NbTile({ gradient = 'water', icon, value, label, style }) {
  const grad = gradients[gradient];
  
  return (
    <LinearGradient
      colors={grad.colors}
      start={grad.start}
      end={grad.end}
      style={[
        styles.tile,
        style,
      ]}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    borderColor: '#0A0A0F',
    padding: spacing.md,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: spacing.xs,
  },
  value: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 24,
    color: '#0A0A0F',
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#0A0A0F',
    textTransform: 'uppercase',
    letterSpacing: 0.1,
    marginTop: 2,
  },
});
