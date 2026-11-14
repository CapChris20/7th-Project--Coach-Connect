// Design Law field frame — HardShadow plus a 3px ink border around form controls.
// Flow: read theme tokens → build outlined inner surface → wrap children in HardShadow.
// Used by food-card editors so screens do not re-wire HardShadow on every field.

import React from 'react';
import { View } from 'react-native';
import HardShadow from '../../look-and-feel/HardShadow';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { borderRadius, nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Default corner radius matches Design Law text inputs (nbInput).
// Manipulate here: pass `radius` from the parent to override for chips / tall fields.
const DEFAULT_FIELD_RADIUS = borderRadius.nbInput;

// ===== HELPER FUNCTIONS =====

/**
 * Build the bordered inner box style from theme ink + surface tokens.
 * Why a helper: keeps the main return free of inline style object noise.
 * @param {{ borderInk: string, surfaceFill: string, cornerRadius: number }} options
 * @returns {object}
 */
function outlinedInnerSurfaceStyle({ borderInk, surfaceFill, cornerRadius }) {
  return {
    // vocab: nb.borderWidth = Design Law 3px outline (not hairline)
    borderWidth: nb.borderWidth,
    borderColor: borderInk,
    backgroundColor: surfaceFill,
    borderRadius: cornerRadius,
    overflow: 'hidden',
  };
}

// ===== MAIN FUNCTION =====

/**
 * HardShadow frame around a form control. Same look as Design Law field chrome.
 * @param {{ children: React.ReactNode, radius?: number, style?: object, contentStyle?: object }} props
 */
export default function ColorFieldFrame({
  children,
  radius = DEFAULT_FIELD_RADIUS,
  style: outerShadowStyle,
  contentStyle: extraInnerStyle,
}) {
  // vocab: useTheme = light/dark token bag (nbBorder, nbSurface, …)
  const { colors } = useTheme();

  // 1. Name the Design Law surface before JSX — 3px ink border, surface fill, clipped corners.
  const framedSurfaceStyle = outlinedInnerSurfaceStyle({
    borderInk: colors.nbBorder,
    surfaceFill: colors.nbSurface,
    cornerRadius: radius,
  });
  const innerStyleList = [framedSurfaceStyle, extraInnerStyle];

  // 2. HardShadow owns the offset card shadow; children live in the bordered box.
  // vocab: HardShadow = solid offset shadow (no blur) from look-and-feel
  // Manipulate here: nb.shadowOffsetSmall = how far the hard shadow sits
  return (
    <HardShadow radius={radius} offset={nb.shadowOffsetSmall} style={outerShadowStyle}>
      <View style={innerStyleList}>{children}</View>
    </HardShadow>
  );
}
