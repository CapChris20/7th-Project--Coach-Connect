/**
 * Premium uppercase section label — centered gradient type, no accent bar.
 */
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import StableGradientText from '../../shared-ui/StableGradientText';

const DISPLAY = 'SpaceGrotesk_600SemiBold';
/** Brighter pink → orange — matches workout tab header treatment. */
const SECTION_HEADER_GRADIENT = ['#FF6B9D', '#FB923C'];

export default function PremiumSectionHeader({
  text,
  isDark = true,
  style,
}) {
  const ruleColors = isDark
    ? ['transparent', 'rgba(255,107,157,0.75)', 'rgba(251,146,60,0.65)', 'transparent']
    : ['transparent', 'rgba(255,107,157,0.55)', 'rgba(251,146,60,0.45)', 'transparent'];

  return (
    <View style={[styles.wrap, style]}>
      <StableGradientText
        colors={SECTION_HEADER_GRADIENT}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[
          styles.label,
          {
            fontFamily: Platform.select({ ios: DISPLAY, android: DISPLAY, default: DISPLAY }),
            alignSelf: 'center',
          },
        ]}
      >
        {String(text || '').toUpperCase()}
      </StableGradientText>
      <LinearGradient
        colors={ruleColors}
        locations={[0, 0.35, 0.65, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.rule}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 22,
    marginBottom: 14,
    alignItems: 'center',
    width: '100%',
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  rule: {
    marginTop: 12,
    height: 2,
    width: '56%',
    alignSelf: 'center',
    borderRadius: 2,
  },
});
