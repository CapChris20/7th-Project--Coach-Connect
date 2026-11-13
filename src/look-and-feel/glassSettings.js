// Shared solid panel tokens (strip pass: was glass Liquid palette).
// Flow: screens that still import Liquid get solid ink surfaces — no frosted rgba chrome.
// Used by: legacy GlassCard callers and dark panels.

import { Platform } from 'react-native';
import { darkColors, lightColors } from './colorPalette';

// ===== NAMED CONSTANTS =====

const GLASS_CARD_RADIUS = 14;
const GLASS_INNER_RADIUS = 12;
const GLASS_GUTTER = 24;
const GLASS_GAP = 12;
const LABEL_TRACKING = 0.5;

const Liquid = {
  colors: {
    obsidian: darkColors.nbBackground,
    glassSurface: darkColors.nbSurface,
    glassStrokeTop: darkColors.nbBorder,
    glassStrokeBottom: darkColors.nbBorder,
    textPrimary: darkColors.nbInk,
    textSecondary: darkColors.nbMuted,
    scrimStrong: 'rgba(0,0,0,0.72)',
    scrimSoft: 'rgba(0,0,0,0.45)',
    // Accent stops mirror Design Law brand gradient — not solid pink chrome fills
    hotPink: '#FF6B9D',
    cyan: '#60A5FA',
    magenta: '#FB923C',
    darkPurple: darkColors.nbBackground,
    lightOrange: '#FB923C',
    accent: '#0A0A0A',
    accentAlt: '#FB923C',
  },
  gradients: {
    primary: ['#FF6B9D', '#FB923C'],
    primarySoft: ['#FF6B9D', '#FB923C'],
    aura: [darkColors.nbSurface, darkColors.nbBackground],
    haloActive: ['#FF6B9D', '#FB923C'],
  },
  radius: {
    card: GLASS_CARD_RADIUS,
    inner: GLASS_INNER_RADIUS,
  },
  spacing: {
    gutter: GLASS_GUTTER,
    gap: GLASS_GAP,
  },
  type: {
    display: Platform.select({ ios: 'System', android: 'System' }),
    body: Platform.select({ ios: 'System', android: 'System' }),
    trackingLabel: LABEL_TRACKING,
  },
};

// ===== HELPER FUNCTIONS =====

function buildLiquidTokens() {
  return Liquid;
}

// ===== MAIN FUNCTION =====

export { Liquid, buildLiquidTokens };
export default Liquid;
