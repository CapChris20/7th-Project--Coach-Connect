// Design Law page chrome: hard-shadow back square + title (+ optional subtitle / forward).
// Flow: safe-area top inset → back chip → title stack → optional forward chip.
// Used by Settings and every settings subpage; PDF viewer uses onForward for next page.
// vocab: backSq = 44×44 outlined chip with offset hard shadow (not the home TopHeader icon chips)
// vocab: SHELL_SAFE_AREA_EDGES = left/right only — THIS header always owns the status-bar inset

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './lightDarkMode';
import { nb, spacing } from './colorPalette';

// ===== HELPERS =====

/**
 * Hard-shadow square chip shared by back / forward.
 * @param {{ onPress?: Function, icon: string, label: string, disabled?: boolean, colors: object }} props
 */
function HeaderSquareChip({ onPress, icon, label, disabled = false, colors }) {
  if (typeof onPress !== 'function') {
    return <View style={styles.backSqSpacer} />;
  }
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.backSq,
        {
          borderColor: colors.nbBorder,
          backgroundColor: colors.nbSurface,
          shadowColor: colors.nbShadow,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      activeOpacity={0.85}
    >
      <Ionicons name={icon} size={22} color={colors.nbInk} />
    </TouchableOpacity>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Always pads `insets.top` so titles never sit under the Dynamic Island / status bar.
 * `skipTopSafeInset` is kept for call-site compat but ignored — shell SafeAreas do not own top.
 * @param {{
 *   title: string,
 *   subtitle?: string|null,
 *   onBack?: Function,
 *   onForward?: Function,
 *   forwardDisabled?: boolean,
 *   skipTopSafeInset?: boolean,
 * }} props
 */
export default function NbPageHeader({
  title,
  subtitle = null,
  onBack,
  onForward,
  forwardDisabled = false,
  skipTopSafeInset: _skipTopSafeInset = false,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Manipulate here: gap under status bar after the safe inset
  const topPad = Math.max(insets.top, 0) + spacing.sm;

  return (
    <View style={[styles.pageHeader, { paddingTop: topPad }]}>
      <HeaderSquareChip
        onPress={onBack}
        icon="chevron-back"
        label="Go back"
        colors={colors}
      />
      <View style={styles.pageHeaderText}>
        <Text style={[styles.pageTitle, { color: colors.nbInk }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.pageSubtitle, { color: colors.nbMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {/* Design Law PDF/media: optional forward chip (next page). Spacer keeps title centered when absent. */}
      {typeof onForward === 'function' ? (
        <HeaderSquareChip
          onPress={onForward}
          icon="chevron-forward"
          label="Next page"
          disabled={forwardDisabled}
          colors={colors}
        />
      ) : (
        <View style={styles.backSqSpacer} />
      )}
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
