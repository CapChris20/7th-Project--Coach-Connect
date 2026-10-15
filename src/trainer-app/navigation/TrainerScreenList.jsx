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

const OVERLAY_PRESENTATION = 'card';
const OVERLAY_ANIMATION = 'slide_from_right';

const overlayScreenOptions = {
  presentation: OVERLAY_PRESENTATION,
  animation: OVERLAY_ANIMATION,
  headerShown: false,
};

const navigatorScreenOptions = {
  headerShown: false,
  animation: OVERLAY_ANIMATION,
};

// Full-screen overlays that sit on top of Main. Voice AI and AI chat share one component.
const TRAINER_OVERLAY_SCREENS = [
  { routeName: TRAINER_ROUTES.Profile, ScreenComponent: TrainerViewMyMyProfileScreen },
  { routeName: TRAINER_ROUTES.Settings, ScreenComponent: TrainerSettingsScreen },
  { routeName: TRAINER_ROUTES.HelpFAQ, ScreenComponent: TrainerHelpFAQScreen },
  { routeName: TRAINER_ROUTES.Terms, ScreenComponent: TrainerTermsScreen },
  { routeName: TRAINER_ROUTES.Privacy, ScreenComponent: TrainerPrivacyScreen },
  { routeName: TRAINER_ROUTES.ContactSupport, ScreenComponent: TrainerContactSupportScreen },
  { routeName: TRAINER_ROUTES.BugReport, ScreenComponent: TrainerBugReportScreen },
  { routeName: TRAINER_ROUTES.Nutrition, ScreenComponent: TrainerDailyFoodLogScreen },
  { routeName: TRAINER_ROUTES.VoiceAI, ScreenComponent: TrainerVoiceAIScreen },
  { routeName: TRAINER_ROUTES.AIChat, ScreenComponent: TrainerVoiceAIScreen },
  { routeName: TRAINER_ROUTES.TrainerSearch, ScreenComponent: SearchTrainersScreenOverlay },
  { routeName: TRAINER_ROUTES.WeeklyReport, ScreenComponent: TrainerWeeklyReportScreenOverlay },
  { routeName: TRAINER_ROUTES.WorkoutPlan, ScreenComponent: TrainerWorkoutPlanScreen },
  { routeName: TRAINER_ROUTES.ManualPlanBuilder, ScreenComponent: TrainerManualPlanBuilderScreen },
  { routeName: TRAINER_ROUTES.Payments, ScreenComponent: TrainerEarningsScreen },
];

// ===== HELPER FUNCTIONS =====

/**
 * One overlay Stack.Screen entry with the shared slide options.
 * @param {{ routeName: string, ScreenComponent: Function }} entry
 * @returns {import('react').ReactElement}
 */
function renderOverlayScreen({ routeName, ScreenComponent }) {
  return (
    <Stack.Screen
      key={routeName}
      name={routeName}
      component={ScreenComponent}
      options={overlayScreenOptions}
    />
  );
}

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
      {TRAINER_OVERLAY_SCREENS.map(renderOverlayScreen)}
    </Stack.Navigator>
  );
}
