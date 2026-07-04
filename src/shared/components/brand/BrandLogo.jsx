import React from 'react';
import { Image } from 'expo-image';
import { BRAND_LOGO_ASPECT, BRAND_LOGO_SOURCE } from '../../../assets/logo/brandLogo';

/**
 * Renders the official Coach Connect logo (src/assets/logo/Logo.PNG).
 */
export default function BrandLogo({ width = 220, style, accessibilityLabel = 'Coach Connect' }) {
  const height = Math.round(width / BRAND_LOGO_ASPECT);
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
