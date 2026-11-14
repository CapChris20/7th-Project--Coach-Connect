// Dark-mode full-screen page wash behind login / setup content.
// Flow: read Design-Law dark nbBackground → build flex root style → wrap children.
// Used by screens that still import GlassBackgroundDark (API kept; prefer plain View + theme for new UI).

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { darkColors } from './colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: page fill is the dark theme token — never paste a random hex here.
const DARK_PAGE_WASH_COLOR = darkColors.nbBackground;

const styles = StyleSheet.create({
  fullScreenRoot: {
    flex: 1,
    backgroundColor: DARK_PAGE_WASH_COLOR,
  },
});

// ===== HELPER FUNCTIONS =====

/**
 * Merge the full-screen dark wash with any caller overrides (padding, safe area).
 * @param {object|object[]|undefined} callerStyle
 * @returns {Array}
 */
function buildDarkPageRootStyle(callerStyle) {
  return [styles.fullScreenRoot, callerStyle];
}

// ===== MAIN FUNCTION =====

/**
 * Solid dark page background. Same props as before so call sites stay unchanged.
 * @param {{ children: import('react').ReactNode, style?: object }} props
 */
export default function GlassBackgroundDark({ children, style }) {
  // 1. Stack token wash + caller style (caller wins on conflicts).
  const pageRootStyle = buildDarkPageRootStyle(style);

  // 2. Paint the shell; screens own scroll / form content inside.
  return <View style={pageRootStyle}>{children}</View>;
}
