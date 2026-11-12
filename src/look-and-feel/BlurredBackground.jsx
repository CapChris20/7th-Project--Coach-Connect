// Solid surface shell (strip pass: no frosted blur).
// Flow: apply style to a View → render children. Same API as the old blur wrapper so callers keep working.
// Used by: headers, menus, cards that previously used expo-blur.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { lightColors, darkColors } from './colorPalette';

// ===== NAMED CONSTANTS =====

const PADDING_KEYS = [
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingHorizontal',
  'paddingVertical',
];

// ===== HELPER FUNCTIONS =====

/**
 * Padding on the outer style stays on the content layer so layout matches the old blur shell.
 * @param {object} flatStyle
 * @returns {{ shellStyle: object, contentInset: object }}
 */
function splitShellPadding(flatStyle) {
  const shellStyle = { ...(flatStyle || {}) };
  const contentInset = {};
  for (const paddingKey of PADDING_KEYS) {
    if (shellStyle[paddingKey] == null) continue;
    contentInset[paddingKey] = shellStyle[paddingKey];
    delete shellStyle[paddingKey];
  }
  return { shellStyle, contentInset };
}

/**
 * Tint → solid fill. Dark tint uses dark surface; light uses white surface.
 * @param {string|undefined} tint
 * @returns {string}
 */
function solidFillForTint(tint) {
  if (tint === 'dark') return darkColors.nbSurface;
  return lightColors.nbSurface;
}

// ===== MAIN FUNCTION =====

/**
 * Strip pass: ignores blur intensity — paints a solid surface so glass chrome is gone.
 * @param {{ intensity?: number, tint?: string, style?: object, contentWrapperStyle?: object, children?: import('react').ReactNode }} props
 */
export default function BlurredBackground({ intensity, tint, style, contentWrapperStyle, children }) {
  const flattenedStyle = StyleSheet.flatten(style) || {};
  const { shellStyle, contentInset } = splitShellPadding(flattenedStyle);
  const { backgroundColor, ...restOfShell } = shellStyle;
  const fill = backgroundColor || solidFillForTint(tint);

  return (
    <View
      style={[
        restOfShell,
        {
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: fill,
        },
      ]}
    >
      <View style={[{ position: 'relative', zIndex: 1 }, contentInset, contentWrapperStyle]} collapsable={false}>
        {children}
      </View>
    </View>
  );
}
