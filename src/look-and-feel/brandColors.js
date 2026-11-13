// Brand gradients for nav icons and hero titles (Design Law accent pairs only).
// Flow: screens import a color list plus the start and end points for the gradient.
// Used by: navigation icons and hero titles.
// vocab: nav uses gold→pink; hero titles use pink→orange — never solid purple chrome

import { navAccentGradient, gradients } from './colorPalette';

// ===== NAMED CONSTANTS =====

/** Even stops for expo-linear-gradient when using 2 colors. */
const BRAND_NAV_ICON_GRADIENT_LOCATIONS = [0, 1];

const BRAND_ICON_GRADIENT_START = { x: 0.5, y: 0 };
const BRAND_ICON_GRADIENT_END = { x: 0.5, y: 1 };

// ===== MAIN FUNCTION =====

const BRAND_NAV_ICON_GRADIENT = [...navAccentGradient];
const HERO_TITLE_TEXT_GRADIENT = [...gradients.title.light.colors];

export {
  BRAND_NAV_ICON_GRADIENT,
  BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  BRAND_ICON_GRADIENT_START,
  BRAND_ICON_GRADIENT_END,
  HERO_TITLE_TEXT_GRADIENT,
};
