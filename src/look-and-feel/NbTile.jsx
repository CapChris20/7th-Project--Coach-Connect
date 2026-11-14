// Neobrutalist status tile — one metric on a Design Law gradient shell.
// Flow: pick water/sleep/energy preset → paint LinearGradient shell → icon + value + label on top.
// Used by: dashboard / home status blocks that show a single number with a colored wash.
//
// vocab: LinearGradient = Expo view that fills with a color ramp (not a flat backgroundColor)
// vocab: tile = compact bordered card for one metric (water cups, sleep hours, energy)
// Manipulate here: styles.tile minHeight / padding; ink stays #0A0A0F (Design Law on-gradient text)

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, nb, gradients, spacing } from './colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_GRADIENT_KEY = 'water';

// Design Law ink on status gradients — keep letter-for-letter (not theme nbInk).
const TILE_INK_COLOR = '#0A0A0F';

// ===== HELPER FUNCTIONS =====

/**
 * Look up the frozen gradient stops for this metric key.
 * Keys stay water / sleep / energy — same letters colorPalette.gradients already exports.
 *
 * @param {'water' | 'sleep' | 'energy'} gradientKey
 * @returns {{ colors: string[], start: { x: number, y: number }, end: { x: number, y: number } }}
 */
function lookUpTileGradientPreset(gradientKey) {
  return gradients[gradientKey];
}

/**
 * Optional icon row above the big number. Skipped when the parent passes no icon.
 */
function TileIconRow({ icon }) {
  if (!icon) {
    return null;
  }

  return <View style={styles.iconContainer}>{icon}</View>;
}

/**
 * Value + uppercase label that sit on the gradient. Ink is fixed (readable on every preset).
 */
function TileValueAndLabel({ value, label }) {
  return (
    <>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </>
  );
}

/**
 * Everything inside the gradient shell — icon (optional), then the metric copy.
 */
function TileFaceContent({ icon, value, label }) {
  return (
    <>
      <TileIconRow icon={icon} />
      <TileValueAndLabel value={value} label={label} />
    </>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Gradient status tile with icon, value, and label.
 *
 * @param {object} props
 * @param {'water' | 'sleep' | 'energy'} [props.gradient='water'] - which Design Law gradient to use
 * @param {React.ReactNode} [props.icon] - icon component
 * @param {string} props.value - main value text
 * @param {string} props.label - label text
 * @param {object} [props.style] - additional container styles
 */
export default function NbTile({
  gradient = DEFAULT_GRADIENT_KEY,
  icon,
  value,
  label,
  style,
}) {
  // 1. Resolve the frozen gradient stops for this metric type.
  const gradientPreset = lookUpTileGradientPreset(gradient);

  // 2. Outer shell is the ramp; face content is ink on top (never white on pastel).
  const tileShellStyle = [styles.tile, style];

  // 3. Paint the gradient shell, then drop icon + value + label inside.
  return (
    <LinearGradient
      colors={gradientPreset.colors}
      start={gradientPreset.start}
      end={gradientPreset.end}
      style={tileShellStyle}
    >
      <TileFaceContent icon={icon} value={value} label={label} />
    </LinearGradient>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  tile: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    borderColor: TILE_INK_COLOR,
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
    color: TILE_INK_COLOR,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: TILE_INK_COLOR,
    textTransform: 'uppercase',
    letterSpacing: 0.1,
    marginTop: 2,
  },
});
