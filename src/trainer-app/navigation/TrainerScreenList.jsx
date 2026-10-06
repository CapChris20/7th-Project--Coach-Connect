// The trainer stack. The tab shell is the base. Every other screen is pushed on top of it.
// Flow: register the main tabs → register each full-screen route with the same slide animation.
// Used once by the trainer app root, after we know the signed-in user is a trainer.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TRAINER_ROUTES } from '../../navigation/screenNames';
import TrainerMainScreen from './TrainerMainScreen';
import {
  TrainerViewMyMyProfileScreen,
  TrainerSettingsScreen,
  TrainerHelpFAQScreen,
  TrainerTermsScreen,
  TrainerPrivacyScreen,
  TrainerContactSupportScreen,
  TrainerBugReportScreen,
  TrainerDailyFoodLogScreen,
  TrainerVoiceAIScreen,
  SearchTrainersScreenOverlay,
  TrainerWeeklyReportScreenOverlay,
  TrainerWorkoutPlanScreen,
  TrainerManualPlanBuilderScreen,
  TrainerEarningsScreen,
} from './trainerExtraScreens';

// ===== NAMED CONSTANTS =====

// vocab: a native stack uses the phone's own navigator, so the slide is not drawn in JavaScript.
const Stack = createNativeStackNavigator();

const overlayScreenOptions = {
  presentation: 'card',
  animation: 'slide_from_right',
  headerShown: false,
};

const navigatorScreenOptions = { headerShown: false, animation: 'slide_from_right' };

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * Voice AI and AI chat share one screen. That screen picks its mode from the route name.
 * @returns {import('react').ReactElement}
 */
export default function TrainerScreenList() {
  return (
    <Stack.Navigator
      screenOptions={navigatorScreenOptions}
      initialRouteName={TRAINER_ROUTES.Main}
    >
      <Stack.Screen name={TRAINER_ROUTES.Main} component={TrainerMainScreen} />
      <Stack.Screen name={TRAINER_ROUTES.Profile} component={TrainerViewMyMyProfileScreen} options={overlayScreenOptions} />
      <Stack.Screen name={TRAINER_ROUTES.Settings} component={TrainerSettingsScreen} options={overlayScreenOptions} />
      <Stack.Screen name={TRAINER_ROUTES.HelpFAQ} component={TrainerHelpFAQScreen} options={overlayScreenOptions} />
      <Stack.Screen name={TRAINER_ROUTES.Terms} component={TrainerTermsScreen} options={overlayScreenOptions} />
      <Stack.Screen name={TRAINER_ROUTES.Privacy} component={TrainerPrivacyScreen} options={overlayScreenOptions} />
      <Stack.Screen
        name={TRAINER_ROUTES.ContactSupport}
        component={TrainerContactSupportScreen}
        options={overlayScreenOptions}
      />
      <Stack.Screen name={TRAINER_ROUTES.BugReport} component={TrainerBugReportScreen} options={overlayScreenOptions} />
      <Stack.Screen name={TRAINER_ROUTES.Nutrition} component={TrainerDailyFoodLogScreen} options={overlayScreenOptions} />
      <Stack.Screen name={TRAINER_ROUTES.VoiceAI} component={TrainerVoiceAIScreen} options={overlayScreenOptions} />
      <Stack.Screen name={TRAINER_ROUTES.AIChat} component={TrainerVoiceAIScreen} options={overlayScreenOptions} />
      <Stack.Screen name={TRAINER_ROUTES.TrainerSearch} component={SearchTrainersScreenOverlay} options={overlayScreenOptions} />
      <Stack.Screen
        name={TRAINER_ROUTES.WeeklyReport}
        component={TrainerWeeklyReportScreenOverlay}
        options={overlayScreenOptions}
      />
      <Stack.Screen name={TRAINER_ROUTES.WorkoutPlan} component={TrainerWorkoutPlanScreen} options={overlayScreenOptions} />
      <Stack.Screen
        name={TRAINER_ROUTES.ManualPlanBuilder}
        component={TrainerManualPlanBuilderScreen}
        options={overlayScreenOptions}
      />
      <Stack.Screen name={TRAINER_ROUTES.Payments} component={TrainerEarningsScreen} options={overlayScreenOptions} />
    </Stack.Navigator>
  );
}
