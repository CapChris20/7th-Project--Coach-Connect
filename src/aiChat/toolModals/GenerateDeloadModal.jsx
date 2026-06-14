import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './toolModalShared';

export default function GenerateDeloadModal({ params, reasoning, onConfirm, onCancel, loading }) {
  return (
    <ToolModalBody title="Create deload week?" reasoning={reasoning}>
      <DetailRow label="Plan" value="Recovery week at ~60% volume" />
      <DetailRow label="Reason" value={params?.reason} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Create"
      />
    </ToolModalBody>
  );
}
