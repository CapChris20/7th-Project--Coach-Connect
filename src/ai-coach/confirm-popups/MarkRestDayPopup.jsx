// Confirm popup before the coach marks today as a rest day.
// Flow: pick the date label → build the info table → confirm or Not now.
// Used by: ConfirmActionPopup when tool = markRestDay (or equivalent rest-day tool).

import React from 'react';
import { ToolModalBody, InfoTable, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const BADGE_TEXT = 'Coach wants to mark a rest day';
const HEADLINE = 'Log rest day?';
const DATE_ROW_LABEL = 'Date';
const WORKOUT_CARD_ROW_LABEL = 'Workout card';
const CONFIRM_BUTTON_LABEL = 'Log rest day';

// Manipulate here: fallback Date-row copy when the tool omitted params.date
const DATE_LABEL_WHEN_COACH_OMITS = 'Today';

// Manipulate here: Workout-card row copy (Design Law rest-day sheet)
const WORKOUT_CARD_VALUE_TEXT = 'Marks today as Rest day on your dashboard';

// ===== HELPER FUNCTIONS =====

/**
 * Which day shows on the Date row. Missing date → "Today".
 * @param {object|undefined} coachParams
 * @returns {string}
 */
function restDayDateLabelFromParams(coachParams) {
  if (!coachParams) {
    return DATE_LABEL_WHEN_COACH_OMITS;
  }

  if (!coachParams.date) {
    return DATE_LABEL_WHEN_COACH_OMITS;
  }

  return String(coachParams.date);
}

/**
 * Two rows for the Design Law info table: Date + Workout card.
 * @param {string} restDayDateLabel
 * @returns {Array<{label: string, value: string}>}
 */
function buildRestDayInfoRows(restDayDateLabel) {
  const dateRow = { label: DATE_ROW_LABEL, value: restDayDateLabel };
  const workoutCardRow = {
    label: WORKOUT_CARD_ROW_LABEL,
    value: WORKOUT_CARD_VALUE_TEXT,
  };
  return [dateRow, workoutCardRow];
}

/**
 * Everything the sheet needs from coach tool params (date label → table rows).
 * @param {object|undefined} coachParams
 * @returns {{ infoRows: Array<{label: string, value: string}> }}
 */
function restDaySheetModelFromParams(coachParams) {
  const restDayDateLabel = restDayDateLabelFromParams(coachParams);
  const infoRows = buildRestDayInfoRows(restDayDateLabel);
  return { infoRows };
}

/**
 * Pure layout — no hooks. Parent owns Confirm.
 */
function MarkRestDayLayout({ infoRows, reasoning, onConfirm, onCancel, loading }) {
  return (
    <ToolModalBody badge={BADGE_TEXT} title={HEADLINE} reasoning={reasoning}>
      <InfoTable rows={infoRows} />
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
 * Confirm logging a rest day after the coach proposes it.
 * Flow: 1. sheet model  2. confirm hands original params through  3. render
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function MarkRestDayPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Turn coach tool params into the Date + Workout card rows.
  const sheetModel = restDaySheetModelFromParams(params);

  // 2. Confirm does not edit params — parent runs the tool with the same object.
  function handleConfirmRestDay() {
    onConfirm(params);
  }

  // 3. Show the Design Law rest-day sheet.
  return (
    <MarkRestDayLayout
      infoRows={sheetModel.infoRows}
      reasoning={reasoning}
      onConfirm={handleConfirmRestDay}
      onCancel={onCancel}
      loading={loading}
    />
  );
}
