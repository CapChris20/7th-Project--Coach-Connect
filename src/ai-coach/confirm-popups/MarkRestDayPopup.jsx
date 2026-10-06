// Confirm popup before the coach marks today as a rest day.
// Flow: read the date → show what the dashboard card will say → confirm or cancel.
// Used by: the coach conversation when a tool wants to log a rest day.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const DEFAULT_REST_DAY_LABEL = 'Today';
const REST_DAY_CARD_TEXT = 'Marks today as Rest day on your dashboard';

// ===== HELPER FUNCTIONS =====

/**
 * @param {object|undefined} params
 * @returns {string}
 */
function readRestDayDate(params) {
  return params?.date || DEFAULT_REST_DAY_LABEL;
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function MarkRestDayPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const restDayDate = readRestDayDate(params);

  return (
    <ToolModalBody title="Log rest day?" reasoning={reasoning}>
      <DetailRow label="Date" value={restDayDate} />
      <DetailRow label="Workout card" value={REST_DAY_CARD_TEXT} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Log rest day"
      />
    </ToolModalBody>
  );
}
