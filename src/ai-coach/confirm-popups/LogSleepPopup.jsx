// Confirm popup before the coach writes sleep hours onto the dashboard.
// Flow: read the hours and the date → show them → confirm or cancel.
// Used by: the coach conversation when a tool wants to log sleep.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const POPUP_TITLE = 'Log sleep on dashboard?';
const SLEEP_ROW_LABEL = 'Sleep';
const DATE_ROW_LABEL = 'Date';
const CONFIRM_BUTTON_LABEL = 'Log sleep';
const MISSING_HOURS_LABEL = '—';
const DEFAULT_SLEEP_DATE = 'Today';
const DEFAULT_REASONING = 'This updates your sleep on the home dashboard for today.';

// ===== HELPER FUNCTIONS =====

function valueWasProvided(value) {
  if (value === undefined) return false;
  if (value === null) return false;
  return true;
}

/**
 * @param {object|undefined} params
 * @returns {number}
 */
function readSleepHoursNumber(params) {
  if (!params) return 0;
  if (valueWasProvided(params.hours)) return Number(params.hours);
  if (valueWasProvided(params.sleepHours)) return Number(params.sleepHours);
  return 0;
}

/**
 * @param {number} sleepHours
 * @returns {string}
 */
function formatSleepHoursLabel(sleepHours) {
  const hoursAreFinite = Number.isFinite(sleepHours);
  if (!hoursAreFinite) return MISSING_HOURS_LABEL;
  return `${sleepHours} hours`;
}

function readSleepDateLabel(params) {
  if (!params || !params.date) return DEFAULT_SLEEP_DATE;
  return params.date;
}

/**
 * @param {object|undefined} params
 * @returns {{ hoursLabel: string, sleepDate: string }}
 */
function readSleepDetails(params) {
  const sleepHours = readSleepHoursNumber(params);
  const hoursLabel = formatSleepHoursLabel(sleepHours);
  const sleepDate = readSleepDateLabel(params);
  return { hoursLabel, sleepDate };
}

function reasoningTextOrDefault(reasoning) {
  if (reasoning) return reasoning;
  return DEFAULT_REASONING;
}

// ===== MAIN FUNCTION =====

/**
 * Confirm logging sleep hours for a day on the dashboard.
 * vocab: hours use an explicit null check so 0 hours is not treated as missing.
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function LogSleepPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Read sleep hours and which day.
  const sleepDetails = readSleepDetails(params);
  const reasoningText = reasoningTextOrDefault(reasoning);

  // 2. Confirm writes those hours. onConfirm still gets the original params.
  function handleConfirmLogSleep() {
    onConfirm(params);
  }

  return (
    <ToolModalBody title={POPUP_TITLE} reasoning={reasoningText}>
      <DetailRow label={SLEEP_ROW_LABEL} value={sleepDetails.hoursLabel} />
      <DetailRow label={DATE_ROW_LABEL} value={sleepDetails.sleepDate} />
      <ConfirmCancelRow
        onConfirm={handleConfirmLogSleep}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
