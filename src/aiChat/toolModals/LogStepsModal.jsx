/**
 * Log Steps Modal
 *
 * Purpose: UI screen or component: Log Steps Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: LogStepsModal
 *
 * @file-header
 */
import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from '../tool-modals/toolModalHelpers';

export default function LogStepsModal({ params, reasoning, onConfirm, onCancel, loading }) {
  const steps = params?.step_count ?? params?.steps ?? params?.stepCount ?? '—';

  return (
    <ToolModalBody title="Log steps on dashboard?" reasoning={reasoning}>
      <DetailRow label="Steps" value={steps !== '—' ? Number(steps).toLocaleString() : '—'} />
      <ConfirmCancelRow onConfirm={() => onConfirm(params)} onCancel={onCancel} loading={loading} confirmLabel="Log steps" />
    </ToolModalBody>
  );
}
