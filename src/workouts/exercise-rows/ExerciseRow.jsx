// One exercise in a saved workout plan: name, sets, reps, rest, optional notes.
// Flow: tap row → edit inline as strings → on blur, parse numbers and call onUpdate.
// Used by: workout plan builders. Parent owns persisted plan data; this file is presentation + local draft state.

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, useColorScheme } from 'react-native';
import NbCard from '../../look-and-feel/NbCard';
import { lightColors, darkColors, spacing as nbSpacing, nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: defaults when a saved exercise is missing sets / reps / rest
const DEFAULT_SETS = 3;
const DEFAULT_REPS = 10;
const SECONDS_PER_MINUTE = 60;
const DEFAULT_REST_SECONDS = SECONDS_PER_MINUTE;

// ===== HELPER FUNCTIONS =====

/**
 * Human rest label: "45s", "2m", or "1m 30s".
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatRestTimeLabel(totalSeconds) {
  if (totalSeconds < SECONDS_PER_MINUTE) {
    return `${totalSeconds}s`;
  }

  const wholeMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const leftoverSeconds = totalSeconds % SECONDS_PER_MINUTE;

  if (leftoverSeconds > 0) {
    return `${wholeMinutes}m ${leftoverSeconds}s`;
  }
  return `${wholeMinutes}m`;
}

/**
 * parseInt on empty/garbage falls back to saved exercise value, then file default.
 * @param {string} textValue
 * @param {number} savedNumber
 * @param {number} defaultNumber
 * @returns {number}
 */
function numberFromTextInput(textValue, savedNumber, defaultNumber) {
  return parseInt(textValue, 10) || savedNumber || defaultNumber;
}

/**
 * Display title: name, then exerciseName, then "Exercise N".
 * @param {object} exercise
 * @param {number} listIndex
 * @returns {string}
 */
function titleForExercise(exercise, listIndex) {
  if (exercise.name) {
    return exercise.name;
  }
  if (exercise.exerciseName) {
    return exercise.exerciseName;
  }
  return `Exercise ${listIndex + 1}`;
}

/**
 * bodyPart • target — skip missing pieces.
 * @param {object} exercise
 * @returns {string}
 */
function muscleTargetLine(exercise) {
  const pieces = [exercise.bodyPart, exercise.target].filter(Boolean);
  return pieces.join(' • ');
}

function buildExerciseRowStyles(themeColors) {
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
      color: themeColors.nbInk,
      width: 24,
      marginRight: nbSpacing.sm,
    },
    exerciseNameContainer: {
      flex: 1,
    },
    exerciseName: {
      fontSize: 16,
      fontFamily: 'SpaceGrotesk_700Bold',
      color: themeColors.nbInk,
      marginBottom: 2,
    },
    exerciseTarget: {
      fontSize: 13,
      fontFamily: 'Inter_400Regular',
      color: themeColors.nbMuted,
      textTransform: 'capitalize',
    },
    exerciseDetails: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: nbSpacing.sm,
      borderTopWidth: nb.borderWidth,
      borderTopColor: themeColors.nbBorder,
    },
    detailItem: {
      alignItems: 'center',
      flex: 1,
    },
    detailLabel: {
      fontSize: 12,
      fontFamily: 'Inter_500Medium',
      color: themeColors.nbMuted,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.1,
    },
    detailValue: {
      fontSize: 16,
      fontFamily: 'SpaceGrotesk_700Bold',
      color: themeColors.nbInk,
      fontVariant: ['tabular-nums'],
    },
    detailInput: {
      fontSize: 16,
      fontFamily: 'SpaceGrotesk_700Bold',
      color: themeColors.nbInk,
      textAlign: 'center',
      minWidth: 40,
      backgroundColor: themeColors.nbSurfaceChip,
      borderRadius: 6,
      padding: nbSpacing.xs,
      borderWidth: nb.borderWidth,
      borderColor: themeColors.nbBorder,
    },
    notesContainer: {
      marginTop: nbSpacing.sm,
      paddingTop: nbSpacing.sm,
      borderTopWidth: nb.borderWidth,
      borderTopColor: themeColors.nbBorder,
    },
    notesInput: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: themeColors.nbInk,
      backgroundColor: themeColors.nbSurfaceChip,
      borderRadius: 8,
      padding: nbSpacing.sm,
      minHeight: 40,
      textAlignVertical: 'top',
      borderWidth: nb.borderWidth,
      borderColor: themeColors.nbBorder,
    },
  });
}

