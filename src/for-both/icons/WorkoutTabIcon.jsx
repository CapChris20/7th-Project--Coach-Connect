// Barbell tab icon: an Ionicon used as a mask, filled with the brand gradient.
// Flow: draw the ionicon in opaque black → MaskedView keeps the gradient only inside that shape.
// Used by the bottom menu for the workout tab. It stays separate from the SVG nav icons so this tab keeps the older look.

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

// The mask color has to be opaque. MaskedView uses the drawn pixels as the shape, not this color as a tint.
const MASK_COLOR = '#000';

// ===== HELPER FUNCTIONS =====

/**
 * Opaque ionicon centered in the tab slot. Returned as an element so the mask stays a View.
 * @param {string} iconName
 * @param {number} iconSize
 * @returns {JSX.Element}
 */
function workoutIconMask(iconName, iconSize) {
  return (
    <View
      style={{
        width: iconSize,
        height: iconSize,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
      }}
    >
      <Ionicons name={iconName} size={iconSize} color={MASK_COLOR} />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Gradient-filled ionicon for the workout tab.
 * @param {object} props
 * @param {string} props.name Ionicon name, for example the barbell glyph.
 * @param {number} [props.size]
 * @param {string[]} [props.colors]
 * @param {number[]} [props.locations]
 * @param {object} [props.start]
 * @param {object} [props.end]
 * @returns {JSX.Element}
 */
export default function WorkoutTabIcon({
  name,
  size = 36,
  colors = BRAND_NAV_ICON_GRADIENT,
  locations = BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  start = BRAND_ICON_GRADIENT_START,
  end = BRAND_ICON_GRADIENT_END,
}) {
  return (
    // vocab: MaskedView = show the children only inside the shape of maskElement.
    // collapsable={false} keeps Android from flattening this view away, which would drop the mask.
    <MaskedView
      style={{ width: size, height: size }}
      collapsable={false}
      maskElement={workoutIconMask(name, size)}
    >
      <LinearGradient
        colors={colors}
        locations={locations}
        start={start}
        end={end}
        style={{ width: size, height: size }}
      />
    </MaskedView>
  );
}
