// Design Law top chrome — flush page surface, thin strip, profile + settings outline chips.
// Flow: safe-area inset → optional left slot → profile chip → settings chip.
// Used by client/trainer shells. Parent shells should use SHELL_SAFE_AREA_EDGES (left/right only).
//
// vocab: flush = same bg as the screen so the bar does not read as a second frosted header
// vocab: outline chip = surface + 3px border + hard offset shadow (same language as NbPageHeader backSq)

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMergedNavigation } from '../../navigation/whichScreenIsOpen';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import {
  lightColors,
  darkColors,
  nb,
} from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: keep this tight so .hi (avatar/greeting) still owns the first viewport.
const HEADER_TOP_GAP = 4;
// Manipulate here: 44 matches Design Law min touch + NbPageHeader backSq.
const CHIP_SIZE = nb.minTouchTarget;
const ICON_SIZE = 22;
const PROFILE_ICON = 'person-outline';
const SETTINGS_ICON = 'settings-outline';
const PROFILE_A11Y_LABEL = 'Open profile';
const SETTINGS_A11Y_LABEL = 'Open settings';

// ===== HELPER FUNCTIONS =====

/**
 * Black/white (ink on surface) square chip — no gradient fill, no sticker PNGs.
 * Matches NbPageHeader backSq so the top strip reads as the same chrome family.
 */
function HeaderOutlineChip({ icon, borderColor, surfaceColor, shadowColor, inkColor }) {
  return (
    <View
      style={[
        styles.chip,
        {
          borderColor,
          backgroundColor: surfaceColor,
          shadowColor,
        },
      ]}
    >
      <Ionicons name={icon} size={ICON_SIZE} color={inkColor} />
    </View>
  );
}

function HeaderActionButton({ onPress, accessibilityLabel, icon, palette }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.hit}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      activeOpacity={0.85}
    >
      <HeaderOutlineChip
        icon={icon}
        borderColor={palette.border}
        surfaceColor={palette.chipSurface}
        shadowColor={palette.shadow}
        inkColor={palette.ink}
      />
    </TouchableOpacity>
  );
}

function HeaderActionsRow({ onProfilePress, onSettingsPress, palette }) {
  return (
    <View style={styles.headerActions}>
      <HeaderActionButton
        onPress={onProfilePress}
        accessibilityLabel={PROFILE_A11Y_LABEL}
        icon={PROFILE_ICON}
        palette={palette}
      />
      <HeaderActionButton
        onPress={onSettingsPress}
        accessibilityLabel={SETTINGS_A11Y_LABEL}
        icon={SETTINGS_ICON}
        palette={palette}
      />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Main app header: profile + settings only.
 * @param {object} props
 */
export default function TopHeader({
  title: _title,
  onBack: _onBack,
  headerLeft,
  onProfilePress: onProfilePressProp,
  onSettingsPress: onSettingsPressProp,
  skipTopSafeInset: _skipTopSafeInset = false,
  showHeaderActions,
  appearanceIsDark,
}) {
  // vocab: useSafeAreaInsets = notches / status-bar padding from the device
  const insets = useSafeAreaInsets();
  // vocab: useTheme = live light/dark tokens from the app theme provider
  const theme = useTheme();
  const isDark = decideHeaderUsesDarkAppearance(appearanceIsDark, theme);
  const palette = buildHeaderPaletteForDarkMode(isDark);

  // vocab: useMergedNavigation = fill missing profile/settings handlers from the shell navigator
  const { onProfilePress, onSettingsPress } = useMergedNavigation({
    onProfilePress: onProfilePressProp,
    onSettingsPress: onSettingsPressProp,
  });

  const actionsEnabled = decideHeaderActionsAreEnabled(showHeaderActions);
  const stripStyle = {
    paddingTop: paddingTopBelowSafeArea(insets.top),
    borderBottomColor: palette.border,
    backgroundColor: palette.pageSurface,
  };

  // 1. When actions are off, keep a flush strip with no chips (still owns safe-area padding).
  if (!actionsEnabled) {
    const emptyStripStyle = { paddingBottom: 2, borderBottomWidth: 0 };
    return <View style={[styles.header, stripStyle, emptyStripStyle]} />;
  }

  // 2. Flush strip colors from theme tokens (or parent appearance override).
  // 3. Optional left slot, then profile + settings chips on the right.
  const leftSlotContent = headerLeft ?? null;
  return (
    <View style={[styles.header, stripStyle]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeftSlot}>{leftSlotContent}</View>
        <HeaderActionsRow
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
          palette={palette}
        />
      </View>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

function decideHeaderUsesDarkAppearance(appearanceIsDark, theme) {
  if (appearanceIsDark !== undefined) {
    return appearanceIsDark;
  }
  return Boolean(theme?.isDark);
}

function paddingTopBelowSafeArea(safeAreaTop) {
  return safeAreaTop + HEADER_TOP_GAP;
}

function decideHeaderActionsAreEnabled(showHeaderActions) {
  return showHeaderActions !== false;
}

function buildHeaderPaletteForDarkMode(isDark) {
  if (isDark) {
    return {
      pageSurface: darkColors.nbBackground,
      chipSurface: darkColors.nbSurface,
      border: darkColors.nbBorder,
      shadow: darkColors.nbShadow,
      ink: darkColors.nbInk,
    };
  }
  return {
    pageSurface: lightColors.nbBackground,
    chipSurface: lightColors.nbSurface,
    border: lightColors.nbBorder,
    shadow: lightColors.nbShadow,
    ink: lightColors.nbInk,
  };
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: nb.borderWidthDivider,
    zIndex: 100,
    paddingBottom: 8,
    paddingLeft: 16,
    paddingRight: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: CHIP_SIZE,
  },
  headerLeftSlot: {
    flexShrink: 1,
    minWidth: 0,
    marginRight: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
    marginLeft: 'auto',
  },
  hit: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
  },
  // Manipulate here: chip radius / hard-shadow offset (keep in lockstep with NbPageHeader backSq).
  chip: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
});
