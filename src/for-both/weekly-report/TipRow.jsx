// One focus tip row — handoff icon chip on the left, coach sentence on the right.
// Flow: normalize list index → pick icon + accent → render chip + text.
// Used by WinsAndWorkOnsSection focus cards (and trainer priority lists styled as tips).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NbIconChip from '../../look-and-feel/NbIconChip';
import { accentGradients, nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

const SLEEP_HANDOFF_ICON = require('../../assets/icons/handoff/sleeping.png');
const PROTEIN_HANDOFF_ICON = require('../../assets/icons/handoff/protein.png');
const WORKOUT_HANDOFF_ICON = require('../../assets/icons/handoff/workout.png');
const ENERGY_HANDOFF_ICON = require('../../assets/icons/handoff/energy.png');
const STRESS_HANDOFF_ICON = require('../../assets/icons/handoff/stress.png');

// Manipulate here: chip diameter beside tip copy (matches report stat icon chips)
const TIP_ICON_CHIP_SIZE = 40;

// Rotates through handoff art when the parent only passes a list position.
const HANDOFF_ICONS_IN_CYCLE = [
  SLEEP_HANDOFF_ICON,
  PROTEIN_HANDOFF_ICON,
  WORKOUT_HANDOFF_ICON,
  ENERGY_HANDOFF_ICON,
  STRESS_HANDOFF_ICON,
];

// Manipulate here: multiply tip slot by this so neighbor tips land on different accents
const ACCENT_INDEX_STRIDE = 3;

// ===== HELPER FUNCTIONS =====

/**
 * Parents often pass 1-based tip numbers (1, 2, 3…). Icon pickers want 0-based slots.
 * Bad or missing numbers fall back to slot 0 so the first handoff icon still shows.
 */
function tipSlotFromParentIndex(rawParentIndex) {
  const asNumber = Number(rawParentIndex);
  const zeroBasedSlot = asNumber - 1;
  const slotIsValid = Number.isFinite(zeroBasedSlot) && zeroBasedSlot >= 0;
  if (slotIsValid) return zeroBasedSlot;
  return 0;
}

function handoffIconForTipSlot(tipSlot) {
  const cycleLength = HANDOFF_ICONS_IN_CYCLE.length;
  const cyclePosition = tipSlot % cycleLength;
  return HANDOFF_ICONS_IN_CYCLE[cyclePosition];
}

function accentColorsForTipSlot(tipSlot) {
  // vocab: accentGradients = Design Law kit of small accent color pairs for NbIconChip
  const howManyGradients = accentGradients.length;
  const gradientSlot = (tipSlot * ACCENT_INDEX_STRIDE) % howManyGradients;
  return accentGradients[gradientSlot];
}

// ===== MAIN FUNCTION =====

/**
 * One tip line with a rotating handoff chip. `variant` is accepted so older callers
 * can still pass it; this row no longer switches chrome by variant.
 * @param {{ index?: number, text: string, variant?: string }} props
 */
export function TipRow({ index = 0, text, variant: _unusedVariant }) {
  // vocab: useTheme = reportColorSettings hook — light/dark token bag for this screen
  const { colors } = useTheme();

  // 1. Turn the parent’s list number into a safe 0-based slot.
  const tipSlot = tipSlotFromParentIndex(index);

  // 2. Precompute chip inputs so JSX stays a flat read (no nested ternaries).
  const chipImageSource = handoffIconForTipSlot(tipSlot);
  const chipAccentColors = accentColorsForTipSlot(tipSlot);
  const chipAccentIndex = tipSlot * ACCENT_INDEX_STRIDE;
  const tipSentenceColor = colors.textPrimary;

  // 3. Chip on the left, tip sentence on the right.
  return (
    <View style={styles.row}>
      <NbIconChip
        source={chipImageSource}
        index={chipAccentIndex}
        size={TIP_ICON_CHIP_SIZE}
        colors={chipAccentColors}
      />
      <Text style={[styles.text, { color: tipSentenceColor }]}>{text}</Text>
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
