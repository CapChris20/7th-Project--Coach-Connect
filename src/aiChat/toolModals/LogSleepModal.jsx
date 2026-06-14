import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './toolModalShared';

export default function LogSleepModal({ params, reasoning, onConfirm, onCancel, loading }) {
  const hours = Number(params?.hours ?? params?.sleepHours ?? 0);
  const date = params?.date || 'Today';

  return (
    <ToolModalBody
      title="Log sleep on dashboard?"
      reasoning={reasoning || 'This updates your sleep on the home dashboard for today.'}
    >
      <DetailRow label="Sleep" value={Number.isFinite(hours) ? `${hours} hours` : '—'} />
      <DetailRow label="Date" value={date} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Log sleep"
      />
    </ToolModalBody>
  );
}
