// Draws the official Coach Connect logo (square or transparent infinity mark).
// Flow: width from caller → height from aspect → Image. Transparent variant for welcome stage.
// Used by: login welcome, signup header, trainer pro offer.

import React from 'react';
import { Image } from 'expo-image';
import {
  BRAND_LOGO_ASPECT,
  BRAND_LOGO_SOURCE,
  TRANSPARENT_BRAND_LOGO_ASPECT,
  TRANSPARENT_BRAND_LOGO_SOURCE,
} from '../../assets/logo/brandLogo';

// ===== NAMED CONSTANTS =====

const DEFAULT_LOGO_WIDTH = 220;
const DEFAULT_ACCESSIBILITY_LABEL = 'Coach Connect';

// ===== HELPER FUNCTIONS =====

/**
 * Height follows the stored brand aspect so the PNG does not stretch.
 * @param {number} width
 * @param {number} aspect
 * @returns {number}
 */
function logoHeightFromWidth(width, aspect) {
  return Math.round(width / aspect);
}

// ===== MAIN FUNCTION =====

/**
 * Official Coach Connect mark at the given width.
 * @param {{
 *   width?: number,
 *   style?: object,
 *   accessibilityLabel?: string,
 *   variant?: 'square' | 'transparent',
 * }} props
 */
export default function AppLogo({
  width = DEFAULT_LOGO_WIDTH,
  style,
  accessibilityLabel = DEFAULT_ACCESSIBILITY_LABEL,
  variant = 'square',
}) {
  // vocab: transparent = handoff cc-logo-transparent.png (black removed) for black/white stages
  const useTransparent = variant === 'transparent';
  const source = useTransparent ? TRANSPARENT_BRAND_LOGO_SOURCE : BRAND_LOGO_SOURCE;
  const aspect = useTransparent ? TRANSPARENT_BRAND_LOGO_ASPECT : BRAND_LOGO_ASPECT;
  const height = logoHeightFromWidth(width, aspect);

  // vocab: contentFit contain = scale the PNG down to fit, no crop.
  return (
    <Image
      source={source}
      style={[{ width, height }, style]}
      contentFit="contain"
      accessibilityLabel={accessibilityLabel}
      accessibilityIgnoresInvertColors
    />
  );
}
