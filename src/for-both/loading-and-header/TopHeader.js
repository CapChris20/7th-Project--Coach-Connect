// Main app header: frosted bar with profile + settings. Always draws under the status bar.
// Flow: read theme + safe-area inset → optional left slot → profile icon → settings icon.
// Used by client and trainer shells. Parent shells should use SHELL_SAFE_AREA_EDGES (left/right only).

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BlurredBackground from '../../look-and-feel/BlurredBackground';
import { useMergedNavigation } from '../../navigation/whichScreenIsOpen';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import ColorfulIcon from '../icons/ColorfulIcon';

// ===== NAMED CONSTANTS =====

/** Matches Settings screen pill gradient (dark pink → dark orange). */
const HEADER_PROFILE_GRADIENT = ['#BE185D', '#C2410C'];
const DEFAULT_PROFILE_ICON_SIZE = 36;
const HEADER_TOP_GAP = 8;

// ===== HELPER FUNCTIONS =====

function GradientProfileHeaderIcon({ size = DEFAULT_PROFILE_ICON_SIZE }) {
  return (
    <ColorfulIcon
      name="people"
      size={size}
      colors={HEADER_PROFILE_GRADIENT}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
    />
  );
}

function headerChrome(isDark) {
  return {
    borderColor: isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)',
    containerBlurIntensity: isDark ? 28 : 18,
    containerTint: isDark ? 'dark' : 'light',
    containerTintColor: isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)',
    glassBackground: isDark ? 'rgba(12,12,18,0.55)' : 'rgba(255,255,255,0.55)',
  };
}

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

function headerSurfaceStyle(insets, chrome) {
  return {
    paddingTop: headerPaddingTop(insets.top),
    borderBottomColor: chrome.borderColor,
    backgroundColor: chrome.glassBackground,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Main app header: profile + settings actions only.
 * Always extends to the physical top edge; status-bar inset is applied inside this component.
 * Parent shells should use SHELL_SAFE_AREA_EDGES (left/right only), not top safe-area padding.
 * @param {object} props
 */
export default function TopHeader({
  title: _title,
  onBack: _onBack,
  headerLeft,
  onProfilePress: onProfilePressProp,
  onSettingsPress: onSettingsPressProp,
  skipTopSafeInset: _skipTopSafeInset = false,
  /** When false, header actions are hidden (e.g. embedded editors). */
  showHeaderActions,
  /** Override global theme for embedded editors (spreadsheet/document modals). */
  appearanceIsDark,
}) {
  // vocab: useSafeAreaInsets = pixels under the notch / status bar. We add them here so parent shells skip top padding.
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const isDark = isAppearanceDark(appearanceIsDark, theme);
  const chrome = headerChrome(isDark);
  const {
    containerBlurIntensity,
    containerTint,
    containerTintColor,
  } = chrome;

  // vocab: useMergedNavigation = fill missing profile/settings taps from the current screen's nav helpers.
  const { onProfilePress, onSettingsPress } = useMergedNavigation({
    onProfilePress: onProfilePressProp,
    onSettingsPress: onSettingsPressProp,
  });

  const shouldShowSideActions = shouldShowHeaderSideActions(showHeaderActions);
  const surfaceStyle = headerSurfaceStyle(insets, chrome);

  // 1. Embedded editors hide the buttons — frosted bar still sits under the status bar.
  if (!shouldShowSideActions) {
    return (
      <BlurredBackground
        intensity={containerBlurIntensity}
        tint={containerTint}
        style={[styles.header, surfaceStyle]}
        contentWrapperStyle={styles.headerContentMinimal}
      >
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: containerTintColor }]} pointerEvents="none" />
      </BlurredBackground>
    );
  }

  // 2. Profile + settings on the frosted bar.
  return (
    <BlurredBackground
      intensity={containerBlurIntensity}
      tint={containerTint}
      style={[styles.header, surfaceStyle]}
      contentWrapperStyle={styles.headerContent}
    >
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: containerTintColor }]} pointerEvents="none" />
      <View style={styles.headerRow}>
        <View style={styles.headerLeftSlot}>{headerLeft ?? null}</View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={onProfilePress}
            style={styles.headerProfileButton}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <GradientProfileHeaderIcon size={DEFAULT_PROFILE_ICON_SIZE} />
          </TouchableOpacity>

          <TouchableOpacity onPress={onSettingsPress} style={styles.settingsButton}>
            <Image
              source={require('../../assets/icons/settings.png')}
              style={styles.settingsIcon}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={0}
            />
          </TouchableOpacity>
        </View>
      </View>
    </BlurredBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 24,
    zIndex: 100,
  },
  headerContent: {
    flexDirection: 'column',
    paddingLeft: 12,
    paddingRight: 8,
    paddingBottom: 8,
    position: 'relative',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  headerLeftSlot: {
    flexShrink: 1,
    minWidth: 0,
    marginRight: 8,
    zIndex: 2,
  },
  headerContentMinimal: {
    paddingBottom: 4,
    position: 'relative',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  headerProfileButton: {
    padding: 8,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButton: {
    padding: 8,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    width: 36,
    height: 36,
  },
});
