import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useTheme } from '../../shared/ui/ThemeContext';

export default function ExerciseCard({ exercise }) {
  const { colors, spacing, isDark } = useTheme();
  const styles = createStyles(spacing, colors, isDark);

  return (
    <View style={styles.card}>
      {exercise.gifUrl && (
        <Image 
          source={{ uri: exercise.gifUrl }} 
          style={styles.image}
          resizeMode="cover"
        />
      )}
      <View style={styles.content}>
        <Text style={styles.name}>{exercise.name || exercise.exerciseName || 'Exercise'}</Text>
        {(exercise.target || exercise.bodyPart) && (
          <Text style={styles.target}>
            {[exercise.bodyPart, exercise.target].filter(Boolean).join(' • ')}
          </Text>
        )}
        {exercise.instructions && (
          <Text style={styles.instructions} numberOfLines={2}>
            {exercise.instructions}
          </Text>
        )}
      </View>
    </View>
  );
}

const createStyles = (spacing, colors, isDark) =>
  StyleSheet.create({
    card: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
      borderRadius: 12,
      marginBottom: spacing.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    image: {
      width: '100%',
      height: 200,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    },
    content: {
      padding: spacing.md,
    },
    name: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.xs,
    },
    target: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
      textTransform: 'capitalize',
    },
    instructions: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 18,
    },
  });




