// Brand-colored tab/header icons: Ionicon shape as a mask, filled with the brand gradient.
// Flow: pick the ionicon for this name → MaskedView keeps the gradient only inside that shape.
// Used by the bottom nav and ChatIcon. SVG stroke+url(#gradient) painted black on device — this path matches AI Coach.

import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BRAND_NAV_ICON_GRADIENT,
  BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  BRAND_ICON_GRADIENT_START,
  BRAND_ICON_GRADIENT_END,
} from '../../look-and-feel/brandColors';

// ===== NAMED CONSTANTS =====

// Mask must be opaque. MaskedView uses the drawn pixels as the shape, not this as a tint.
const MASK_COLOR = '#FFFFFF';
const DEFAULT_ICON_SIZE = 36;

// Our friendly names → Ionicons glyph names (outline reads better on the frosted bar).
const IONICON_BY_NAME = {
  home: 'home-outline',
  barbell: 'barbell-outline',
  restaurant: 'restaurant-outline',
  'document-text': 'document-text-outline',
  gemini: 'sparkles',
  chatbubbles: 'chatbubbles-outline',
  people: 'people-outline',
  settings: 'settings-outline',
  sparkles: 'sparkles',
};

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} name
 * @returns {string|null}
 */
function ioniconNameFor(name) {
  return IONICON_BY_NAME[name] || null;
}

function iconBoxStyle(iconSize) {
  return { width: iconSize, height: iconSize };
}

function maskWrapStyle(iconSize) {
  return {
    width: iconSize,
    height: iconSize,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  };
}

/**
 * Opaque ionicon used as the mask shape.
 * @param {string} ioniconName
 * @param {number} iconSize
 * @returns {JSX.Element}
 */
function iconMaskElement(ioniconName, iconSize) {
  return (
    <View style={maskWrapStyle(iconSize)}>
      <Ionicons name={ioniconName} size={iconSize} color={MASK_COLOR} />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Draw one brand icon by name. Returns null when that name has no ionicon mapping.
 * @param {{ name: string, size?: number, colors?: string[], locations?: number[], start?: object, end?: object, strokeWidth?: number }} props
 * @returns {import('react').ReactElement|null}
 */
export default function ColorfulIcon({
  name,
  size = DEFAULT_ICON_SIZE,
  colors = BRAND_NAV_ICON_GRADIENT,
  locations = BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  start = BRAND_ICON_GRADIENT_START,
  end = BRAND_ICON_GRADIENT_END,
  // Kept so old call sites (strokeWidth={2.35}) do not crash — unused with MaskedView.
  strokeWidth: _strokeWidth,
}) {
  const ioniconName = ioniconNameFor(name);
  if (!ioniconName) return null;

  const boxStyle = iconBoxStyle(size);

  // vocab: MaskedView = show the gradient only where the ionicon is opaque.
  // collapsable={false} stops Android from flattening the mask away (icons went blank).
  return (
    <MaskedView
      style={boxStyle}
      collapsable={false}
      maskElement={iconMaskElement(ioniconName, size)}
    >
      <LinearGradient
        colors={colors}
        locations={locations}
        start={start}
        end={end}
        style={boxStyle}
      />
    </MaskedView>
  );
}
