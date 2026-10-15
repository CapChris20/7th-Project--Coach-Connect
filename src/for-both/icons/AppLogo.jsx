// Draws the official Coach Connect logo from Logo.PNG.
// Flow: width comes from the caller → height follows the square aspect ratio → Image renders it.
// Used by: login and home screens that show the brand mark.

import React from 'react';
import { Image } from 'expo-image';
import { BRAND_LOGO_ASPECT, BRAND_LOGO_SOURCE } from '../../assets/logo/brandLogo';

// ===== NAMED CONSTANTS =====

const DEFAULT_LOGO_WIDTH = 220;
const DEFAULT_ACCESSIBILITY_LABEL = 'Coach Connect';

// ===== HELPER FUNCTIONS =====

/**
 * Height follows the stored brand aspect so Logo.PNG does not stretch.
 * @param {number} width
 * @returns {number}
 */
function logoHeightFromWidth(width) {
  return Math.round(width / BRAND_LOGO_ASPECT);
}

// ===== MAIN FUNCTION =====

/**
 * Official Coach Connect mark at the given width.
 * @param {{ width?: number, style?: object, accessibilityLabel?: string }} props
 */
export default function AppLogo({
  width = DEFAULT_LOGO_WIDTH,
  style,
  accessibilityLabel = DEFAULT_ACCESSIBILITY_LABEL,
}) {
  const height = logoHeightFromWidth(width);

  // 1. Height follows the brand aspect so the PNG does not stretch.
  // 2. Draw Logo.PNG at that size.
  // vocab: contentFit contain = scale the PNG down to fit, no crop.
  return (
    <Image
      source={BRAND_LOGO_SOURCE}
      style={[{ width, height }, style]}
      contentFit="contain"
      accessibilityLabel={accessibilityLabel}
      accessibilityIgnoresInvertColors
    />
  );
}
