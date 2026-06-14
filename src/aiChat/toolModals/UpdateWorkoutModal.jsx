import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './toolModalShared';

export default function UpdateWorkoutModal({ params, reasoning, onConfirm, onCancel, loading }) {
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
