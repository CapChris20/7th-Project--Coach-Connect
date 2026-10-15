// Overlay that asks the user to confirm an AI-coach tool before it runs.
// Flow: normalize the tool call → pick the matching confirm popup → fade in over the chat.
// Used by the AI conversation screen. Unknown tools fall back to a generic ConfirmCancelRow.

import React from 'react';
import { Modal, View, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { AI_COACH_UI } from '../coachColors';

// ===== NAMED CONSTANTS =====

const DEFAULT_CONFIRM_TITLE = 'Confirm action?';
const DISMISS_ACCESSIBILITY_LABEL = 'Dismiss';
const GRADIENT_BORDER_START = { x: 0, y: 0 };
const GRADIENT_BORDER_END = { x: 1, y: 0 };
const GRADIENT_INNER_START = { x: 0, y: 0 };
const GRADIENT_INNER_END = { x: 0, y: 1 };

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

function dismissHandlerWhenIdle(canDismiss, onCancel) {
  if (canDismiss) return onCancel;
  return undefined;
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

/**
 * Gradient card shell shared by every confirm popup in this modal.
 * @param {{ children: * }} props
 */
function ConfirmActionCard({ children }) {
  return (
    <View style={styles.cardWrap} pointerEvents="box-none">
      <LinearGradient
        colors={AI_COACH_UI.gradient.borderWarmSubtle}
        start={GRADIENT_BORDER_START}
        end={GRADIENT_BORDER_END}
        style={styles.cardBorder}
      >
        <View style={styles.card} accessibilityRole="none">
          <LinearGradient
            colors={AI_COACH_UI.heroInner}
            start={GRADIENT_INNER_START}
            end={GRADIENT_INNER_END}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.cardInner}>{children}</View>
        </View>
      </LinearGradient>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Fade-in modal that wraps the matching confirm popup for an AI tool call.
 * While loading, backdrop taps and Android back do nothing so a double-tap cannot cancel mid-run.
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
  const dismissWhileIdle = dismissHandlerWhenIdle(canDismissWithBackdrop, onCancel);
  const confirmAccessibilityLabel = `Confirm ${toolTitle}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismissWhileIdle}
      accessibilityViewIsModal
      accessibilityLabel={confirmAccessibilityLabel}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={dismissWhileIdle}
          accessibilityRole="button"
          accessibilityLabel={DISMISS_ACCESSIBILITY_LABEL}
        />
        <ConfirmActionCard>{body}</ConfirmActionCard>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.78)',
  },
  cardWrap: {
    width: '100%',
    maxWidth: 360,
    zIndex: 2,
    elevation: 12,
  },
  cardBorder: {
    borderRadius: 16,
    padding: 1,
  },
  card: {
    borderRadius: 15,
    borderWidth: 1,
    borderColor: AI_COACH_UI.borderHairline,
    overflow: 'hidden',
  },
  cardInner: {
    padding: 20,
    zIndex: 1,
  },
});
