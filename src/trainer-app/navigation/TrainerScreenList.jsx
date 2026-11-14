// The trainer native stack: tab shell at the bottom, every other screen slides on top.
// Flow: build overlay Screen list → mount Stack.Navigator with Main as the home route.
// Used once by the trainer app root after we know the signed-in user is a trainer.
// Read order: constants → helpers that build Screen nodes → main navigator → PLUMBING.

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
  TrainerPrivacyDataRightsScreen,
  TrainerDailyFoodLogScreen,
  TrainerVoiceAIScreen,
  SearchTrainersScreenOverlay,
  TrainerWeeklyReportScreenOverlay,
  TrainerWorkoutPlanScreen,
  TrainerManualPlanBuilderScreen,
  TrainerEarningsScreen,
  TrainerNotificationsScreen,
} from './trainerExtraScreens';

// ===== NAMED CONSTANTS =====

// vocab: createNativeStackNavigator = phone-native stack (slide is OS-drawn, not JS)
const Stack = createNativeStackNavigator();

// Manipulate here: card + slide_from_right matches Design Law trainer overlay transitions
const OVERLAY_PRESENTATION = 'card';
const OVERLAY_ANIMATION = 'slide_from_right';

const OVERLAY_SCREEN_OPTIONS = {
  presentation: OVERLAY_PRESENTATION,
  animation: OVERLAY_ANIMATION,
  headerShown: false,
};

const NAVIGATOR_SCREEN_OPTIONS = {
  headerShown: false,
  animation: OVERLAY_ANIMATION,
};

// Full-screen overlays on top of Main. Voice AI and AI chat share one component.
const TRAINER_OVERLAY_SCREENS = [
  { routeName: TRAINER_ROUTES.Profile, ScreenComponent: TrainerViewMyMyProfileScreen },
  { routeName: TRAINER_ROUTES.Settings, ScreenComponent: TrainerSettingsScreen },
  { routeName: TRAINER_ROUTES.HelpFAQ, ScreenComponent: TrainerHelpFAQScreen },
  { routeName: TRAINER_ROUTES.Terms, ScreenComponent: TrainerTermsScreen },
  { routeName: TRAINER_ROUTES.Privacy, ScreenComponent: TrainerPrivacyScreen },
  { routeName: TRAINER_ROUTES.ContactSupport, ScreenComponent: TrainerContactSupportScreen },
  { routeName: TRAINER_ROUTES.BugReport, ScreenComponent: TrainerBugReportScreen },
  { routeName: TRAINER_ROUTES.PrivacyDataRights, ScreenComponent: TrainerPrivacyDataRightsScreen },
  { routeName: TRAINER_ROUTES.Nutrition, ScreenComponent: TrainerDailyFoodLogScreen },
  { routeName: TRAINER_ROUTES.VoiceAI, ScreenComponent: TrainerVoiceAIScreen },
  { routeName: TRAINER_ROUTES.AIChat, ScreenComponent: TrainerVoiceAIScreen },
  { routeName: TRAINER_ROUTES.TrainerSearch, ScreenComponent: SearchTrainersScreenOverlay },
  { routeName: TRAINER_ROUTES.WeeklyReport, ScreenComponent: TrainerWeeklyReportScreenOverlay },
  { routeName: TRAINER_ROUTES.WorkoutPlan, ScreenComponent: TrainerWorkoutPlanScreen },
  { routeName: TRAINER_ROUTES.ManualPlanBuilder, ScreenComponent: TrainerManualPlanBuilderScreen },
  { routeName: TRAINER_ROUTES.Payments, ScreenComponent: TrainerEarningsScreen },
  { routeName: TRAINER_ROUTES.Notifications, ScreenComponent: TrainerNotificationsScreen },
];

// ===== HELPER FUNCTIONS =====

/**
 * One overlay Stack.Screen with the shared slide options.
 * @param {{ routeName: string, ScreenComponent: Function }} overlayEntry
 * @returns {import('react').ReactElement}
 */
function makeOverlayStackScreen(overlayEntry) {
  const routeName = overlayEntry.routeName;
  const ScreenComponent = overlayEntry.ScreenComponent;
  return (
    <Stack.Screen
      key={routeName}
      name={routeName}
      component={ScreenComponent}
      options={OVERLAY_SCREEN_OPTIONS}
    />
  );
}

/**
 * Turn the overlay table into Stack.Screen elements (no .map in the main recipe).
 * @param {Array<{ routeName: string, ScreenComponent: Function }>} overlayTable
 * @returns {import('react').ReactElement[]}
 */
function buildOverlayStackScreens(overlayTable) {
  const screenElements = [];
  for (let index = 0; index < overlayTable.length; index += 1) {
    const overlayEntry = overlayTable[index];
    screenElements.push(makeOverlayStackScreen(overlayEntry));
  }
  return screenElements;
}

/**
 * Hub tabs Screen — always the bottom route of the trainer stack.
 * @returns {import('react').ReactElement}
 */
function makeMainTabStackScreen() {
  return (
    <Stack.Screen name={TRAINER_ROUTES.Main} component={TrainerMainScreen} />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Trainer stack navigator. Main (tabs) is the base; overlays slide on top.
 * Voice AI and AI chat share one screen; that screen picks mode from the route name.
 * @returns {import('react').ReactElement}
 */
export default function TrainerScreenList() {
  // 1. Build every overlay Screen node from the route table.
  const overlayStackScreens = buildOverlayStackScreens(TRAINER_OVERLAY_SCREENS);

  // 2. Hub tabs stay at the bottom (initialRouteName = Main).
  const mainTabScreen = makeMainTabStackScreen();

  // 3. Mount the native stack with shared slide animation.
  return (
    <Stack.Navigator
      screenOptions={NAVIGATOR_SCREEN_OPTIONS}
      initialRouteName={TRAINER_ROUTES.Main}
    >
      {mainTabScreen}
      {overlayStackScreens}
    </Stack.Navigator>
  );
}

// ===== PLUMBING — skip unless debugging stack registration =====
// Overlay table + Screen factory live above; nothing heavier needed here.
