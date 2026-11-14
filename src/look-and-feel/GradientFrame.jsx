// Solid outline frame — strip pass: ink border + fill (not cool-gradient rings).
// Flow: optional hard shadow → ink border shell → inner content inset → children.
// Used when older screens wrapped cards/buttons in GradientFrame chrome.
//
// vocab: colors/start/end props stay for call-site compat but are ignored in strip pass
// Manipulate here: HARD_SHADOW_COLOR, ANDROID_ELEVATION, nb.shadowOffset, nb.borderWidth

import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { borderRadius, lightColors, darkColors, nb } from './colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: shadow color tracks light nb ink for the hard offset look
const HARD_SHADOW_COLOR = lightColors.nbInk;
const PLATFORM_ANDROID = 'android';
const ANDROID_ELEVATION = 4;
const HARD_SHADOW_OPACITY = 1;
const HARD_SHADOW_BLUR_RADIUS = 0;

// ===== HELPER FUNCTIONS =====

function buildIosPlatformShadowStyle() {
  return {
    shadowColor: HARD_SHADOW_COLOR,
    shadowOpacity: HARD_SHADOW_OPACITY,
    shadowRadius: HARD_SHADOW_BLUR_RADIUS,
    shadowOffset: { width: nb.shadowOffset, height: nb.shadowOffset },
  };
}

function buildAndroidPlatformShadowStyle() {
  return { elevation: ANDROID_ELEVATION };
}

function platformShadowStyleWhenEnabled(shadowIsOff) {
  if (shadowIsOff) {
    return null;
  }
  return Platform.select({
    ios: buildIosPlatformShadowStyle(),
    android: buildAndroidPlatformShadowStyle(),
  });
}

function shouldPaintAndroidShadowDuplicate(shadowIsOff) {
  if (shadowIsOff) {
    return false;
  }
  return Platform.OS === PLATFORM_ANDROID;
}

function buildAndroidDuplicateFillStyle(cornerRadius) {
  return [
    styles.androidShadowFill,
    {
      borderRadius: cornerRadius,
      backgroundColor: HARD_SHADOW_COLOR,
      top: nb.shadowOffset,
      left: nb.shadowOffset,
    },
  ];
}

function buildOuterInkRingStyle(cornerRadius, borderWidth, fillColor) {
  return {
    borderRadius: cornerRadius,
    borderWidth,
    borderColor: darkColors.nbBorder,
    backgroundColor: fillColor,
    overflow: 'hidden',
  };
}

function innerClipRadiusFromBorder(cornerRadius, borderWidth) {
  return Math.max(0, cornerRadius - borderWidth);
}

function buildInnerContentShellStyle(innerClipRadius, fillColor, contentStyle) {
  return [
    {
      borderRadius: innerClipRadius,
      backgroundColor: fillColor,
      overflow: 'hidden',
    },
    contentStyle,
  ];
}

function AndroidDuplicateShadowFill({ cornerRadius }) {
  const fillStyle = buildAndroidDuplicateFillStyle(cornerRadius);
  return <View pointerEvents="none" style={fillStyle} />;
}

function InkBorderFrame({ cornerRadius, borderWidth, fillColor, contentStyle, children }) {
  const outerRingStyle = buildOuterInkRingStyle(cornerRadius, borderWidth, fillColor);
  const innerClipRadius = innerClipRadiusFromBorder(cornerRadius, borderWidth);
  const innerContentShellStyle = buildInnerContentShellStyle(
    innerClipRadius,
    fillColor,
    contentStyle,
  );

  return (
    <View style={outerRingStyle}>
      <View style={innerContentShellStyle}>{children}</View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Strip pass: colors/start/end ignored — paints a solid ink border + fill.
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 * @param {string[]} [props.colors] - ignored (compat)
 * @param {{ x: number, y: number }} [props.start]
 * @param {{ x: number, y: number }} [props.end]
 * @param {string} [props.fill]
 * @param {number} [props.radius]
 * @param {number} [props.borderWidth]
 * @param {boolean} [props.noShadow]
 * @param {object} [props.style]
 * @param {object} [props.contentStyle]
 */
export default function GradientFrame({
  children,
  colors,
  start,
  end,
  fill = lightColors.nbSurface,
  radius = borderRadius.nbCard,
  borderWidth = nb.borderWidth,
  noShadow = false,
  style,
  contentStyle,
}) {
  // Legacy gradient props are intentionally unused — keep names so old call sites do not break.
  void colors;
  void start;
  void end;

  // 1. iOS: native hard shadow on the wrapper. Android: elevation + optional duplicate fill.
  const shadowIsOff = noShadow === true;
  const platformShadowStyle = platformShadowStyleWhenEnabled(shadowIsOff);
  const showAndroidShadowDuplicate = shouldPaintAndroidShadowDuplicate(shadowIsOff);
  const wrapperStyle = [platformShadowStyle, style];

  // 2. Outer ink ring + inner clip so children respect radius minus border.
  return (
    <View style={wrapperStyle}>
      {showAndroidShadowDuplicate ? (
        <AndroidDuplicateShadowFill cornerRadius={radius} />
      ) : null}
      <InkBorderFrame
        cornerRadius={radius}
        borderWidth={borderWidth}
        fillColor={fill}
        contentStyle={contentStyle}
      >
        {children}
      </InkBorderFrame>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  androidShadowFill: {
    ...StyleSheet.absoluteFillObject,
  },
});
