import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

/**
 * LoadingSpinner Component
 * @param {string} size - 'small' | 'large'
 * @param {string} color - Spinner color
 * @param {string} text - Text to display below spinner
 */
export default function LoadingSpinner({
  size = 'large',
  color,
  text,
}) {
  const { colors, fontSize, spacing } = useTheme();
  const spinnerColor = color || colors.primary;

  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <ActivityIndicator size={size} color={spinnerColor} />
      {text && (
        <Text
          style={{
            marginTop: spacing.md,
            fontSize: fontSize.sm,
            color: colors.textSecondary,
          }}
        >
          {text}
        </Text>
      )}
    </View>
  );
}

