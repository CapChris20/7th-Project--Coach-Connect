// Design Law focus tip — gradient icon chip + sentence (progress “What to focus on”).
// Flow: pick accent by index → NbIconChip → tip text. No numbered pro/con chrome.
// Used by: WinsAndWorkOnsSection focus list (and trainer priorities when styled as tips).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NbIconChip from '../../look-and-feel/NbIconChip';
import { accentGradients, nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

const SLEEP_ICON = require('../../assets/icons/handoff/sleeping.png');
const PROTEIN_ICON = require('../../assets/icons/handoff/protein.png');
const WORKOUT_ICON = require('../../assets/icons/handoff/workout.png');
const ENERGY_ICON = require('../../assets/icons/handoff/energy.png');
const STRESS_ICON = require('../../assets/icons/handoff/stress.png');
const CHIP_SIZE = 40;

const TIP_ICONS = [SLEEP_ICON, PROTEIN_ICON, WORKOUT_ICON, ENERGY_ICON, STRESS_ICON];

// ===== HELPER FUNCTIONS =====

function iconForIndex(index) {
  return TIP_ICONS[index % TIP_ICONS.length];
}

function gradientForIndex(index) {
  // Manipulate here: stride accents so neighbors differ (Design Law kit stride)
  return accentGradients[(index * 3) % accentGradients.length];
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ index?: number, text: string, variant?: string }} props
 */
export function TipRow({ index = 0, text, variant: _variant }) {
  const { colors } = useTheme();
  const tipIndex = Math.max(0, Number(index) - 1 || 0);

  return (
    <View style={styles.row}>
      <NbIconChip
        source={iconForIndex(tipIndex)}
        index={tipIndex * 3}
        size={CHIP_SIZE}
        colors={gradientForIndex(tipIndex)}
      />
      <Text style={[styles.text, { color: colors.textPrimary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    minHeight: nb.minTouchTarget,
  },
  text: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
