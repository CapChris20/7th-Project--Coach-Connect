// Coach Connect logo PNG modules and the width÷height each Image should use.
// Flow: Metro require() loads the file → we store native width/height → AppLogo sizes from aspect.
// Used by: AppLogo. Transparent mark is the Design Law welcome hero centerpiece.
// Read order: asset requires → native size constants → aspect mains → exports.

// ===== NAMED CONSTANTS =====

// vocab: require() — Metro bundles the PNG and returns a numeric asset id at build time.
const BRAND_LOGO_SOURCE = require('./Logo.PNG');
const TRANSPARENT_BRAND_LOGO_SOURCE = require('./cc-logo-transparent.png');

// Manipulate here: square mark native size. Change only if Logo.PNG is replaced with a non-square file.
const SQUARE_LOGO_NATIVE_WIDTH = 1;
const SQUARE_LOGO_NATIVE_HEIGHT = 1;

// Manipulate here: transparent handoff size from design (510×360).
const TRANSPARENT_LOGO_NATIVE_WIDTH = 510;
const TRANSPARENT_LOGO_NATIVE_HEIGHT = 360;

// ===== HELPER FUNCTIONS =====

function aspectRatioFromWidthAndHeight(nativeWidth, nativeHeight) {
  return nativeWidth / nativeHeight;
}

// ===== MAIN =====

/**
 * Aspect ratios AppLogo reads so height = width ÷ aspect (or the reverse).
 * Frozen export names: BRAND_LOGO_SOURCE, BRAND_LOGO_ASPECT, TRANSPARENT_*.
 */
// 1. Square mark — width ÷ height is always 1 while the asset stays square.
const BRAND_LOGO_ASPECT = aspectRatioFromWidthAndHeight(
  SQUARE_LOGO_NATIVE_WIDTH,
  SQUARE_LOGO_NATIVE_HEIGHT,
);

// 2. Transparent mark — 510 ÷ 360 so the welcome hero keeps the handoff silhouette.
const TRANSPARENT_BRAND_LOGO_ASPECT = aspectRatioFromWidthAndHeight(
  TRANSPARENT_LOGO_NATIVE_WIDTH,
  TRANSPARENT_LOGO_NATIVE_HEIGHT,
);

export {
  BRAND_LOGO_SOURCE,
  BRAND_LOGO_ASPECT,
  TRANSPARENT_BRAND_LOGO_SOURCE,
  TRANSPARENT_BRAND_LOGO_ASPECT,
};
