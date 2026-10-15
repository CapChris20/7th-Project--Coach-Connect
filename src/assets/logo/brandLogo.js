// The Coach Connect logo file and the shape of that image.
// Flow: screens import the source and the aspect ratio, then size the image themselves.
// Used by: AppLogo.

// ===== NAMED CONSTANTS =====

/** Official Coach Connect brand mark (interlocking CC infinity gradient). */
const BRAND_LOGO_SOURCE = require('./Logo.PNG');

/** Native asset aspect ratio — width / height. The logo file is square. */
const BRAND_LOGO_ASPECT_RATIO = 1;

// ===== HELPER FUNCTIONS =====

/**
 * @returns {number}
 */
function brandLogoAspectRatio() {
  return BRAND_LOGO_ASPECT_RATIO;
}

// ===== MAIN FUNCTION =====

const BRAND_LOGO_ASPECT = brandLogoAspectRatio();

export { BRAND_LOGO_SOURCE, BRAND_LOGO_ASPECT };
