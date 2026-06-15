/**
 * colors
 *
 * Purpose: colors — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/theme
 * Key exports: colors, shadows, gradients
 *
 * @file-header
 */
export const colors = {
  background: '#0A0A0F',
  primary: '#FF6B9D',
  secondary: '#C084FC',
  cyan: '#64D2FF',
  orange: '#F97316',
  green: '#10B981',
  glassLight: 'rgba(255, 255, 255, 0.05)',
  glassLightBorder: 'rgba(255, 255, 255, 0.1)',
  glassStrong: 'rgba(255, 255, 255, 0.08)',
  glassStrongBorder: 'rgba(255, 255, 255, 0.14)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.6)',
  textMuted: 'rgba(255, 255, 255, 0.3)',
};

// RN shadow tokens (web box-shadow equivalents)
export const shadows = {
  pinkGlow: {
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  pinkGlowStrong: {
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
};

export const gradients = {
  primary: [colors.primary, colors.secondary],
  cyan: [colors.cyan, colors.secondary],
};

