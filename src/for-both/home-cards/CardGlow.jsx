// Legacy no-op — CardGlow used to paint a soft orange wash behind home heroes.
// Flow: ignore props → return null. Stale imports stay safe; NbCard owns the surface now.
// Used by: old call sites only. Design Law removed glow and blur decoration.

import React from 'react';

// ===== NAMED CONSTANTS =====

// Manipulate here: none — this stub must keep returning null forever.
const NOTHING_TO_PAINT = null;

// ===== HELPER FUNCTIONS =====

function paintNothingForLegacyCallers(_unusedProps) {
  return NOTHING_TO_PAINT;
}

// ===== MAIN FUNCTION =====

/**
 * Safe stub when an old screen still imports CardGlow.
 * @param {{ isDark?: boolean, borderRadius?: number }} unusedProps
 * @returns {null}
 */
export default function CardGlow(unusedProps) {
  // 1. Design Law retired glow; render nothing and let NbCard own the hero surface.
  return paintNothingForLegacyCallers(unusedProps);
}
