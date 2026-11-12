// Design Law mood confirm — fill chips + optional note (screens/ai-coach-popups/03).
// Flow: pre-select mood from tool params → user can retap chips / edit note → Log mood.
// Used by: ConfirmActionPopup when tool = logMood.

import React, { useMemo, useState } from 'react';
import {
  ToolModalBody,
  FieldLabel,
  PopupTextField,
  FillChipRow,
  ConfirmCancelRow,
} from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const BADGE = 'Coach wants to log your mood';
const TITLE = 'How are you feeling?';
const NOTE_LABEL = 'NOTE (OPTIONAL)';
const CONFIRM_LABEL = 'Log mood';

// Manipulate here: mood ids must match what carryOutAction / server accept
const MOOD_OPTIONS = [
  { id: 'happy', label: 'Happy' },
  { id: 'okay', label: 'Okay' },
  { id: 'tired', label: 'Tired' },
  { id: 'stressed', label: 'Stressed' },
  { id: 'anxious', label: 'Anxious' },
];

// ===== HELPERS =====

function readInitialMood(params) {
  const raw = params?.mood ?? params?.feeling;
  if (raw == null || raw === '') return 'okay';
  const id = String(raw).toLowerCase().trim();
  if (MOOD_OPTIONS.some((opt) => opt.id === id)) return id;
  return 'okay';
}

function readInitialNote(params) {
  if (params?.notes) return String(params.notes);
  if (params?.note) return String(params.note);
  return '';
}

// ===== MAIN FUNCTION =====

export default function LogMoodPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const [mood, setMood] = useState(() => readInitialMood(params));
  const [note, setNote] = useState(() => readInitialNote(params));

  const draftParams = useMemo(
    () => ({
      ...(params || {}),
      mood,
      notes: note.trim() ? note.trim() : undefined,
      note: note.trim() ? note.trim() : undefined,
    }),
    [params, mood, note],
  );

  return (
    <ToolModalBody title={TITLE} badge={BADGE} reasoning={reasoning}>
      <FillChipRow options={MOOD_OPTIONS} value={mood} onChange={setMood} />
      <FieldLabel label={NOTE_LABEL} />
      <PopupTextField
        value={note}
        onChangeText={setNote}
        placeholder="Optional note…"
        multiline
      />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(draftParams)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_LABEL}
      />
    </ToolModalBody>
  );
}
