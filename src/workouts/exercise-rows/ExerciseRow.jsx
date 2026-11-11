// One exercise in a workout plan: name, sets, reps, rest, optional notes.
// Flow: tap the row to edit inline → on blur, parse the numbers and tell the parent.
// Used by: workout plan builders. UI only — the parent owns the saved plan.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, useColorScheme } from 'react-native';
import NbCard from '../../look-and-feel/NbCard';
import { lightColors, darkColors, spacing as nbSpacing, nb } from '../../look-and-feel/colorPalette';

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
 * @param {object} colors - neobrutalist colors
 */
function createStyles(colors) {
  return StyleSheet.create({
    cardInner: {
      padding: nbSpacing.md,
    },
    exerciseHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: nbSpacing.sm,
    },
    exerciseNumber: {
      fontSize: 16,
      fontFamily: 'SpaceGrotesk_700Bold',
      color: colors.nbInk,
      width: 24,
      marginRight: nbSpacing.sm,
    },
    exerciseNameContainer: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 16,
      fontFamily: 'SpaceGrotesk_700Bold',
      color: colors.nbInk,
      marginBottom: 2,
    },
    exerciseTarget: {
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: colors.nbMuted,
      textTransform: 'capitalize',
    },
    exerciseDetails: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: nbSpacing.sm,
      borderTopWidth: nb.borderWidth,
      borderTopColor: colors.nbBorder,
    },
    detailItem: {
      alignItems: 'center',
      flex: 1,
    },
    detailLabel: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: colors.nbMuted,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.1,
    },
    detailValue: {
      fontSize: 16,
      fontFamily: 'SpaceGrotesk_700Bold',
      color: colors.nbInk,
      fontVariant: ['tabular-nums'],
    },
    detailInput: {
      fontSize: 16,
      fontFamily: 'SpaceGrotesk_700Bold',
      color: colors.nbInk,
      textAlign: 'center',
      minWidth: 40,
      backgroundColor: colors.nbSurfaceChip,
      borderRadius: 6,
      padding: nbSpacing.xs,
      borderWidth: nb.borderWidth,
      borderColor: colors.nbBorder,
    },
    notesContainer: {
      marginTop: nbSpacing.sm,
      paddingTop: nbSpacing.sm,
      borderTopWidth: nb.borderWidth,
      borderTopColor: colors.nbBorder,
    },
    notesInput: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: colors.nbInk,
      backgroundColor: colors.nbSurfaceChip,
      borderRadius: 8,
      padding: nbSpacing.sm,
      minHeight: 40,
      textAlignVertical: 'top',
      borderWidth: nb.borderWidth,
      borderColor: colors.nbBorder,
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
  isDark: deprecatedIsDark,
  colors: deprecatedColors,
  spacing: deprecatedSpacing,
}) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const [isEditing, setIsEditing] = useState(false);
  const [localSets, setLocalSets] = useState(String(exercise.sets || DEFAULT_SETS));
  const [localReps, setLocalReps] = useState(String(exercise.reps || DEFAULT_REPS));
  const [localRest, setLocalRest] = useState(String(exercise.restSeconds || DEFAULT_REST_SECONDS));
  const [localNotes, setLocalNotes] = useState(exercise.notes || '');

  const styles = createStyles(colors);
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
      onPress={() => setIsEditing(true)}
      activeOpacity={0.7}
    >
      <NbCard style={styles.cardInner}>
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
              placeholderTextColor={colors.nbMuted}
              multiline
            />
          </View>
        )}
      </NbCard>
    </TouchableOpacity>
  );
}
