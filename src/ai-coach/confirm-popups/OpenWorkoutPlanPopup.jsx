// Design Law open-plan confirm — InfoTable of plan / today / exercises (screens/ai-coach-popups/17).
// Flow: read plan display fields → Open plan confirms original params.
// Used by: ConfirmActionPopup when tool = openWorkoutPlan.

import React from 'react';
import { ToolModalBody, InfoTable, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const BADGE = 'Coach wants to open your plan';
const CONFIRM_BUTTON_LABEL = 'Open plan';
const CURRENT_PLAN_ID = 'current';
const CURRENT_PLAN_LABEL = 'Current active plan';
const DEFAULT_REASONING =
  "Opens your Weekly Plan viewer and summarizes today's session here in chat.";

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
 * Hero title — PNG uses the day’s plan name (“Lower body strength”).
 * @param {object|undefined} params
 * @returns {string}
 */
function readTitle(params) {
  const named =
    params?.planName ||
    params?.title ||
    params?.dayName ||
    params?.todayFocus ||
    params?.focus;
  if (named) return String(named);
  return 'Open workout plan?';
}

/**
 * @param {object|undefined} params
 * @returns {Array<{label:string,value:string}>}
 */
function readInfoRows(params) {
  const planId = readPlanId(params);
  const planLabel =
    params?.split ||
    params?.planLabel ||
    params?.planSummary ||
    (planId === CURRENT_PLAN_ID ? CURRENT_PLAN_LABEL : planId);

  const today =
    params?.todayFocus ||
    params?.dayName ||
    params?.today ||
    params?.focus;

  let exercises = params?.exercises || params?.exerciseList;
  if (Array.isArray(exercises)) {
    exercises = exercises
      .map((item) => (typeof item === 'string' ? item : item?.name))
      .filter(Boolean)
      .join(', ');
  }

  return [
    { label: 'Plan', value: planLabel ? String(planLabel) : undefined },
    { label: 'Today', value: today ? String(today) : undefined },
    { label: 'Exercises', value: exercises ? String(exercises) : undefined },
  ];
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
  const title = readTitle(params);
  const rows = readInfoRows(params);
  const reasoningText = reasoningTextOrDefault(reasoning);

  function handleConfirmOpenPlan() {
    onConfirm(params);
  }

  return (
    <ToolModalBody badge={BADGE} title={title} reasoning={reasoningText}>
      <InfoTable rows={rows} />
      <ConfirmCancelRow
        onConfirm={handleConfirmOpenPlan}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
