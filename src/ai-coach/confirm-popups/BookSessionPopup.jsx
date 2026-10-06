// Confirm popup before the coach books a session.
// Flow: read date, time, and duration → show notes → confirm or cancel.
// Used by: the coach conversation when a tool wants to book a session.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const MISSING_VALUE = '—';

// ===== HELPER FUNCTIONS =====

/**
 * @param {object|undefined} params
 * @returns {{ sessionDate: string, sessionTime: string, durationLabel: string, notes: string|undefined }}
 */
function readSessionDetails(params) {
  const sessionDate = params?.sessionDate || params?.date || MISSING_VALUE;
  const sessionTime = params?.sessionTime || params?.time || MISSING_VALUE;
  const durationMinutes = params?.durationMinutes ?? params?.duration ?? MISSING_VALUE;
  const durationLabel = durationMinutes !== MISSING_VALUE ? `${durationMinutes} min` : MISSING_VALUE;
  return { sessionDate, sessionTime, durationLabel, notes: params?.notes };
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function BookSessionPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const sessionDetails = readSessionDetails(params);

  return (
    <ToolModalBody title="Book session?" reasoning={reasoning}>
      <DetailRow label="Date" value={sessionDetails.sessionDate} />
      <DetailRow label="Time" value={sessionDetails.sessionTime} />
      <DetailRow label="Duration" value={sessionDetails.durationLabel} />
      <DetailRow label="Notes" value={sessionDetails.notes} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Book"
      />
    </ToolModalBody>
  );
}
