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
const DARK_MODE = 'dark';
const DARK_CARD_COLOR = 'rgba(14,14,22,0.98)';
const LIGHT_CARD_COLOR = '#ffffff';

const VARIANT_GRADIENTS = {
  pro: { border: GRADIENTS.g1, badge: GRADIENTS.g3 },
  con: { border: GRADIENTS.g4, badge: GRADIENTS.g3 },
};

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * @param {{ index: number|string, text: string, variant?: string }} props
 */
export function TipRow({ index, text, variant = PRO_VARIANT }) {
  const { colors, mode } = useTheme();
  const variantPalette = VARIANT_GRADIENTS[variant] || VARIANT_GRADIENTS.pro;
  const isDarkMode = mode === DARK_MODE;
  const innerBackground = isDarkMode ? DARK_CARD_COLOR : LIGHT_CARD_COLOR;

  return (
    <ColorBorder
      colors={variantPalette.border}
      borderWidth={1.5}
      radius={18}
      innerBackground={innerBackground}
      style={styles.cardWrap}
    >
      <LinearGradient
        colors={[`${variantPalette.border[0]}28`, `${variantPalette.border[1]}10`, 'transparent']}
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
