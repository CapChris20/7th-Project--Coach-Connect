// Confirm popup before the coach writes a mood onto the dashboard.
// Flow: read the mood and optional notes → show them → confirm or cancel.
// Used by: the coach conversation when a tool wants to log mood.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const MISSING_VALUE = '—';

// ===== HELPER FUNCTIONS =====

/**
 * @param {object|undefined} params
 * @returns {string}
 */
function readMood(params) {
  return params?.mood ?? params?.feeling ?? MISSING_VALUE;
}

/**
 * @param {object|undefined} params
 * @returns {string|undefined}
 */
function readNotes(params) {
  return params?.notes || params?.note;
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function LogMoodPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const mood = readMood(params);
  const notes = readNotes(params);

  return (
    <ToolModalBody title="Log mood on dashboard?" reasoning={reasoning}>
      <DetailRow label="Mood" value={mood} />
      {notes ? <DetailRow label="Notes" value={notes} /> : null}
      <ConfirmCancelRow onConfirm={() => onConfirm(params)} onCancel={onCancel} loading={loading} confirmLabel="Log mood" />
    </ToolModalBody>
  );
}
