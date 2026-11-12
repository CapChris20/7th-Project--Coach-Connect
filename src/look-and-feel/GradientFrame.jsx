// Solid outline frame (strip pass: no cool-gradient card rings).
// Flow: ink border View → fill surface → children. Props kept so call sites still work.
// Used when a card/button previously needed GradientFrame chrome.

import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { borderRadius, lightColors, darkColors, nb } from './colorPalette';

// ===== NAMED CONSTANTS =====

const HARD_SHADOW_COLOR = lightColors.nbInk;

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
  colors, // ignored
  start, // ignored
  end, // ignored
  fill = lightColors.nbSurface,
  radius = borderRadius.nbCard,
  borderWidth = nb.borderWidth,
  noShadow = false,
  style,
  contentStyle,
}) {
  const shadowStyle = noShadow
    ? null
    : Platform.select({
        ios: {
          shadowColor: HARD_SHADOW_COLOR,
          shadowOpacity: 1,
          shadowRadius: 0,
          shadowOffset: { width: nb.shadowOffset, height: nb.shadowOffset },
        },
        android: { elevation: 4 },
      });

  return (
    <View style={[shadowStyle, style]}>
      {Platform.OS === 'android' && !noShadow ? (
        <View
          pointerEvents="none"
          style={[
            styles.androidShadow,
            {
              borderRadius: radius,
              backgroundColor: HARD_SHADOW_COLOR,
              top: nb.shadowOffset,
              left: nb.shadowOffset,
            },
          ]}
        />
      ) : null}
      <View
        style={{
          borderRadius: radius,
          borderWidth,
          borderColor: darkColors.nbBorder,
          backgroundColor: fill,
          overflow: 'hidden',
        }}
      >
        <View
          style={[
            {
              borderRadius: Math.max(0, radius - borderWidth),
              backgroundColor: fill,
              overflow: 'hidden',
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  androidShadow: {
    ...StyleSheet.absoluteFillObject,
  },
});
