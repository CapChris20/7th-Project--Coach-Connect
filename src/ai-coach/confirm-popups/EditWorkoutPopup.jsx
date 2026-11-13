// Design Law workout-edit confirm — DiffTable / InfoTable + Apply changes (screens/ai-coach-popups/15).
// Flow: read swap OR set/rep/weight edits from tool params → show bordered card → confirm.
// Used by: ConfirmActionPopup when tool = updateWorkout.
//
// vocab: updateWorkout params today are mostly swap-shaped (newExercise); display-only
//        sets/reps/weight/position keys still render when the model sends them.

import React from 'react';
import {
  ToolModalBody,
  DiffTable,
  InfoTable,
  ConfirmCancelRow,
} from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const BADGE = 'Coach wants to edit your workout';
const CONFIRM_LABEL = 'Apply changes';
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

function nameFromExerciseObject(newExercise) {
  if (typeof newExercise !== 'object' || newExercise === null) return '';
  if (!newExercise.name) return '';
  return String(newExercise.name);
}

/**
 * Title prefers the exercise being edited (PNG: “Box squat”), then the add name.
 * @param {object|undefined} params
 * @returns {string}
 */
function readPopupTitle(params) {
  const named =
    params?.exerciseName ||
    params?.oldExercise ||
    params?.exerciseId ||
    nameFromExerciseObject(params?.newExercise);
  if (named) return String(named);
  if (typeof params?.newExercise === 'string' && params.newExercise) return params.newExercise;
  return 'Edit workout?';
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

function readRemovedExercise(params) {
  return readFirstStringParam(params, PARAM_KEYS_FOR_REMOVED, '');
}

function optionalNumberish(value) {
  if (value == null || value === '') return undefined;
  return String(value);
}

/**
 * Build DiffTable rows when the coach proposed numeric edits (PNG 15).
 * @param {object|undefined} params
 * @returns {Array<{label:string,before?:string,after?:string}>}
 */
function readNumericDiffRows(params) {
  if (!params) return [];
  const rows = [];

  const beforePos = optionalNumberish(params.oldPosition ?? params.oldExerciseIndex);
  const afterPos = optionalNumberish(
    params.position ?? params.newPosition ?? (Number.isFinite(Number(params.exerciseIndex))
      ? Number(params.exerciseIndex) + 1
      : undefined),
  );
  if (beforePos || afterPos) {
    rows.push({ label: 'Position', before: beforePos, after: afterPos });
  }

  const beforeSets = optionalNumberish(params.oldSets);
  const afterSets = optionalNumberish(params.sets ?? params.newSets);
  if (beforeSets || afterSets) {
    rows.push({ label: 'Sets', before: beforeSets, after: afterSets });
  }

  const beforeReps = optionalNumberish(params.oldReps);
  const afterReps = optionalNumberish(params.reps ?? params.newReps);
  if (beforeReps || afterReps) {
    rows.push({ label: 'Reps', before: beforeReps, after: afterReps });
  }

  const beforeWeight = optionalNumberish(params.oldWeight);
  const afterWeight = optionalNumberish(params.weight ?? params.newWeight);
  if (beforeWeight || afterWeight) {
    const withUnit = (v) => {
      if (!v) return v;
      return /lb|kg/i.test(v) ? v : `${v} lb`;
    };
    rows.push({
      label: 'Weight',
      before: withUnit(beforeWeight),
      after: withUnit(afterWeight),
    });
  }

  return rows;
}

/**
 * Swap fallback card when there are no numeric before/after fields.
 * @param {object|undefined} params
 * @returns {Array<{label:string,value:string}>}
 */
function readSwapInfoRows(params) {
  const removed = readRemovedExercise(params);
  const added = readAddedExercise(params);
  const reason = params?.reason ? String(params.reason) : '';
  const dayIndex = Number(params?.dayIndex);
  const exerciseIndex = Number(params?.exerciseIndex);
  const positionParts = [];
  if (Number.isFinite(dayIndex)) positionParts.push(`Day ${dayIndex + 1}`);
  if (Number.isFinite(exerciseIndex)) positionParts.push(`Exercise ${exerciseIndex + 1}`);

  const rows = [];
  if (removed) rows.push({ label: 'Remove', value: removed });
  if (positionParts.length) rows.push({ label: 'Position', value: positionParts.join(' · ') });
  if (added && added !== MISSING_VALUE) rows.push({ label: 'Add', value: added });
  if (reason) rows.push({ label: 'Reason', value: reason });
  return rows;
}

// ===== MAIN FUNCTION =====

/**
 * Confirm swapping one workout exercise for another after the coach proposes a change.
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function EditWorkoutPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const title = readPopupTitle(params);
  const diffRows = readNumericDiffRows(params);
  const infoRows = diffRows.length ? [] : readSwapInfoRows(params);

  function handleConfirmSwap() {
    onConfirm(params);
  }

  return (
    <ToolModalBody badge={BADGE} title={title} reasoning={reasoning}>
      {diffRows.length ? <DiffTable rows={diffRows} /> : <InfoTable rows={infoRows} />}
      <ConfirmCancelRow
        onConfirm={handleConfirmSwap}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_LABEL}
      />
    </ToolModalBody>
  );
}
