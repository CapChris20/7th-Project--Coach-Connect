/**
 * Log Rest Day Modal
 *
 * Purpose: UI screen or component: Log Rest Day Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: LogRestDayModal
 *
 * @file-header
 */
import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from '../tool-modals/toolModalHelpers';

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
