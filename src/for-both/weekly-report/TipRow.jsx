// One tip card on the weekly report, numbered, with a colored edge.
// Flow: pick the pro or con colors → paint the border → show the number and the sentence.
// Used by: the tips list on the weekly report.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENTS, useTheme } from '../weekly-report/reportColorSettings';
import { ColorBorder } from './ColorBorder';

// ===== NAMED CONSTANTS =====

const PRO_VARIANT = 'pro';
const CON_VARIANT = 'con';
const DARK_MODE = 'dark';
const DARK_CARD_COLOR = 'rgba(14,14,22,0.98)';
const LIGHT_CARD_COLOR = '#ffffff';
const BORDER_WIDTH = 1.5;
const CARD_RADIUS = 18;
const WASH_START_ALPHA = '28';
const WASH_MID_ALPHA = '10';

const VARIANT_GRADIENTS = {
  [PRO_VARIANT]: { border: GRADIENTS.g1, badge: GRADIENTS.g3 },
  [CON_VARIANT]: { border: GRADIENTS.g4, badge: GRADIENTS.g3 },
};

// ===== HELPER FUNCTIONS =====

function paletteForVariant(variant) {
  if (VARIANT_GRADIENTS[variant]) return VARIANT_GRADIENTS[variant];
  return VARIANT_GRADIENTS[PRO_VARIANT];
}

function cardBackgroundForMode(mode) {
  if (mode === DARK_MODE) return DARK_CARD_COLOR;
  return LIGHT_CARD_COLOR;
}

function washColors(borderGradient) {
  return [
    `${borderGradient[0]}${WASH_START_ALPHA}`,
    `${borderGradient[1]}${WASH_MID_ALPHA}`,
    'transparent',
  ];
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ index: number|string, text: string, variant?: string }} props
 */
export function TipRow({ index, text, variant = PRO_VARIANT }) {
  const { colors, mode } = useTheme();
  const variantPalette = paletteForVariant(variant);
  const innerBackground = cardBackgroundForMode(mode);

  return (
    <ColorBorder
      colors={variantPalette.border}
      borderWidth={BORDER_WIDTH}
      radius={CARD_RADIUS}
      innerBackground={innerBackground}
      style={styles.cardWrap}
    >
      <LinearGradient
        colors={washColors(variantPalette.border)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.row}>
        <LinearGradient
          colors={variantPalette.badge}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.numBadge}
        >
          <Text style={styles.numText}>{index}</Text>
        </LinearGradient>

        <Text style={[styles.text, { color: colors.textPrimary }]}>{text}</Text>
      </View>
    </ColorBorder>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
  },
  numBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1a1a1a',
  },
  text: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.15,
    paddingTop: 6,
  },
});
