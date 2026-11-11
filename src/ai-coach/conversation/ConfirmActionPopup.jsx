// Overlay that asks the user to confirm an AI-coach tool before it runs (neobrutalist design).
// Flow: normalize the tool call → pick the matching confirm popup → show in NbSheet over the chat.
// Used by: AI conversation screen. Unknown tools fall back to a generic ConfirmCancelRow.
//
// vocab: NbSheet = neobrutalist bottom sheet with thick border and rounded top

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

// ===== HELPER FUNCTIONS =====

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


/**
 * Unknown tool names get a generic title + confirm/cancel row instead of a dedicated sheet.
 * @param {string} toolName
 * @param {object} sharedProps
 * @returns {JSX.Element}
 */
function genericConfirmBody(toolName, sharedProps) {
  const titleText = titleForGenericTool(toolName);

  function handleConfirmGenericTool() {
    sharedProps.onConfirm(sharedProps.params);
  }

  return (
    <ToolModalBody title={titleText} reasoning={sharedProps.reasoning}>
      <ConfirmCancelRow
        onConfirm={handleConfirmGenericTool}
        onCancel={sharedProps.onCancel}
        loading={sharedProps.loading}
      />
    </ToolModalBody>
  );
}

/**
 * Each tool name maps to a dedicated confirm UI. Unknown names get the generic confirm/cancel row.
 * @param {string} toolName
 * @param {object} sharedProps
 * @returns {JSX.Element|null}
 */
function popupBodyForTool(toolName, sharedProps) {
  const DedicatedPopup = TOOL_POPUP_BY_NAME[toolName];
  if (DedicatedPopup) return <DedicatedPopup {...sharedProps} />;
  return genericConfirmBody(toolName, sharedProps);
}


// ===== MAIN FUNCTION =====

/**
 * NbSheet that wraps the matching confirm popup for an AI tool call.
 * While loading, backdrop taps and Android back do nothing so a double-tap cannot cancel mid-run.
 * Uses neobrutalist NbSheet component.
 * @param {{ visible: boolean, toolCall: object, onConfirm: Function, onCancel: Function, loading?: boolean }} props
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

  const toolTitle = accessibilityToolTitle(name);
  const canDismissWithBackdrop = !loading;
  // Only allow dismissal when not loading
  const handleClose = canDismissWithBackdrop ? onCancel : () => {};

  return (
    <NbSheet
      visible={visible}
      onClose={handleClose}
      title={`Confirm ${toolTitle}`}
    >
      {body}
    </NbSheet>
  );
}
