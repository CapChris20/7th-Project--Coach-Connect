// Design Law mood confirm — fill chips + optional note (screens/ai-coach-popups/03).
// Flow: pre-select mood from tool params → trainee retaps chips / edits note → Log mood.
// Used by: ConfirmActionPopup when the coach tool is logMood.

import React, { useMemo, useState } from 'react';
import {
  ToolModalBody,
  FieldLabel,
  PopupTextField,
  FillChipRow,
  ConfirmCancelRow,
} from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const BADGE_TEXT = 'Coach wants to log your mood';
const HEADLINE = 'How are you feeling?';
const OPTIONAL_NOTE_LABEL = 'NOTE (OPTIONAL)';
const CONFIRM_BUTTON_LABEL = 'Log mood';
const NOTE_PLACEHOLDER = 'Optional note…';

// Manipulate here: mood ids must match what carryOutAction / server accept
const MOOD_CHIP_OPTIONS = [
  { id: 'happy', label: 'Happy' },
  { id: 'okay', label: 'Okay' },
  { id: 'tired', label: 'Tired' },
  { id: 'stressed', label: 'Stressed' },
  { id: 'anxious', label: 'Anxious' },
];

const DEFAULT_MOOD_ID = 'okay';

// ===== HELPER FUNCTIONS =====

function moodIdIsKnown(moodId) {
  for (let index = 0; index < MOOD_CHIP_OPTIONS.length; index += 1) {
    const option = MOOD_CHIP_OPTIONS[index];
    if (option.id === moodId) {
      return true;
    }
  }
  return false;
}

function rawMoodFromCoachParams(coachParams) {
  if (!coachParams) {
    return null;
  }

  if (coachParams.mood != null) {
    return coachParams.mood;
  }
  if (coachParams.feeling != null) {
    return coachParams.feeling;
  }

  return null;
}

function startingMoodFromCoachParams(coachParams) {
  const rawMood = rawMoodFromCoachParams(coachParams);
  const moodIsEmpty = rawMood == null || rawMood === '';

  if (moodIsEmpty) {
    return DEFAULT_MOOD_ID;
  }

  const moodId = String(rawMood).toLowerCase().trim();
  if (moodIdIsKnown(moodId)) {
    return moodId;
  }

  return DEFAULT_MOOD_ID;
}

function startingNoteFromCoachParams(coachParams) {
  if (!coachParams) {
    return '';
  }
  if (coachParams.notes) {
    return String(coachParams.notes);
  }
  if (coachParams.note) {
    return String(coachParams.note);
  }
  return '';
}

function noteTextForFirestore(trimmedNote) {
  if (trimmedNote.length === 0) {
    return undefined;
  }
  return trimmedNote;
}

function baseParamsOrEmptyObject(baseParams) {
  if (baseParams) {
    return baseParams;
  }
  return {};
}

function buildMoodDraftForConfirm(baseParams, moodId, noteDraft) {
  const trimmedNote = noteDraft.trim();
  const noteForServer = noteTextForFirestore(trimmedNote);
  const safeBaseParams = baseParamsOrEmptyObject(baseParams);

  return {
    ...safeBaseParams,
    mood: moodId,
    notes: noteForServer,
    note: noteForServer,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Confirm logging a mood the coach proposed (trainee can retap chips + edit note).
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function LogMoodPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Mood chip and optional note — prefilled once from coach tool args.
  const [moodId, setMoodId] = useState(() => startingMoodFromCoachParams(params));
  const [noteDraft, setNoteDraft] = useState(() => startingNoteFromCoachParams(params));

  // 2. Keep confirm payload in sync with chip + note.
  const draftParams = useMemo(
    () => buildMoodDraftForConfirm(params, moodId, noteDraft),
    [params, moodId, noteDraft],
  );

  function handleConfirmLogMood() {
    onConfirm(draftParams);
  }

  // 3. Paint chips → note field → Log mood.
  return (
    <ToolModalBody title={HEADLINE} badge={BADGE_TEXT} reasoning={reasoning}>
      <FillChipRow
        options={MOOD_CHIP_OPTIONS}
        value={moodId}
        onChange={setMoodId}
      />
      <FieldLabel label={OPTIONAL_NOTE_LABEL} />
      <PopupTextField
        value={noteDraft}
        onChangeText={setNoteDraft}
        placeholder={NOTE_PLACEHOLDER}
        multiline
      />
      <ConfirmCancelRow
        onConfirm={handleConfirmLogMood}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
