// Barbell tab icon: opaque ionicon mask with brand gradient fill inside the shape.
// Flow: build square box → paint black ionicon as mask → MaskedView shows gradient only through that silhouette.
// Used by the bottom menu workout tab (legacy look, separate from SVG nav icons).

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

// Mask pixels must be opaque — MaskedView reads alpha/shape, not this as a tint.
// Manipulate here: any fully opaque color works; black is the usual mask convention.
const MASK_COLOR = '#000';
// Manipulate here: default tab glyph size in points.
const DEFAULT_TAB_ICON_SIZE = 36;

// ===== HELPER FUNCTIONS =====

function squareBoxStyle(sideLength) {
  return { width: sideLength, height: sideLength };
}

function centeredMaskContainerStyle(iconSize) {
  return {
    width: iconSize,
    height: iconSize,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  };
}

/**
 * Brand gradient square that fills the icon box.
 * MaskedView clips this so only the ionicon silhouette shows the colors.
 */
function BrandGradientFill({ iconSize, gradientColors, gradientStops, gradientStart, gradientEnd }) {
  const boxStyle = squareBoxStyle(iconSize);
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

/**
 * Opaque ionicon centered in a transparent box — becomes the MaskedView maskElement.
 */
function OpaqueIoniconMask({ ioniconName, iconSize }) {
  const maskContainerStyle = centeredMaskContainerStyle(iconSize);
  return (
    <View style={maskContainerStyle}>
      <Ionicons name={ioniconName} size={iconSize} color={MASK_COLOR} />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Workout tab barbell icon with brand gradient clipped to the ionicon outline.
 * @param {{ name: string, size?: number, colors?: string[], locations?: number[], start?: object, end?: object }} props
 */
export default function WorkoutTabIcon({
  name,
  size = DEFAULT_TAB_ICON_SIZE,
  colors = BRAND_NAV_ICON_GRADIENT,
  locations = BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  start = BRAND_ICON_GRADIENT_START,
  end = BRAND_ICON_GRADIENT_END,
}) {
  // 1. Square tab slot and opaque ionicon mask from the caller glyph name.
  const iconBoxStyle = squareBoxStyle(size);
  const maskElement = (
    <OpaqueIoniconMask ioniconName={name} iconSize={size} />
  );

  // 2. Clip the brand gradient to the ionicon outline via MaskedView.
  // vocab: MaskedView = children paint only where maskElement is opaque.
  // vocab: collapsable={false} = stop Android from flattening the mask away (icons went blank).
  return (
    <MaskedView
      style={iconBoxStyle}
      collapsable={false}
      maskElement={maskElement}
    >
      <BrandGradientFill
        iconSize={size}
        gradientColors={colors}
        gradientStops={locations}
        gradientStart={start}
        gradientEnd={end}
      />
    </MaskedView>
  );
}
