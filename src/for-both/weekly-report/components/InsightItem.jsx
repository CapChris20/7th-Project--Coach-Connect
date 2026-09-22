import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENTS, useTheme } from '../theme/WeeklyReportThemeContext';
import { GradientBorder } from './GradientBorder';

const VARIANT_GRADIENTS = {
  pro: { border: GRADIENTS.g1, badge: GRADIENTS.g3 },
  con: { border: GRADIENTS.g4, badge: GRADIENTS.g3 },
};

export function InsightItem({ index, text, variant = 'pro' }) {
  const { colors, mode } = useTheme();
  const palette = VARIANT_GRADIENTS[variant] || VARIANT_GRADIENTS.pro;
  const innerBg = mode === 'dark' ? 'rgba(14,14,22,0.98)' : '#ffffff';

  return (
    <GradientBorder
      colors={palette.border}
      borderWidth={1.5}
      radius={18}
      innerBackground={innerBg}
      style={styles.cardWrap}
    >
      <LinearGradient
        colors={[`${palette.border[0]}28`, `${palette.border[1]}10`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.row}>
        <LinearGradient
          colors={palette.badge}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.numBadge}
        >
          <Text style={styles.numText}>{index}</Text>
        </LinearGradient>

        <Text style={[styles.text, { color: colors.textPrimary }]}>{text}</Text>
      </View>
    </GradientBorder>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    padding: 16,
  },
  numBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1a1a1a',
  },
  text: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.15,
    paddingTop: 6,
  },
});
