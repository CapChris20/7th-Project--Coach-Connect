// Google Gemini mark filled with the brand gradient, for the AI coach tab.
// Flow: draw the PNG as a mask → paint the gradient through that shape → size the mark slightly inside the box.
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

const GEMINI_MARK = require('../../assets/icons/google_gemini.png');
const DEFAULT_TAB_ICON_SIZE = 36;
// Manipulate here: fraction of the tab slot the mark fills. Lower = more padding around the spark.
const GEMINI_MARK_SCALE = 0.9;

// ===== HELPER FUNCTIONS =====

/**
 * @param {number} iconSize
 * @returns {number}
 */
function geminiMarkSize(iconSize) {
  return iconSize * GEMINI_MARK_SCALE;
}

function tabSlotStyle(iconSize) {
  return { width: iconSize, height: iconSize };
}

function geminiMaskStyle(iconSize) {
  return {
    width: iconSize,
    height: iconSize,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  };
}

function geminiImageStyle(markSize) {
  return { width: markSize, height: markSize };
}

/**
 * The mask is the opaque PNG. MaskedView shows the gradient only where this image is drawn.
 * Returned as an element, not a component, so the mask stays a View.
 * @param {number} iconSize
 * @param {number} markSize
 * @returns {JSX.Element}
 */
function geminiMarkMask(iconSize, markSize) {
  const maskStyle = geminiMaskStyle(iconSize);
  const imageStyle = geminiImageStyle(markSize);
  return (
    <View style={maskStyle}>
      <Image source={GEMINI_MARK} style={imageStyle} resizeMode="contain" />
    </View>
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
  const markSize = geminiMarkSize(size);
  const boxStyle = tabSlotStyle(size);
  const markMask = geminiMarkMask(size, markSize);

  // 1. Size the Gemini mark a bit inside the tab slot.
  // 2. Mask the brand gradient through that PNG.
  return (
    // vocab: MaskedView = show the children only inside the shape of maskElement.
    // collapsable={false} keeps Android from flattening this view away, which would drop the mask.
    <MaskedView
      style={boxStyle}
      collapsable={false}
      maskElement={markMask}
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
