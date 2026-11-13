// Design Law top chrome — flush page surface, thin strip, profile + settings outline chips.
// Flow: safe-area inset → optional left slot → profile chip → settings chip.
// Used by client/trainer shells. Parent shells should use SHELL_SAFE_AREA_EDGES (left/right only).
//
// vocab: flush = same bg as the screen so the bar doesn’t read as a second “frosted” header
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

// Manipulate here: keep this tight so .hi (avatar/greeting) still owns the first viewport
const HEADER_TOP_GAP = 4;
// Manipulate here: 44 matches Design Law min touch + NbPageHeader backSq
const CHIP_SIZE = nb.minTouchTarget;
const ICON_SIZE = 22;
const PROFILE_ICON = 'person-outline';
const SETTINGS_ICON = 'settings-outline';

// ===== HELPERS =====

function isAppearanceDark(appearanceIsDark, theme) {
  if (appearanceIsDark !== undefined) return appearanceIsDark;
  return Boolean(theme?.isDark);
}

function headerPaddingTop(safeAreaTop) {
  return safeAreaTop + HEADER_TOP_GAP;
}

function shouldShowHeaderSideActions(showHeaderActions) {
  return showHeaderActions !== false;
}

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
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const isDark = isAppearanceDark(appearanceIsDark, theme);
  // Same as screen bg so the strip doesn’t look like a separate frosted plate
  const surface = isDark ? darkColors.nbBackground : lightColors.nbBackground;
  const chipSurface = isDark ? darkColors.nbSurface : lightColors.nbSurface;
  const border = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  const shadow = isDark ? darkColors.nbShadow : lightColors.nbShadow;
  const ink = isDark ? darkColors.nbInk : lightColors.nbInk;

  const { onProfilePress, onSettingsPress } = useMergedNavigation({
    onProfilePress: onProfilePressProp,
    onSettingsPress: onSettingsPressProp,
  });

  const shouldShowSideActions = shouldShowHeaderSideActions(showHeaderActions);
  const surfaceStyle = {
    paddingTop: headerPaddingTop(insets.top),
    borderBottomColor: border,
    backgroundColor: surface,
  };

  if (!shouldShowSideActions) {
    return <View style={[styles.header, surfaceStyle, { paddingBottom: 2, borderBottomWidth: 0 }]} />;
  }

  return (
    <View style={[styles.header, surfaceStyle]}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeftSlot}>{headerLeft ?? null}</View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={onProfilePress}
            style={styles.hit}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            activeOpacity={0.85}
          >
            <HeaderOutlineChip
              icon={PROFILE_ICON}
              borderColor={border}
              surfaceColor={chipSurface}
              shadowColor={shadow}
              inkColor={ink}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onSettingsPress}
            style={styles.hit}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            activeOpacity={0.85}
          >
            <HeaderOutlineChip
              icon={SETTINGS_ICON}
              borderColor={border}
              surfaceColor={chipSurface}
              shadowColor={shadow}
              inkColor={ink}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
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
  // Manipulate here: chip radius / hard-shadow offset (keep in lockstep with NbPageHeader backSq)
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
