/**
 * liquid Tokens
 *
 * Purpose: liquid Tokens — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: Liquid
 *
 * @file-header
 */
import { Platform } from 'react-native';

export const Liquid = {
  colors: {
    obsidian: '#050505',
    glassSurface: 'rgba(255,255,255,0.03)', // ~ #FFFFFF08
    glassStrokeTop: 'rgba(255,255,255,0.15)',
    glassStrokeBottom: 'rgba(255,255,255,0.04)',
    textPrimary: 'rgba(255,255,255,0.92)',
    textSecondary: 'rgba(255,255,255,0.62)',
    scrimStrong: 'rgba(0,0,0,0.72)',
    scrimSoft: 'rgba(0,0,0,0.45)',
    // Accent palette (requested): hot pink, cyan, magenta, dark purple, light orange
    hotPink: '#FF2DCE',
    cyan: '#00E5FF',
    magenta: '#FF00D4',
    darkPurple: '#240A44',
    lightOrange: '#FFB25B',

    // Derived accents (used for "active" state)
    accent: '#00E5FF',
    accentAlt: '#FF2DCE',
  },
  gradients: {
    // Primary: vibrant but premium. Used for primary CTAs.
    primary: ['#FF2DCE', '#FF00D4', '#00E5FF', '#FFB25B'],
    // Softer version for large surfaces/buttons (less "rainbow blast")
    primarySoft: ['rgba(255,45,206,0.70)', 'rgba(0,229,255,0.65)'],
    // Aura: softer, behind frosted panels.
    aura: ['rgba(255,45,206,0)', 'rgba(255,0,212,0.30)', 'rgba(0,229,255,0.28)', 'rgba(255,178,91,0)'],
    // Halo: subtle Z-depth for icon halos.
    haloActive: ['rgba(255,45,206,0.22)', 'rgba(0,229,255,0.18)'],
  },
  radius: {
    card: 28,
    inner: 12,
  },
  spacing: {
    gutter: 24,
    gap: 12,
  },
  type: {
    display: Platform.select({ ios: 'System', android: 'System' }),
    body: Platform.select({ ios: 'System', android: 'System' }),
    trackingLabel: 0.5,
  },
};


