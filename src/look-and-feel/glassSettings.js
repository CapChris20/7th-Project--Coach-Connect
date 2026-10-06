// Shared glass colors, radii, and type for dark panels.
// Flow: screens read Liquid.colors, Liquid.radius, and the rest. This file does not compute layout.
// Used by: glass cards and dark backgrounds.

import { Platform } from 'react-native';

// ===== NAMED CONSTANTS =====

const GLASS_CARD_RADIUS = 28;
const GLASS_INNER_RADIUS = 12;
const GLASS_GUTTER = 24;
const GLASS_GAP = 12;
const LABEL_TRACKING = 0.5;

const Liquid = {
  colors: {
    obsidian: '#050505',
    glassSurface: 'rgba(255,255,255,0.03)',
    glassStrokeTop: 'rgba(255,255,255,0.15)',
    glassStrokeBottom: 'rgba(255,255,255,0.04)',
    textPrimary: 'rgba(255,255,255,0.92)',
    textSecondary: 'rgba(255,255,255,0.62)',
    scrimStrong: 'rgba(0,0,0,0.72)',
    scrimSoft: 'rgba(0,0,0,0.45)',
    hotPink: '#FF2DCE',
    cyan: '#00E5FF',
    magenta: '#FF00D4',
    darkPurple: '#240A44',
    lightOrange: '#FFB25B',
    accent: '#00E5FF',
    accentAlt: '#FF2DCE',
  },
  gradients: {
    primary: ['#FF2DCE', '#FF00D4', '#00E5FF', '#FFB25B'],
    primarySoft: ['rgba(255,45,206,0.70)', 'rgba(0,229,255,0.65)'],
    aura: ['rgba(255,45,206,0)', 'rgba(255,0,212,0.30)', 'rgba(0,229,255,0.28)', 'rgba(255,178,91,0)'],
    haloActive: ['rgba(255,45,206,0.22)', 'rgba(0,229,255,0.18)'],
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

// ===== MAIN FUNCTION =====

export { Liquid };
