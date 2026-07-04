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
import UpdateWorkoutSessionSheet from '../tool-modals/UpdateWorkoutSessionSheet';
import AdjustMacroTargetsSheet from '../tool-modals/AdjustMacroTargetsSheet';
import LogMealSheet from '../tool-modals/LogMealSheet';
import BookTraineeSessionSheet from '../tool-modals/BookTraineeSessionSheet';
import UpdateFitnessGoalSheet from '../tool-modals/UpdateFitnessGoalSheet';
import SendTrainerMessageSheet from '../tool-modals/SendTrainerMessageSheet';
import LogSleepHoursSheet from '../tool-modals/LogSleepHoursSheet';
import LogWaterIntakeSheet from '../tool-modals/LogWaterIntakeSheet';
import LogDailyStepsSheet from '../tool-modals/LogDailyStepsSheet';
import RateEnergyLevelSheet from '../tool-modals/RateEnergyLevelSheet';
import LogMoodRatingSheet from '../tool-modals/LogMoodRatingSheet';
import RateWorkoutFeelSheet from '../tool-modals/RateWorkoutFeelSheet';
import OpenWorkoutPlanSheet from '../tool-modals/OpenWorkoutPlanSheet';
import LogRestDaySheet from '../tool-modals/LogRestDaySheet';
import ConfirmDeleteLogSheet from '../tool-modals/ConfirmDeleteLogSheet';
import { normalizeToolCall, TOOL_DISPLAY_NAMES } from '../../server-logic/tools/runCoachAction';
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
      body = <UpdateWorkoutSessionSheet {...shared} />;
      break;
    case 'adjustMacroTargets':
      body = <AdjustMacroTargetsSheet {...shared} />;
      break;
    case 'logNutrition':
      body = <LogMealSheet {...shared} />;
      break;
    case 'logSleep':
      body = <LogSleepHoursSheet {...shared} />;
      break;
    case 'logWater':
      body = <LogWaterIntakeSheet {...shared} />;
      break;
    case 'logSteps':
      body = <LogDailyStepsSheet {...shared} />;
      break;
    case 'rateEnergy':
      body = <RateEnergyLevelSheet {...shared} />;
      break;
    case 'logMood':
      body = <LogMoodRatingSheet {...shared} />;
      break;
    case 'rateWorkout':
      body = <RateWorkoutFeelSheet {...shared} />;
      break;
    case 'bookSession':
      body = <BookTraineeSessionSheet {...shared} />;
      break;
    case 'updateGoal':
      body = <UpdateFitnessGoalSheet {...shared} />;
      break;
    case 'notifyTrainer':
      body = <SendTrainerMessageSheet {...shared} />;
      break;
    case 'openWorkoutPlan':
      body = <OpenWorkoutPlanSheet {...shared} />;
      break;
    case 'logRestDay':
      body = <LogRestDaySheet {...shared} />;
      break;
    case 'deleteLog':
      body = <ConfirmDeleteLogSheet {...shared} />;
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
