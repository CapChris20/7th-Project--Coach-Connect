// Design Law top chrome — flush page surface, thin strip, profile + settings icon chips.
// Flow: safe-area inset → optional left slot → profile chip → settings chip.
// Used by client/trainer shells. Parent shells should use SHELL_SAFE_AREA_EDGES (left/right only).
//
// vocab: flush = same bg as the screen so the bar doesn’t read as a second “frosted” header

import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useMergedNavigation } from '../../navigation/whichScreenIsOpen';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import {
  lightColors,
  darkColors,
  navAccentGradient,
  nb,
} from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: keep this tight so .hi (avatar/greeting) still owns the first viewport
const HEADER_TOP_GAP = 4;
const CHIP_SIZE = 40;
const SETTINGS_ICON = require('../../assets/icons/settings.png');
const HANDOFF_SETTINGS = (() => {
  try {
    return require('../../assets/icons/handoff/settings.png');
  } catch (_) {
    return SETTINGS_ICON;
  }
})();

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
 * Design Law header chip — pink→orange fill, 3px border (no hard shadow so it doesn’t fight .hi).
 */
function HeaderIconChip({ children, borderColor }) {
  return (
    <LinearGradient
      colors={navAccentGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.chip, { borderColor }]}
    >
      {children}
    </LinearGradient>
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
  const border = isDark ? darkColors.nbBorder : lightColors.nbBorder;

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
            <HeaderIconChip borderColor={border}>
              <Ionicons name="people" size={22} color={lightColors.nbInk} />
            </HeaderIconChip>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onSettingsPress}
            style={styles.hit}
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            activeOpacity={0.85}
          >
            <HeaderIconChip borderColor={border}>
              <Image source={HANDOFF_SETTINGS} style={styles.settingsGlyph} resizeMode="contain" />
            </HeaderIconChip>
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
  chip: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  settingsGlyph: {
    width: 22,
    height: 22,
  },
});
