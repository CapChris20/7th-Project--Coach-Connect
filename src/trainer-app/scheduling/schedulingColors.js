// Theme token remap for leftover scheduling helpers that still import this module.
// Flow: pick light or dark nb palette → return the old key names (bg, cardBg, text, …).
// Used by: older scheduling call sites. New screens should call useTheme() / nb* instead.
// Design Law: black/white/gray only — never purple borders, never green.
// Read order: main export → legacy named aliases under PLUMBING.

import { lightColors, darkColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: only if a legacy screen still reads these keys — new UI uses colorPalette nb*

// ===== HELPER FUNCTIONS =====
// (no internal helpers needed)

// ===== MAIN FUNCTION =====

/**
 * Pick dark or light nb-aligned palette and expose the old scheduling color keys.
 * Border is always nbBorder (never purple).
 * @param {boolean} isDark
 * @returns {object}
 */
export function getSessionSchedulingColors(isDark) {
  // 1. Choose the theme palette the rest of the app already uses.
  const paletteColors = isDark ? darkColors : lightColors;

  // 2. Remap to the legacy key names so old imports keep working.
  return {
    bg: paletteColors.nbBackground,
    cardBg: paletteColors.nbSurface,
    text: paletteColors.nbInk,
    label: paletteColors.nbInk,
    muted: paletteColors.nbMuted,
    divider: paletteColors.nbBorder,
    border: paletteColors.nbBorder,
    wheelShell: paletteColors.nbSoft,
    wheelInactive: paletteColors.nbMuted,
    inputBg: paletteColors.nbSurface,
  };
}

// ===== PLUMBING — skip unless debugging =====
// Legacy named exports kept so old imports do not crash.
// Values are nb ink / fill — not the old pink / purple / gold accents.

export const DARK_ORANGE = lightColors.nbInk;
export const DARK_PINK = lightColors.nbInk;
export const DARK_PURPLE = lightColors.nbInk;
export const GOLD = lightColors.nbInk;
export const SESSION_GRADIENT = [lightColors.nbFill, lightColors.nbFill];
export const ACCENT_GRADIENT = [lightColors.nbFill, lightColors.nbFill];
