// Solid surface shell — strip pass killed frosted blur; callers still pass intensity/tint.
// Flow: flatten style → peel padding onto content → pick solid fill from tint → shell + children.
// Used by: headers, menus, cards that used to wrap expo-blur.
//
// vocab: tint = old BlurView light/dark hint; we map it to nbSurface only
// Manipulate here: lightColors.nbSurface / darkColors.nbSurface are the strip fills

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { lightColors, darkColors } from './colorPalette';

// ===== NAMED CONSTANTS =====

// Padding keys leave the outer shell so the content layer owns inset (matches old blur layout).
const PADDING_STYLE_KEYS = [
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingHorizontal',
  'paddingVertical',
];

const TINT_DARK = 'dark';

// ===== HELPER FUNCTIONS =====

function shellStyleHasPaddingKey(shellStyle, paddingKey) {
  return shellStyle[paddingKey] != null;
}

// Outer shell keeps size/position; padding moves to the inner content wrapper.
function peelPaddingOffShellStyle(flatStyle) {
  const shellStyle = { ...(flatStyle || {}) };
  const paddingForContent = {};

  for (const paddingKey of PADDING_STYLE_KEYS) {
    if (!shellStyleHasPaddingKey(shellStyle, paddingKey)) continue;
    paddingForContent[paddingKey] = shellStyle[paddingKey];
    delete shellStyle[paddingKey];
  }

  return { shellStyle, paddingForContent };
}

// Dark tint → dark surface; anything else → light surface (intensity is ignored in strip pass).
function solidFillColorForTint(tint) {
  if (tint === TINT_DARK) {
    return darkColors.nbSurface;
  }
  return lightColors.nbSurface;
}

function pickShellFillColor(callerBackgroundColor, tint) {
  if (callerBackgroundColor) {
    return callerBackgroundColor;
  }
  return solidFillColorForTint(tint);
}

function buildOuterShellStyle(shellWithoutBackground, shellFillColor) {
  return [
    shellWithoutBackground,
    {
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: shellFillColor,
    },
  ];
}

function buildContentLayerStyle(paddingForContent, contentWrapperStyle) {
  return [
    styles.contentLayer,
    paddingForContent,
    contentWrapperStyle,
  ];
}

function SolidShellContent({ paddingForContent, contentWrapperStyle, children }) {
  const contentLayerStyle = buildContentLayerStyle(paddingForContent, contentWrapperStyle);
  return (
    <View style={contentLayerStyle} collapsable={false}>
      {children}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Strip pass: ignores blur intensity — paints a solid surface so glass chrome is gone.
 * @param {{ intensity?: number, tint?: string, style?: object, contentWrapperStyle?: object, children?: import('react').ReactNode }} props
 */
export default function BlurredBackground({
  intensity,
  tint,
  style,
  contentWrapperStyle,
  children,
}) {
  // Legacy blur prop kept so old call sites still compile; strip pass never reads it.
  void intensity;

  // 1. Flatten caller style and peel padding onto the content layer.
  const flattenedStyle = StyleSheet.flatten(style) || {};
  const { shellStyle, paddingForContent } = peelPaddingOffShellStyle(flattenedStyle);

  // 2. Caller backgroundColor wins; otherwise pick surface from tint.
  const { backgroundColor: callerBackgroundColor, ...shellWithoutBackground } = shellStyle;
  const shellFillColor = pickShellFillColor(callerBackgroundColor, tint);

  // 3. Paint solid shell + children above it (same stacking as the old blur stack).
  const outerShellStyle = buildOuterShellStyle(shellWithoutBackground, shellFillColor);

  return (
    <View style={outerShellStyle}>
      <SolidShellContent
        paddingForContent={paddingForContent}
        contentWrapperStyle={contentWrapperStyle}
      >
        {children}
      </SolidShellContent>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  contentLayer: {
    position: 'relative',
    zIndex: 1,
  },
});
