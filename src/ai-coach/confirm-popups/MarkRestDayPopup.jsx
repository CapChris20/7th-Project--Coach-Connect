// Confirm popup before the coach marks today as a rest day.
// Flow: read the date → show what the dashboard card will say → confirm or cancel.
// Used by: the coach conversation when a tool wants to log a rest day.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const POPUP_TITLE = 'Log rest day?';
const DATE_ROW_LABEL = 'Date';
const WORKOUT_CARD_ROW_LABEL = 'Workout card';
const CONFIRM_BUTTON_LABEL = 'Log rest day';
const DEFAULT_REST_DAY_LABEL = 'Today';
const REST_DAY_CARD_TEXT = 'Marks today as Rest day on your dashboard';

// ===== HELPER FUNCTIONS =====

/**
 * @param {object|undefined} params
 * @returns {string}
 */
function readRestDayDateLabel(params) {
  if (!params || !params.date) return DEFAULT_REST_DAY_LABEL;
  return String(params.date);
}

// ===== MAIN FUNCTION =====

/**
 * Confirm marking a calendar day as a rest day on the workout card.
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function MarkRestDayPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Read which day becomes a rest day (default Today).
  const restDayDate = readRestDayDateLabel(params);

  // 2. Confirm marks that day. onConfirm still gets the original params.
  function handleConfirmRestDay() {
    onConfirm(params);
  }

  return (
    <ToolModalBody title={POPUP_TITLE} reasoning={reasoning}>
      <DetailRow label={DATE_ROW_LABEL} value={restDayDate} />
      <DetailRow label={WORKOUT_CARD_ROW_LABEL} value={REST_DAY_CARD_TEXT} />
      <ConfirmCancelRow
        onConfirm={handleConfirmRestDay}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
