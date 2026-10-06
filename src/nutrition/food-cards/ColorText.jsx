// Gradient text for food cards. This wraps the shared SVG text so food screens do not use MaskedView.
// Flow: pass the gradient and the words through to the shared ColorText.
// Used by: food cards.

import React from 'react';
import BaseColorText from '../../look-and-feel/ColorText';

// ===== NAMED CONSTANTS =====

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * @param {{ colors?: string[], style?: object, children?: import('react').ReactNode, start?: object, end?: object }} props
 */
export default function ColorText({ colors: gradientColors, style, children, start, end }) {
  return (
    <BaseColorText colors={gradientColors} style={style} start={start} end={end}>
      {children}
    </BaseColorText>
  );
}
