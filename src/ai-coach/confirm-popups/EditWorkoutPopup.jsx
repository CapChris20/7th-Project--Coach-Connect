// Design Law workout-edit confirm — DiffTable when numbers change, else swap InfoTable.
// Flow: read swap OR set/rep/weight edits from tool params → bordered card → Apply changes.
// Used by: ConfirmActionPopup when the coach tool is updateWorkout.

import React from 'react';
import {
  ToolModalBody,
  DiffTable,
  InfoTable,
  ConfirmCancelRow,
} from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const BADGE_TEXT = 'Coach wants to edit your workout';
const CONFIRM_BUTTON_LABEL = 'Apply changes';
const MISSING_VALUE_MARK = '—';
const FALLBACK_TITLE = 'Edit workout?';

const PARAM_KEYS_FOR_REMOVED_NAME = ['exerciseId', 'oldExercise', 'exerciseName'];

// ===== HELPER FUNCTIONS =====

function firstNonEmptyStringFromParams(coachParams, keyNames, fallbackLabel) {
  if (!coachParams) {
    return fallbackLabel;
  }

  for (let index = 0; index < keyNames.length; index += 1) {
    const keyName = keyNames[index];
    const candidate = coachParams[keyName];
    if (candidate) {
      return String(candidate);
    }
  }

  return fallbackLabel;
}

function nameFromExerciseObject(newExercise) {
  if (typeof newExercise !== 'object') {
    return '';
  }
  if (newExercise === null) {
    return '';
  }
  if (!newExercise.name) {
    return '';
  }
  return String(newExercise.name);
}

function stringParamOrEmpty(coachParams, keyName) {
  if (!coachParams) {
    return '';
  }
  const value = coachParams[keyName];
  if (!value) {
    return '';
  }
  return String(value);
}

function titleForEditPopup(coachParams) {
  const exerciseName = stringParamOrEmpty(coachParams, 'exerciseName');
  if (exerciseName) {
    return exerciseName;
  }

  const oldExercise = stringParamOrEmpty(coachParams, 'oldExercise');
  if (oldExercise) {
    return oldExercise;
  }

  const exerciseId = stringParamOrEmpty(coachParams, 'exerciseId');
  if (exerciseId) {
    return exerciseId;
  }

  if (!coachParams) {
    return FALLBACK_TITLE;
  }

  const nameFromObject = nameFromExerciseObject(coachParams.newExercise);
  if (nameFromObject) {
    return nameFromObject;
  }

  if (typeof coachParams.newExercise === 'string' && coachParams.newExercise) {
    return coachParams.newExercise;
  }

  return FALLBACK_TITLE;
}

function addedExerciseName(coachParams) {
  if (!coachParams) {
    return MISSING_VALUE_MARK;
  }

  const nameFromObject = nameFromExerciseObject(coachParams.newExercise);
  if (nameFromObject) {
    return nameFromObject;
  }

  if (typeof coachParams.newExercise === 'string' && coachParams.newExercise) {
    return coachParams.newExercise;
  }

  if (coachParams.exerciseName) {
    return String(coachParams.exerciseName);
  }

  return MISSING_VALUE_MARK;
}

function removedExerciseName(coachParams) {
  return firstNonEmptyStringFromParams(coachParams, PARAM_KEYS_FOR_REMOVED_NAME, '');
}

function valueHasVisibleText(value) {
  if (value == null) {
    return false;
  }
  if (value === '') {
    return false;
  }
  return true;
}

function optionalNumberAsString(value) {
  if (!valueHasVisibleText(value)) {
    return undefined;
  }
  return String(value);
}

function weightLabelWithUnit(value) {
  if (!value) {
    return value;
  }
  const alreadyHasUnit = /lb|kg/i.test(value);
  if (alreadyHasUnit) {
    return value;
  }
  return `${value} lb`;
}

// Same door as `??`: only skip when the left side is null or undefined.
function pickFirstDefinedValue(firstValue, secondValue) {
  if (firstValue != null) {
    return firstValue;
  }
  return secondValue;
}

function afterPositionFromParams(coachParams) {
  let afterPositionRaw = coachParams.position;
  if (afterPositionRaw == null) {
    afterPositionRaw = coachParams.newPosition;
  }

  if (afterPositionRaw == null) {
    const exerciseIndexNumber = Number(coachParams.exerciseIndex);
    if (Number.isFinite(exerciseIndexNumber)) {
      afterPositionRaw = exerciseIndexNumber + 1;
    }
  }

  return optionalNumberAsString(afterPositionRaw);
}

