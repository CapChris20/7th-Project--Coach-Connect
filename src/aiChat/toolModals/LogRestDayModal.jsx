import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './toolModalShared';

export default function LogRestDayModal({ params, reasoning, onConfirm, onCancel, loading }) {
  const date = params?.date || 'Today';

  return (
    <ToolModalBody title="Log rest day?" reasoning={reasoning}>
      <DetailRow label="Date" value={date} />
      <DetailRow label="Workout card" value="Marks today as Rest day on your dashboard" />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Log rest day"
      />
    </ToolModalBody>
  );
}
