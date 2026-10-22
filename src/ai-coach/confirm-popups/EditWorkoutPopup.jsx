// Confirm popup before the coach swaps one exercise for another.
// Flow: read the exercise to remove and the one to add → show the reason → confirm or cancel.
// Used by: the coach conversation when a tool wants to edit a workout.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const POPUP_TITLE = 'Swap exercise?';
const REMOVE_ROW_LABEL = 'Remove';
const ADD_ROW_LABEL = 'Add';
const REASON_ROW_LABEL = 'Reason';
const CURRENT_EXERCISE_LABEL = 'Current exercise';
const MISSING_VALUE = '—';
const PARAM_KEYS_FOR_REMOVED = ['exerciseId', 'oldExercise', 'exerciseName'];

// ===== HELPER FUNCTIONS =====

/**
 * Walk known param keys until one holds a non-empty string.
 * @param {object|undefined} params
 * @param {string[]} keyNames
 * @param {string} fallbackLabel
 * @returns {string}
 */
function readFirstStringParam(params, keyNames, fallbackLabel) {
  if (!params) return fallbackLabel;
  for (let index = 0; index < keyNames.length; index += 1) {
    const keyName = keyNames[index];
    const candidate = params[keyName];
    if (candidate) return String(candidate);
  }
  return fallbackLabel;
}

/**
 * @param {object|undefined} params
 * @returns {string}
 */
function readRemovedExercise(params) {
  return readFirstStringParam(params, PARAM_KEYS_FOR_REMOVED, CURRENT_EXERCISE_LABEL);
}

function nameFromExerciseObject(newExercise) {
  if (typeof newExercise !== 'object' || newExercise === null) return '';
  if (!newExercise.name) return '';
  return String(newExercise.name);
}

/**
 * A new exercise can be a name string or an object with a name.
 * @param {object|undefined} params
 * @returns {string}
 */
function readAddedExercise(params) {
  if (!params) return MISSING_VALUE;
  const newExercise = params.newExercise;
  const nameFromObject = nameFromExerciseObject(newExercise);
  if (nameFromObject) return nameFromObject;
  if (typeof newExercise === 'string' && newExercise) return newExercise;
  if (params.exerciseName) return String(params.exerciseName);
  return MISSING_VALUE;
}

function readSwapReason(params) {
  if (!params) return undefined;
  return params.reason;
}

/**
 * Where in the plan the swap lands ("Day 2 · Exercise 3"), 1-based for humans.
 * The model usually identifies the old exercise only by dayIndex/exerciseIndex
 * — without this row the popup said Remove: "Current exercise" and the user
 * could not tell WHICH exercise was about to be replaced.
 * @param {object|undefined} params
 * @returns {string|undefined}
 */
function readSwapPosition(params) {
  if (!params) return undefined;
  const dayIndex = Number(params.dayIndex);
  const exerciseIndex = Number(params.exerciseIndex);
  const parts = [];
  if (Number.isFinite(dayIndex)) parts.push(`Day ${dayIndex + 1}`);
  if (Number.isFinite(exerciseIndex)) parts.push(`Exercise ${exerciseIndex + 1}`);
  return parts.length ? parts.join(' · ') : undefined;
}

// ===== MAIN FUNCTION =====

/**
 * Confirm swapping one workout exercise for another after the coach proposes a change.
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function EditWorkoutPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Read the exercise to remove and the one to add.
  const removedExercise = readRemovedExercise(params);
  const addedExercise = readAddedExercise(params);
  const swapReason = readSwapReason(params);
  const swapPosition = readSwapPosition(params);

  // 2. Confirm swaps them. onConfirm still gets the original params.
  function handleConfirmSwap() {
    onConfirm(params);
  }

  return (
    <ToolModalBody title={POPUP_TITLE} reasoning={reasoning}>
      <DetailRow label={REMOVE_ROW_LABEL} value={removedExercise} />
      {/* Position row hides itself when the model sent no indexes. */}
      <DetailRow label="Position" value={swapPosition} />
      <DetailRow label={ADD_ROW_LABEL} value={addedExercise} />
      <DetailRow label={REASON_ROW_LABEL} value={swapReason} />
      <ConfirmCancelRow onConfirm={handleConfirmSwap} onCancel={onCancel} loading={loading} />
    </ToolModalBody>
  );
}
