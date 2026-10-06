// Frosted glass panel. Layers a white gradient, a tint, a shine, and a soft border behind the children.
// Flow: turn transmission / roughness / tint into opacities → stack those layers → render children on top.
// Used wherever a screen wants the liquid-glass card. `distortion` is accepted so callers can pass it; the layers do not use it yet.

import React, { useMemo, memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ===== NAMED CONSTANTS =====

// Manipulate here: how see-through the glass is allowed to get.
const GLASS_OPACITY_MIN = 0.1;
const GLASS_OPACITY_MAX = 0.95;
const TRANSMISSION_TO_OPACITY = 0.85;
const BORDER_OPACITY_MIN = 0.1;
const BORDER_OPACITY_MAX = 0.4;
const ROUGHNESS_TO_BORDER = 2;
const DEFAULT_CORNER_RADIUS = 16;
const TINT_STRENGTH = 0.15;
const HIGHLIGHT_START = 0.25;
const HIGHLIGHT_MID = 0.15;
const HIGHLIGHT_END = 0.2;

// ===== HELPER FUNCTIONS =====

function glassOpacityFromTransmission(transmission) {
  return Math.max(GLASS_OPACITY_MIN, Math.min(GLASS_OPACITY_MAX, transmission * TRANSMISSION_TO_OPACITY));
}

function borderOpacityFromRoughness(roughness) {
  return Math.max(BORDER_OPACITY_MIN, Math.min(BORDER_OPACITY_MAX, roughness * ROUGHNESS_TO_BORDER));
}

function tintColorFromHex(tint, glassOpacity) {
  if (tint.startsWith('rgba')) return tint;
  const hexDigits = tint.replace('#', '');
  if (hexDigits.length !== 6) return tint;
  const red = parseInt(hexDigits.substring(0, 2), 16);
  const green = parseInt(hexDigits.substring(2, 4), 16);
  const blue = parseInt(hexDigits.substring(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${glassOpacity * TINT_STRENGTH})`;
}

function glassGradientColors(glassOpacity) {
  return [
    `rgba(255, 255, 255, ${glassOpacity * HIGHLIGHT_START})`,
    `rgba(255, 255, 255, ${glassOpacity * HIGHLIGHT_MID})`,
    `rgba(255, 255, 255, ${glassOpacity * HIGHLIGHT_END})`,
  ];
}

function borderRadiusFromStyle(style) {
  if (style && typeof style === 'object' && !Array.isArray(style)) {
    return style.borderRadius || DEFAULT_CORNER_RADIUS;
  }
  if (Array.isArray(style)) {
    const flatStyle = StyleSheet.flatten(style);
    return flatStyle?.borderRadius || DEFAULT_CORNER_RADIUS;
  }
  return DEFAULT_CORNER_RADIUS;
}

// ===== MAIN FUNCTION =====

/**
 * Liquid-glass wrapper. Children stay direct so their layout is unchanged.
 * @param {object} props
 */
const GlassPanel = memo(function GlassPanel({
  width,
  height,
  // Pulled out of ...props so View does not receive it. The layers below do not paint it yet.
  distortion: _distortion = 0.5,
  roughness = 0.2,
  transmission = 0.9,
  thickness = 0.5,
  tint = '#ffffff',
  children,
  style,
  ...props
}) {
  const glassOpacity = useMemo(
    () => glassOpacityFromTransmission(transmission),
    [transmission],
  );

  const borderOpacity = useMemo(
    () => borderOpacityFromRoughness(roughness),
    [roughness],
  );

  const tintColor = useMemo(
    () => tintColorFromHex(tint, glassOpacity),
    [tint, glassOpacity],
  );

  const gradientColors = useMemo(
    () => glassGradientColors(glassOpacity),
    [glassOpacity],
  );

  const borderRadius = useMemo(
    () => borderRadiusFromStyle(style),
    [style],
  );

  const containerStyle = useMemo(
    () => [
      styles.container,
      width && { width },
      height && { height },
      style,
    ],
    [width, height, style],
  );

  const layerStyle = useMemo(
    () => [styles.glassLayer, { borderRadius }],
    [borderRadius],
  );

  const tintLayerStyle = useMemo(
    () => [styles.tintLayer, { borderRadius }],
    [borderRadius],
  );

  const highlightLayerStyle = useMemo(
    () => [styles.highlightLayer, { borderRadius }],
    [borderRadius],
  );

  const borderGlowStyle = useMemo(
    () => [
      styles.borderGlow,
      {
        borderRadius,
        borderColor: `rgba(255, 255, 255, ${borderOpacity})`,
        borderWidth: thickness * 2,
      },
    ],
    [borderRadius, borderOpacity, thickness],
  );

  return (
    <View style={containerStyle} {...props}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={layerStyle}
        pointerEvents="none"
      />

      <View
        style={[
          tintLayerStyle,
          { backgroundColor: tintColor },
        ]}
        pointerEvents="none"
      />

      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0.4)',
          'rgba(255, 255, 255, 0.1)',
          'transparent',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={highlightLayerStyle}
        pointerEvents="none"
      />

      <View style={borderGlowStyle} pointerEvents="none" />

      {children}
    </View>
  );
}, (previousProps, nextProps) => {
  return (
    previousProps.width === nextProps.width &&
    previousProps.height === nextProps.height &&
    previousProps.transmission === nextProps.transmission &&
    previousProps.roughness === nextProps.roughness &&
    previousProps.thickness === nextProps.thickness &&
    previousProps.tint === nextProps.tint &&
    previousProps.children === nextProps.children
  );
});

GlassPanel.displayName = 'GlassPanel';

export default GlassPanel;

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  glassLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tintLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  highlightLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.6,
  },
  borderGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
