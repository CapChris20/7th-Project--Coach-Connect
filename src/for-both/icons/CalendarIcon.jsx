// Draws the frequency icon used as the calendar button.
// Flow: take a size → hand the stored SVG to SvgXml.
// Used by: screens that show the calendar shortcut.

import React from 'react';
import { SvgXml } from 'react-native-svg';
import frequency2SvgXml from '../../assets/icons/frequency2SvgXml';

// ===== NAMED CONSTANTS =====

const DEFAULT_ICON_SIZE = 34;

// ===== HELPER FUNCTIONS =====

function frequencyIconSize(size) {
  return { width: size, height: size };
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ size?: number }} props
 */
export default function CalendarIcon({ size = DEFAULT_ICON_SIZE }) {
  const iconSize = frequencyIconSize(size);

  // 1. Draw the stored frequency SVG at the given size.
  // vocab: SvgXml = paint an SVG string. The paths live in frequency2SvgXml, not in this file.
  return <SvgXml xml={frequency2SvgXml} width={iconSize.width} height={iconSize.height} />;
}
