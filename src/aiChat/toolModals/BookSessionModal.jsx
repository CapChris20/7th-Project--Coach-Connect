import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './toolModalShared';

export default function BookSessionModal({ params, reasoning, onConfirm, onCancel, loading }) {
  const date = params?.sessionDate || params?.date || '—';
  const time = params?.sessionTime || params?.time || '—';
  const duration = params?.durationMinutes ?? params?.duration ?? '—';

  return (
    <ToolModalBody title="Book session?" reasoning={reasoning}>
      <DetailRow label="Date" value={date} />
      <DetailRow label="Time" value={time} />
      <DetailRow label="Duration" value={duration !== '—' ? `${duration} min` : '—'} />
      <DetailRow label="Notes" value={params?.notes} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Book"
      />
    </ToolModalBody>
  );
}
