// Design Law confirm overlay — NbSheet + tool-specific popup body (no duplicate sheet title).
// Flow: normalize tool call → dedicated popup (or generic) → Not now / confirm runs the tool.
// Used by: CoachConversationScreen. Visual law: screens/ai-coach-popups/*.png
//
// vocab: NbSheet = neobrutalist bottom sheet; title omitted so each popup owns badge + headline

import React from 'react';
import NbSheet from '../../look-and-feel/NbSheet';
import EditWorkoutPopup from '../confirm-popups/EditWorkoutPopup';
import ChangeFoodTargetsPopup from '../confirm-popups/ChangeFoodTargetsPopup';
import LogMealPopup from '../confirm-popups/LogMealPopup';
import BookSessionPopup from '../confirm-popups/BookSessionPopup';
import UpdateGoalPopup from '../confirm-popups/UpdateGoalPopup';
import MessageTrainerPopup from '../confirm-popups/MessageTrainerPopup';
import LogSleepPopup from '../confirm-popups/LogSleepPopup';
import LogWaterPopup from '../confirm-popups/LogWaterPopup';
import LogStepsPopup from '../confirm-popups/LogStepsPopup';
import RateEnergyPopup from '../confirm-popups/RateEnergyPopup';
import LogMoodPopup from '../confirm-popups/LogMoodPopup';
import RateWorkoutPopup from '../confirm-popups/RateWorkoutPopup';
import OpenWorkoutPlanPopup from '../confirm-popups/OpenWorkoutPlanPopup';
import MarkRestDayPopup from '../confirm-popups/MarkRestDayPopup';
import ConfirmDeletePopup from '../confirm-popups/ConfirmDeletePopup';
import { normalizeToolCall, TOOL_DISPLAY_NAMES } from '../../ai-coach/coach-actions/carryOutAction';
import { ToolModalBody, ConfirmCancelRow } from '../confirm-popups/sharedPopupParts';

// ===== NAMED CONSTANTS =====

const DEFAULT_CONFIRM_TITLE = 'Confirm action?';

// Tool name strings must match carryOutAction — do not rename these keys.
const TOOL_POPUP_BY_NAME = {
  updateWorkout: EditWorkoutPopup,
  adjustMacroTargets: ChangeFoodTargetsPopup,
  logNutrition: LogMealPopup,
  logSleep: LogSleepPopup,
  logWater: LogWaterPopup,
  logSteps: LogStepsPopup,
  rateEnergy: RateEnergyPopup,
  logMood: LogMoodPopup,
  rateWorkout: RateWorkoutPopup,
  bookSession: BookSessionPopup,
  updateGoal: UpdateGoalPopup,
  notifyTrainer: MessageTrainerPopup,
  openWorkoutPlan: OpenWorkoutPlanPopup,
  logRestDay: MarkRestDayPopup,
  deleteLog: ConfirmDeletePopup,
};

// ===== HELPERS =====

function titleForGenericTool(toolName) {
  const displayName = TOOL_DISPLAY_NAMES[toolName];
  if (!displayName) return DEFAULT_CONFIRM_TITLE;
  return `${displayName}?`;
}

function accessibilityToolTitle(toolName) {
  const displayName = TOOL_DISPLAY_NAMES[toolName];
  if (displayName) return displayName;
  return toolName;
}

function genericConfirmBody(toolName, sharedProps) {
  const titleText = titleForGenericTool(toolName);

  function handleConfirmGenericTool() {
    sharedProps.onConfirm(sharedProps.params);
  }

  return (
    <ToolModalBody
      badge={`Coach wants to ${String(accessibilityToolTitle(toolName)).toLowerCase()}`}
      title={titleText}
      reasoning={sharedProps.reasoning}
    >
      <ConfirmCancelRow
        onConfirm={handleConfirmGenericTool}
        onCancel={sharedProps.onCancel}
        loading={sharedProps.loading}
      />
    </ToolModalBody>
  );
}

function popupBodyForTool(toolName, sharedProps) {
  const DedicatedPopup = TOOL_POPUP_BY_NAME[toolName];
  if (DedicatedPopup) return <DedicatedPopup {...sharedProps} />;
  return genericConfirmBody(toolName, sharedProps);
}

// ===== MAIN FUNCTION =====

/**
 * NbSheet wrapping the matching confirm popup. No sheet title — badge + headline live in the body.
 * While loading, backdrop taps / Android back do nothing (no cancel mid-run).
 */
export default function ConfirmActionPopup({
  visible,
  toolCall,
  onConfirm,
  onCancel,
  loading = false,
}) {
  const normalized = normalizeToolCall(toolCall);
  if (!visible || !normalized) return null;

  const { name, params, reasoning } = normalized;
  const sharedProps = { params, reasoning, onConfirm, onCancel, loading };
  const body = popupBodyForTool(name, sharedProps);
  if (!body) return null;

  const canDismissWithBackdrop = !loading;
  const handleClose = canDismissWithBackdrop ? onCancel : () => {};

  return (
    <NbSheet visible={visible} onClose={handleClose}>
      {body}
    </NbSheet>
  );
}
