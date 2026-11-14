// Google Gemini mark filled with the brand gradient, for the AI coach tab.
// Flow: size the tab slot → build PNG mask → clip LinearGradient through MaskedView.
// Used by the tab bar as the AI coach icon.

import React from 'react';
import { View, Image } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import {
  BRAND_NAV_ICON_GRADIENT,
  BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  BRAND_ICON_GRADIENT_START,
  BRAND_ICON_GRADIENT_END,
} from '../../look-and-feel/brandColors';

// ===== NAMED CONSTANTS =====

const GEMINI_MARK_IMAGE = require('../../assets/icons/google_gemini.png');

// Manipulate here: default tab slot edge when parent omits size.
const DEFAULT_TAB_ICON_SIZE = 36;

// Manipulate here: fraction of the tab slot the mark fills. Lower = more padding around the spark.
const GEMINI_MARK_SCALE = 0.9;

// ===== HELPER FUNCTIONS =====

function markSizeInsideTabSlot(tabSlotEdge) {
  return tabSlotEdge * GEMINI_MARK_SCALE;
}

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

// Opaque PNG silhouette — MaskedView shows the gradient only where this image is drawn.
function makeGeminiPngMask(tabSlotEdge, markEdge) {
  const slotStyle = makeCenteredTransparentBox(tabSlotEdge);
  const markStyle = makeSquareStyle(markEdge);

  return (
    <View style={slotStyle}>
      <Image source={GEMINI_MARK_IMAGE} style={markStyle} resizeMode="contain" />
    </View>
  );
}

// Full-slot brand gradient; the mask clips it to the Gemini shape.
function makeBrandGradientLayer(slotStyle, gradientColors, gradientStops, gradientStart, gradientEnd) {
  return (
    <LinearGradient
      colors={gradientColors}
      locations={gradientStops}
      start={gradientStart}
      end={gradientEnd}
      style={slotStyle}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Gradient-filled Gemini mark for the AI coach tab.
 * @param {object} [props]
 * @param {number} [props.size]
 * @param {string[]} [props.colors]
 * @param {number[]} [props.locations]
 * @param {object} [props.start]
 * @param {object} [props.end]
 * @returns {JSX.Element}
 */
export default function AICoachTabIcon({
  size = DEFAULT_TAB_ICON_SIZE,
  colors = BRAND_NAV_ICON_GRADIENT,
  locations = BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  start = BRAND_ICON_GRADIENT_START,
  end = BRAND_ICON_GRADIENT_END,
}) {
  // 1. Tab slot is square; Gemini art is slightly smaller inside it.
  const tabSlotStyle = makeSquareStyle(size);
  const markEdge = markSizeInsideTabSlot(size);

  // 2. Build the PNG mask and the brand gradient fill.
  const pngMask = makeGeminiPngMask(size, markEdge);
  const gradientLayer = makeBrandGradientLayer(
    tabSlotStyle,
    colors,
    locations,
    start,
    end,
  );

  // 3. Paint brand gradient, clipped to the PNG silhouette.
  // vocab: MaskedView = show children only inside maskElement’s opaque pixels.
  // collapsable={false} keeps Android from flattening this view away, which would drop the mask.
  return (
    <MaskedView style={tabSlotStyle} collapsable={false} maskElement={pngMask}>
      {gradientLayer}
    </MaskedView>
  );
}
