// Design Law open-plan confirm — InfoTable of plan / today / exercises (screens/ai-coach-popups/17).
// Flow: read plan display fields → user reads summary → Open plan confirms original params.
// Used by: ConfirmActionPopup when tool = openWorkoutPlan.

import React from 'react';
import { ToolModalBody, InfoTable, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const BADGE_TEXT = 'Coach wants to open your plan';
const CONFIRM_BUTTON_LABEL = 'Open plan';

const CURRENT_PLAN_ID = 'current';
const CURRENT_PLAN_LABEL = 'Current active plan';

// Manipulate here: headline when the tool sent no planName / title / dayName / focus
const HEADLINE_WHEN_COACH_OMITS_TITLE = 'Open workout plan?';

// Manipulate here: reasoning blurb when the coach did not pass its own reasoning string
const REASONING_WHEN_COACH_OMITS =
  "Opens your Weekly Plan viewer and summarizes today's session here in chat.";

const INFO_ROW_LABEL_PLAN = 'Plan';
const INFO_ROW_LABEL_TODAY = 'Today';
const INFO_ROW_LABEL_EXERCISES = 'Exercises';

// ===== HELPER FUNCTIONS =====

/**
 * Plan id for the table. Missing → "current".
 * @param {object|undefined} coachParams
 * @returns {string}
 */
function planIdFromParams(coachParams) {
  if (!coachParams) {
    return CURRENT_PLAN_ID;
  }

  if (!coachParams.planId) {
    return CURRENT_PLAN_ID;
  }

  return String(coachParams.planId);
}

/**
 * First non-empty title field among the coach aliases, or undefined.
 * @param {object} coachParams
 * @returns {*|undefined}
 */
function firstTitleFieldFromParams(coachParams) {
  if (coachParams.planName) {
    return coachParams.planName;
  }
  if (coachParams.title) {
    return coachParams.title;
  }
  if (coachParams.dayName) {
    return coachParams.dayName;
  }
  if (coachParams.todayFocus) {
    return coachParams.todayFocus;
  }
  if (coachParams.focus) {
    return coachParams.focus;
  }
  return undefined;
}

/**
 * Hero title for the modal. Prefers planName, then title / dayName / todayFocus / focus.
 * @param {object|undefined} coachParams
 * @returns {string}
 */
function popupTitleFromParams(coachParams) {
  if (!coachParams) {
    return HEADLINE_WHEN_COACH_OMITS_TITLE;
  }

  const titleFromTool = firstTitleFieldFromParams(coachParams);
  if (titleFromTool) {
    return String(titleFromTool);
  }

  return HEADLINE_WHEN_COACH_OMITS_TITLE;
}

/**
 * Value for the Plan row: split → planLabel → planSummary → current label → raw id.
 * @param {object|undefined} coachParams
 * @param {string} planId
 * @returns {string}
 */
function planRowLabelFromParams(coachParams, planId) {
  if (coachParams && coachParams.split) {
    return String(coachParams.split);
  }

  if (coachParams && coachParams.planLabel) {
    return String(coachParams.planLabel);
  }

  if (coachParams && coachParams.planSummary) {
    return String(coachParams.planSummary);
  }

  if (planId === CURRENT_PLAN_ID) {
    return CURRENT_PLAN_LABEL;
  }

  return planId;
}

/**
 * Value for the Today row: todayFocus → dayName → today → focus.
 * @param {object|undefined} coachParams
 * @returns {string|undefined}
 */
function todayFocusLabelFromParams(coachParams) {
  if (!coachParams) {
    return undefined;
  }

  if (coachParams.todayFocus) {
    return String(coachParams.todayFocus);
  }

  if (coachParams.dayName) {
    return String(coachParams.dayName);
  }

  if (coachParams.today) {
    return String(coachParams.today);
  }

  if (coachParams.focus) {
    return String(coachParams.focus);
  }

  return undefined;
}

/**
 * Walk the exercises array and pull a display name from each item.
 * @param {Array} exercisesList
 * @returns {string[]}
 */
function collectExerciseNamesFromList(exercisesList) {
  const exerciseNames = [];

  for (let itemIndex = 0; itemIndex < exercisesList.length; itemIndex += 1) {
    const item = exercisesList[itemIndex];

    if (typeof item === 'string') {
      exerciseNames.push(item);
      continue;
    }

    if (!item) {
      continue;
    }

    if (item.name) {
      exerciseNames.push(item.name);
    }
  }

  return exerciseNames;
}

/**
 * Turn an exercises array (or a plain string) into a comma-separated label.
 * Objects contribute their `.name` when present.
 * @param {Array|string|undefined} exercisesOrList
 * @returns {string|undefined}
 */
function formatExerciseListLabel(exercisesOrList) {
  if (!Array.isArray(exercisesOrList)) {
    if (exercisesOrList) {
      return String(exercisesOrList);
    }
    return undefined;
  }

  const exerciseNames = collectExerciseNamesFromList(exercisesOrList);

  if (exerciseNames.length === 0) {
    return undefined;
  }

  return exerciseNames.join(', ');
}

/**
 * Exercises row value from params.exercises or params.exerciseList.
 * @param {object|undefined} coachParams
 * @returns {string|undefined}
 */
function exerciseListLabelFromParams(coachParams) {
  if (!coachParams) {
    return undefined;
  }

  let listFromTool = coachParams.exercises;
  if (!listFromTool) {
    listFromTool = coachParams.exerciseList;
  }

  return formatExerciseListLabel(listFromTool);
}

/**
 * Three-row summary: Plan / Today / Exercises (values may be undefined → blank cells).
 * @param {object|undefined} coachParams
 * @returns {Array<{label: string, value: string|undefined}>}
 */
function buildOpenPlanInfoRows(coachParams) {
  const planId = planIdFromParams(coachParams);
  const planRowValue = planRowLabelFromParams(coachParams, planId);
  const todayRowValue = todayFocusLabelFromParams(coachParams);
  const exercisesRowValue = exerciseListLabelFromParams(coachParams);

  let planTableValue;
  if (planRowValue) {
    planTableValue = String(planRowValue);
  }

  let todayTableValue;
  if (todayRowValue) {
    todayTableValue = String(todayRowValue);
  }

  return [
    { label: INFO_ROW_LABEL_PLAN, value: planTableValue },
    { label: INFO_ROW_LABEL_TODAY, value: todayTableValue },
    { label: INFO_ROW_LABEL_EXERCISES, value: exercisesRowValue },
  ];
}

/**
 * Reasoning blurb under the badge — coach text, or the Design Law default.
 * @param {string|undefined} reasoning
 * @returns {string}
 */
function reasoningTextOrDefault(reasoning) {
  if (reasoning) {
    return reasoning;
  }

  return REASONING_WHEN_COACH_OMITS;
}

/**
 * Pure layout — no hooks. Parent owns Confirm.
 */
function OpenWorkoutPlanLayout({
  popupTitle,
  reasoningShown,
  infoRows,
  onConfirm,
  onCancel,
  loading,
}) {
  return (
    <ToolModalBody badge={BADGE_TEXT} title={popupTitle} reasoning={reasoningShown}>
      <InfoTable rows={infoRows} />
      <ConfirmCancelRow
        onConfirm={onConfirm}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Confirm opening the workout plan viewer after the coach proposes it.
 * Flow: 1. title + table  2. Open plan hands original params through
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function OpenWorkoutPlanPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Build the hero title and the three-row summary table from tool params.
  const popupTitle = popupTitleFromParams(params);
  const infoRows = buildOpenPlanInfoRows(params);
  const reasoningShown = reasoningTextOrDefault(reasoning);

  // 2. Open plan does not mutate params — navigation uses what the tool already sent.
  function handleConfirmOpenPlan() {
    onConfirm(params);
  }

  // 3. Show the Design Law open-plan sheet.
  return (
    <OpenWorkoutPlanLayout
      popupTitle={popupTitle}
      reasoningShown={reasoningShown}
      infoRows={infoRows}
      onConfirm={handleConfirmOpenPlan}
      onCancel={onCancel}
      loading={loading}
    />
  );
}
