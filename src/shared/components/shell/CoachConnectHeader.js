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
import { View, Text, StyleSheet, TouchableOpacity, Image as RNImage } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import BlurBackdropPlate from '../../ui/BlurBackdropPlate';
import { useMergedNavigation } from '../../../navigation/AppNavigationContext';
import { useTheme } from '../../ui/ThemeContext';

/** Matches Settings screen pill gradient (dark pink → dark orange). */
const HEADER_PROFILE_GRADIENT = ['#BE185D', '#C2410C'];
const PROFILE_ICON_PNG = require('../../../assets/icons/people.png');

/** Same PNG as before; gradient is applied by masking (opaque pixels → fill). */
function GradientProfileHeaderIcon({ size = 36 }) {
  return (
    <MaskedView
      style={{ width: size, height: size }}
      maskElement={
        <View
          style={{
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'transparent',
          }}
        >
          <RNImage source={PROFILE_ICON_PNG} style={{ width: size, height: size }} resizeMode="contain" />
        </View>
      }
    >
      <LinearGradient
        colors={HEADER_PROFILE_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ width: size, height: size }}
      />
    </MaskedView>
  );
}

/**
 * Main app header: title, optional back, profile + settings actions.
 * When the parent is SafeAreaView (top edge), pass skipTopSafeInset so top inset is not applied twice.
 */
export default function CoachConnectHeader({
  title = 'COACHCONNECT',
  onBack,
  headerLeft,
  onProfilePress: onProfilePressProp,
  onSettingsPress: onSettingsPressProp,
  skipTopSafeInset = false,
  /** When true, profile + settings stay visible even with a back button (default: hidden on sub-screens). */
  showHeaderActions,
}) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const colors = theme?.colors ?? {};
  const isDark = Boolean(theme?.isDark);
  const titleColor = colors.text ?? (isDark ? '#FFFFFF' : '#111827');
  const borderColor = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)';
  const containerBlurIntensity = isDark ? 28 : 18;
  const containerTint = isDark ? 'dark' : 'light';
  const containerTintColor = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)';
  const glassBackground = isDark ? 'rgba(12,12,18,0.55)' : 'rgba(255,255,255,0.55)';
  const titleShadowStyle = isDark
    ? {}
    : {
        textShadowColor: 'rgba(0,0,0,0.18)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
      };

  const { onProfilePress, onSettingsPress } = useMergedNavigation({
    onProfilePress: onProfilePressProp,
    onSettingsPress: onSettingsPressProp,
  });

  const sideActionsVisible = showHeaderActions ?? !onBack;

  return (
    <BlurBackdropPlate
      intensity={containerBlurIntensity}
      tint={containerTint}
      style={[
        styles.header,
        {
          paddingTop: (skipTopSafeInset ? 0 : insets.top) + 12,
          borderBottomColor: borderColor,
          backgroundColor: glassBackground,
        },
      ]}
      contentWrapperStyle={styles.headerContent}
    >
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: containerTintColor }]} pointerEvents="none" />
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={28} color={titleColor} />
        </TouchableOpacity>
      ) : headerLeft ? (
        <View style={styles.headerLeftWrap}>{headerLeft}</View>
      ) : (
        <View style={styles.headerSideSlot} />
      )}
      <Text
        style={[
          styles.headerTitle,
          titleShadowStyle,
          { color: titleColor, opacity: sideActionsVisible && !onBack && !headerLeft ? 0 : 1 },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {title}
      </Text>
      {sideActionsVisible ? (
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={onProfilePress} style={styles.headerProfileButton}>
            <GradientProfileHeaderIcon size={36} />
          </TouchableOpacity>

          <TouchableOpacity onPress={onSettingsPress} style={styles.settingsButton}>
            <Image
              source={require('../../../assets/icons/settings.png')}
              style={styles.settingsIcon}
            />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.headerSideSlot} />
      )}
    </BlurBackdropPlate>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 24,
    zIndex: 100,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 8,
    paddingBottom: 12,
    position: 'relative',
  },
  backButton: {
    padding: 8,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSideSlot: {
    width: 44,
    height: 44,
  },
  headerLeftWrap: {
    flexShrink: 0,
    maxWidth: 148,
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
