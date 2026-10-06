// Confirm popup before the coach writes a step count onto the dashboard.
// Flow: read the step count off the coach action → show it → confirm or cancel.
// Used by: the coach conversation when a tool wants to log steps.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const MISSING_VALUE = '—';

// ===== HELPER FUNCTIONS =====

/**
 * The coach action has used more than one field name for the same number.
 * @param {object|undefined} params
 * @returns {string|number}
 */
function readStepCount(params) {
  return params?.step_count ?? params?.steps ?? params?.stepCount ?? MISSING_VALUE;
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function LogStepsPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const stepCount = readStepCount(params);
  const stepLabel = stepCount !== MISSING_VALUE ? Number(stepCount).toLocaleString() : MISSING_VALUE;

  return (
    <ToolModalBody title="Log steps on dashboard?" reasoning={reasoning}>
      <DetailRow label="Steps" value={stepLabel} />
      <ConfirmCancelRow onConfirm={() => onConfirm(params)} onCancel={onCancel} loading={loading} confirmLabel="Log steps" />
    </ToolModalBody>
  );
}
