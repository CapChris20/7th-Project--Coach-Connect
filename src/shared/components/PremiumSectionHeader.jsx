/**
 * Premium uppercase section label — centered gradient type, no accent bar.
 */
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import StableGradientText from '../../shared-ui/StableGradientText';
import { HERO_TITLE_TEXT_GRADIENT } from '../../shared-ui/brandGradients';

const DISPLAY = 'SpaceGrotesk_600SemiBold';

export default function PremiumSectionHeader({
  text,
  isDark = true,
  style,
}) {
  const ruleColors = isDark
    ? ['transparent', 'rgba(190,24,93,0.55)', 'rgba(194,65,12,0.45)', 'transparent']
    : ['transparent', 'rgba(190,24,93,0.35)', 'rgba(194,65,12,0.28)', 'transparent'];

  return (
    <View style={[styles.wrap, style]}>
      <StableGradientText
        colors={HERO_TITLE_TEXT_GRADIENT}
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
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  rule: {
    marginTop: 12,
    height: 1.5,
    width: '56%',
    alignSelf: 'center',
    borderRadius: 2,
  },
});
