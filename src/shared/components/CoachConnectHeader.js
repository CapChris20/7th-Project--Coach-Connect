import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image as RNImage } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import FluidGlass from '../ui/FluidGlass';
import { useMergedNavigation } from '../../navigation/AppNavigationContext';
import { useTheme } from '../ui/ThemeContext';

/** Matches Settings screen pill gradient (dark pink → dark orange). */
const HEADER_PROFILE_GRADIENT = ['#BE185D', '#C2410C'];
const PROFILE_ICON_PNG = require('../../assets/icons/people.png');

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
 * (Firebase/backend project id may still be `anatrox-auth`; this UI is Coach Connect.)
 */
export default function CoachConnectHeader({
  title = 'COACHCONNECT',
  onBack,
  onProfilePress: onProfilePressProp,
  onSettingsPress: onSettingsPressProp,
  ...rest
}) {
  const { colors, isDark } = useTheme();
  const titleColor = colors.text;
  const headerBackground = isDark ? colors.background : '#FFFFFF';
  const borderColor = colors.border;
  const Container = isDark ? View : FluidGlass;
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

  return (
    <Container
      {...(!isDark && {
        transmission: 0.92,
        roughness: 0.1,
        tint: headerBackground,
      })}
      style={[
        styles.header,
        {
          backgroundColor: headerBackground,
          borderBottomColor: borderColor,
        },
      ]}
    >
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={28} color={titleColor} />
        </TouchableOpacity>
      ) : null}
      <Text
        style={[styles.headerTitle, titleShadowStyle, { color: titleColor, opacity: onBack ? 1 : 0 }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <View style={styles.headerActions}>
        <TouchableOpacity onPress={onProfilePress} style={styles.headerProfileButton}>
          <GradientProfileHeaderIcon size={36} />
        </TouchableOpacity>

        <TouchableOpacity onPress={onSettingsPress} style={styles.settingsButton}>
          <Image
            source={require('../../assets/icons/settings.png')}
            style={styles.settingsIcon}
          />
        </TouchableOpacity>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 8,
    paddingTop: 12,
    paddingBottom: 12,
    marginTop: 0,
    borderBottomWidth: 1,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.2,
    textAlign: 'center',
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
