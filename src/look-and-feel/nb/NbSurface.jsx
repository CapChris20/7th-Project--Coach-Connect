// The basic neobrutalist box: thick outline, hard offset shadow, optional gradient fill.
// Flow: paint the shadow layer behind → paint the outlined box on top → render the children inside.
// Used by NbButton, NbChip, NbField and by screens that need a card.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../lightDarkMode';
import {
  NB_BORDER_WIDTH,
  NB_GRADIENTS,
  NB_GRADIENT_END,
  NB_GRADIENT_START,
  NB_RADIUS,
  NB_SHADOW_OFFSET,
  getNbColors,
} from './nbTokens';

// ===== NAMED CONSTANTS =====

// ===== HELPER FUNCTIONS =====

/**
 * @param {string|undefined} gradientName One of the names in NB_GRADIENTS.
 * @returns {boolean}
 */
function hasGradient(gradientName) {
  return Boolean(gradientName && NB_GRADIENTS[gradientName]);
}

// ===== MAIN FUNCTION =====

/**
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.gradient] Name from NB_GRADIENTS. Leave empty for a plain surface.
 * @param {string} [props.fillColor] Overrides the plain surface color.
 * @param {number} [props.radius]
 * @param {boolean} [props.hasShadow]
 * @param {object} [props.style] Applies to the outer wrapper (margins, flex).
 * @param {object} [props.innerStyle] Applies to the outlined box (padding, alignment).
 * @returns {JSX.Element}
 */
export function NbSurface({
  children,
  gradient,
  fillColor,
  radius = NB_RADIUS.card,
  hasShadow = true,
  style,
  innerStyle,
}) {
  // 1. Pick the colors for the current theme.
  const { isDark } = useTheme();
  const colors = getNbColors(isDark);

  // 2. The wrapper reserves room on the right and bottom so the shadow never overlaps a neighbor.
  const wrapperStyle = { marginRight: NB_SHADOW_OFFSET, marginBottom: NB_SHADOW_OFFSET };
  const shadowStyle = {
    top: NB_SHADOW_OFFSET,
    left: NB_SHADOW_OFFSET,
    right: -NB_SHADOW_OFFSET,
    bottom: -NB_SHADOW_OFFSET,
    borderRadius: radius,
    backgroundColor: colors.shadow,
  };
  const boxStyle = {
    borderWidth: NB_BORDER_WIDTH,
    borderColor: colors.border,
    borderRadius: radius,
    backgroundColor: fillColor || colors.surface,
    overflow: 'hidden',
  };

  // 3. Shadow layer first, outlined box on top, gradient filling the box behind the children.
  return (
    <View style={[wrapperStyle, style]}>
      {hasShadow ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, shadowStyle]} /> : null}
      <View style={[boxStyle, innerStyle]}>
        {hasGradient(gradient) ? (
          <LinearGradient
            colors={NB_GRADIENTS[gradient]}
            start={NB_GRADIENT_START}
            end={NB_GRADIENT_END}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {children}
      </View>
    </View>
  );
}

export default NbSurface;
