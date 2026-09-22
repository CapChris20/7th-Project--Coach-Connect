/**
 * theme
 *
 * Purpose: theme — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: lightColors, darkColors, typography, spacing, borderRadius, fontSize, fontWeight, shadows
 *
 * @file-header
 */
// Theme configuration for React Native styling with Light and Dark mode support

// Light mode colors (Modern Neutral theme)
export const lightColors = {
  primary: '#5856D6', // iOS indigo primary
  primaryDark: '#4A49C7',
  secondary: '#6B7280',
  accent: '#AF52DE', // Subtle purple accent
  background: '#F2F2F7', // iOS light gray background
  surface: '#FFFFFF', // White surface
  surfaceSecondary: '#F9F9F9',
  text: '#000000', // Black text for light mode
  textSecondary: '#3C3C43',
  success: '#30D158', // iOS green
  warning: '#FF9F0A', // iOS orange
  error: '#FF3B30', // iOS red
  info: '#5856D6',
  border: '#E5E5E7',
  white: '#FFFFFF',
  black: '#000000',
  indigo: {
    50: '#F0F0FF',
    100: '#E5E5FF',
    200: '#D1D1FF',
    300: '#B8B8FF',
    400: '#9F9FFF',
    500: '#8686FF',
    600: '#5856D6',
    700: '#4A49C7',
    800: '#3C3BA8',
    900: '#2E2D89',
  },
  gray: {
    50: '#F2F2F7',
    100: '#E5E5EA',
    200: '#D1D1D6',
    300: '#C7C7CC',
    400: '#AEAEB2',
    500: '#8E8E93',
    600: '#636366',
    700: '#48484A',
    800: '#3A3A3C',
    900: '#1C1C1E',
  },
};

// Dark mode colors (Modern Neutral theme)
export const darkColors = {
  primary: '#5856D6', // iOS indigo primary (same for consistency)
  primaryDark: '#6B6CFF',
  secondary: '#8E8E93',
  accent: '#AF52DE', // Subtle purple accent
  background: '#000000', // Pure black background
  surface: '#1C1C1E', // iOS dark gray surface
  surfaceSecondary: '#2C2C2E',
  text: '#FFFFFF', // White text for dark mode
  textSecondary: '#AEAEB2',
  success: '#30D158', // iOS green (brighter for dark mode)
  warning: '#FF9F0A', // iOS orange
  error: '#FF453A', // iOS red
  info: '#5856D6',
  border: '#38383A',
  white: '#FFFFFF',
  black: '#000000',
  indigo: {
    50: '#1C1C1E',
    100: '#2C2C2E',
    200: '#3C3C41',
    300: '#4C4C52',
    400: '#5C5C63',
    500: '#6C6C74',
    600: '#5856D6',
    700: '#6B6CFF',
    800: '#7F7FFF',
    900: '#9393FF',
  },
  gray: {
    50: '#000000',
    100: '#1C1C1E',
    200: '#2C2C2E',
    300: '#3A3A3C',
    400: '#48484A',
    500: '#636366',
    600: '#8E8E93',
    700: '#AEAEB2',
    800: '#C7C7CC',
    900: '#D1D1D6',
  },
};

// Typography scale
export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  h4: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  },
  small: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  },
};

// Spacing scale
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

// Border radius
export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  xxl: 20,
  round: 9999,
};

// Font sizes
export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
};

// Font weights
export const fontWeight = {
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

// Shadows
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
};
