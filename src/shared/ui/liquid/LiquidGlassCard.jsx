import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import BlurBackdropPlate from '../BlurBackdropPlate';
import { LinearGradient } from 'expo-linear-gradient';
import { Liquid } from './liquidTokens';

/**
 * Custom "glass material":
 * - background blur ~30
 * - semi-transparent surface
 * - linear border brighter at top, fading to bottom
 * - squircle geometry (continuous curve on iOS)
 */
export default function LiquidGlassCard({
  children,
  style,
  contentStyle,
  onPress,
  disabled,
  radius = Liquid.radius.card,
  blurIntensity = 30,
  strokeColors = [Liquid.colors.glassStrokeTop, Liquid.colors.glassStrokeBottom],
}) {
  const Container = onPress ? Pressable : View;
  const containerStyle = onPress
    ? ({ pressed }) => [styles.hit, { opacity: pressed ? 0.96 : 1 }, style]
    : [styles.hit, style];
  return (
    <Container
      disabled={disabled}
      onPress={onPress}
      style={containerStyle}
    >
      {/* Gradient stroke */}
      <LinearGradient
        pointerEvents="none"
        colors={strokeColors}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[
          styles.stroke,
          {
            borderRadius: radius,
            ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
          },
        ]}
      />

      {/* Inner glass — blur behind surface so children (icons/images) are not inside BlurView */}
      <BlurBackdropPlate
        intensity={blurIntensity}
        tint="dark"
        style={[
          styles.blur,
          {
            borderRadius: radius,
            ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
          },
        ]}
      >
        <View
          style={[
            styles.surface,
            {
              borderRadius: radius,
              ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null),
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </BlurBackdropPlate>
    </Container>
  );
}

const styles = StyleSheet.create({
  hit: {
    minHeight: 44,
    minWidth: 44,
  },
  stroke: {
    ...StyleSheet.absoluteFillObject,
    padding: 1,
  },
  blur: {
    overflow: 'hidden',
  },
  surface: {
    flex: 1,
    backgroundColor: Liquid.colors.glassSurface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
});


