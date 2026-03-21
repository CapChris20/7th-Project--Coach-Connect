import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTheme } from '../ui/ThemeContext';

/**
 * Card Component
 * @param {ReactNode} children - Card content
 * @param {function} onPress - Press handler (optional)
 * @param {object} style - Additional styles
 */
export default function Card({ children, onPress, style }) {
  const { colors, spacing, borderRadius } = useTheme();

  const cardStyle = {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={[cardStyle, style]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
}
