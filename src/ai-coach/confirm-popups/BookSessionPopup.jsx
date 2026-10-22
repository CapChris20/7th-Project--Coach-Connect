// Confirm popup before the coach books a session.
// Flow: read date, time, and duration → show notes → confirm or cancel.
// Used by: the coach conversation when a tool wants to book a session.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const MISSING_VALUE = '—';

// ===== HELPER FUNCTIONS =====

/**
 * Turn raw tool params into labels the DetailRow can show.
 * @param {object|undefined} params
 * @returns {{ sessionDate: string, sessionTime: string, durationLabel: string, notes: string|undefined }}
 */
function buildSessionDisplayFields(params) {
  const sessionDate = params?.sessionDate || params?.date || MISSING_VALUE;
  const sessionTime = params?.sessionTime || params?.time || MISSING_VALUE;
  const durationRaw =
    params?.durationMin ?? params?.durationMinutes ?? params?.duration ?? MISSING_VALUE;
  let durationLabel = MISSING_VALUE;
  if (durationRaw !== MISSING_VALUE) durationLabel = `${durationRaw} min`;
  const notes = params?.notes;
  // The model often sends one combined phrase ("next Tuesday at 10am") as
  // dateTime. Before this, Date/Time both showed "—" even though the server
  // could parse it. Show the phrase as "When" whenever the split fields are
  // missing, so the user confirms something they can actually read.
  const combinedWhen =
    sessionDate === MISSING_VALUE && sessionTime === MISSING_VALUE && params?.dateTime
      ? String(params.dateTime)
      : undefined;
  return { sessionDate, sessionTime, durationLabel, notes, combinedWhen };
}

// ===== MAIN FUNCTION =====

/**
 * Modal that asks the user to confirm booking a trainer session from a coach tool call.
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function BookSessionPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Read date, time, duration, and notes for the session.
  const displayFields = buildSessionDisplayFields(params);

  // 2. Confirm books it. onConfirm still gets the original params object.

  const handleConfirmBook = () => onConfirm(params);

  return (
    <ToolModalBody title="Book session?" reasoning={reasoning}>
      {/* Combined phrase wins when present; otherwise the split date/time rows. */}
      {displayFields.combinedWhen ? (
        <DetailRow label="When" value={displayFields.combinedWhen} />
      ) : (
        <>
          <DetailRow label="Date" value={displayFields.sessionDate} />
          <DetailRow label="Time" value={displayFields.sessionTime} />
        </>
      )}
      <DetailRow label="Duration" value={displayFields.durationLabel} />
      <DetailRow label="Notes" value={displayFields.notes} />
      <ConfirmCancelRow
        onConfirm={handleConfirmBook}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Book"
      />
    </ToolModalBody>
  );
}
