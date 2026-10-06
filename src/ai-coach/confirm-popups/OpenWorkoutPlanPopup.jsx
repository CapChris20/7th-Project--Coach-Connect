// Confirm popup before the coach opens the weekly workout plan.
// Flow: read which plan → say "current" in plain words → confirm or cancel.
// Used by: the coach conversation when a tool wants to open the plan viewer.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const CURRENT_PLAN_ID = 'current';
const CURRENT_PLAN_LABEL = 'Current active plan';
const DEFAULT_REASONING = 'Opens your Weekly Plan viewer and summarizes today\'s session here in chat.';

// ===== HELPER FUNCTIONS =====

/**
 * @param {object|undefined} params
 * @returns {string}
 */
function readPlanLabel(params) {
  const planId = params?.planId || CURRENT_PLAN_ID;
  if (planId === CURRENT_PLAN_ID) return CURRENT_PLAN_LABEL;
  return planId;
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function OpenWorkoutPlanPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const planLabel = readPlanLabel(params);

  return (
    <ToolModalBody
      title="Open workout plan?"
      reasoning={reasoning || DEFAULT_REASONING}
    >
      <DetailRow label="Plan" value={planLabel} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Open plan"
      />
    </ToolModalBody>
  );
}
