/**
 * Update Workout Modal
 *
 * Purpose: UI screen or component: Update Workout Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: UpdateWorkoutSessionSheet
 *
 * @file-header
 */
import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from '../tool-modals/toolModalHelpers';

export default function UpdateWorkoutSessionSheet({ params, reasoning, onConfirm, onCancel, loading }) {
  const remove =
    params?.exerciseId ||
    params?.oldExercise ||
    params?.exerciseName ||
    'Current exercise';
  const add =
    typeof params?.newExercise === 'object'
      ? params.newExercise?.name
      : params?.newExercise || params?.exerciseName || '—';

  return (
    <ToolModalBody title="Swap exercise?" reasoning={reasoning}>
      <DetailRow label="Remove" value={remove} />
      <DetailRow label="Add" value={add} />
      <DetailRow label="Reason" value={params?.reason} />
      <ConfirmCancelRow onConfirm={() => onConfirm(params)} onCancel={onCancel} loading={loading} />
    </ToolModalBody>
  );
}
