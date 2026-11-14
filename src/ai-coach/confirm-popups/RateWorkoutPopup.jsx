// Workout rating popup — trainee sets a 1–10 session score + optional trainer note, then Save rating.
// Flow: coach suggests a rating → trainee drags + edits note → confirm merges draft into onConfirm.
// Used by ConfirmActionPopup when the normalized tool name is rateWorkout.

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

const BADGE_TEXT = 'Coach wants to rate your workout';
const HEADLINE = 'How was the session?';
const CONFIRM_BUTTON_LABEL = 'Save rating';
const TRAINER_NOTE_LABEL = 'NOTE FOR TRAINER (OPTIONAL)';
const NOTE_PLACEHOLDER = 'Anything your trainer should know…';

const WORKOUT_RATING_MIN = 1;
const WORKOUT_RATING_MAX = 10;
// Manipulate here: default when the coach tool omitted a rating
const WORKOUT_RATING_WHEN_MISSING = 7;
// Accent ramp for the workout slider (Design Law rate-workout PNG)
const WORKOUT_SLIDER_GRADIENT_INDEX = 3;

// ===== HELPER FUNCTIONS =====

function keepWorkoutRatingInsideScale(wholeNumber) {
  if (wholeNumber < WORKOUT_RATING_MIN) {
    return WORKOUT_RATING_MIN;
  }
  if (wholeNumber > WORKOUT_RATING_MAX) {
    return WORKOUT_RATING_MAX;
  }
  return wholeNumber;
}

function firstWorkoutRatingFromParams(coachParams) {
  let ratingRaw;
  if (coachParams) {
    ratingRaw = coachParams.rating;
  }

  const ratingAsNumber = Number(ratingRaw);
  if (!Number.isFinite(ratingAsNumber)) {
    return WORKOUT_RATING_WHEN_MISSING;
  }

  const roundedWhole = Math.round(ratingAsNumber);
  return keepWorkoutRatingInsideScale(roundedWhole);
}

function firstTrainerNoteFromParams(coachParams) {
  if (!coachParams) {
    return '';
  }

  let noteFromTool = coachParams.notes;
  if (!noteFromTool) {
    noteFromTool = coachParams.note;
  }
  if (!noteFromTool) {
    return '';
  }
  return String(noteFromTool);
}

function trainerNoteForServerOrUndefined(noteText) {
  const trimmed = noteText.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  return trimmed;
}

function mergeWorkoutDraftIntoParams(baseParams, sessionRating, trainerNote) {
  const noteForServer = trainerNoteForServerOrUndefined(trainerNote);
  const safeBase = baseParams || {};

  return {
    ...safeBase,
    rating: sessionRating,
    notes: noteForServer,
    note: noteForServer,
  };
}

function workoutHeroLabel(currentRating) {
  return `${currentRating} / ${WORKOUT_RATING_MAX}`;
}

function WorkoutRatingSlider({ rating, onRatingChange }) {
  const sliderColors = accentGradients[WORKOUT_SLIDER_GRADIENT_INDEX];

  return (
    <PopupSlider
      value={rating}
      min={WORKOUT_RATING_MIN}
      max={WORKOUT_RATING_MAX}
      onChange={onRatingChange}
      colors={sliderColors}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Editable workout-rating confirm body. Parent owns NbSheet.
 * Flow: 1. seed draft  2. merge on confirm  3. render
 */
export default function RateWorkoutPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // Hook order frozen: sessionRating, trainerNote, then useMemo
  const [sessionRating, setSessionRating] = useState(() => firstWorkoutRatingFromParams(params));
  const [trainerNote, setTrainerNote] = useState(() => firstTrainerNoteFromParams(params));

  const confirmPayload = useMemo(
    () => mergeWorkoutDraftIntoParams(params, sessionRating, trainerNote),
    [params, sessionRating, trainerNote],
  );

  // 1. Hand the merged draft to the parent confirm runner.
  function handleSaveWorkoutRating() {
    onConfirm(confirmPayload);
  }

  // 2. Name the hero number before JSX.
  const valueBlockLabel = workoutHeroLabel(sessionRating);

  // 3. Sheet body: badge + headline + slider + trainer note + buttons.
  return (
    <ToolModalBody title={HEADLINE} badge={BADGE_TEXT} reasoning={reasoning}>
      <BigValueBlock valueLabel={valueBlockLabel}>
        <WorkoutRatingSlider rating={sessionRating} onRatingChange={setSessionRating} />
      </BigValueBlock>

      <FieldLabel label={TRAINER_NOTE_LABEL} />
      <PopupTextField
        value={trainerNote}
        onChangeText={setTrainerNote}
        placeholder={NOTE_PLACEHOLDER}
        multiline
      />

      <ConfirmCancelRow
        onConfirm={handleSaveWorkoutRating}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
