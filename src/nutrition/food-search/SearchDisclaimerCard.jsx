// Soft accuracy note under food-search results (Design Law PNG 05/06).
// Flow: read theme tokens → HardShadow card → one muted paragraph.
// Used by FoodSearchScreen idle browse + results footer. Export name is frozen.
//
// vocab: HardShadow = solid offset shadow (no blur) — Design Law chrome, not CSS blur
// vocab: nbSoft = muted wash surface; nbMuted = secondary ink for the notice body

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, nb } from '../../look-and-feel/colorPalette';
import { useTheme } from '../../look-and-feel/lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: keep one short paragraph — PNG is a single note, not a FAQ
const DISCLAIMER_COPY =
  'Search packaged foods, restaurants, and groceries. Nutrition data comes from public databases and menus — verify serving sizes before you log.';

const ACCESSIBILITY_ROLE = 'summary';
const ACCESSIBILITY_LABEL = 'Nutrition data accuracy notice';

// ===== HELPER FUNCTIONS =====

/**
 * Paint bag for the notice card from Design Law theme tokens.
 * @param {{ nbSoft: string, nbBorder: string, nbMuted: string }} themeColors
 * @returns {{ cardBackground: string, cardBorder: string, bodyInk: string }}
 */
function noticeCardPaintFromTheme(themeColors) {
  return {
    cardBackground: themeColors.nbSoft,
    cardBorder: themeColors.nbBorder,
    bodyInk: themeColors.nbMuted,
  };
}

// ===== MAIN FUNCTION =====

/**
 * HardShadow accuracy card under search results / idle browse.
 * Flow: 1. theme colors  2. paint named locals  3. render one paragraph
 * @param {{ isDark?: boolean }} props
 * @returns {React.ReactElement}
 */
export default function FoodSearchAccuracyHeroCard({ isDark: legacyIsDarkFlag }) {
  // Older call sites still pass isDark; paint comes from useTheme only.
  // vocab: void = discard the value so lint does not flag an unused prop
  void legacyIsDarkFlag;

  // vocab: useTheme = Design Law light/dark tokens (nbBackground, nbInk, nbSoft, …)
  const { colors } = useTheme();

  // 1. Name the paint decisions before JSX (no nested ternaries in the tree).
  const { cardBackground, cardBorder, bodyInk } = noticeCardPaintFromTheme(colors);

  // 2. Render the notice card.
  return (
    <View
      accessibilityRole={ACCESSIBILITY_ROLE}
      accessibilityLabel={ACCESSIBILITY_LABEL}
      style={styles.wrapper}
    >
      <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbCard}>
        <View
          style={[
            styles.inner,
            {
              backgroundColor: cardBackground,
              borderColor: cardBorder,
            },
          ]}
        >
          <Text style={[styles.body, { color: bodyInk }]}>{DISCLAIMER_COPY}</Text>
        </View>
      </HardShadow>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  // Manipulate here: vertical breathing room under the results list card
  wrapper: {
    marginBottom: 14,
    marginTop: 4,
  },
  // Manipulate here: padding 14 matches Design Law / mockup soft note cards
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
