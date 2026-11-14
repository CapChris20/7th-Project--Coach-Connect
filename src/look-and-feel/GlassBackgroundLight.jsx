// Light-mode full-screen page wash behind login / setup content.
// Flow: read Design-Law light nbBackground → build flex root style → wrap children.
// Used by screens that still import GlassBackgroundLight (API kept; prefer plain View + theme for new UI).

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { lightColors } from './colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: page fill is the light theme token — never paste a random hex here.
const LIGHT_PAGE_WASH_COLOR = lightColors.nbBackground;

const styles = StyleSheet.create({
  fullScreenRoot: {
    flex: 1,
    backgroundColor: LIGHT_PAGE_WASH_COLOR,
  },
});

// ===== HELPER FUNCTIONS =====

/**
 * Merge the full-screen light wash with any caller overrides (padding, safe area).
 * @param {object|object[]|undefined} callerStyle
 * @returns {Array}
 */
function buildLightPageRootStyle(callerStyle) {
  return [styles.fullScreenRoot, callerStyle];
}

// ===== MAIN FUNCTION =====

/**
 * Solid light page background. Same props as before so call sites stay unchanged.
 * @param {{ children: import('react').ReactNode, style?: object }} props
 */
export default function GlassBackgroundLight({ children, style }) {
  // 1. Stack token wash + caller style (caller wins on conflicts).
  const pageRootStyle = buildLightPageRootStyle(style);

  // 2. Paint the shell; screens own scroll / form content inside.
  return <View style={pageRootStyle}>{children}</View>;
}
