// Gradient text for food cards. Thin wrapper so food screens do not import MaskedView directly.
// Flow: accept gradient stops + words → forward them to the shared look-and-feel ColorText.
// Used by: FoodCard, NutritionFactsPanel, and other food-card chrome.

import React from 'react';
import BaseColorText from '../../look-and-feel/ColorText';

// ===== NAMED CONSTANTS =====

// No local knobs — the shared ColorText owns blur / fill defaults.

// ===== HELPER FUNCTIONS =====

/**
 * Build the prop bag for the shared ColorText. Keeps the main return as a one-liner.
 * @param {{ colors?: string[], style?: object, start?: object, end?: object }} options
 * @returns {object}
 */
function sharedColorTextProps({ colors: gradientColors, style, start, end }) {
  return {
    colors: gradientColors,
    style,
    start,
    end,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Food-card gradient label. Same API as look-and-feel ColorText; food screens import this path.
 * @param {{ colors?: string[], style?: object, children?: import('react').ReactNode, start?: object, end?: object }} props
 */
export default function ColorText({ colors: gradientColors, style, children, start, end }) {
  const colorTextProps = sharedColorTextProps({
    colors: gradientColors,
    style,
    start,
    end,
  });

  return <BaseColorText {...colorTextProps}>{children}</BaseColorText>;
}
