// Hero disclaimer on food search: "verify before you log" plus calorie/protein/macro pills.
// Flow: pick dark vs light colors → always-expanded card → feature pills. No collapse.
// Used by: FoodSearchScreen idle browse state.
// Redesigned with neobrutalist components and tokens from colorPalette.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NbCard from '../../look-and-feel/NbCard';
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const CYAN = '#64D2FF';
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 0, y: 1 };

// Manipulate here: the four pills under the disclaimer. Labels are also React keys.
const FEATURES = [
  { icon: 'flame-outline', label: 'Calories' },
  { icon: 'barbell-outline', label: 'Protein' },
  { icon: 'pie-chart-outline', label: 'Macros' },
  { icon: 'restaurant-outline', label: 'Menus' },
];

// ===== HELPER FUNCTIONS =====

/**
 * vocab: disclaimerColors = neobrutalist tokens for dark vs light theme
 * @param {boolean} isDark
 * @returns {object}
 */
function disclaimerColors(isDark) {
  const colors = isDark ? darkColors : lightColors;
  return {
    labelColor: colors.nbMuted,
    headlineColor: colors.nbInk,
    subheadColor: colors.nbMuted,
    pillBackground: colors.nbSurfaceChip,
    pillText: colors.nbInk,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Hero disclaimer for food search with neobrutalist NbCard styling.
 * vocab: NbCard = card with thick border and hard shadow; always fully expanded.
 * @param {{ isDark?: boolean }} props
 */
export default function FoodSearchAccuracyHeroCard({ isDark = true }) {
  const colors = disclaimerColors(isDark);

  return (
    <NbCard
      style={styles.wrapper}
      accessibilityRole="summary"
      accessibilityLabel="Nutrition data accuracy notice"
    >
      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={styles.headerTextCol}>
            <Text style={[styles.label, { color: colors.labelColor }]}>NUTRITION DATA</Text>
            <Text style={[styles.headline, { color: colors.headlineColor }]}>
              Verify before you log
            </Text>
          </View>
        </View>

        <Text style={[styles.subhead, { color: colors.subheadColor }]}>
          Numbers come from trusted food databases and restaurant menus. Labels change often,
          so double-check serving sizes or edit entries after logging.
        </Text>

        <View style={styles.pillsRow}>
          {FEATURES.map(({ icon, label }) => (
            <View key={label} style={[styles.pill, { backgroundColor: colors.pillBackground }]}>
              <Ionicons name={icon} size={13} color={CYAN} style={styles.pillIcon} />
              <Text style={[styles.pillText, { color: colors.pillText }]} numberOfLines={1}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </NbCard>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
    padding: 16,
  },
  inner: {
    // NbCard provides the container
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 8,
  },
  label: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  headline: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    letterSpacing: -0.4,
  },
  subhead: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  pillIcon: {
    marginRight: 5,
  },
  pillText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
  },
});
