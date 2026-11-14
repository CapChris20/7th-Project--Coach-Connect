// Shared solid panel tokens (legacy name: Liquid / glass — now solid ink surfaces only).
// Flow: build color bag → gradient pairs → radius/spacing/type → one Liquid object importers expect.
// Used by: legacy GlassCard callers and dark panels. No frosted rgba chrome anymore.
//
// vocab: Liquid = frozen export name for the panel token bag (not real glass blur)
// Manipulate here: GLASS_* radius/gutter numbers; accent hex must stay Design Law brand stops

import { Platform } from 'react-native';
import { darkColors } from './colorPalette';

// ===== NAMED CONSTANTS =====

const GLASS_CARD_RADIUS = 14;
const GLASS_INNER_RADIUS = 12;
const GLASS_GUTTER = 24;
const GLASS_GAP = 12;
const LABEL_TRACKING = 0.5;

const BRAND_PINK = '#FF6B9D';
const BRAND_ORANGE = '#FB923C';
const BRAND_BLUE = '#60A5FA';
const ACCENT_INK = '#0A0A0A';

const SCRIM_STRONG = 'rgba(0,0,0,0.72)';
const SCRIM_SOFT = 'rgba(0,0,0,0.45)';

const SYSTEM_FONT_NAME = 'System';

// ===== HELPER FUNCTIONS =====

/**
 * Solid fills and strokes — nb* tokens from dark theme plus a few fixed accent stops.
 * Accent stops mirror Design Law brand gradient — not solid pink chrome fills.
 *
 * @returns {object}
 */
function buildLiquidColorTokens() {
  return {
    obsidian: darkColors.nbBackground,
    glassSurface: darkColors.nbSurface,
    glassStrokeTop: darkColors.nbBorder,
    glassStrokeBottom: darkColors.nbBorder,
    textPrimary: darkColors.nbInk,
    textSecondary: darkColors.nbMuted,
    scrimStrong: SCRIM_STRONG,
    scrimSoft: SCRIM_SOFT,
    hotPink: BRAND_PINK,
    cyan: BRAND_BLUE,
    magenta: BRAND_ORANGE,
    darkPurple: darkColors.nbBackground,
    lightOrange: BRAND_ORANGE,
    accent: ACCENT_INK,
    accentAlt: BRAND_ORANGE,
  };
}

/**
 * Small gradient pairs for buttons and halos (same brand diagonal as colorPalette).
 *
 * @returns {object}
 */
function buildLiquidGradientStops() {
  // Fresh arrays per key so a caller mutating one list cannot touch the others.
  return {
    primary: [BRAND_PINK, BRAND_ORANGE],
    primarySoft: [BRAND_PINK, BRAND_ORANGE],
    aura: [darkColors.nbSurface, darkColors.nbBackground],
    haloActive: [BRAND_PINK, BRAND_ORANGE],
  };
}

/**
 * Typography defaults — system font on both platforms; label tracking is tunable.
 *
 * @returns {object}
 */
function buildLiquidTypeTokens() {
  // vocab: Platform.select = pick ios vs android value (both System here)
  const systemFontOnBothPlatforms = Platform.select({
    ios: SYSTEM_FONT_NAME,
    android: SYSTEM_FONT_NAME,
  });

  return {
    display: systemFontOnBothPlatforms,
    body: systemFontOnBothPlatforms,
    trackingLabel: LABEL_TRACKING,
  };
}

/**
 * Radius + spacing bags callers already read as Liquid.radius / Liquid.spacing.
 *
 * @returns {{ radius: object, spacing: object }}
 */
function buildLiquidSizeTokens() {
  return {
    radius: {
      card: GLASS_CARD_RADIUS,
      inner: GLASS_INNER_RADIUS,
    },
    spacing: {
      gutter: GLASS_GUTTER,
      gap: GLASS_GAP,
    },
  };
}

// ===== MAIN FUNCTION =====

let liquidTokensSingleton = null;

/**
 * Build (once) the Liquid token bag importers already expect.
 * Flow: 1. colors → 2. gradients → 3. size → 4. type → cache.
 *
 * @returns {object}
 */
function buildLiquidTokens() {
  // 1. Reuse the cached bag if we already built it this session.
  if (liquidTokensSingleton) {
    return liquidTokensSingleton;
  }

  // 2. Assemble each section with spoken helpers.
  const colorTokens = buildLiquidColorTokens();
  const gradientTokens = buildLiquidGradientStops();
  const sizeTokens = buildLiquidSizeTokens();
  const typeTokens = buildLiquidTypeTokens();

  // 3. One object shape — keys stay colors / gradients / radius / spacing / type.
  liquidTokensSingleton = {
    colors: colorTokens,
    gradients: gradientTokens,
    radius: sizeTokens.radius,
    spacing: sizeTokens.spacing,
    type: typeTokens,
  };

  return liquidTokensSingleton;
}

const Liquid = buildLiquidTokens();

export { Liquid, buildLiquidTokens };
export default Liquid;
