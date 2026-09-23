/**
 * Tool Confirmation Modal
 *
 * Purpose: UI screen or component: Tool Confirmation Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: ConfirmActionPopup
 *
 * @file-header
 */
import React from 'react';
import { Modal, View, StyleSheet, Pressable, Text } from 'react-native';
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
  const shared = { params, reasoning, onConfirm, onCancel, loading };

  let body = null;
  switch (name) {
    case 'updateWorkout':
      body = <EditWorkoutPopup {...shared} />;
      break;
    case 'adjustMacroTargets':
      body = <ChangeFoodTargetsPopup {...shared} />;
      break;
    case 'logNutrition':
      body = <LogMealPopup {...shared} />;
      break;
    case 'logSleep':
      body = <LogSleepPopup {...shared} />;
      break;
    case 'logWater':
      body = <LogWaterPopup {...shared} />;
      break;
    case 'logSteps':
      body = <LogStepsPopup {...shared} />;
      break;
    case 'rateEnergy':
      body = <RateEnergyPopup {...shared} />;
      break;
    case 'logMood':
      body = <LogMoodPopup {...shared} />;
      break;
    case 'rateWorkout':
      body = <RateWorkoutPopup {...shared} />;
      break;
    case 'bookSession':
      body = <BookSessionPopup {...shared} />;
      break;
    case 'updateGoal':
      body = <UpdateGoalPopup {...shared} />;
      break;
    case 'notifyTrainer':
      body = <MessageTrainerPopup {...shared} />;
      break;
    case 'openWorkoutPlan':
      body = <OpenWorkoutPlanPopup {...shared} />;
      break;
    case 'logRestDay':
      body = <MarkRestDayPopup {...shared} />;
      break;
    case 'deleteLog':
      body = <ConfirmDeletePopup {...shared} />;
      break;
    default:
      body = (
        <ToolModalBody
          title={TOOL_DISPLAY_NAMES[name] ? `${TOOL_DISPLAY_NAMES[name]}?` : 'Confirm action?'}
          reasoning={reasoning}
        >
          <ConfirmCancelRow onConfirm={() => onConfirm(params)} onCancel={onCancel} loading={loading} />
        </ToolModalBody>
      );
  }

  if (!body) return null;

  const toolTitle = TOOL_DISPLAY_NAMES[name] || name;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={loading ? undefined : onCancel}
      accessibilityViewIsModal
      accessibilityLabel={`Confirm ${toolTitle}`}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={loading ? undefined : onCancel}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View style={styles.cardWrap} pointerEvents="box-none">
          <LinearGradient
            colors={AI_COACH_UI.gradient.borderWarmSubtle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cardBorder}
          >
            <View style={styles.card} accessibilityRole="none">
              <LinearGradient
                colors={AI_COACH_UI.heroInner}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.cardInner}>{body}</View>
            </View>
          </LinearGradient>
        </View>
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
