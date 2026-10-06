// Confirm popup before the coach changes the trainee's goal.
// Flow: turn the stored goal into a readable label → show the reason → confirm or cancel.
// Used by: the coach conversation when a tool wants to update the goal.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';
import { showSetupAnswers } from '../../helpers/showSetupAnswers';

// ===== NAMED CONSTANTS =====

const MISSING_GOAL = '—';

// ===== HELPER FUNCTIONS =====

/**
 * @param {object|undefined} params
 * @returns {string}
 */
function readGoalLabel(params) {
  return showSetupAnswers(params?.newGoal, params?.newGoal || MISSING_GOAL);
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function UpdateGoalPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const goalLabel = readGoalLabel(params);

  return (
    <ToolModalBody title="Change goal?" reasoning={reasoning}>
      <DetailRow label="New goal" value={goalLabel} />
      <DetailRow label="Reason" value={params?.reason} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Update"
      />
    </ToolModalBody>
  );
}
