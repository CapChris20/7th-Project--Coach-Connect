// The Coach Connect logo files and the shape of each image.
// Flow: screens pick square (Logo.PNG) or transparent (cc-logo-transparent.png), then size them.
// Used by: AppLogo. Transparent mark is Design Law welcome centerpiece (hero-and-welcome-redesign).

// ===== NAMED CONSTANTS =====

/** Square brand mark (black background baked in) — older splash / pro offer chips. */
const BRAND_LOGO_SOURCE = require('./Logo.PNG');

/** Native aspect for Logo.PNG — width / height. The file is square. */
const BRAND_LOGO_ASPECT_RATIO = 1;

/**
 * Transparent CC infinity mark — black removed for the welcome stage.
 * Native size 510×360 from the design handoff.
 */
const TRANSPARENT_BRAND_LOGO_SOURCE = require('./cc-logo-transparent.png');

/** Aspect for the transparent PNG: 510 / 360. */
const TRANSPARENT_BRAND_LOGO_ASPECT_RATIO = 510 / 360;

// ===== HELPER FUNCTIONS =====

/**
 * @returns {number}
 */
function brandLogoAspectRatio() {
  return BRAND_LOGO_ASPECT_RATIO;
}

/**
 * @returns {number}
 */
function transparentBrandLogoAspectRatio() {
  return TRANSPARENT_BRAND_LOGO_ASPECT_RATIO;
}

// ===== MAIN FUNCTION =====

const BRAND_LOGO_ASPECT = brandLogoAspectRatio();
const TRANSPARENT_BRAND_LOGO_ASPECT = transparentBrandLogoAspectRatio();

export {
  BRAND_LOGO_SOURCE,
  BRAND_LOGO_ASPECT,
  TRANSPARENT_BRAND_LOGO_SOURCE,
  TRANSPARENT_BRAND_LOGO_ASPECT,
};
