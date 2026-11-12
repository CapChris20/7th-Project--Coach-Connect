// Design Law protein / carb / fat bar on the daily food log.
// Flow: current vs target → NbProgressBar fill. Used when a parent wants a standalone lane.
// DailyFoodLogScreen inlines NbProgressBar; this stays for LogTodaysMeals / trainer reuse.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbProgressBar from '../../look-and-feel/NbProgressBar';

// ===== NAMED CONSTANTS =====

// Design Law macro fills — never green
const MACRO_BAR_COLORS = {
  protein: ['#60A5FA', '#818CF8'],
  carbs: ['#FDA4AF', '#FB923C'],
  fat: ['#FB7185', '#EF4444'],
};

// ===== HELPER FUNCTIONS =====

function macroFillPercent(current, target) {
  if (target > 0) return Math.min(current / target, 1);
  return 0;
}

function colorsForLabel(label) {
  const key = String(label || '').toLowerCase();
  if (key.includes('carb')) return MACRO_BAR_COLORS.carbs;
  if (key.includes('fat')) return MACRO_BAR_COLORS.fat;
  return MACRO_BAR_COLORS.protein;
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ label: string, current: number, target: number, color?: string, animatedValue?: object }} props
 */
export default function MacroBar({ label, current, target }) {
  const { colors } = useTheme();
  const percentage = macroFillPercent(current, target);
  const barColors = colorsForLabel(label);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.nbInk }]} selectable>
          {label}
        </Text>
        <Text style={[styles.value, { color: colors.nbMuted }]} selectable>
          {Math.round(current)} / {Math.round(target)} g
        </Text>
      </View>
      <NbProgressBar progress={percentage} colors={barColors} />
    </View>
  );
}

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
