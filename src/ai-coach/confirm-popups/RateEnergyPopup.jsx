// Energy confirm popup — trainee sets a 1–8 energy score + optional note, then taps Log energy.
// Flow: coach tool params seed the slider → trainee drags / types → confirm merges draft into onConfirm.
// Used by ConfirmActionPopup when the normalized tool name is rateEnergy (ai-coach-popups energy PNG).

import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import {
  ToolModalBody,
  BigValueBlock,
  PopupSlider,
  FieldLabel,
  PopupTextField,
  ConfirmCancelRow,
  usePopupColors,
} from './sharedPopupParts';
import { accentGradients, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const BADGE_TEXT = 'Coach wants to log energy';
const HEADLINE = 'Energy right now';
const CONFIRM_BUTTON_LABEL = 'Log energy';
const OPTIONAL_NOTE_LABEL = 'NOTE (OPTIONAL)';
const NOTE_PLACEHOLDER = 'Optional note…';

// Manipulate here: Design Law energy scale is 1–8 (not the 1–10 workout scale)
const ENERGY_SCALE_MIN = 1;
const ENERGY_SCALE_MAX = 8;
// Manipulate here: middle of the scale when the coach tool forgot to send a rating
const ENERGY_WHEN_COACH_OMITS_RATING = 5;

const SCALE_LEFT_CAPTION = 'DRAINED';
const SCALE_RIGHT_CAPTION = 'WIRED';
const SCALE_CAPTION_FONT_SIZE = 11;
const SCALE_CAPTION_WEIGHT = '800';

// Accent ramp index for the energy slider (pink→orange family in Design Law)
const ENERGY_SLIDER_GRADIENT_INDEX = 1;

// ===== HELPER FUNCTIONS =====

/**
 * Keep a whole number inside the 1–8 energy scale.
 * Why: coach tools sometimes send 0 or 10; the PNG only shows 1–8.
 * @param {number} wholeNumber
 * @returns {number}
 */
function keepEnergyInsideScale(wholeNumber) {
  if (wholeNumber < ENERGY_SCALE_MIN) {
    return ENERGY_SCALE_MIN;
  }
  if (wholeNumber > ENERGY_SCALE_MAX) {
    return ENERGY_SCALE_MAX;
  }
  return wholeNumber;
}

/**
 * First slider value when the popup opens.
 * Coach may send `rating` or `energy` — both mean the same number here.
 * Uses nullish pick (rating wins unless null/undefined) — freeze-safe for a real 0.
 * @param {object|undefined} coachParams
 * @returns {number}
 */
function firstEnergyFromCoachParams(coachParams) {
  if (!coachParams) {
    return ENERGY_WHEN_COACH_OMITS_RATING;
  }

  // vocab: nullish = only fall through when left is null or undefined (0 stays)
  let ratingOrEnergy = coachParams.rating;
  if (ratingOrEnergy === null || ratingOrEnergy === undefined) {
    ratingOrEnergy = coachParams.energy;
  }

  const asNumber = Number(ratingOrEnergy);

  if (!Number.isFinite(asNumber)) {
    return ENERGY_WHEN_COACH_OMITS_RATING;
  }

  const roundedWhole = Math.round(asNumber);
  return keepEnergyInsideScale(roundedWhole);
}

/**
 * Optional note field seed — coach may send `notes` or `note`.
 * Empty string when neither exists so the TextInput stays controlled.
 * @param {object|undefined} coachParams
 * @returns {string}
 */
function firstNoteFromCoachParams(coachParams) {
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

/**
 * Empty notes must become undefined so Firestore does not store "".
 * Both `notes` and `note` stay in sync for older and newer tool callers.
 * @param {string} noteDraft
 * @returns {string|undefined}
 */
function noteForServerOrUndefined(noteDraft) {
  const trimmedNote = noteDraft.trim();
  if (trimmedNote.length === 0) {
    return undefined;
  }
  return trimmedNote;
}

/**
 * Merge the trainee’s draft over the coach’s original params.
 * Keeps every other tool key (date, source, …) so carryOutAction still sees them.
 * @param {object|undefined} baseParams
 * @param {number} energyValue
 * @param {string} noteDraft
 * @returns {object}
 */
function mergeEnergyDraftIntoParams(baseParams, energyValue, noteDraft) {
  const safeBase = baseParams || {};
  const noteForServer = noteForServerOrUndefined(noteDraft);

  return {
    ...safeBase,
    rating: energyValue,
    energy: energyValue,
    notes: noteForServer,
    note: noteForServer,
  };
}

/** Big hero label under the title — e.g. "5 / 8". */
function energyHeroLabel(currentRating) {
  return `${currentRating} / ${ENERGY_SCALE_MAX}`;
}

/**
 * DRAINED … WIRED captions under the slider (Design Law PNG labels).
 */
function DrainedWiredCaptionRow({ mutedInkColor }) {
  const captionStyle = {
    fontSize: SCALE_CAPTION_FONT_SIZE,
    fontWeight: SCALE_CAPTION_WEIGHT,
    color: mutedInkColor,
  };

  const endsRowStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  };

  return (
    <View style={endsRowStyle}>
      <Text style={captionStyle}>{SCALE_LEFT_CAPTION}</Text>
      <Text style={captionStyle}>{SCALE_RIGHT_CAPTION}</Text>
    </View>
  );
}

/**
 * Slider + drained/wired row. Lives here so the main return stays a short recipe.
 */
function EnergySliderWithCaptions({ rating, onRatingChange, mutedInkColor }) {
  // Manipulate here: swap ENERGY_SLIDER_GRADIENT_INDEX to try another accent ramp
  const sliderGradient = accentGradients[ENERGY_SLIDER_GRADIENT_INDEX];

  return (
    <>
      <PopupSlider
        value={rating}
        min={ENERGY_SCALE_MIN}
        max={ENERGY_SCALE_MAX}
        onChange={onRatingChange}
        colors={sliderGradient}
      />
      <DrainedWiredCaptionRow mutedInkColor={mutedInkColor} />
    </>
  );
}

/**
 * Pure layout — no hooks. Parent owns rating / note draft and Confirm.
 */
function RateEnergyLayout({
  reasoning,
  bigValueLabel,
  energyRating,
  onRatingChange,
  mutedInkColor,
  noteDraft,
  onNoteChange,
  onConfirm,
  onCancel,
  loading,
}) {
  return (
    <ToolModalBody title={HEADLINE} badge={BADGE_TEXT} reasoning={reasoning}>
      <BigValueBlock valueLabel={bigValueLabel}>
        <EnergySliderWithCaptions
          rating={energyRating}
          onRatingChange={onRatingChange}
          mutedInkColor={mutedInkColor}
        />
      </BigValueBlock>

      <FieldLabel label={OPTIONAL_NOTE_LABEL} />
      <PopupTextField
        value={noteDraft}
        onChangeText={onNoteChange}
        placeholder={NOTE_PLACEHOLDER}
        multiline
      />

      <ConfirmCancelRow
        onConfirm={onConfirm}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}

// ===== MAIN FUNCTION =====

/**
 * RateEnergyPopup — editable energy confirm sheet body (no NbSheet; parent owns the shell).
 * Flow: 1. theme colors  2. seed draft from coach  3. rebuild confirm bag on edits  4. render
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function RateEnergyPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Theme tokens for muted DRAINED / WIRED captions.
  const popupColors = usePopupColors();

  // 2. Seed slider + note once from coach tool args (hook order frozen).
  const [energyRating, setEnergyRating] = useState(() => firstEnergyFromCoachParams(params));
  const [noteDraft, setNoteDraft] = useState(() => firstNoteFromCoachParams(params));

  // 3. Confirm bag rebuilds when rating or note change.
  const payloadForConfirm = useMemo(
    () => mergeEnergyDraftIntoParams(params, energyRating, noteDraft),
    [params, energyRating, noteDraft],
  );

  function handleConfirmLogEnergy() {
    onConfirm(payloadForConfirm);
  }

  // 4. Name the hero number, then show the Design Law energy sheet.
  const bigValueLabel = energyHeroLabel(energyRating);
  const mutedInkColor = popupColors.nbMuted;

  return (
    <RateEnergyLayout
      reasoning={reasoning}
      bigValueLabel={bigValueLabel}
      energyRating={energyRating}
      onRatingChange={setEnergyRating}
      mutedInkColor={mutedInkColor}
      noteDraft={noteDraft}
      onNoteChange={setNoteDraft}
      onConfirm={handleConfirmLogEnergy}
      onCancel={onCancel}
      loading={loading}
    />
  );
}
