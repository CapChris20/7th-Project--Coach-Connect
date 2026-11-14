// Confirm overlay — NbSheet shell + tool-specific popup body (no duplicate sheet title).
// Flow: normalize coach toolCall → dedicated popup or generic fallback → confirm runs carryOutAction.
// Used by CoachConversationScreen. Visual law: screens/ai-coach-popups/*.png

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

const GENERIC_CONFIRM_HEADLINE = 'Confirm action?';

// Keys must match carryOutAction normalizeToolCall names — do not rename these letters.
const POPUP_COMPONENT_BY_TOOL_NAME = {
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

function friendlyDisplayNameForTool(toolName) {
  return TOOL_DISPLAY_NAMES[toolName];
}

function headlineForUnknownTool(toolName) {
  const friendlyName = friendlyDisplayNameForTool(toolName);
  if (!friendlyName) {
    return GENERIC_CONFIRM_HEADLINE;
  }
  return `${friendlyName}?`;
}

function badgeVerbForTool(toolName) {
  const friendlyName = friendlyDisplayNameForTool(toolName);
  if (friendlyName) {
    return friendlyName;
  }
  return toolName;
}

function sharedPropsForPopupBody(normalizedTool, onConfirm, onCancel, loading) {
  return {
    params: normalizedTool.params,
    reasoning: normalizedTool.reasoning,
    onConfirm,
    onCancel,
    loading,
  };
}

function GenericToolConfirmPopup({ toolName, sharedProps }) {
  const headline = headlineForUnknownTool(toolName);
  const badgeVerb = badgeVerbForTool(toolName);
  const badgeText = `Coach wants to ${String(badgeVerb).toLowerCase()}`;

  function handleConfirmUnknownTool() {
    sharedProps.onConfirm(sharedProps.params);
  }

  return (
    <ToolModalBody badge={badgeText} title={headline} reasoning={sharedProps.reasoning}>
      <ConfirmCancelRow
        onConfirm={handleConfirmUnknownTool}
        onCancel={sharedProps.onCancel}
        loading={sharedProps.loading}
      />
    </ToolModalBody>
  );
}

function popupBodyForToolName(toolName, sharedProps) {
  const DedicatedPopupComponent = POPUP_COMPONENT_BY_TOOL_NAME[toolName];

  if (DedicatedPopupComponent) {
    return (
      <DedicatedPopupComponent
        params={sharedProps.params}
        reasoning={sharedProps.reasoning}
        onConfirm={sharedProps.onConfirm}
        onCancel={sharedProps.onCancel}
        loading={sharedProps.loading}
      />
    );
  }

  return <GenericToolConfirmPopup toolName={toolName} sharedProps={sharedProps} />;
}

function sheetCloseHandlerWhileToolRunning(isLoading, onCancel) {
  if (isLoading) {
    return () => {};
  }
  return onCancel;
}

function ConfirmActionPopupBody({ normalizedTool, onConfirm, onCancel, loading }) {
  const sharedProps = sharedPropsForPopupBody(normalizedTool, onConfirm, onCancel, loading);
  return popupBodyForToolName(normalizedTool.name, sharedProps);
}

// ===== MAIN FUNCTION =====

/**
 * NbSheet wrapper around the right confirm body for this toolCall.
 * Flow: 1. normalize  2. bail if closed/bad  3. build body  4. lock dismiss while loading  5. sheet
 */
export default function ConfirmActionPopup({
  visible,
  toolCall,
  onConfirm,
  onCancel,
  loading = false,
}) {
  // vocab: normalizeToolCall = turn the coach's raw toolCall into { name, params, reasoning }
  const normalizedTool = normalizeToolCall(toolCall);

  // 1. Nothing to show when the sheet is closed.
  if (!visible) {
    return null;
  }

  // 2. Nothing to show when the tool call did not normalize.
  if (!normalizedTool) {
    return null;
  }

  // 3. Build the tool-specific (or generic) body.
  const popupBody = (
    <ConfirmActionPopupBody
      normalizedTool={normalizedTool}
      onConfirm={onConfirm}
      onCancel={onCancel}
      loading={loading}
    />
  );

  if (!popupBody) {
    return null;
  }

  // 4. Block backdrop dismiss and Android back while the tool promise is in flight.
  const handleSheetClose = sheetCloseHandlerWhileToolRunning(loading, onCancel);

  // 5. NbSheet has no title — each popup owns badge + headline inside.
  return (
    <NbSheet visible={visible} onClose={handleSheetClose}>
      {popupBody}
    </NbSheet>
  );
}
