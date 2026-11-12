// Theme tokens for any leftover scheduling helpers that still import this module.
// Flow: screens should prefer useTheme()/nb tokens; this file only remaps to those names.
// Used by: older scheduling call sites. Design Law: no purple borders, no green.
//
// Manipulate here: only if a legacy screen still reads these keys — new UI uses colorPalette nb*

import { lightColors, darkColors } from '../../look-and-feel/colorPalette';

// ===== HELPERS =====

/**
 * Pick dark or light nb-aligned palette. Border is always nbBorder (never purple).
 * @param {boolean} isDark
 * @returns {object}
 */
export function getSessionSchedulingColors(isDark) {
  const c = isDark ? darkColors : lightColors;
  return {
    bg: c.nbBackground,
    cardBg: c.nbSurface,
    text: c.nbInk,
    label: c.nbInk,
    muted: c.nbMuted,
    divider: c.nbBorder,
    border: c.nbBorder,
    wheelShell: c.nbSoft,
    wheelInactive: c.nbMuted,
    inputBg: c.nbSurface,
  };
}

// Legacy named exports kept so old imports do not crash — values are nb tokens, not pink/purple
export const DARK_ORANGE = lightColors.nbInk;
export const DARK_PINK = lightColors.nbInk;
export const DARK_PURPLE = lightColors.nbInk;
export const GOLD = lightColors.nbInk;
export const SESSION_GRADIENT = [lightColors.nbFill, lightColors.nbFill];
export const ACCENT_GRADIENT = [lightColors.nbFill, lightColors.nbFill];
