// Confirm popup before the coach swaps one exercise for another.
// Flow: read the exercise to remove and the one to add → show the reason → confirm or cancel.
// Used by: the coach conversation when a tool wants to edit a workout.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const CURRENT_EXERCISE_LABEL = 'Current exercise';
const MISSING_VALUE = '—';

// ===== HELPER FUNCTIONS =====

/**
 * @param {object|undefined} params
 * @returns {string}
 */
function readRemovedExercise(params) {
  return params?.exerciseId || params?.oldExercise || params?.exerciseName || CURRENT_EXERCISE_LABEL;
}

/**
 * A new exercise can be a name string or an object with a name.
 * @param {object|undefined} params
 * @returns {string}
 */
function readAddedExercise(params) {
  if (typeof params?.newExercise === 'object') {
    return params.newExercise?.name;
  }
  return params?.newExercise || params?.exerciseName || MISSING_VALUE;
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function EditWorkoutPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const removedExercise = readRemovedExercise(params);
  const addedExercise = readAddedExercise(params);

  return (
    <ToolModalBody title="Swap exercise?" reasoning={reasoning}>
      <DetailRow label="Remove" value={removedExercise} />
      <DetailRow label="Add" value={addedExercise} />
      <DetailRow label="Reason" value={params?.reason} />
      <ConfirmCancelRow onConfirm={() => onConfirm(params)} onCancel={onCancel} loading={loading} />
    </ToolModalBody>
  );
}
