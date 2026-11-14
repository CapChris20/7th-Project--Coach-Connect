// Official Coach Connect logo — square mark or transparent infinity for dark stages.
// Flow: pick asset from variant → height from brand aspect → expo-image with contain fit.
// Used by login welcome, signup header, trainer pro offer.

import React from 'react';
import { Image } from 'expo-image';
import {
  BRAND_LOGO_ASPECT,
  BRAND_LOGO_SOURCE,
  TRANSPARENT_BRAND_LOGO_ASPECT,
  TRANSPARENT_BRAND_LOGO_SOURCE,
} from '../../assets/logo/brandLogo';

// ===== NAMED CONSTANTS =====

// Manipulate here: default width when the parent does not pass one.
const DEFAULT_LOGO_WIDTH = 220;
const DEFAULT_ACCESSIBILITY_LABEL = 'Coach Connect';
const LOGO_VARIANT_TRANSPARENT = 'transparent';
const LOGO_VARIANT_SQUARE = 'square';

// ===== HELPER FUNCTIONS =====

// Height follows stored aspect so the PNG never stretches.
function logoHeightForWidth(logoWidth, aspectRatio) {
  return Math.round(logoWidth / aspectRatio);
}

// Pick square vs transparent handoff PNG and its aspect ratio.
function pickLogoAsset(variantName) {
  // vocab: transparent = cc-logo-transparent.png with black removed for B/W welcome stages.
  const wantsTransparentMark = variantName === LOGO_VARIANT_TRANSPARENT;
  if (wantsTransparentMark) {
    return {
      imageSource: TRANSPARENT_BRAND_LOGO_SOURCE,
      aspectRatio: TRANSPARENT_BRAND_LOGO_ASPECT,
    };
  }
  return {
    imageSource: BRAND_LOGO_SOURCE,
    aspectRatio: BRAND_LOGO_ASPECT,
  };
}

// Fixed box first, then any parent style overrides.
function combineLogoStyles(logoWidth, logoHeight, styleFromParent) {
  const sizeBox = { width: logoWidth, height: logoHeight };
  return [sizeBox, styleFromParent];
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
  variant = LOGO_VARIANT_SQUARE,
}) {
  // 1. Pick square vs transparent handoff asset and its aspect ratio.
  const logoAsset = pickLogoAsset(variant);

  // 2. Lock height to aspect so layout does not squish the mark.
  const logoHeight = logoHeightForWidth(width, logoAsset.aspectRatio);
  const imageStyle = combineLogoStyles(width, logoHeight, style);

  // 3. Paint with contain fit so the PNG scales down without cropping.
  // vocab: contentFit contain = scale down to fit box without cropping.
  // vocab: accessibilityIgnoresInvertColors = keep logo colors when iOS Smart Invert is on.
  return (
    <Image
      source={logoAsset.imageSource}
      style={imageStyle}
      contentFit="contain"
      accessibilityLabel={accessibilityLabel}
      accessibilityIgnoresInvertColors
    />
  );
}
