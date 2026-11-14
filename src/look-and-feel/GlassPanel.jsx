// Frosted glass panel — stacks white gradients, tint, shine, and soft border behind children.
// Flow: glass knobs → opacities / tint rgba / corner radius → paint absolute layers → children on top.
// Used wherever a screen still wants liquid-glass chrome. `distortion` is accepted but not painted yet.
// vocab: transmission = how see-through; roughness = border softness; thickness scales border width.

import React, { useMemo, memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ===== NAMED CONSTANTS =====

// Manipulate here: opacity clamps and highlight ratios control how “glassy” vs flat the panel reads.
const GLASS_OPACITY_FLOOR = 0.1;
const GLASS_OPACITY_CEILING = 0.95;
const TRANSMISSION_TIMES_THIS = 0.85;
const BORDER_OPACITY_FLOOR = 0.1;
const BORDER_OPACITY_CEILING = 0.4;
const ROUGHNESS_TIMES_THIS = 2;
const DEFAULT_CORNER_RADIUS = 16;
const TINT_ALPHA_FRACTION = 0.15;
const WHITE_HIGHLIGHT_START_FRACTION = 0.25;
const WHITE_HIGHLIGHT_MID_FRACTION = 0.15;
const WHITE_HIGHLIGHT_END_FRACTION = 0.2;
const BORDER_WIDTH_PER_THICKNESS = 2;

const SHINE_GRADIENT_COLORS = [
  'rgba(255, 255, 255, 0.4)',
  'rgba(255, 255, 255, 0.1)',
  'transparent',
];
const SHINE_GRADIENT_START = { x: 0, y: 0 };
const SHINE_GRADIENT_END = { x: 1, y: 1 };

const styles = StyleSheet.create({
  outerBox: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  absoluteFillLayer: {
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
});

// ===== HELPER FUNCTIONS =====

/**
 * Soft white body gradient that fills the rounded box.
 */
function GlassBodyGradient({ gradientColors, layerStyle }) {
  return (
    <LinearGradient
      colors={gradientColors}
      start={SHINE_GRADIENT_START}
      end={SHINE_GRADIENT_END}
      style={layerStyle}
      pointerEvents="none"
    />
  );
}

/**
 * Solid tint wash (often a faint white or caller hex turned into rgba).
 */
function GlassTintWash({ tintColor, layerStyle }) {
  const tintPaintStyle = [layerStyle, { backgroundColor: tintColor }];
  return <View style={tintPaintStyle} pointerEvents="none" />;
}

/**
 * Diagonal shine highlight on top of the tint.
 */
function GlassShineHighlight({ layerStyle }) {
  return (
    <LinearGradient
      colors={SHINE_GRADIENT_COLORS}
      start={SHINE_GRADIENT_START}
      end={SHINE_GRADIENT_END}
      style={layerStyle}
      pointerEvents="none"
    />
  );
}

/**
 * Soft white border ring. Thickness already baked into borderGlowStyle.
 */
function GlassBorderRing({ borderGlowStyle }) {
  return <View style={borderGlowStyle} pointerEvents="none" />;
}

// ===== MAIN FUNCTION =====

/**
 * Liquid-glass wrapper. Children stay direct so their layout is unchanged.
 * @param {object} props
 */
const GlassPanel = memo(
  function GlassPanel({
    width,
    height,
    // Pulled out of ...props so View does not receive it. Layers do not paint distortion yet.
    distortion: _distortion = 0.5,
    roughness = 0.2,
    transmission = 0.9,
    thickness = 0.5,
    tint = '#ffffff',
    children,
    style,
    ...props
  }) {
    // 1. Turn glass knobs into opacities, tint rgba, gradient stops, and corner radius once per prop change.
    // vocab: useMemo = recalculate only when listed deps change (avoids redo on every parent render)
    // Hook order frozen: glassLook → outerBox → body → tint → highlight → border (six useMemos).
    const glassLook = useMemo(
      () => buildGlassLookFromKnobs({ transmission, roughness, tint, style }),
      [transmission, roughness, tint, style],
    );
    const {
      borderOpacity,
      tintColor,
      gradientColors,
      borderRadius: cornerRadius,
    } = glassLook;

    // 2. Size + caller style on the outer box.
    const outerBoxStyle = useMemo(
      () => [styles.outerBox, width && { width }, height && { height }, style],
      [width, height, style],
    );

    // 3. Shared absolute-fill layer shells — only corner radius changes between body / tint / shine.
    const bodyGradientStyle = useMemo(
      () => [styles.absoluteFillLayer, { borderRadius: cornerRadius }],
      [cornerRadius],
    );
    const tintFillStyle = useMemo(
      () => [styles.absoluteFillLayer, { borderRadius: cornerRadius }],
      [cornerRadius],
    );
    const highlightFillStyle = useMemo(
      () => [styles.highlightLayer, { borderRadius: cornerRadius }],
      [cornerRadius],
    );

    const borderGlowStyle = useMemo(
      () => [
        styles.absoluteFillLayer,
        {
          borderRadius: cornerRadius,
          borderColor: `rgba(255, 255, 255, ${borderOpacity})`,
          borderWidth: thickness * BORDER_WIDTH_PER_THICKNESS,
        },
      ],
      [cornerRadius, borderOpacity, thickness],
    );

    // 4. Stack non-interactive layers under children (pointerEvents none on each layer).
    return (
      <View style={outerBoxStyle} {...props}>
        <GlassBodyGradient gradientColors={gradientColors} layerStyle={bodyGradientStyle} />
        <GlassTintWash tintColor={tintColor} layerStyle={tintFillStyle} />
        <GlassShineHighlight layerStyle={highlightFillStyle} />
        <GlassBorderRing borderGlowStyle={borderGlowStyle} />
        {children}
      </View>
    );
  },
  function glassPanelPropsAreEqual(previousProps, nextProps) {
    const sameWidth = previousProps.width === nextProps.width;
    const sameHeight = previousProps.height === nextProps.height;
    const sameTransmission = previousProps.transmission === nextProps.transmission;
    const sameRoughness = previousProps.roughness === nextProps.roughness;
    const sameThickness = previousProps.thickness === nextProps.thickness;
    const sameTint = previousProps.tint === nextProps.tint;
    const sameChildren = previousProps.children === nextProps.children;

    const sameSize = sameWidth && sameHeight;
    const sameGlass = sameTransmission && sameRoughness && sameThickness && sameTint;
    return sameSize && sameGlass && sameChildren;
  },
);

GlassPanel.displayName = 'GlassPanel';

export default GlassPanel;

// PLUMBING — skip unless debugging

function clampNumberBetween(value, floor, ceiling) {
  return Math.max(floor, Math.min(ceiling, value));
}

function glassOpacityFromTransmission(transmission) {
  const rawOpacity = transmission * TRANSMISSION_TIMES_THIS;
  return clampNumberBetween(rawOpacity, GLASS_OPACITY_FLOOR, GLASS_OPACITY_CEILING);
}

function borderOpacityFromRoughness(roughness) {
  const rawOpacity = roughness * ROUGHNESS_TIMES_THIS;
  return clampNumberBetween(rawOpacity, BORDER_OPACITY_FLOOR, BORDER_OPACITY_CEILING);
}

function tintColorFromHexOrRgba(tintValue, glassOpacity) {
  if (tintValue.startsWith('rgba')) {
    return tintValue;
  }

  const hexDigits = tintValue.replace('#', '');
  const hexIsSixDigits = hexDigits.length === 6;
  if (!hexIsSixDigits) {
    return tintValue;
  }

  const red = parseInt(hexDigits.substring(0, 2), 16);
  const green = parseInt(hexDigits.substring(2, 4), 16);
  const blue = parseInt(hexDigits.substring(4, 6), 16);
  const tintAlpha = glassOpacity * TINT_ALPHA_FRACTION;
  return `rgba(${red}, ${green}, ${blue}, ${tintAlpha})`;
}

function whiteHighlightGradientColors(glassOpacity) {
  return [
    `rgba(255, 255, 255, ${glassOpacity * WHITE_HIGHLIGHT_START_FRACTION})`,
    `rgba(255, 255, 255, ${glassOpacity * WHITE_HIGHLIGHT_MID_FRACTION})`,
    `rgba(255, 255, 255, ${glassOpacity * WHITE_HIGHLIGHT_END_FRACTION})`,
  ];
}

function cornerRadiusFromCallerStyle(style) {
  const styleIsPlainObject =
    style && typeof style === 'object' && !Array.isArray(style);
  if (styleIsPlainObject) {
    return style.borderRadius || DEFAULT_CORNER_RADIUS;
  }

  if (Array.isArray(style)) {
    // vocab: StyleSheet.flatten = merge style array into one object React Native understands
    const flatStyle = StyleSheet.flatten(style);
    return flatStyle?.borderRadius || DEFAULT_CORNER_RADIUS;
  }

  return DEFAULT_CORNER_RADIUS;
}

function buildGlassLookFromKnobs({ transmission, roughness, tint, style }) {
  const glassOpacity = glassOpacityFromTransmission(transmission);
  const borderOpacity = borderOpacityFromRoughness(roughness);
  const tintColor = tintColorFromHexOrRgba(tint, glassOpacity);
  const gradientColors = whiteHighlightGradientColors(glassOpacity);
  const borderRadius = cornerRadiusFromCallerStyle(style);
  return { glassOpacity, borderOpacity, tintColor, gradientColors, borderRadius };
}
