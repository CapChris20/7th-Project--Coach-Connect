/**
 * Marketplace Glass
 *
 * Purpose: Marketplace Glass — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/marketplace
 * Key exports: MarketplaceGlass
 *
 * @file-header
 */
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BlurBackdropPlate from '../../shared/ui/BlurBackdropPlate';
import { getGlass } from './marketplaceFilters';

/**
 * Frosted glass panel — blur backdrop + translucent tint + soft top-lit border (web .glass-card).
 */
export function MarketplaceGlass({
  children,
  style,
  contentStyle,
  contentWrapperStyle,
  isDark = true,
  intensity,
  borderRadius = 22,
  overflow = 'hidden',
}) {
  const glass = getGlass(isDark);
  const tint = isDark ? 'dark' : 'light';
  const blur = intensity ?? glass.blur;
  const strokeTop = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.95)';
  const strokeBottom = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.35)';

  return (
    <View
      style={[
        glassStyles.outer,
        { borderRadius, overflow, borderWidth: 1, borderColor: glass.border },
        Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: isDark ? 0.38 : 0.12,
            shadowRadius: 20,
          },
          android: { elevation: 8 },
          default: {},
        }),
        style,
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[strokeTop, strokeBottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          glassStyles.stroke,
          {
            borderRadius,
            ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
          },
        ]}
      />
      <BlurBackdropPlate
        intensity={blur}
        tint={tint}
        style={[
          glassStyles.blur,
          {
            borderRadius: borderRadius - 1,
            ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
          },
        ]}
        contentWrapperStyle={contentWrapperStyle}
      >
        <View
          style={[
            glassStyles.surface,
            {
              backgroundColor: glass.surface,
              borderRadius: borderRadius - 1,
              ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </BlurBackdropPlate>
    </View>
  );
}

const glassStyles = StyleSheet.create({
  outer: {
    position: 'relative',
  },
  stroke: {
    ...StyleSheet.absoluteFillObject,
    padding: 1,
  },
  blur: {
    overflow: 'hidden',
  },
  surface: {},
});

export default MarketplaceGlass;
