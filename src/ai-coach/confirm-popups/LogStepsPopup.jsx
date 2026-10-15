// Confirm popup before the coach writes a step count onto the dashboard.
// Flow: read the step count off the coach action → show it → confirm or cancel.
// Used by: the coach conversation when a tool wants to log steps.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const POPUP_TITLE = 'Log steps on dashboard?';
const STEPS_ROW_LABEL = 'Steps';
const CONFIRM_BUTTON_LABEL = 'Log steps';
const MISSING_VALUE = '—';
const STEP_COUNT_KEYS = ['step_count', 'steps', 'stepCount'];

// ===== HELPER FUNCTIONS =====

function valueWasProvided(value) {
  if (value === undefined) return false;
  if (value === null) return false;
  return true;
}

/**
 * The coach action has used more than one field name for the same number.
 * @param {object|undefined} params
 * @returns {string|number}
 */
function readStepCount(params) {
  if (!params) return MISSING_VALUE;
  for (let index = 0; index < STEP_COUNT_KEYS.length; index += 1) {
    const keyName = STEP_COUNT_KEYS[index];
    const candidate = params[keyName];
    if (valueWasProvided(candidate)) return candidate;
  }
  return MISSING_VALUE;
}

/**
 * @param {string|number} stepCount
 * @returns {string}
 */
function formatStepCountLabel(stepCount) {
  if (stepCount === MISSING_VALUE) return MISSING_VALUE;
  const numericSteps = Number(stepCount);
  if (!Number.isFinite(numericSteps)) return String(stepCount);
  return numericSteps.toLocaleString();
}

// ===== MAIN FUNCTION =====

/**
 * Confirm writing a step total onto the dashboard.
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function LogStepsPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Read the step count off the coach action (several field names have been used).
  const stepCount = readStepCount(params);
  const stepLabel = formatStepCountLabel(stepCount);

  // 2. Confirm writes that count. onConfirm still gets the original params.
  function handleConfirmLogSteps() {
    onConfirm(params);
  }

  return (
    <ToolModalBody title={POPUP_TITLE} reasoning={reasoning}>
      <DetailRow label={STEPS_ROW_LABEL} value={stepLabel} />
      <ConfirmCancelRow
        onConfirm={handleConfirmLogSteps}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
