/**
 * WorkoutDayCard Component
 * 
 * Displays a workout plan as a day card with exercises.
 * This is a UI-only component for cleaner organization.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ExerciseRow from './ExerciseRow';

export default function WorkoutDayCard({ 
  workout, 
  onStartWorkout, 
  onDelete, 
  onExerciseUpdate,
  isDark,
  colors,
  spacing 
}) {
  const styles = createStyles(spacing, colors, isDark);

  return (
    <View style={styles.dayCard}>
      {/* Day Card Header */}
      <View style={styles.dayHeader}>
        <View style={styles.dayHeaderLeft}>
          <Text style={styles.dayName}>{workout.name}</Text>
          {workout.goal && (
            <Text style={styles.dayMeta}>{workout.goal} • {workout.exercises?.length || 0} exercises</Text>
          )}
        </View>
        {onDelete && (
          <TouchableOpacity onPress={() => onDelete(workout.id)} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Exercise List */}
      {workout.exercises && workout.exercises.length > 0 ? (
        <View style={styles.exerciseList}>
          {workout.exercises.map((exercise, index) => (
            <ExerciseRow
              key={exercise.exerciseId || index}
              exercise={exercise}
              index={index}
              onUpdate={(updates) => onExerciseUpdate && onExerciseUpdate(workout.id, index, updates)}
              isDark={isDark}
              colors={colors}
              spacing={spacing}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyExercises}>
          <Text style={styles.emptyExercisesText}>No exercises added yet</Text>
        </View>
      )}

      {/* Start Button */}
      {onStartWorkout && (
        <TouchableOpacity
          style={styles.startButton}
          onPress={() => onStartWorkout(workout.id)}
        >
          <Text style={styles.startButtonText}>Start Workout</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (spacing, colors, isDark) =>
  StyleSheet.create({
    dayCard: {
      marginBottom: spacing.lg,
      backgroundColor: isDark ? 'rgba(30, 27, 46, 0.4)' : 'rgba(255, 255, 255, 0.6)',
      borderRadius: 16,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(88, 86, 214, 0.2)' : 'rgba(88, 86, 214, 0.1)',
    },
    dayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    },
    dayHeaderLeft: {
      flex: 1,
    },
    dayName: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.xs / 2,
    },
    dayMeta: {
      fontSize: 14,
      color: colors.textSecondary,
      textTransform: 'capitalize',
    },
    deleteButton: {
      padding: spacing.xs,
    },
    exerciseList: {
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    emptyExercises: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    emptyExercisesText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontStyle: 'italic',
    },
    startButton: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    startButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
  });

