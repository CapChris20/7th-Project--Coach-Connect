import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './toolModalShared';

const LOG_TYPE_LABELS = {
  nutrition: 'Food / nutrition entry',
  sleep: 'Sleep log',
  water: 'Water log',
  steps: 'Step count',
  energy: 'Energy rating',
  mood: 'Mood log',
  workout: 'Workout entry',
  restDay: 'Rest day entry',
};

export default function DeleteLogModal({ params, reasoning, onConfirm, onCancel, loading }) {
  const logType = String(params?.logType || 'nutrition').toLowerCase();
  const date = params?.date || 'Today';
  const foodName = params?.foodName || params?.food;
  const deleteAll = !!(params?.deleteAll || params?.all);

  const title =
    logType === 'nutrition'
      ? deleteAll
        ? 'Delete all food logs for this day?'
        : foodName
          ? `Delete "${foodName}" from your log?`
          : 'Delete your most recent food entry?'
      : `Clear your ${LOG_TYPE_LABELS[logType] || logType}?`;

  return (
    <ToolModalBody
      title={title}
      reasoning={reasoning || 'This removes the entry from your app — you can always log it again.'}
    >
      <DetailRow label="Type" value={LOG_TYPE_LABELS[logType] || logType} />
      {foodName ? <DetailRow label="Food" value={foodName} /> : null}
      <DetailRow label="Date" value={date} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Delete"
      />
    </ToolModalBody>
  );
}
