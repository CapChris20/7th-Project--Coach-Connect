import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './toolModalShared';

export default function LogStepsModal({ params, reasoning, onConfirm, onCancel, loading }) {
  const steps = params?.step_count ?? params?.steps ?? params?.stepCount ?? '—';

  return (
    <ToolModalBody title="Log steps on dashboard?" reasoning={reasoning}>
      <DetailRow label="Steps" value={steps !== '—' ? Number(steps).toLocaleString() : '—'} />
      <ConfirmCancelRow onConfirm={() => onConfirm(params)} onCancel={onCancel} loading={loading} confirmLabel="Log steps" />
    </ToolModalBody>
  );
}
