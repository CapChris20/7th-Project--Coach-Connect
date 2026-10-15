// One exercise in a workout plan: name, sets, reps, rest, optional notes.
// Flow: tap the row to edit inline → on blur, parse the numbers and tell the parent.
// Used by: workout plan builders. UI only — the parent owns the saved plan.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

// ===== NAMED CONSTANTS =====

const DEFAULT_SETS = 3;
const DEFAULT_REPS = 10;
const SECONDS_PER_MINUTE = 60;
const DEFAULT_REST_SECONDS = SECONDS_PER_MINUTE;

// ===== HELPER FUNCTIONS =====

/**
 * "45s" under a minute, "2m" on the minute, "1m 30s" otherwise.
 * @param {number} seconds
 * @returns {string}
 */
function formatRestTime(seconds) {
  if (seconds < SECONDS_PER_MINUTE) return `${seconds}s`;
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const leftoverSeconds = seconds % SECONDS_PER_MINUTE;
  if (leftoverSeconds > 0) return `${minutes}m ${leftoverSeconds}s`;
  return `${minutes}m`;
}

/**
 * parseInt of empty/garbage input falls back to the saved exercise value, then the default.
 * @param {string} rawValue
 * @param {number} savedValue
 * @param {number} fallbackValue
 * @returns {number}
 */
function parsedCountOrFallback(rawValue, savedValue, fallbackValue) {
  return parseInt(rawValue) || savedValue || fallbackValue;
}

/**
 * @param {object} exercise
 * @param {number} index
 * @returns {string}
 */
function exerciseDisplayName(exercise, index) {
  return exercise.name || exercise.exerciseName || `Exercise ${index + 1}`;
}

/**
 * bodyPart • target, skipping whichever is missing.
 * @param {object} exercise
 * @returns {string}
 */
function exerciseTargetLine(exercise) {
  return [exercise.bodyPart, exercise.target].filter(Boolean).join(' • ');
}

/**
 * @param {object} spacing
 * @param {object} colors
 * @param {boolean} isDark
 */
function createStyles(spacing, colors, isDark) {
  return StyleSheet.create({
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
}

// ===== MAIN FUNCTION =====

/**
 * Inline-editable exercise row. Hooks stay in this original order so the parent screen cannot skip a field.
 * vocab: useState holds the draft strings until blur, when we parse and send numbers upward.
 * @param {{ exercise: object, index: number, onUpdate?: Function, isDark: boolean, colors: object, spacing: object }} props
 */
export default function ExerciseRow({
  exercise,
  index,
  onUpdate,
  isDark,
  colors,
  spacing,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localSets, setLocalSets] = useState(String(exercise.sets || DEFAULT_SETS));
  const [localReps, setLocalReps] = useState(String(exercise.reps || DEFAULT_REPS));
  const [localRest, setLocalRest] = useState(String(exercise.restSeconds || DEFAULT_REST_SECONDS));
  const [localNotes, setLocalNotes] = useState(exercise.notes || '');

  const styles = createStyles(spacing, colors, isDark);
  const targetLine = exerciseTargetLine(exercise);

  const handleBlur = () => {
    if (onUpdate) {
      onUpdate({
        sets: parsedCountOrFallback(localSets, exercise.sets, DEFAULT_SETS),
        reps: parsedCountOrFallback(localReps, exercise.reps, DEFAULT_REPS),
        restSeconds: parsedCountOrFallback(localRest, exercise.restSeconds, DEFAULT_REST_SECONDS),
        notes: localNotes,
      });
    }
    setIsEditing(false);
  };

  return (
    <TouchableOpacity
      style={styles.exerciseRow}
      onPress={() => setIsEditing(true)}
      activeOpacity={0.7}
    >
      <View style={styles.exerciseHeader}>
        <Text style={styles.exerciseNumber}>{index + 1}</Text>
        <View style={styles.exerciseNameContainer}>
          <Text style={styles.exerciseName}>{exerciseDisplayName(exercise, index)}</Text>
          {(exercise.target || exercise.bodyPart) && (
            <Text style={styles.exerciseTarget}>{targetLine}</Text>
          )}
        </View>
      </View>

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
            <Text style={styles.detailValue}>{exercise.sets || DEFAULT_SETS}</Text>
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
            <Text style={styles.detailValue}>{exercise.reps || DEFAULT_REPS}</Text>
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
            <Text style={styles.detailValue}>
              {formatRestTime(exercise.restSeconds || DEFAULT_REST_SECONDS)}
            </Text>
          )}
        </View>
      </View>

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
