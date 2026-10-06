// Frosted panel. The blur sits behind the children so icons and text stay visible.
// Flow: peel padding off the outer style → blur fills the edges → children sit in a normal layer on top.
// Used by: headers and menus that need a frosted strip without blanking their contents.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';

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
 * Padding on the outer style would shrink the blur. It belongs on the content instead.
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

// ===== MAIN FUNCTION =====

/**
 * Do not put images, icons, or text inputs inside the blur view. They go blank on iOS and Android.
 * @param {{ intensity?: number, tint?: string, style?: object, contentWrapperStyle?: object, children?: import('react').ReactNode }} props
 */
export default function BlurredBackground({ intensity, tint, style, contentWrapperStyle, children }) {
  const flattenedStyle = StyleSheet.flatten(style) || {};
  const { shellStyle, contentInset } = splitShellPadding(flattenedStyle);
  const { backgroundColor, ...restOfShell } = shellStyle;

  return (
    <View style={[restOfShell, { position: 'relative', overflow: 'hidden' }]}>
      <BlurView intensity={intensity} tint={tint} pointerEvents="none" style={StyleSheet.absoluteFillObject} />
      {backgroundColor ? (
        <View
          style={[StyleSheet.absoluteFillObject, { backgroundColor }]}
          pointerEvents="none"
        />
      ) : null}
      <View
        style={[{ position: 'relative', zIndex: 1 }, contentInset, contentWrapperStyle]}
        collapsable={false}
      >
        {children}
      </View>
    </View>
  );
}
