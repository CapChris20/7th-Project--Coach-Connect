import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../ui/ThemeContext';
import Loader from '../../Loader';

/**
 * LoadingSpinner Component - Now uses dot jumping loader
 * @param {string} text - Text to display below loader
 */
export default function LoadingSpinner({
  text,
}) {
  const { colors, fontSize, spacing } = useTheme();

  return (
    <View style={styles.container}>
      <Loader />
      {text && (
        <Text
          style={[
            styles.loadingText,
            {
              marginTop: spacing.md,
              fontSize: fontSize.sm,
              color: colors.textSecondary,
            }
          ]}
        >
          {text}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
});

