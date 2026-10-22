// Confirm popup before the coach writes a mood onto the dashboard.
// Flow: read the mood and optional notes → show them → confirm or cancel.
// Used by: the coach conversation when a tool wants to log mood.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const POPUP_TITLE = 'Log mood on dashboard?';
const MOOD_ROW_LABEL = 'Mood';
const NOTES_ROW_LABEL = 'Notes';
const CONFIRM_BUTTON_LABEL = 'Log mood';
const MISSING_VALUE = '—';

// What the user actually sees for each mood: emoji + capitalized word.
// Before this the popup showed only the raw lowercase word (or "—" when the
// model forgot the field) — no emoji, which read as a broken/empty popup.
// Manipulate here: swap any emoji or label wording.
const MOOD_DISPLAY = {
  happy: { emoji: '😊', label: 'Happy' },
  okay: { emoji: '😐', label: 'Okay' },
  stressed: { emoji: '😖', label: 'Stressed' },
  tired: { emoji: '😴', label: 'Tired' },
  anxious: { emoji: '😰', label: 'Anxious' },
};

// ===== HELPER FUNCTIONS =====

function valueWasProvided(value) {
  if (value === undefined) return false;
  if (value === null) return false;
  return true;
}

/**
 * @param {object|undefined} params
 * @returns {string}
 */
function readMoodLabel(params) {
  if (!params) return MISSING_VALUE;
  const rawMood = valueWasProvided(params.mood)
    ? params.mood
    : valueWasProvided(params.feeling)
      ? params.feeling
      : null;
  if (rawMood == null) return MISSING_VALUE;
  // Known mood → "😊 Happy". Unknown text still shows as-is so nothing is hidden.
  const display = MOOD_DISPLAY[String(rawMood).toLowerCase().trim()];
  return display ? `${display.emoji} ${display.label}` : String(rawMood);
}

/**
 * Notes have shown up as `notes` or `note` on different tool payloads.
 * @param {object|undefined} params
 * @returns {string|undefined}
 */
function readOptionalNotes(params) {
  if (!params) return undefined;
  if (params.notes) return String(params.notes);
  if (params.note) return String(params.note);
  return undefined;
}

function NotesRow({ notesText }) {
  if (!notesText) return null;
  return <DetailRow label={NOTES_ROW_LABEL} value={notesText} />;
}

// ===== MAIN FUNCTION =====

/**
 * Confirm writing today's mood onto the home dashboard.
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function LogMoodPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Read mood and optional notes.
  const moodLabel = readMoodLabel(params);
  const notesText = readOptionalNotes(params);

  // 2. Confirm writes the mood. onConfirm still gets the original params.
  function handleConfirmLogMood() {
    onConfirm(params);
  }

  return (
    <ToolModalBody title={POPUP_TITLE} reasoning={reasoning}>
      <DetailRow label={MOOD_ROW_LABEL} value={moodLabel} />
      <NotesRow notesText={notesText} />
      <ConfirmCancelRow
        onConfirm={handleConfirmLogMood}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
