/**
 * Trainer Root Navigator
 *
 * Purpose: Trainer Root Navigator — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: TrainerRootNavigator
 *
 * @file-header
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TRAINER_ROUTES } from '../../navigation/routes';
import TrainerMainScreen from './TrainerMainScreen';
import {
  TrainerProfileScreen,
  TrainerSettingsScreen,
  TrainerHelpFAQScreen,
  TrainerTermsScreen,
  TrainerPrivacyScreen,
  TrainerContactSupportScreen,
  TrainerBugReportScreen,
  TrainerNutritionScreen,
  TrainerVoiceAIScreen,
  TrainerSearchScreenOverlay,
  TrainerWeeklyReportScreenOverlay,
  TrainerWorkoutPlanScreen,
  TrainerManualPlanBuilderScreen,
  TrainerPaymentsScreen,
} from './trainerOverlayScreens';

const Stack = createNativeStackNavigator();

const modalOptions = {
  presentation: 'card',
  animation: 'slide_from_right',
  headerShown: false,
};

export default function TrainerRootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      initialRouteName={TRAINER_ROUTES.Main}
    >
      <Stack.Screen name={TRAINER_ROUTES.Main} component={TrainerMainScreen} />
      <Stack.Screen name={TRAINER_ROUTES.Profile} component={TrainerProfileScreen} options={modalOptions} />
      <Stack.Screen name={TRAINER_ROUTES.Settings} component={TrainerSettingsScreen} options={modalOptions} />
      <Stack.Screen name={TRAINER_ROUTES.HelpFAQ} component={TrainerHelpFAQScreen} options={modalOptions} />
      <Stack.Screen name={TRAINER_ROUTES.Terms} component={TrainerTermsScreen} options={modalOptions} />
      <Stack.Screen name={TRAINER_ROUTES.Privacy} component={TrainerPrivacyScreen} options={modalOptions} />
      <Stack.Screen
        name={TRAINER_ROUTES.ContactSupport}
        component={TrainerContactSupportScreen}
        options={modalOptions}
      />
      <Stack.Screen name={TRAINER_ROUTES.BugReport} component={TrainerBugReportScreen} options={modalOptions} />
      <Stack.Screen name={TRAINER_ROUTES.Nutrition} component={TrainerNutritionScreen} options={modalOptions} />
      <Stack.Screen name={TRAINER_ROUTES.VoiceAI} component={TrainerVoiceAIScreen} options={modalOptions} />
      <Stack.Screen name={TRAINER_ROUTES.AIChat} component={TrainerVoiceAIScreen} options={modalOptions} />
      <Stack.Screen name={TRAINER_ROUTES.TrainerSearch} component={TrainerSearchScreenOverlay} options={modalOptions} />
      <Stack.Screen
        name={TRAINER_ROUTES.WeeklyReport}
        component={TrainerWeeklyReportScreenOverlay}
        options={modalOptions}
      />
      <Stack.Screen name={TRAINER_ROUTES.WorkoutPlan} component={TrainerWorkoutPlanScreen} options={modalOptions} />
      <Stack.Screen
        name={TRAINER_ROUTES.ManualPlanBuilder}
        component={TrainerManualPlanBuilderScreen}
        options={modalOptions}
      />
      <Stack.Screen name={TRAINER_ROUTES.Payments} component={TrainerPaymentsScreen} options={modalOptions} />
    </Stack.Navigator>
  );
}
