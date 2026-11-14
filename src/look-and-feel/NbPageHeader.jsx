// Design Law page chrome: hard-shadow back square + title (+ optional subtitle / forward).
// Flow: safe-area top pad → back chip → title stack → forward chip or matching spacer.
// Used by: Settings and settings subpages; PDF viewer uses onForward for next page.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './lightDarkMode';
import { nb, spacing } from './colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: chip 44×44, radius 12; disabled opacity when forward is locked
const HEADER_CHIP_SIZE = 44;
const HEADER_CHIP_RADIUS = 12;
const HEADER_CHIP_ICON_SIZE = 22;
const HEADER_CHIP_DISABLED_OPACITY = 0.4;
const HEADER_CHIP_ACTIVE_OPACITY = 0.85;
const BACK_ICON_NAME = 'chevron-back';
const FORWARD_ICON_NAME = 'chevron-forward';

// ===== HELPER FUNCTIONS =====

function pressHandlerIsCallable(onPress) {
  return typeof onPress === 'function';
}

/**
 * Hard-shadow square chip for back / forward.
 * No handler → empty spacer so the title stays centered.
 */
function PageHeaderSquareChip({
  onPress,
  icon,
  label,
  disabled = false,
  themeColors,
}) {
  const canPress = pressHandlerIsCallable(onPress);

  if (!canPress) {
    return <View style={styles.backSqSpacer} />;
  }

  const chipOpacity = disabled ? HEADER_CHIP_DISABLED_OPACITY : 1;
  const chipChrome = {
    borderColor: themeColors.nbBorder,
    backgroundColor: themeColors.nbSurface,
    shadowColor: themeColors.nbShadow,
    opacity: chipOpacity,
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.backSq, chipChrome]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      activeOpacity={HEADER_CHIP_ACTIVE_OPACITY}
    >
      <Ionicons name={icon} size={HEADER_CHIP_ICON_SIZE} color={themeColors.nbInk} />
    </TouchableOpacity>
  );
}

function PageHeaderTitleStack({ title, subtitle, inkColor, mutedColor }) {
  let subtitleNode = null;
  if (subtitle) {
    subtitleNode = (
      <Text style={[styles.pageSubtitle, { color: mutedColor }]} numberOfLines={2}>
        {subtitle}
      </Text>
    );
  }

  return (
    <View style={styles.pageHeaderText}>
      <Text style={[styles.pageTitle, { color: inkColor }]} numberOfLines={1}>
        {title}
      </Text>
      {subtitleNode}
    </View>
  );
}

/**
 * Forward chip when onForward is a function; otherwise a matching spacer.
 */
function PageHeaderForwardSlot({ onForward, forwardDisabled, themeColors }) {
  const showForwardChip = pressHandlerIsCallable(onForward);

  if (!showForwardChip) {
    return <View style={styles.backSqSpacer} />;
  }

  return (
    <PageHeaderSquareChip
      onPress={onForward}
      icon={FORWARD_ICON_NAME}
      label="Next page"
      disabled={forwardDisabled}
      themeColors={themeColors}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Always pads below the status bar / Dynamic Island.
 * skipTopSafeInset is kept for call-site compat but ignored — this header owns top inset.
 *
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
  // vocab: useTheme = Design Law tokens; useSafeAreaInsets = notch / status-bar padding
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();

  // 1. Always pad below status bar — skipTopSafeInset ignored on purpose.
  // Manipulate here: spacing.sm is the gap under the safe inset
  const topPad = Math.max(insets.top, 0) + spacing.sm;

  // 2. Three-column row: back | title | forward (or matching spacer).
  return (
    <View style={[styles.pageHeader, { paddingTop: topPad }]}>
      <PageHeaderSquareChip
        onPress={onBack}
        icon={BACK_ICON_NAME}
        label="Go back"
        themeColors={themeColors}
      />
      <PageHeaderTitleStack
        title={title}
        subtitle={subtitle}
        inkColor={themeColors.nbInk}
        mutedColor={themeColors.nbMuted}
      />
      <PageHeaderForwardSlot
        onForward={onForward}
        forwardDisabled={forwardDisabled}
        themeColors={themeColors}
      />
    </View>
  );
}

// PLUMBING — skip unless debugging chip shadow / title type
const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backSq: {
    width: HEADER_CHIP_SIZE,
    height: HEADER_CHIP_SIZE,
    borderRadius: HEADER_CHIP_RADIUS,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  backSqSpacer: { width: HEADER_CHIP_SIZE, height: HEADER_CHIP_SIZE },
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
