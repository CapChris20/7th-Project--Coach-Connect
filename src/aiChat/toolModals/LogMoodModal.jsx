import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './toolModalShared';

export default function LogMoodModal({ params, reasoning, onConfirm, onCancel, loading }) {
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
