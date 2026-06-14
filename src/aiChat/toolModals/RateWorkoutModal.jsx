import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './toolModalShared';

export default function RateWorkoutModal({ params, reasoning, onConfirm, onCancel, loading }) {
  const rating = params?.rating ?? '—';
  const notes = params?.notes || params?.note;

  return (
    <ToolModalBody title="Log workout rating?" reasoning={reasoning}>
      <DetailRow label="Rating" value={rating !== '—' ? `${rating}/10` : '—'} />
      {notes ? <DetailRow label="Notes" value={notes} /> : null}
      <ConfirmCancelRow onConfirm={() => onConfirm(params)} onCancel={onCancel} loading={loading} confirmLabel="Save rating" />
    </ToolModalBody>
  );
}
