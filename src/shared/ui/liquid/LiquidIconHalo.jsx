import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Liquid } from './liquidTokens';

/**
 * Subtle glassmorphic halo behind an icon (quiet luxury):
 * - no shadows
 * - soft gradient + faint stroke
 * - squircle geometry
 */
export default function LiquidIconHalo({ children, size = 36, active = false }) {
  const accent = active ? Liquid.gradients.haloActive : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)'];

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: Liquid.radius.inner,
          ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
        },
      ]}
    >
      <LinearGradient
        colors={accent}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: Liquid.radius.inner,
            ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
          },
        ]}
      />
      <View style={styles.stroke} pointerEvents="none" />
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  stroke: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});


