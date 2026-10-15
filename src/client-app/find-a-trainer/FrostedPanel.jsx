// Frosted-glass panel for every card and sheet in the trainer marketplace.
// Flow: paint a lit edge → blur whatever is behind the card → tint the surface so text stays readable.
// Used by marketplace cards. Real glass needs all three layers; one layer alone looks flat.

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BlurredBackground from '../../look-and-feel/BlurredBackground';
import { getGlass } from './trainerFilters';

// ===== NAMED CONSTANTS =====

const DEFAULT_BORDER_RADIUS = 22;
const IOS_PLATFORM = 'ios';
const DARK_TINT = 'dark';
const LIGHT_TINT = 'light';
const DARK_STROKE_TOP = 'rgba(255,255,255,0.16)';
const LIGHT_STROKE_TOP = 'rgba(255,255,255,0.95)';
const DARK_STROKE_BOTTOM = 'rgba(255,255,255,0.05)';
const LIGHT_STROKE_BOTTOM = 'rgba(255,255,255,0.35)';
const SHADOW_COLOR = '#000';
const DARK_SHADOW_OPACITY = 0.38;
const LIGHT_SHADOW_OPACITY = 0.12;

// ===== HELPER FUNCTIONS =====

/**
 * iOS can round with a continuous curve. Android ignores that key.
 * @param {number} radius
 * @returns {object}
 */
function iosCornerCurve(radius) {
  if (Platform.OS !== IOS_PLATFORM) return { borderRadius: radius };
  return { borderRadius: radius, borderCurve: 'continuous' };
}

/**
 * @param {boolean} isDark
 * @returns {object}
 */
function floatingShadow(isDark) {
  return Platform.select({
    ios: {
      shadowColor: SHADOW_COLOR,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? DARK_SHADOW_OPACITY : LIGHT_SHADOW_OPACITY,
      shadowRadius: 20,
    },
    android: { elevation: 8 },
    default: {},
  });
}

// ===== MAIN FUNCTION =====

/**
 * vocab: ?? keeps a blur of 0. || would treat 0 as unset and put the default blur back.
 * @param {object} props
 * @returns {import('react').ReactElement}
 */
export function FrostedPanel({
  children,
  style,
  contentStyle,
  contentWrapperStyle,
  isDark = true,
  intensity,
  borderRadius = DEFAULT_BORDER_RADIUS,
  overflow = 'hidden',
}) {
  const glass = getGlass(isDark);
  const blurTint = isDark ? DARK_TINT : LIGHT_TINT;
  const blurIntensity = intensity ?? glass.blur;
  const strokeTop = isDark ? DARK_STROKE_TOP : LIGHT_STROKE_TOP;
  const strokeBottom = isDark ? DARK_STROKE_BOTTOM : LIGHT_STROKE_BOTTOM;
  const innerRadius = borderRadius - 1;

  return (
    <View
      style={[
        glassStyles.outer,
        { borderRadius, overflow, borderWidth: 1, borderColor: glass.border },
        floatingShadow(isDark),
        style,
      ]}
    >
      <LinearGradient
        pointerEvents="none"
        colors={[strokeTop, strokeBottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[glassStyles.stroke, iosCornerCurve(borderRadius)]}
      />
      <BlurredBackground
        intensity={blurIntensity}
        tint={blurTint}
        style={[glassStyles.blur, iosCornerCurve(innerRadius)]}
        contentWrapperStyle={contentWrapperStyle}
      >
        <View
          style={[
            glassStyles.surface,
            {
              backgroundColor: glass.surface,
              ...iosCornerCurve(innerRadius),
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </BlurredBackground>
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

export default FrostedPanel;
