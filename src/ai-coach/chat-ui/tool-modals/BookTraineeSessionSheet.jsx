/**
 * Book Session Modal
 *
 * Purpose: UI screen or component: Book Session Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: BookTraineeSessionSheet
 *
 * @file-header
 */
import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from '../tool-modals/toolModalHelpers';

export default function BookTraineeSessionSheet({ params, reasoning, onConfirm, onCancel, loading }) {
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
