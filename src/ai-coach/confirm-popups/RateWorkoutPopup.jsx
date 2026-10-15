// Confirm popup before the coach writes a workout rating onto the dashboard.
// Flow: read the rating and optional notes → show them as a score out of 10 → confirm or cancel.
// Used by: the coach conversation when a tool wants to rate a workout.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const POPUP_TITLE = 'Log workout rating?';
const RATING_ROW_LABEL = 'Rating';
const NOTES_ROW_LABEL = 'Notes';
const CONFIRM_BUTTON_LABEL = 'Save rating';
const MISSING_VALUE = '—';
const RATING_SCALE_MAX = 10;

// ===== HELPER FUNCTIONS =====

function valueWasProvided(value) {
  if (value === undefined) return false;
  if (value === null) return false;
  return true;
}

/**
 * @param {object|undefined} params
 * @returns {string|number}
 */
function readWorkoutRating(params) {
  if (!params) return MISSING_VALUE;
  if (!valueWasProvided(params.rating)) return MISSING_VALUE;
  return params.rating;
}

/**
 * @param {object|undefined} params
 * @returns {string|undefined}
 */
function readOptionalNotes(params) {
  if (!params) return undefined;
  if (params.notes) return String(params.notes);
  if (params.note) return String(params.note);
  return undefined;
}

/**
 * @param {string|number} workoutRating
 * @returns {string}
 */
function formatWorkoutScoreLabel(workoutRating) {
  if (workoutRating === MISSING_VALUE) return MISSING_VALUE;
  return `${workoutRating}/${RATING_SCALE_MAX}`;
}

function NotesRow({ notesText }) {
  if (!notesText) return null;
  return <DetailRow label={NOTES_ROW_LABEL} value={notesText} />;
}

// ===== MAIN FUNCTION =====

/**
 * Confirm saving a post-workout rating on the dashboard.
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function RateWorkoutPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Read the workout rating and optional notes.
  const workoutRating = readWorkoutRating(params);
  const notesText = readOptionalNotes(params);
  const ratingLabel = formatWorkoutScoreLabel(workoutRating);

  // 2. Confirm saves the rating. onConfirm still gets the original params.
  function handleConfirmSaveRating() {
    onConfirm(params);
  }

  return (
    <ToolModalBody title={POPUP_TITLE} reasoning={reasoning}>
      <DetailRow label={RATING_ROW_LABEL} value={ratingLabel} />
      <NotesRow notesText={notesText} />
      <ConfirmCancelRow
        onConfirm={handleConfirmSaveRating}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
