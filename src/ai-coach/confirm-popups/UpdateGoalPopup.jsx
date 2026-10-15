// Confirm popup before the coach changes the trainee's goal.
// Flow: turn the stored goal into a readable label → show the reason → confirm or cancel.
// Used by: the coach conversation when a tool wants to update the goal.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';
import { showSetupAnswers } from '../../helpers/showSetupAnswers';

// ===== NAMED CONSTANTS =====

const POPUP_TITLE = 'Change goal?';
const GOAL_ROW_LABEL = 'New goal';
const REASON_ROW_LABEL = 'Reason';
const CONFIRM_BUTTON_LABEL = 'Update';
const MISSING_GOAL = '—';

// ===== HELPER FUNCTIONS =====

function readNewGoalValue(params) {
  if (!params) return undefined;
  return params.newGoal;
}

function goalFallbackLabel(newGoalValue) {
  if (newGoalValue) return newGoalValue;
  return MISSING_GOAL;
}

/**
 * showSetupAnswers turns stored setup codes into the same labels the profile screen uses.
 * @param {object|undefined} params
 * @returns {string}
 */
function readGoalDisplayLabel(params) {
  const newGoalValue = readNewGoalValue(params);
  const fallbackWhenEmpty = goalFallbackLabel(newGoalValue);
  return showSetupAnswers(newGoalValue, fallbackWhenEmpty);
}

function readChangeReason(params) {
  if (!params) return undefined;
  return params.reason;
}

// ===== MAIN FUNCTION =====

/**
 * Confirm updating the trainee goal from a coach tool call.
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function UpdateGoalPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Read the new goal the coach wants to write.
  const goalLabel = readGoalDisplayLabel(params);
  const changeReason = readChangeReason(params);

  // 2. Confirm updates the goal. onConfirm still gets the original params.
  function handleConfirmUpdateGoal() {
    onConfirm(params);
  }

  return (
    <ToolModalBody title={POPUP_TITLE} reasoning={reasoning}>
      <DetailRow label={GOAL_ROW_LABEL} value={goalLabel} />
      <DetailRow label={REASON_ROW_LABEL} value={changeReason} />
      <ConfirmCancelRow
        onConfirm={handleConfirmUpdateGoal}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
