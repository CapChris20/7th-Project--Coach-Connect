// Design Law page chrome: hard-shadow back square + title (+ optional subtitle).
// Flow: safe-area top inset → back chip → title stack. Used by Settings and every settings subpage.
// vocab: backSq = 44×44 outlined chip with offset hard shadow (not the home TopHeader icon chips)
// vocab: SHELL_SAFE_AREA_EDGES = left/right only — THIS header always owns the status-bar inset

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './lightDarkMode';
import { nb, spacing } from './colorPalette';

// ===== MAIN FUNCTION =====

/**
 * Always pads `insets.top` so titles never sit under the Dynamic Island / status bar.
 * `skipTopSafeInset` is kept for call-site compat but ignored — shell SafeAreas do not own top.
 * @param {{ title: string, subtitle?: string|null, onBack?: Function, skipTopSafeInset?: boolean }} props
 */
export default function NbPageHeader({ title, subtitle = null, onBack, skipTopSafeInset: _skipTopSafeInset = false }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Manipulate here: gap under status bar after the safe inset
  const topPad = Math.max(insets.top, 0) + spacing.sm;

  return (
    <View style={[styles.pageHeader, { paddingTop: topPad }]}>
      {typeof onBack === 'function' ? (
        <TouchableOpacity
          onPress={onBack}
          style={[
            styles.backSq,
            {
              borderColor: colors.nbBorder,
              backgroundColor: colors.nbSurface,
              shadowColor: colors.nbShadow,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          activeOpacity={0.85}
        >
          <Ionicons name="chevron-back" size={22} color={colors.nbInk} />
        </TouchableOpacity>
      ) : (
        <View style={styles.backSqSpacer} />
      )}
      <View style={styles.pageHeaderText}>
        <Text style={[styles.pageTitle, { color: colors.nbInk }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.pageSubtitle, { color: colors.nbMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  // Manipulate here: back chip size / radius / hard shadow offset
  backSq: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  backSqSpacer: { width: 44, height: 44 },
  pageHeaderText: { flex: 1, minWidth: 0 },
  pageTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    letterSpacing: -0.4,
  },
  pageSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
});
