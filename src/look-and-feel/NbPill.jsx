// Neobrutalist pill badge — small rounded tag with optional accent gradient.
// Flow: pick variant look → gradient shell or plain chip → uppercase label.
// Used by: status indicators, tags, counts, weekly report eyebrows.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { nb, gradients, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

const VARIANT_PLAIN = 'plain';
// Manipulate here: gradient pills use fixed dark ink on bright ramps (Design Law accent pills)
const GRADIENT_PILL_INK = '#0A0A0F';
const GRADIENT_PILL_BORDER = '#0A0A0F';
const PILL_CORNER_RADIUS = 12;

// ===== HELPER FUNCTIONS =====

function pillVariantIsPlain(variant) {
  return variant === VARIANT_PLAIN;
}

/**
 * Look up Design Law gradient for brand/water/sleep/energy. Plain → null.
 * @param {string} variant
 * @returns {object|null}
 */
function findPillGradientForVariant(variant) {
  if (pillVariantIsPlain(variant)) {
    return null;
  }
  const gradientForVariant = gradients[variant];
  if (!gradientForVariant) {
    return null;
  }
  return gradientForVariant;
}

/**
 * Plain chips use theme ink; gradient chips use fixed dark ink on bright ramps.
 */
function pickPillLabelColor(variant, themeColors) {
  if (pillVariantIsPlain(variant)) {
    return themeColors.nbInk;
  }
  return GRADIENT_PILL_INK;
}

function PillGradientShell({ gradient, borderColor, labelColor, children, style }) {
  // vocab: LinearGradient = expo ramp; colors/start/end come from colorPalette gradients.*
  return (
    <LinearGradient
      colors={gradient.colors}
      start={gradient.start}
      end={gradient.end}
      style={[styles.pill, { borderColor }, style]}
    >
      <Text style={[styles.text, { color: labelColor }]}>{children}</Text>
    </LinearGradient>
  );
}

function PillPlainShell({ surfaceColor, borderColor, labelColor, children, style }) {
  const plainChrome = {
    backgroundColor: surfaceColor,
    borderColor,
  };

  return (
    <View style={[styles.pill, plainChrome, style]}>
      <Text style={[styles.text, { color: labelColor }]}>{children}</Text>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Small uppercase pill. Plain = surface chip; other variants = Design Law accent gradients.
 *
 * @param {{
 *   children: import('react').ReactNode,
 *   variant?: 'brand' | 'water' | 'sleep' | 'energy' | 'plain',
 *   style?: object,
 * }} props
 */
export default function NbPill({ children, variant = 'plain', style }) {
  // vocab: useTheme = Design Law light/dark tokens (nbSurfaceChip, nbBorder, nbInk)
  const { colors: themeColors } = useTheme();

  // 1. Resolve gradient (if any) and label color from variant + theme.
  const gradient = findPillGradientForVariant(variant);
  const labelColor = pickPillLabelColor(variant, themeColors);

  // 2. Gradient variant gets a ramp shell; plain gets a surface chip.
  if (gradient) {
    return (
      <PillGradientShell
        gradient={gradient}
        borderColor={GRADIENT_PILL_BORDER}
        labelColor={labelColor}
        style={style}
      >
        {children}
      </PillGradientShell>
    );
  }

  return (
    <PillPlainShell
      surfaceColor={themeColors.nbSurfaceChip}
      borderColor={themeColors.nbBorder}
      labelColor={labelColor}
      style={style}
    >
      {children}
    </PillPlainShell>
  );
}

// PLUMBING — skip unless debugging pill padding / type
const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: PILL_CORNER_RADIUS,
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
