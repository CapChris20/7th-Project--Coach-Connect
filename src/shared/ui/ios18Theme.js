// iOS 18 Design Language Theme
// Provides iOS 18-specific design tokens for PremiumTrainerDashboard

import { Platform } from 'react-native';

export default {
  colors: {
    // Ambient gradient colors
    ambientPurple: '#AF52DE',
    ambientGreen: '#30D158',
    ambientTeal: '#5AC8FA',
    
    // Status colors
    statusActive: '#30D158',
    statusWarning: '#FF9F0A',
    statusInactive: '#8E8E93',
    
    // Accent colors
    accentGreen: '#30D158',
    accentBlue: '#007AFF',
    accentPurple: '#AF52DE',
    
    // Base colors
    pureBlack: '#000000',
    textPrimary: '#FFFFFF',
    textSecondary: '#AEAEB2',
    textTertiary: '#8E8E93',
    
    // Border colors
    hairlineBorder: '#38383A',
    divider: '#38383A',
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
  },
  
  typography: {
    sizes: {
      body: 17,
      largeTitle: 34,
      subhead: 15,
      caption1: 12,
      footnote: 13,
    },
  },
  
  borderRadius: {
    small: 8,
    medium: 12,
    large: 16,
    xxlarge: 20,
    circular: 9999,
  },
  
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
  },
  
  statusPipSize: {
    large: 8,
  },
  
  // SF Pro Rounded font helper
  sfProRounded: (size, weight = '400') => ({
    fontSize: size,
    fontWeight: weight,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Rounded' : 'sans-serif',
  }),
};

