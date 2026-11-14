// Brand gradients for nav icons and hero titles (Design Law accent pairs only).
// Flow: colorPalette owns the hex stops → this file copies them with expo-linear-gradient geometry.
// Used by: navigation tab icons and masked hero titles.
//
// vocab: nav uses gold→pink; hero titles use pink→orange — never solid purple chrome
// vocab: expo-linear-gradient `locations` — even stops when there are exactly two colors

import { navAccentGradient, gradients } from './colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: [0, 1] = color A at the top, color B at the bottom (two-stop ramp)
const BRAND_NAV_ICON_GRADIENT_LOCATIONS = [0, 1];

// Vertical gradient: top center → bottom center (icons read top-to-bottom).
const BRAND_ICON_GRADIENT_START = { x: 0.5, y: 0 };
const BRAND_ICON_GRADIENT_END = { x: 0.5, y: 1 };

// ===== HELPER FUNCTIONS =====

// Nav tab icons use the one allowed gold→pink pair from Design Law / colorPalette.
function copyNavIconGradientColors() {
  return [...navAccentGradient];
}

// Hero masked titles always use the light title ramp (same stops in both themes).
function copyHeroTitleGradientColors() {
  return [...gradients.title.light.colors];
}

// ===== MAIN FUNCTION =====

const BRAND_NAV_ICON_GRADIENT = copyNavIconGradientColors();
const HERO_TITLE_TEXT_GRADIENT = copyHeroTitleGradientColors();

export {
  BRAND_NAV_ICON_GRADIENT,
  BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  BRAND_ICON_GRADIENT_START,
  BRAND_ICON_GRADIENT_END,
  HERO_TITLE_TEXT_GRADIENT,
};
