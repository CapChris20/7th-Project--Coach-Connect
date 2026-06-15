/**
 * Fluid Glass
 *
 * Purpose: Fluid Glass — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: (see file)
 *
 * @file-header
 */
import React, { useMemo, memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * FluidGlass - True Liquid Glass Effect Component for React Native
 * 
 * Creates Apple iOS 26-style liquid glass effect using advanced styling
 * Mimics refraction, light scattering, and soft glass tint
 * 
 * Optimized for performance with memoization and reduced re-renders
 */
const FluidGlass = memo(function FluidGlass({
  width,
  height,
  distortion = 0.5,
  roughness = 0.2,
  transmission = 0.9,
  thickness = 0.5,
  tint = '#ffffff',
  children,
  style,
  ...props
}) {
  // Calculate opacity based on transmission (memoized for performance)
  const glassOpacity = useMemo(() => {
    return Math.max(0.1, Math.min(0.95, transmission * 0.85));
  }, [transmission]);

  // Calculate border opacity based on roughness
  const borderOpacity = useMemo(() => {
    return Math.max(0.1, Math.min(0.4, roughness * 2));
  }, [roughness]);

  // Parse tint color (optimized)
  const tintColor = useMemo(() => {
    // Handle rgba strings
    if (tint.startsWith('rgba')) return tint;
    
    // Extract RGB from hex
    const hex = tint.replace('#', '');
    if (hex.length !== 6) return tint; // Fallback for invalid hex
    
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${glassOpacity * 0.15})`;
  }, [tint, glassOpacity]);

  // Memoize gradient colors to prevent recreation
  const gradientColors = useMemo(() => [
    `rgba(255, 255, 255, ${glassOpacity * 0.25})`,
    `rgba(255, 255, 255, ${glassOpacity * 0.15})`,
    `rgba(255, 255, 255, ${glassOpacity * 0.2})`,
  ], [glassOpacity]);

  // Extract borderRadius from style for glass layers
  const borderRadius = useMemo(() => {
    if (style && typeof style === 'object' && !Array.isArray(style)) {
      return style.borderRadius || 16;
    }
    if (Array.isArray(style)) {
      const flatStyle = StyleSheet.flatten(style);
      return flatStyle?.borderRadius || 16;
    }
    return 16;
  }, [style]);

  const containerStyle = useMemo(
    () => [
      styles.container,
      width && { width },
      height && { height },
      style,
    ],
    [width, height, style]
  );

  const layerStyle = useMemo(
    () => [
      styles.glassLayer,
      { borderRadius },
    ],
    [borderRadius]
  );

  const tintLayerStyle = useMemo(
    () => [
      styles.tintLayer,
      { borderRadius },
    ],
    [borderRadius]
  );

  const highlightLayerStyle = useMemo(
    () => [
      styles.highlightLayer,
      { borderRadius },
    ],
    [borderRadius]
  );

  const borderGlowStyle = useMemo(
    () => [
      styles.borderGlow,
      {
        borderRadius,
        borderColor: `rgba(255, 255, 255, ${borderOpacity})`,
        borderWidth: thickness * 2,
      }
    ],
    [borderRadius, borderOpacity, thickness]
  );

  return (
    <View style={containerStyle} {...props}>
      {/* Glass Background Layer */}
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={layerStyle}
        pointerEvents="none"
      />
      
      {/* Tint Layer */}
      <View 
        style={[
          tintLayerStyle,
          { backgroundColor: tintColor }
        ]} 
        pointerEvents="none"
      />

      {/* Highlight/Shine Effect */}
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

      {/* Border Glow */}
      <View style={borderGlowStyle} pointerEvents="none" />

      {/* Content - direct children to preserve layout */}
      {children}
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  // Note: style prop is excluded as it's often recreated in RN
  return (
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.transmission === nextProps.transmission &&
    prevProps.roughness === nextProps.roughness &&
    prevProps.thickness === nextProps.thickness &&
    prevProps.tint === nextProps.tint &&
    prevProps.children === nextProps.children
  );
});

FluidGlass.displayName = 'FluidGlass';

export default FluidGlass;

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

