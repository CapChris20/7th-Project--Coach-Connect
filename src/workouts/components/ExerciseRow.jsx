/**
 * ExerciseRow Component
 * 
 * Displays a single exercise with inline editing for sets, reps, rest, and notes.
 * This is a UI-only component for cleaner organization.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

export default function ExerciseRow({ 
  exercise, 
  index, 
  onUpdate,
  isDark,
  colors,
  spacing 
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localSets, setLocalSets] = useState(String(exercise.sets || 3));
  const [localReps, setLocalReps] = useState(String(exercise.reps || 10));
  const [localRest, setLocalRest] = useState(String(exercise.restSeconds || 60));
  const [localNotes, setLocalNotes] = useState(exercise.notes || '');

  const styles = createStyles(spacing, colors, isDark);

  const handleBlur = () => {
    // Update parent when editing is done
    if (onUpdate) {
      onUpdate({
        sets: parseInt(localSets) || exercise.sets || 3,
        reps: parseInt(localReps) || exercise.reps || 10,
        restSeconds: parseInt(localRest) || exercise.restSeconds || 60,
        notes: localNotes,
      });
    }
    setIsEditing(false);
  };

  const formatRestTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  };

  return (
    <TouchableOpacity
      style={styles.exerciseRow}
      onPress={() => setIsEditing(true)}
      activeOpacity={0.7}
    >
      {/* Exercise Name */}
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseNumber}>{index + 1}</Text>
        <View style={styles.exerciseNameContainer}>
          <Text style={styles.exerciseName}>
            {exercise.name || exercise.exerciseName || `Exercise ${index + 1}`}
          </Text>
          {(exercise.target || exercise.bodyPart) && (
            <Text style={styles.exerciseTarget}>
              {[exercise.bodyPart, exercise.target].filter(Boolean).join(' • ')}
            </Text>
          )}
        </View>
      </View>

      {/* Exercise Details - Inline Editable */}
      <View style={styles.exerciseDetails}>
        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Sets</Text>
          {isEditing ? (
            <TextInput
              style={styles.detailInput}
              value={localSets}
              onChangeText={setLocalSets}
              onBlur={handleBlur}
              keyboardType="numeric"
              selectTextOnFocus
            />
          ) : (
            <Text style={styles.detailValue}>{exercise.sets || 3}</Text>
          )}
        </View>

        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Reps</Text>
          {isEditing ? (
            <TextInput
              style={styles.detailInput}
              value={localReps}
              onChangeText={setLocalReps}
              onBlur={handleBlur}
              keyboardType="numeric"
              selectTextOnFocus
            />
          ) : (
            <Text style={styles.detailValue}>{exercise.reps || 10}</Text>
          )}
        </View>

        <View style={styles.detailItem}>
          <Text style={styles.detailLabel}>Rest</Text>
          {isEditing ? (
            <TextInput
              style={styles.detailInput}
              value={localRest}
              onChangeText={setLocalRest}
              onBlur={handleBlur}
              keyboardType="numeric"
              placeholder="seconds"
              selectTextOnFocus
            />
          ) : (
            <Text style={styles.detailValue}>{formatRestTime(exercise.restSeconds || 60)}</Text>
          )}
        </View>
      </View>

      {/* Notes Section */}
      {(isEditing || localNotes) && (
        <View style={styles.notesContainer}>
          <TextInput
            style={styles.notesInput}
            value={localNotes}
            onChangeText={setLocalNotes}
            onBlur={handleBlur}
            placeholder="Add notes (optional)"
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        </View>
      )}
    </TouchableOpacity>
  );
}

const createStyles = (spacing, colors, isDark) =>
  StyleSheet.create({
    exerciseRow: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
      borderRadius: 12,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    },
    exerciseHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
    },
    exerciseNumber: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
      width: 24,
      marginRight: spacing.sm,
    },
    exerciseNameContainer: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.xs / 2,
    },
    exerciseTarget: {
      fontSize: 13,
      color: colors.textSecondary,
      textTransform: 'capitalize',
    },
    exerciseDetails: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    },
    detailItem: {
      alignItems: 'center',
      flex: 1,
    },
    detailLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: spacing.xs / 2,
      fontWeight: '500',
    },
    detailValue: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    detailInput: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
      textAlign: 'center',
      minWidth: 40,
      backgroundColor: isDark ? 'rgba(88, 86, 214, 0.2)' : 'rgba(88, 86, 214, 0.1)',
      borderRadius: 6,
      padding: spacing.xs,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    notesContainer: {
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    },
    notesInput: {
      fontSize: 14,
      color: colors.text,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
      borderRadius: 8,
      padding: spacing.sm,
      minHeight: 40,
      textAlignVertical: 'top',
    },
  });

