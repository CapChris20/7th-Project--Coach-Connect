/**
 * Coach Connect Header
 *
 * Purpose: Coach Connect Header — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: CoachConnectHeader
 *
 * @file-header
 */
import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BlurBackdropPlate from '../../../shared-ui/BlurBackdropPlate';
import { useMergedNavigation } from '../../../navigation/AppNavigationContext';
import { useTheme } from '../../../shared-ui/ThemeContext';
import BrandGradientIcon from '../icons/BrandGradientIcon';

/** Matches Settings screen pill gradient (dark pink → dark orange). */
const HEADER_PROFILE_GRADIENT = ['#BE185D', '#C2410C'];

function GradientProfileHeaderIcon({ size = 36 }) {
  return (
    <BrandGradientIcon
      name="people"
      size={size}
      colors={HEADER_PROFILE_GRADIENT}
      start={{ x: 0, y: 0.5 }}
      end={{ x: 1, y: 0.5 }}
    />
  );
}

/**
 * Main app header: profile + settings actions only.
 * Always extends to the physical top edge; status-bar inset is applied inside this component.
 * Parent shells should use SHELL_SAFE_AREA_EDGES (left/right only), not top safe-area padding.
 */
export default function CoachConnectHeader({
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
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const isDark = appearanceIsDark !== undefined ? appearanceIsDark : Boolean(theme?.isDark);
  const borderColor = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)';
  const containerBlurIntensity = isDark ? 28 : 18;
  const containerTint = isDark ? 'dark' : 'light';
  const containerTintColor = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)';
  const glassBackground = isDark ? 'rgba(12,12,18,0.55)' : 'rgba(255,255,255,0.55)';

  const { onProfilePress, onSettingsPress } = useMergedNavigation({
    onProfilePress: onProfilePressProp,
    onSettingsPress: onSettingsPressProp,
  });

  const sideActionsVisible = showHeaderActions !== false;

  if (!sideActionsVisible) {
    return (
      <BlurBackdropPlate
        intensity={containerBlurIntensity}
        tint={containerTint}
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            borderBottomColor: borderColor,
            backgroundColor: glassBackground,
          },
        ]}
        contentWrapperStyle={styles.headerContentMinimal}
      >
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: containerTintColor }]} pointerEvents="none" />
      </BlurBackdropPlate>
    );
  }

  return (
    <BlurBackdropPlate
      intensity={containerBlurIntensity}
      tint={containerTint}
      style={[
        styles.header,
        {
          paddingTop: insets.top + 8,
          borderBottomColor: borderColor,
          backgroundColor: glassBackground,
        },
      ]}
      contentWrapperStyle={styles.headerContent}
    >
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: containerTintColor }]} pointerEvents="none" />
      <View style={styles.headerRow}>
        <View style={styles.headerLeftSlot}>{headerLeft ?? null}</View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={onProfilePress} style={styles.headerProfileButton}>
            <GradientProfileHeaderIcon size={36} />
          </TouchableOpacity>

          <TouchableOpacity onPress={onSettingsPress} style={styles.settingsButton}>
            <Image
              source={require('../../../assets/icons/settings.png')}
              style={styles.settingsIcon}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={0}
            />
          </TouchableOpacity>
        </View>
      </View>
    </BlurBackdropPlate>
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
