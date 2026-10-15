// Confirm popup before the coach opens the weekly workout plan.
// Flow: read which plan → say "current" in plain words → confirm or cancel.
// Used by: the coach conversation when a tool wants to open the plan viewer.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const POPUP_TITLE = 'Open workout plan?';
const PLAN_ROW_LABEL = 'Plan';
const CONFIRM_BUTTON_LABEL = 'Open plan';
const CURRENT_PLAN_ID = 'current';
const CURRENT_PLAN_LABEL = 'Current active plan';
const DEFAULT_REASONING = 'Opens your Weekly Plan viewer and summarizes today\'s session here in chat.';

// ===== HELPER FUNCTIONS =====

/**
 * @param {object|undefined} params
 * @returns {string}
 */
function readPlanId(params) {
  if (!params || !params.planId) return CURRENT_PLAN_ID;
  return String(params.planId);
}

/**
 * @param {string} planId
 * @returns {string}
 */
function planIdToDisplayLabel(planId) {
  if (planId === CURRENT_PLAN_ID) return CURRENT_PLAN_LABEL;
  return planId;
}

function reasoningTextOrDefault(reasoning) {
  if (reasoning) return reasoning;
  return DEFAULT_REASONING;
}

// ===== MAIN FUNCTION =====

/**
 * Confirm opening the workout plan viewer from a coach tool call.
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function OpenWorkoutPlanPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Say "current" in plain words when the coach did not pick a saved plan id.
  const planId = readPlanId(params);
  const planLabel = planIdToDisplayLabel(planId);
  const reasoningText = reasoningTextOrDefault(reasoning);

  // 2. Confirm still sends the original params so the opener knows which plan.
  function handleConfirmOpenPlan() {
    onConfirm(params);
  }

  return (
    <ToolModalBody title={POPUP_TITLE} reasoning={reasoningText}>
      <DetailRow label={PLAN_ROW_LABEL} value={planLabel} />
      <ConfirmCancelRow
        onConfirm={handleConfirmOpenPlan}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
