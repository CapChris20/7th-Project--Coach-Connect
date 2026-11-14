// One protein / carb / fat progress lane for the daily food log (Design Law gradients).
// Flow: read current vs target grams → pick macro gradient → fill NbProgressBar 0–1.
// Used by: LogTodaysMeals and trainer views. DailyFoodLogScreen may inline NbProgressBar instead.
// Read order: constants → helpers → numbered main → styles PLUMBING.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbProgressBar from '../../look-and-feel/NbProgressBar';

// ===== NAMED CONSTANTS =====

// Design Law macro lane fills — never green.
// Manipulate here: swap gradient pair stops to match updated Design-Law PNGs.
const MACRO_BAR_GRADIENT_STOPS = {
  protein: ['#60A5FA', '#818CF8'],
  carbs: ['#FDA4AF', '#FB923C'],
  fat: ['#FB7185', '#EF4444'],
};

// ===== HELPER FUNCTIONS =====

/**
 * Fill amount for NbProgressBar. Target 0 → empty bar; never above 1.
 * @param {number} currentGrams
 * @param {number} targetGrams
 * @returns {number}
 */
function computeMacroBarFillRatio(currentGrams, targetGrams) {
  if (targetGrams <= 0) return 0;
  const rawRatio = currentGrams / targetGrams;
  if (rawRatio > 1) return 1;
  return rawRatio;
}

/**
 * Pick the Design Law gradient pair from the lane label text.
 * @param {string} labelText
 * @returns {string[]}
 */
function gradientStopsForMacroLabel(labelText) {
  const normalizedLabel = String(labelText || '').toLowerCase();
  const labelMentionsCarbs = normalizedLabel.includes('carb');
  const labelMentionsFat = normalizedLabel.includes('fat');

  if (labelMentionsCarbs) return MACRO_BAR_GRADIENT_STOPS.carbs;
  if (labelMentionsFat) return MACRO_BAR_GRADIENT_STOPS.fat;
  return MACRO_BAR_GRADIENT_STOPS.protein;
}

/**
 * Build the "12 / 150 g" caption shown beside the macro name.
 * @param {number} currentGrams
 * @param {number} targetGrams
 * @returns {string}
 */
function gramsCaptionForMacroLane(currentGrams, targetGrams) {
  const currentGramsRounded = Math.round(currentGrams);
  const targetGramsRounded = Math.round(targetGrams);
  return `${currentGramsRounded} / ${targetGramsRounded} g`;
}

// ===== MAIN FUNCTION =====

/**
 * One macro lane: label, current/target grams, and a filled progress bar.
 * @param {{ label: string, current: number, target: number, color?: string, animatedValue?: object }} props
 */
export default function MacroBar({ label, current, target }) {
  // vocab: useTheme = Design Law light/dark token bag (nbInk, nbMuted, …)
  const { colors } = useTheme();

  // 1. How full the bar should look (0–1, capped when over target).
  const fillRatio = computeMacroBarFillRatio(current, target);

  // 2. Gradient stops from the macro name (protein / carbs / fat).
  const gradientStops = gradientStopsForMacroLabel(label);

  // 3. Name paint + caption before JSX (no nested ternaries in the tree).
  const gramsCaptionText = gramsCaptionForMacroLane(current, target);
  const labelTextColor = colors.nbInk;
  const valueTextColor = colors.nbMuted;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: labelTextColor }]} selectable>
          {label}
        </Text>
        <Text style={[styles.value, { color: valueTextColor }]} selectable>
          {gramsCaptionText}
        </Text>
      </View>
      <NbProgressBar progress={fillRatio} colors={gradientStops} />
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  container: { marginBottom: 12 },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
});
