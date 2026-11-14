// Calendar shortcut icon — frequency SVG from assets, not inline paths.
// Flow: caller size → square width/height → SvgXml paints the stored string.
// Used by screens that show the calendar button.

import React from 'react';
import { SvgXml } from 'react-native-svg';
import frequency2SvgXml from '../../assets/icons/frequency2SvgXml';

// ===== NAMED CONSTANTS =====

// Manipulate here: default tap target size when parent omits size.
const DEFAULT_ICON_SIZE = 34;

// ===== HELPER FUNCTIONS =====

// Turn one edge length into a square width/height pair for SvgXml.
function squareBoxSizeFromNumber(edgeLength) {
  return { width: edgeLength, height: edgeLength };
}

// ===== MAIN FUNCTION =====

/**
 * Calendar / frequency shortcut icon at the given square size.
 * @param {{ size?: number }} props
 */
export default function CalendarIcon({ size = DEFAULT_ICON_SIZE }) {
  // 1. Build a square box from the requested edge length.
  const squareSize = squareBoxSizeFromNumber(size);

  // 2. Paint the bundled frequency art at that size.
  // vocab: SvgXml = runtime paint of an SVG string; paths live in frequency2SvgXml.
  return (
    <SvgXml
      xml={frequency2SvgXml}
      width={squareSize.width}
      height={squareSize.height}
    />
  );
}
