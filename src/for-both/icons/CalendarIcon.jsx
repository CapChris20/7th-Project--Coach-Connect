// Draws the frequency icon used as the calendar button.
// Flow: take a size → hand the stored SVG to SvgXml.
// Used by: screens that show the calendar shortcut.

import React from 'react';
import { SvgXml } from 'react-native-svg';
import frequency2SvgXml from '../../assets/icons/frequency2SvgXml';

// ===== NAMED CONSTANTS =====

const DEFAULT_ICON_SIZE = 34;

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * @param {{ size?: number }} props
 */
export default function CalendarIcon({ size = DEFAULT_ICON_SIZE }) {
  return <SvgXml xml={frequency2SvgXml} width={size} height={size} />;
}
