// Brand gradient tab icons — ionicon shape masks a linear gradient (SVG stroke failed on device).
// Flow: map friendly name → outline glyph → MaskedView clips gradient to opaque mask pixels.
// Used by bottom nav and ChatIcon. strokeWidth prop kept so old call sites do not throw.

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
import { lightColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: mask must be fully opaque — MaskedView uses alpha as shape, not tint.
const OPAQUE_MASK_COLOR = lightColors.white;

// Manipulate here: default edge when a nav row omits size.
const DEFAULT_NAV_ICON_SIZE = 36;

// Friendly nav names → Ionicons glyph (outline reads on frosted bar).
// Add a key when a new tab icon lands.
const OUTLINE_GLYPH_BY_FRIENDLY_NAME = {
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

function makeSquareStyle(edgeLength) {
  return { width: edgeLength, height: edgeLength };
}

function makeCenteredTransparentBox(edgeLength) {
  return {
    width: edgeLength,
    height: edgeLength,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  };
}

// Look up the outline glyph, or null when the friendly name is unknown.
function findOutlineGlyph(friendlyName) {
  const glyphName = OUTLINE_GLYPH_BY_FRIENDLY_NAME[friendlyName];
  if (!glyphName) {
    return null;
  }
  return glyphName;
}

// White ionicon layer — its opaque pixels become the MaskedView shape.
function makeIoniconMask(ioniconName, iconEdge) {
  const centerStyle = makeCenteredTransparentBox(iconEdge);
  return (
    <View style={centerStyle}>
      <Ionicons name={ioniconName} size={iconEdge} color={OPAQUE_MASK_COLOR} />
    </View>
  );
}

// Brand gradient fill that only shows through the mask silhouette.
function makeBrandGradientLayer(
  iconEdge,
  gradientColors,
  gradientStops,
  gradientStart,
  gradientEnd,
) {
  const boxStyle = makeSquareStyle(iconEdge);
  return (
    <LinearGradient
      colors={gradientColors}
      locations={gradientStops}
      start={gradientStart}
      end={gradientEnd}
      style={boxStyle}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Gradient-filled ionicon for nav / chat shortcuts.
 * @param {object} props
 * @param {string} props.name Friendly name (home, barbell, chatbubbles, …)
 * @param {number} [props.size]
 * @param {string[]} [props.colors]
 * @param {number[]} [props.locations]
 * @param {object} [props.start]
 * @param {object} [props.end]
 * @param {number} [props.strokeWidth] Legacy — ignored; kept so old call sites do not crash
 * @returns {JSX.Element|null}
 */
export default function ColorfulIcon({
  name,
  size = DEFAULT_NAV_ICON_SIZE,
  colors = BRAND_NAV_ICON_GRADIENT,
  locations = BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  start = BRAND_ICON_GRADIENT_START,
  end = BRAND_ICON_GRADIENT_END,
  // Kept so legacy strokeWidth={2.35} call sites do not crash — unused with MaskedView.
  strokeWidth: _strokeWidth,
}) {
  // 1. Unknown name → render nothing (nav should not show a broken slot).
  const ioniconName = findOutlineGlyph(name);
  if (!ioniconName) {
    return null;
  }

  // 2. Build mask + gradient, then clip fill to the white ionicon pixels.
  const iconBoxStyle = makeSquareStyle(size);
  const ioniconMask = makeIoniconMask(ioniconName, size);
  const gradientLayer = makeBrandGradientLayer(
    size,
    colors,
    locations,
    start,
    end,
  );

  // vocab: MaskedView = children paint only where maskElement is opaque.
  // collapsable={false} stops Android from flattening the mask (icons went blank).
  return (
    <MaskedView
      style={iconBoxStyle}
      collapsable={false}
      maskElement={ioniconMask}
    >
      {gradientLayer}
    </MaskedView>
  );
}
