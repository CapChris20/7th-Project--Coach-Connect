// Solid card wrapper (strip pass: no glass blur / gradient stroke).
// Flow: Pressable when tappable → solid surface + ink border → children.
// Used by: login and panels that still import GlassCard — API unchanged.

import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { darkColors, lightColors, nb } from './colorPalette';

// ===== NAMED CONSTANTS =====

const PRESSED_OPACITY = 0.96;
const PLATFORM_IOS = 'ios';
const DEFAULT_RADIUS = 14;

// ===== HELPER FUNCTIONS =====

/**
 * iOS squircle when available.
 * @returns {{ borderCurve: string }|null}
 */
function iosContinuousCurveStyle() {
  return Platform.OS === PLATFORM_IOS ? { borderCurve: 'continuous' } : null;
}

/**
 * @param {boolean} isPressed
 * @param {*} extraStyle
 * @returns {Array}
 */
function pressedCardStyle(isPressed, extraStyle) {
  return [styles.hit, { opacity: isPressed ? PRESSED_OPACITY : 1 }, extraStyle];
}

// ===== MAIN FUNCTION =====

/**
 * Strip pass: solid nb surface, thick ink border — no BlurView, no glass stroke gradient.
 * @param {{ children: *, style?: object, contentStyle?: object, onPress?: Function, disabled?: boolean, radius?: number, blurIntensity?: number, strokeColors?: string[] }} props
 */
export default function GlassCard({
  children,
  style,
  contentStyle,
  onPress,
  disabled,
  radius = DEFAULT_RADIUS,
  blurIntensity, // ignored — kept for call-site compat
  strokeColors, // ignored — kept for call-site compat
}) {
  const Container = onPress ? Pressable : View;
  const containerStyle = onPress
    ? ({ pressed }) => pressedCardStyle(pressed, style)
    : [styles.hit, style];
  const continuousCurve = iosContinuousCurveStyle();

  return (
    <Container disabled={disabled} onPress={onPress} style={containerStyle}>
      <View
        style={[
          styles.surface,
          {
            borderRadius: radius,
            borderWidth: nb.borderWidth || 2.5,
            borderColor: lightColors.nbBorder,
            backgroundColor: darkColors.nbSurface,
            ...continuousCurve,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  hit: {
    minHeight: 44,
    minWidth: 44,
  },
  surface: {
    flex: 1,
    overflow: 'hidden',
  },
});
