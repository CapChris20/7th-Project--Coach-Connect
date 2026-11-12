// Weekly-report color tokens — Design Law nb palette only (no green, no purple chrome).
// Flow: pick accent gradients for icon chips → light/dark text+surface from nb tokens.
// Used by: reportColorSettings and every weekly-report card/chart.

import { accentGradients, darkColors, lightColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: which accentGradients pair feeds g1–g5 (icon chips / focus tips only)
const GRADIENTS = {
  g1: accentGradients[0],
  g2: accentGradients[2],
  g3: accentGradients[3],
  g4: accentGradients[6],
  g5: accentGradients[8],
};

// Design Law light — flat bg, ink text, 3px border token (never soft purple wash)
const LIGHT_COLORS = {
  background: lightColors.nbBackground,
  backgroundGradient: [lightColors.nbBackground, lightColors.nbBackground],
  surfacePrimary: lightColors.nbSurface,
  surfaceSecondary: lightColors.nbSoft,
  textPrimary: lightColors.nbInk,
  textSecondary: lightColors.nbMuted,
  textMuted: lightColors.nbMuted,
  border: lightColors.nbBorder,
  blurTint: 'light',
  fill: lightColors.nbFill,
  onFill: lightColors.nbOnFill,
  soft: lightColors.nbSoft,
  shadow: lightColors.nbShadow,
};

// Design Law dark — same roles, bright border/shadow so hard offsets still read
const DARK_COLORS = {
  background: darkColors.nbBackground,
  backgroundGradient: [darkColors.nbBackground, darkColors.nbBackground],
  surfacePrimary: darkColors.nbSurface,
  surfaceSecondary: darkColors.nbSoft,
  textPrimary: darkColors.nbInk,
  textSecondary: darkColors.nbMuted,
  textMuted: darkColors.nbMuted,
  border: darkColors.nbBorder,
  blurTint: 'dark',
  fill: darkColors.nbFill,
  onFill: darkColors.nbOnFill,
  soft: darkColors.nbSoft,
  shadow: darkColors.nbShadow,
};

// Trend arrows stay ink/muted — never green (Design Law: never green)
const TREND_POSITIVE = lightColors.nbInk;
const TREND_NEGATIVE = lightColors.nbMuted;
const STORAGE_KEY = 'coachconnect.theme.mode';

// ===== MAIN FUNCTION =====

export {
  GRADIENTS,
  DARK_COLORS,
  LIGHT_COLORS,
  TREND_POSITIVE,
  TREND_NEGATIVE,
  STORAGE_KEY,
};
