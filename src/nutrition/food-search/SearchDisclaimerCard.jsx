// Design Law search disclaimer (PNG 05/06): short note under results / idle browse.
// Flow: theme tokens → HardShadow card → plain body copy. No feature pills, no GradientFrame.
// Used by: FoodSearchScreen idle browse + results footer.
//
// vocab: HardShadow = solid offset shadow (no blur); nbSoft = muted surface wash

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, nb } from '../../look-and-feel/colorPalette';
import { useTheme } from '../../look-and-feel/lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: disclaimer copy (keep short — PNG is one paragraph)
const DISCLAIMER_COPY =
  'Search packaged foods, restaurants, and groceries. Nutrition data comes from public databases and menus — verify serving sizes before you log.';

// ===== MAIN FUNCTION =====

/**
 * Compact HardShadow disclaimer for food search.
 * @param {{ isDark?: boolean }} props — isDark kept for call-site compat; theme drives paint
 */
export default function FoodSearchAccuracyHeroCard({ isDark: _isDark }) {
  const { colors } = useTheme();

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel="Nutrition data accuracy notice"
      style={styles.wrapper}
    >
      <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbCard}>
        <View
          style={[
            styles.inner,
            {
              backgroundColor: colors.nbSoft,
              borderColor: colors.nbBorder,
            },
          ]}
        >
          <Text style={[styles.body, { color: colors.nbMuted }]}>{DISCLAIMER_COPY}</Text>
        </View>
      </HardShadow>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
    marginTop: 4,
  },
  inner: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
});
