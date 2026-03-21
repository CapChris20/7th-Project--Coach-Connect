import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import FluidGlass from '../ui/FluidGlass';
import { useMergedNavigation } from '../../navigation/AppNavigationContext';

/**
 * CoachConnect Header Component
 * Premium header with gradient text and navigation actions.
 * Pass onBack to show a back button (e.g. on workout plan or profile).
 */
export default function CoachConnectHeader({
  title = 'COACHCONNECT',
  isDark,
  onBack,
  onProfilePress: onProfilePressProp,
  onSettingsPress: onSettingsPressProp,
}) {
  const { onProfilePress, onSettingsPress } = useMergedNavigation({
    onProfilePress: onProfilePressProp,
    onSettingsPress: onSettingsPressProp,
  });
  const titleColor = isDark ? '#FFFFFF' : '#111827';
  const headerBackground = isDark ? '#000000' : '#FFFFFF';
  const borderColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)';
  const Container = isDark ? View : FluidGlass;

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
      <Text style={[styles.headerTitle, { color: titleColor, opacity: onBack ? 1 : 0 }]} numberOfLines={1}>{title}</Text>
      <View style={styles.headerActions}>
        <TouchableOpacity onPress={onProfilePress} style={styles.headerProfileButton}>
          <Image
            source={require('../../assets/icons/people.png')}
            style={styles.headerProfileIcon}
          />
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
    color: '#FFFFFF',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
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
  headerProfileIcon: {
    width: 36,
    height: 36,
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
