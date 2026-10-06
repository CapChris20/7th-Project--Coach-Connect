// Confirm popup before the coach writes sleep hours onto the dashboard.
// Flow: read the hours and the date → show them → confirm or cancel.
// Used by: the coach conversation when a tool wants to log sleep.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const MISSING_HOURS_LABEL = '—';
const DEFAULT_SLEEP_DATE = 'Today';
const DEFAULT_REASONING = 'This updates your sleep on the home dashboard for today.';

// ===== HELPER FUNCTIONS =====

/**
 * @param {object|undefined} params
 * @returns {{ hoursLabel: string, sleepDate: string }}
 */
function readSleepDetails(params) {
  const hours = Number(params?.hours ?? params?.sleepHours ?? 0);
  const hoursLabel = Number.isFinite(hours) ? `${hours} hours` : MISSING_HOURS_LABEL;
  const sleepDate = params?.date || DEFAULT_SLEEP_DATE;
  return { hoursLabel, sleepDate };
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function LogSleepPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const sleepDetails = readSleepDetails(params);

  return (
    <ToolModalBody
      title="Log sleep on dashboard?"
      reasoning={reasoning || DEFAULT_REASONING}
    >
      <DetailRow label="Sleep" value={sleepDetails.hoursLabel} />
      <DetailRow label="Date" value={sleepDetails.sleepDate} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Log sleep"
      />
    </ToolModalBody>
  );
}
