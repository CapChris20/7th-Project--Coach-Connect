// Brand gradients for nav icons and hero titles.
// Flow: screens import a color list plus the start and end points for the gradient.
// Used by: navigation icons and hero titles. Pink goes to purple to indigo, top to bottom.

// ===== NAMED CONSTANTS =====

const BRAND_PINK = '#E94EAD';
const BRAND_PURPLE = '#A348D0';
const BRAND_INDIGO = '#6B3AD9';
const HERO_DARK_PINK = '#BE185D';
const HERO_DARK_ORANGE = '#C2410C';

/** Even stops for expo-linear-gradient when using 3 colors. */
const BRAND_NAV_ICON_GRADIENT_LOCATIONS = [0, 0.5, 1];

const BRAND_ICON_GRADIENT_START = { x: 0.5, y: 0 };
const BRAND_ICON_GRADIENT_END = { x: 0.5, y: 1 };

// ===== HELPER FUNCTIONS =====

function buildNavIconGradient() {
  return [BRAND_PINK, BRAND_PURPLE, BRAND_INDIGO];
}

function buildHeroTitleGradient() {
  return [HERO_DARK_PINK, HERO_DARK_ORANGE];
}

// ===== MAIN FUNCTION =====

const BRAND_NAV_ICON_GRADIENT = buildNavIconGradient();
const HERO_TITLE_TEXT_GRADIENT = buildHeroTitleGradient();

export {
  BRAND_NAV_ICON_GRADIENT,
  BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  BRAND_ICON_GRADIENT_START,
  BRAND_ICON_GRADIENT_END,
  HERO_TITLE_TEXT_GRADIENT,
};
