// Confirm popup before the coach writes a workout rating onto the dashboard.
// Flow: read the rating and optional notes → show them as a score out of 10 → confirm or cancel.
// Used by: the coach conversation when a tool wants to rate a workout.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const MISSING_VALUE = '—';
const RATING_SCALE_MAX = 10;

// ===== HELPER FUNCTIONS =====

/**
 * @param {object|undefined} params
 * @returns {string|number}
 */
function readWorkoutRating(params) {
  return params?.rating ?? MISSING_VALUE;
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
export default function RateWorkoutPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const workoutRating = readWorkoutRating(params);
  const notes = readNotes(params);
  const ratingLabel = workoutRating !== MISSING_VALUE ? `${workoutRating}/${RATING_SCALE_MAX}` : MISSING_VALUE;

  return (
    <ToolModalBody title="Log workout rating?" reasoning={reasoning}>
      <DetailRow label="Rating" value={ratingLabel} />
      {notes ? <DetailRow label="Notes" value={notes} /> : null}
      <ConfirmCancelRow onConfirm={() => onConfirm(params)} onCancel={onCancel} loading={loading} confirmLabel="Save rating" />
    </ToolModalBody>
  );
}
