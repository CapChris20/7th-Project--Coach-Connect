/**
 * Log Mood Modal
 *
 * Purpose: UI screen or component: Log Mood Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: LogMoodPopup
 *
 * @file-header
 */
import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

export default function LogMoodPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const mood = params?.mood ?? params?.feeling ?? '—';
  const notes = params?.notes || params?.note;

  return (
    <ToolModalBody title="Log mood on dashboard?" reasoning={reasoning}>
      <DetailRow label="Mood" value={mood} />
      {notes ? <DetailRow label="Notes" value={notes} /> : null}
      <ConfirmCancelRow onConfirm={() => onConfirm(params)} onCancel={onCancel} loading={loading} confirmLabel="Log mood" />
    </ToolModalBody>
  );
}
