// Design Law workout rating — 1–10 slider + note for trainer (screens/ai-coach-popups rate workout).
// Flow: prefill rating → drag / edit note → Save rating.
// Used by: ConfirmActionPopup when tool = rateWorkout.

import React, { useMemo, useState } from 'react';
import {
  ToolModalBody,
  BigValueBlock,
  PopupSlider,
  FieldLabel,
  PopupTextField,
  ConfirmCancelRow,
} from './sharedPopupParts';
import { accentGradients } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const BADGE = 'Coach wants to rate your workout';
const TITLE = 'How was the session?';
const CONFIRM_LABEL = 'Save rating';
const NOTE_LABEL = 'NOTE FOR TRAINER (OPTIONAL)';
const RATING_MIN = 1;
const RATING_MAX = 10;

// ===== HELPERS =====

function readRating(params) {
  const n = Number(params?.rating);
  if (!Number.isFinite(n)) return 7;
  return Math.min(RATING_MAX, Math.max(RATING_MIN, Math.round(n)));
}

function readNote(params) {
  return String(params?.notes || params?.note || '');
}

// ===== MAIN FUNCTION =====

export default function RateWorkoutPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const [rating, setRating] = useState(() => readRating(params));
  const [note, setNote] = useState(() => readNote(params));

  const draftParams = useMemo(
    () => ({
      ...(params || {}),
      rating,
      notes: note.trim() || undefined,
      note: note.trim() || undefined,
    }),
    [params, rating, note],
  );

  return (
    <ToolModalBody title={TITLE} badge={BADGE} reasoning={reasoning}>
      <BigValueBlock valueLabel={`${rating} / ${RATING_MAX}`}>
        <PopupSlider
          value={rating}
          min={RATING_MIN}
          max={RATING_MAX}
          onChange={setRating}
          colors={accentGradients[3]}
        />
      </BigValueBlock>
      <FieldLabel label={NOTE_LABEL} />
      <PopupTextField
        value={note}
        onChangeText={setNote}
        placeholder="Anything your trainer should know…"
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
