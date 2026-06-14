import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './toolModalShared';

export default function RateEnergyModal({ params, reasoning, onConfirm, onCancel, loading }) {
  const rating = params?.rating ?? params?.energy ?? '—';
  const notes = params?.notes || params?.note;

  return (
    <ToolModalBody title="Log energy level?" reasoning={reasoning}>
      <DetailRow label="Energy" value={rating !== '—' ? `${rating}/10` : '—'} />
      {notes ? <DetailRow label="Notes" value={notes} /> : null}
      <ConfirmCancelRow onConfirm={() => onConfirm(params)} onCancel={onCancel} loading={loading} confirmLabel="Log energy" />
    </ToolModalBody>
  );
}