function numericDiffRowsFromParams(coachParams) {
  if (!coachParams) {
    return [];
  }

  const rows = [];

  const beforePosition = optionalNumberAsString(
    pickFirstDefinedValue(coachParams.oldPosition, coachParams.oldExerciseIndex),
  );
  const afterPosition = afterPositionFromParams(coachParams);
  if (beforePosition || afterPosition) {
    rows.push({ label: 'Position', before: beforePosition, after: afterPosition });
  }

  const beforeSets = optionalNumberAsString(coachParams.oldSets);
  const afterSets = optionalNumberAsString(
    pickFirstDefinedValue(coachParams.sets, coachParams.newSets),
  );
  if (beforeSets || afterSets) {
    rows.push({ label: 'Sets', before: beforeSets, after: afterSets });
  }

  const beforeReps = optionalNumberAsString(coachParams.oldReps);
  const afterReps = optionalNumberAsString(
    pickFirstDefinedValue(coachParams.reps, coachParams.newReps),
  );
  if (beforeReps || afterReps) {
    rows.push({ label: 'Reps', before: beforeReps, after: afterReps });
  }

  const beforeWeight = optionalNumberAsString(coachParams.oldWeight);
  const afterWeight = optionalNumberAsString(
    pickFirstDefinedValue(coachParams.weight, coachParams.newWeight),
  );
  if (beforeWeight || afterWeight) {
    rows.push({
      label: 'Weight',
      before: weightLabelWithUnit(beforeWeight),
      after: weightLabelWithUnit(afterWeight),
    });
  }

  return rows;
}

function positionPartsFromParams(coachParams) {
  const positionParts = [];
  if (!coachParams) {
    return positionParts;
  }

  const dayIndexNumber = Number(coachParams.dayIndex);
  if (Number.isFinite(dayIndexNumber)) {
    positionParts.push(`Day ${dayIndexNumber + 1}`);
  }

  const exerciseIndexNumber = Number(coachParams.exerciseIndex);
  if (Number.isFinite(exerciseIndexNumber)) {
    positionParts.push(`Exercise ${exerciseIndexNumber + 1}`);
  }

  return positionParts;
}

function reasonTextFromParams(coachParams) {
  if (!coachParams) {
    return '';
  }
  if (!coachParams.reason) {
    return '';
  }
  return String(coachParams.reason);
}

function swapInfoRowsFromParams(coachParams) {
  const removedName = removedExerciseName(coachParams);
  const addedName = addedExerciseName(coachParams);
  const reasonText = reasonTextFromParams(coachParams);
  const positionParts = positionPartsFromParams(coachParams);

  const rows = [];

  if (removedName) {
    rows.push({ label: 'Remove', value: removedName });
  }
  if (positionParts.length) {
    rows.push({ label: 'Position', value: positionParts.join(' · ') });
  }
  if (addedName && addedName !== MISSING_VALUE_MARK) {
    rows.push({ label: 'Add', value: addedName });
  }
  if (reasonText) {
    rows.push({ label: 'Reason', value: reasonText });
  }

  return rows;
}

function changeSummaryTableForParams(coachParams) {
  const diffRows = numericDiffRowsFromParams(coachParams);
  if (diffRows.length > 0) {
    return <DiffTable rows={diffRows} />;
  }

  const infoRows = swapInfoRowsFromParams(coachParams);
  return <InfoTable rows={infoRows} />;
}

// ===== MAIN FUNCTION =====

/**
 * Confirm swapping one workout exercise (or applying set/rep/weight edits).
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function EditWorkoutPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Title from the exercise being edited (or a safe fallback).
  const popupTitle = titleForEditPopup(params);

  // 2. DiffTable when numbers change; else swap InfoTable.
  const changeSummaryTable = changeSummaryTableForParams(params);

  // 3. Confirm forwards the original tool params — carryOutAction owns the write.
  function handleConfirmApplyChanges() {
    onConfirm(params);
  }

  // 4. Paint badge → title → change table → Apply changes.
  return (
    <ToolModalBody badge={BADGE_TEXT} title={popupTitle} reasoning={reasoning}>
      {changeSummaryTable}
      <ConfirmCancelRow
        onConfirm={handleConfirmApplyChanges}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
