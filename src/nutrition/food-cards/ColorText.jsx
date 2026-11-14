// Gradient label text for food cards — thin wrapper around look-and-feel ColorText.
// Flow: parent passes gradient stops + typography → shared SVG/MaskedView paints the words.
// Used by FoodCard, NutritionFactsPanel, and other nutrition chrome on this import path.

import React from 'react';
import BaseColorText from '../../look-and-feel/ColorText';

// ===== NAMED CONSTANTS =====

// No local knobs — blur / fill / default ramp live in look-and-feel ColorText.
// Food screens import this path so they never reach into look-and-feel directly for labels.

// ===== HELPER FUNCTIONS =====

// (none — this file only forwards props to the shared ColorText)

// ===== MAIN FUNCTION =====

/**
 * Food-card gradient label. Same API as look-and-feel ColorText; food screens import this path.
 * @param {{ colors?: string[], style?: object, children?: import('react').ReactNode, start?: object, end?: object }} props
 */
export default function ColorText({
  colors: gradientColorStops,
  style: textStyle,
  children,
  start: gradientStartPoint,
  end: gradientEndPoint,
}) {
  // 1. Name the forwarded bag so JSX stays free of rename noise.
  // vocab: BaseColorText expects `colors` (stops), not the food-card alias we accept from parents
  const sharedColorTextProps = {
    colors: gradientColorStops,
    style: textStyle,
    start: gradientStartPoint,
    end: gradientEndPoint,
  };

  // 2. One shared implementation — measure / SVG fill defaults stay in look-and-feel.
  return <BaseColorText {...sharedColorTextProps}>{children}</BaseColorText>;
}