// Sets / reps / rest column — shared blur handler so one keyboard dismiss saves everything.
function ExerciseDetailField({
  label,
  isEditing,
  displayText,
  draftText,
  onDraftChange,
  onBlurSave,
  styles,
  keyboardType,
  placeholder,
}) {
  let valueNode;
  if (isEditing) {
    valueNode = (
      <TextInput
        style={styles.detailInput}
        value={draftText}
        onChangeText={onDraftChange}
        onBlur={onBlurSave}
        keyboardType={keyboardType}
        placeholder={placeholder}
        selectTextOnFocus
      />
    );
  } else {
    valueNode = <Text style={styles.detailValue}>{displayText}</Text>;
  }

  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      {valueNode}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * One editable exercise card inside a workout plan list.
 * @param {object} props
 * @param {object} props.exercise
 * @param {number} props.index
 * @param {Function} [props.onUpdate]
 * @param {boolean} [props.isDark] deprecated
 * @param {object} [props.colors] deprecated
 * @param {object} [props.spacing] deprecated
 */
// vocab: useColorScheme + useState — hook order frozen for parent screens; do not reorder.
export default function ExerciseRow({
  exercise,
  index,
  onUpdate,
  isDark: deprecatedIsDark,
  colors: deprecatedColors,
  spacing: deprecatedSpacing,
}) {
  void deprecatedIsDark;
  void deprecatedColors;
  void deprecatedSpacing;

  const colorScheme = useColorScheme();
  let themeColors = lightColors;
  if (colorScheme === 'dark') {
    themeColors = darkColors;
  }

  // Draft strings stay local until blur so typing never fights parent re-renders.
  const [isEditing, setIsEditing] = useState(false);
  const [localSets, setLocalSets] = useState(String(exercise.sets || DEFAULT_SETS));
  const [localReps, setLocalReps] = useState(String(exercise.reps || DEFAULT_REPS));
  const [localRest, setLocalRest] = useState(String(exercise.restSeconds || DEFAULT_REST_SECONDS));
  const [localNotes, setLocalNotes] = useState(exercise.notes || '');

  const styles = buildExerciseRowStyles(themeColors);
  const targetSubtitle = muscleTargetLine(exercise);
  const exerciseTitle = titleForExercise(exercise, index);
  const showTargetLine = Boolean(exercise.target || exercise.bodyPart);

  const restSecondsSaved = exercise.restSeconds || DEFAULT_REST_SECONDS;
  const restDisplayWhenIdle = formatRestTimeLabel(restSecondsSaved);
  const setsDisplayWhenIdle = exercise.sets || DEFAULT_SETS;
  const repsDisplayWhenIdle = exercise.reps || DEFAULT_REPS;
  const rowNumberLabel = index + 1;

  // Show notes whenever editing, or when there is already text to display.
  const showNotesArea = isEditing || Boolean(localNotes);

  // 1. Parse drafts → push patch upward → leave edit mode.
  const saveEditsAndClose = () => {
    if (onUpdate) {
      onUpdate({
        sets: numberFromTextInput(localSets, exercise.sets, DEFAULT_SETS),
        reps: numberFromTextInput(localReps, exercise.reps, DEFAULT_REPS),
        restSeconds: numberFromTextInput(localRest, exercise.restSeconds, DEFAULT_REST_SECONDS),
        notes: localNotes,
      });
    }
    setIsEditing(false);
  };

  const openInlineEditor = () => {
    setIsEditing(true);
  };

  let targetLineNode = null;
  if (showTargetLine) {
    targetLineNode = <Text style={styles.exerciseTarget}>{targetSubtitle}</Text>;
  }

  let notesAreaNode = null;
  if (showNotesArea) {
    notesAreaNode = (
      <View style={styles.notesContainer}>
        <TextInput
          style={styles.notesInput}
          value={localNotes}
          onChangeText={setLocalNotes}
          onBlur={saveEditsAndClose}
          placeholder="Add notes (optional)"
          placeholderTextColor={themeColors.nbMuted}
          multiline
        />
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={openInlineEditor} activeOpacity={0.7}>
      <NbCard style={styles.cardInner}>
        <View style={styles.exerciseHeader}>
          <Text style={styles.exerciseNumber}>{rowNumberLabel}</Text>
          <View style={styles.exerciseNameContainer}>
            <Text style={styles.exerciseName}>{exerciseTitle}</Text>
            {targetLineNode}
          </View>
        </View>

        <View style={styles.exerciseDetails}>
          <ExerciseDetailField
            label="Sets"
            isEditing={isEditing}
            displayText={setsDisplayWhenIdle}
            draftText={localSets}
            onDraftChange={setLocalSets}
            onBlurSave={saveEditsAndClose}
            styles={styles}
            keyboardType="numeric"
          />
          <ExerciseDetailField
            label="Reps"
            isEditing={isEditing}
            displayText={repsDisplayWhenIdle}
            draftText={localReps}
            onDraftChange={setLocalReps}
            onBlurSave={saveEditsAndClose}
            styles={styles}
            keyboardType="numeric"
          />
          <ExerciseDetailField
            label="Rest"
            isEditing={isEditing}
            displayText={restDisplayWhenIdle}
            draftText={localRest}
            onDraftChange={setLocalRest}
            onBlurSave={saveEditsAndClose}
            styles={styles}
            keyboardType="numeric"
            placeholder="seconds"
          />
        </View>

        {notesAreaNode}
      </NbCard>
    </TouchableOpacity>
  );
}
