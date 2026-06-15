/**
 * Rate Workout Modal
 *
 * Purpose: UI screen or component: Rate Workout Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: RateWorkoutModal
 *
 * @file-header
 */
import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from '../tool-modals/toolModalHelpers';

export default function RateWorkoutModal({ params, reasoning, onConfirm, onCancel, loading }) {
  const rating = params?.rating ?? '—';
  const notes = params?.notes || params?.note;

  return (
    <ToolModalBody title="Log workout rating?" reasoning={reasoning}>
      <DetailRow label="Rating" value={rating !== '—' ? `${rating}/10` : '—'} />
      {notes ? <DetailRow label="Notes" value={notes} /> : null}
      <ConfirmCancelRow onConfirm={() => onConfirm(params)} onCancel={onCancel} loading={loading} confirmLabel="Save rating" />
    </ToolModalBody>
  );
}
