// Brand gradients for nav icons and hero titles.
// Flow: screens import a color list plus the start and end points for the gradient.
// Used by: navigation icons and hero titles. Pink goes to purple to indigo, top to bottom.

// ===== NAMED CONSTANTS =====

const BRAND_NAV_ICON_GRADIENT = ['#E94EAD', '#A348D0', '#6B3AD9'];

/** Even stops for expo-linear-gradient when using 3 colors. */
const BRAND_NAV_ICON_GRADIENT_LOCATIONS = [0, 0.5, 1];

const BRAND_ICON_GRADIENT_START = { x: 0.5, y: 0 };
const BRAND_ICON_GRADIENT_END = { x: 0.5, y: 1 };

/** Dark pink to dark orange for hero titles and accent text. */
const HERO_TITLE_TEXT_GRADIENT = ['#BE185D', '#C2410C'];

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

export {
  BRAND_NAV_ICON_GRADIENT,
  BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  BRAND_ICON_GRADIENT_START,
  BRAND_ICON_GRADIENT_END,
  HERO_TITLE_TEXT_GRADIENT,
};
