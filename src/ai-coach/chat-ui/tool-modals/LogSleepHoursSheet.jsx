/**
 * Log Sleep Modal
 *
 * Purpose: UI screen or component: Log Sleep Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: LogSleepHoursSheet
 *
 * @file-header
 */
import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from '../tool-modals/toolModalHelpers';

export default function LogSleepHoursSheet({ params, reasoning, onConfirm, onCancel, loading }) {
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
