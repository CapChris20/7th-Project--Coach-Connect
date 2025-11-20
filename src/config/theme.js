// Theme configuration for React Native styling with Light and Dark mode support

// Light mode colors (Purple theme)
export const lightColors = {
  primary: '#8B5CF6', // Purple primary
  primaryDark: '#7C3AED',
  secondary: '#6B7280',
  accent: '#A78BFA', // Light purple accent
  background: '#FFFFFF', // White background for light mode
  surface: '#F9FAFB', // Light gray surface
  surfaceSecondary: '#F3F4F6',
  text: '#111827', // Dark text
  textSecondary: '#6B7280',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#8B5CF6',
  border: '#E5E7EB',
  white: '#FFFFFF',
  black: '#000000',
  purple: {
    50: '#FAF5FF',
    100: '#F3E8FF',
    200: '#E9D5FF',
    300: '#D8B4FE',
    400: '#C084FC',
    500: '#A855F7',
    600: '#8B5CF6',
    700: '#7C3AED',
    800: '#6D28D9',
    900: '#5B21B6',
  },
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827',
  },
};

// Dark mode colors (Purple theme)
export const darkColors = {
  primary: '#8B5CF6', // Purple primary
  primaryDark: '#7C3AED',
  secondary: '#9CA3AF',
  accent: '#A78BFA', // Light purple accent
  background: '#0F0B1E', // Dark purple-black background
  surface: '#1E1B2E', // Dark purple surface
  surfaceSecondary: '#2A2342', // Darker purple surface
  text: '#FFFFFF', // White text
  textSecondary: '#A78BFA', // Light purple secondary text
  success: '#34D399',
  warning: '#FBBF24',
  error: '#F87171',
  info: '#8B5CF6',
  border: 'rgba(139, 92, 246, 0.2)', // Purple border with opacity
  white: '#FFFFFF',
  black: '#000000',
  purple: {
    50: '#5B21B6',
    100: '#6D28D9',
    200: '#7C3AED',
    300: '#8B5CF6',
    400: '#A855F7',
    500: '#C084FC',
    600: '#D8B4FE',
    700: '#E9D5FF',
    800: '#F3E8FF',
    900: '#FAF5FF',
  },
  gray: {
    50: '#111827',
    100: '#1f2937',
    200: '#374151',
    300: '#4b5563',
    400: '#6b7280',
    500: '#9ca3af',
    600: '#d1d5db',
    700: '#e5e7eb',
    800: '#f3f4f6',
    900: '#f9fafb',
  },
};

// Default export (light mode for backward compatibility)
export const colors = lightColors;

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40,
  },
  h2: {
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 36,
  },
  h3: {
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 32,
  },
  h4: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 28,
  },
  h5: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  },
  h6: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  body: {
    fontSize: 16,
    fontWeight: 'normal',
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: 'normal',
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: 'normal',
    lineHeight: 16,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
};

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
    elevation: 5,
  },
};

