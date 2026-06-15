/**
 * Tool Confirmation Modal
 *
 * Purpose: UI screen or component: Tool Confirmation Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: ToolConfirmationModal
 *
 * @file-header
 */
import React from 'react';
import { Modal, View, StyleSheet, Pressable, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import UpdateWorkoutModal from '../tool-modals/UpdateWorkoutModal';
import AdjustMacrosModal from '../tool-modals/AdjustMacrosModal';
import LogNutritionModal from '../tool-modals/LogNutritionModal';
import BookSessionModal from '../tool-modals/BookSessionModal';
import UpdateGoalModal from '../tool-modals/UpdateGoalModal';
import NotifyTrainerModal from '../tool-modals/NotifyTrainerModal';
import LogSleepModal from '../tool-modals/LogSleepModal';
import LogWaterModal from '../tool-modals/LogWaterModal';
import LogStepsModal from '../tool-modals/LogStepsModal';
import RateEnergyModal from '../tool-modals/RateEnergyModal';
import LogMoodModal from '../tool-modals/LogMoodModal';
import RateWorkoutModal from '../tool-modals/RateWorkoutModal';
import OpenWorkoutPlanModal from '../tool-modals/OpenWorkoutPlanModal';
import LogRestDayModal from '../tool-modals/LogRestDayModal';
import DeleteLogModal from '../tool-modals/DeleteLogModal';
import { normalizeToolCall, TOOL_DISPLAY_NAMES } from '../../ai/tools/executeCoachTool';
import { ToolModalBody, ConfirmCancelRow } from '../tool-modals/toolModalHelpers';
import { AI_COACH_UI } from '../aiCoachUiTokens';

export default function ToolConfirmationModal({
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
      body = <UpdateWorkoutModal {...shared} />;
      break;
    case 'adjustMacroTargets':
      body = <AdjustMacrosModal {...shared} />;
      break;
    case 'logNutrition':
      body = <LogNutritionModal {...shared} />;
      break;
    case 'logSleep':
      body = <LogSleepModal {...shared} />;
      break;
    case 'logWater':
      body = <LogWaterModal {...shared} />;
      break;
    case 'logSteps':
      body = <LogStepsModal {...shared} />;
      break;
    case 'rateEnergy':
      body = <RateEnergyModal {...shared} />;
      break;
    case 'logMood':
      body = <LogMoodModal {...shared} />;
      break;
    case 'rateWorkout':
      body = <RateWorkoutModal {...shared} />;
      break;
    case 'bookSession':
      body = <BookSessionModal {...shared} />;
      break;
    case 'updateGoal':
      body = <UpdateGoalModal {...shared} />;
      break;
    case 'notifyTrainer':
      body = <NotifyTrainerModal {...shared} />;
      break;
    case 'openWorkoutPlan':
      body = <OpenWorkoutPlanModal {...shared} />;
      break;
    case 'logRestDay':
      body = <LogRestDayModal {...shared} />;
      break;
    case 'deleteLog':
      body = <DeleteLogModal {...shared} />;
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
