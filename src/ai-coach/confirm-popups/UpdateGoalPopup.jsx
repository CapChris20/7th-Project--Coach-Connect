// Confirm popup before the coach changes the trainee's goal.
// Flow: map stored goal code → profile label → show reason row → Update forwards original params unchanged.
// Used by ConfirmActionPopup when normalized tool name is updateGoal.

import React from 'react';
import { ToolModalBody, InfoTable, ConfirmCancelRow } from './sharedPopupParts';
import { showSetupAnswers } from '../../helpers/showSetupAnswers';

// ===== NAMED CONSTANTS =====

const SHEET_HEADLINE = 'Change goal?';
const BADGE_TEXT = 'Coach wants to update your goal';
const GOAL_TABLE_LABEL = 'New goal';
const REASON_TABLE_LABEL = 'Reason';
const UPDATE_BUTTON_LABEL = 'Update';
// Manipulate here: shown when the coach sent no goal value at all.
const EMPTY_GOAL_PLACEHOLDER = '—';

// ===== HELPER FUNCTIONS =====

function newGoalCodeFromCoachParams(coachParams) {
  if (!coachParams) {
    return undefined;
  }
  return coachParams.newGoal;
}

function reasonTextFromCoachParams(coachParams) {
  if (!coachParams) {
    return undefined;
  }
  return coachParams.reason;
}

function humanReadableGoalLabel(coachParams) {
  const newGoalCode = newGoalCodeFromCoachParams(coachParams);

  let fallbackWhenLookupMisses = EMPTY_GOAL_PLACEHOLDER;
  if (newGoalCode) {
    fallbackWhenLookupMisses = newGoalCode;
  }

  // vocab: showSetupAnswers = same label mapping as the setup goal picker
  return showSetupAnswers(newGoalCode, fallbackWhenLookupMisses);
}

function goalChangeInfoTableRows(goalLabel, reasonText) {
  return [
    { label: GOAL_TABLE_LABEL, value: goalLabel },
    { label: REASON_TABLE_LABEL, value: reasonText },
  ];
}

// ===== MAIN FUNCTION =====

/**
 * Confirm sheet for updateGoal — mapped label + reason, then Update / Cancel.
 * Confirm forwards the original tool params; Firestore write shape lives in carryOutAction.
 */
export default function UpdateGoalPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Turn the coach's stored goal code into the label the user knows from setup.
  const goalLabel = humanReadableGoalLabel(params);
  const reasonText = reasonTextFromCoachParams(params);
  const tableRows = goalChangeInfoTableRows(goalLabel, reasonText);

  // 2. Confirm must send the original tool params — do not rebuild { newGoal, reason } here.
  function handleConfirmGoalUpdate() {
    onConfirm(params);
  }

  // 3. Sheet body: badge + headline + table + buttons.
  return (
    <ToolModalBody badge={BADGE_TEXT} title={SHEET_HEADLINE} reasoning={reasoning}>
      <InfoTable rows={tableRows} />
      <ConfirmCancelRow
        onConfirm={handleConfirmGoalUpdate}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={UPDATE_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
