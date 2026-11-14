// Top-level route table for the client side of the app.
// Flow: MainTabs is the root → every other CLIENT_ROUTES entry is a pushed card screen.
// Used by ClientAppStart after we know the signed-in user is a client.
// Route name strings (CLIENT_ROUTES.*) must stay exactly as the stack registers them.

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CLIENT_ROUTES } from '../../navigation/screenNames';
import ClientMainScreen from './ClientMainScreen';
import {
  ClientViewMyMyProfileScreen,
  ClientSettingsScreen,
  ClientHelpFAQScreen,
  ClientTermsScreen,
  ClientPrivacyScreen,
  ClientContactSupportScreen,
  ClientBugReportScreen,
  ClientPrivacyDataRightsScreen,
  ClientDailyFoodLogScreen,
  ClientWorkoutPlanScreen,
  ClientSearchTrainersScreen,
  ClientTrainerViewMyMyProfileScreen,
  ClientWeeklyReportScreen,
  ClientMyProgressPhotosScreen,
  ClientProgressChartsScreen,
  ClientLogWorkoutScreen,
  ClientDailyCheckInScreen,
  ClientMoodCheckInScreen,
  ClientWeeklyMomentumScreen,
  ClientNotificationsScreen,
  ClientAIWorkoutsScreen,
  ClientMyWorkoutPlanScreen,
  ClientWorkoutSessionScreen,
  ClientMySessionsScreen,
  ClientRequestSessionScreen,
  ClientCoachHomeScreen,
  ClientCoachConversationScreen,
  ClientAICoachTestScreen,
} from './clientExtraScreens';
import NbComponentsPreview from '../../look-and-feel/NbComponentsPreview';

// ===== NAMED CONSTANTS =====

// vocab: createNativeStackNavigator = React Navigation native stack factory
const Stack = createNativeStackNavigator();

const PUSH_PRESENTATION = 'card';
const PUSH_ANIMATION = 'slide_from_right';

// QA-only routes (not in CLIENT_ROUTES) — keep the string letters frozen.
const QA_ROUTE_AI_COACH_TESTS = 'ClientAICoachTests';
const QA_ROUTE_NB_PREVIEW = 'ClientNbComponentsPreview';

const pushedScreenOptions = {
  presentation: PUSH_PRESENTATION,
  animation: PUSH_ANIMATION,
  headerShown: false,
};

const rootNavigatorOptions = {
  headerShown: false,
  animation: PUSH_ANIMATION,
};

/**
 * Each row: stack route name → wrapper component from clientExtraScreens.jsx.
 * Order does not affect navigation; names must match goToClientScreen / CLIENT_ROUTES.
 */
const CLIENT_PUSHED_SCREENS = [
  { routeName: CLIENT_ROUTES.Profile, ScreenComponent: ClientViewMyMyProfileScreen },
  { routeName: CLIENT_ROUTES.Settings, ScreenComponent: ClientSettingsScreen },
  { routeName: CLIENT_ROUTES.HelpFAQ, ScreenComponent: ClientHelpFAQScreen },
  { routeName: CLIENT_ROUTES.Terms, ScreenComponent: ClientTermsScreen },
  { routeName: CLIENT_ROUTES.Privacy, ScreenComponent: ClientPrivacyScreen },
  { routeName: CLIENT_ROUTES.ContactSupport, ScreenComponent: ClientContactSupportScreen },
  { routeName: CLIENT_ROUTES.BugReport, ScreenComponent: ClientBugReportScreen },
  { routeName: CLIENT_ROUTES.PrivacyDataRights, ScreenComponent: ClientPrivacyDataRightsScreen },
  { routeName: CLIENT_ROUTES.Nutrition, ScreenComponent: ClientDailyFoodLogScreen },
  { routeName: CLIENT_ROUTES.WorkoutPlan, ScreenComponent: ClientWorkoutPlanScreen },
  { routeName: CLIENT_ROUTES.TrainerSearch, ScreenComponent: ClientSearchTrainersScreen },
  { routeName: CLIENT_ROUTES.TrainerProfile, ScreenComponent: ClientTrainerViewMyMyProfileScreen },
  { routeName: CLIENT_ROUTES.WeeklyReport, ScreenComponent: ClientWeeklyReportScreen },
  { routeName: CLIENT_ROUTES.PhotoGallery, ScreenComponent: ClientMyProgressPhotosScreen },
  { routeName: CLIENT_ROUTES.ProgressCharts, ScreenComponent: ClientProgressChartsScreen },
  { routeName: CLIENT_ROUTES.LogWorkout, ScreenComponent: ClientLogWorkoutScreen },
  { routeName: CLIENT_ROUTES.DailyCheckIn, ScreenComponent: ClientDailyCheckInScreen },
  { routeName: CLIENT_ROUTES.MoodCheckIn, ScreenComponent: ClientMoodCheckInScreen },
  { routeName: CLIENT_ROUTES.WeeklyMomentum, ScreenComponent: ClientWeeklyMomentumScreen },
  { routeName: CLIENT_ROUTES.Notifications, ScreenComponent: ClientNotificationsScreen },
  { routeName: CLIENT_ROUTES.AIWorkouts, ScreenComponent: ClientAIWorkoutsScreen },
  { routeName: CLIENT_ROUTES.PlanViewer, ScreenComponent: ClientMyWorkoutPlanScreen },
  { routeName: CLIENT_ROUTES.WorkoutSession, ScreenComponent: ClientWorkoutSessionScreen },
  { routeName: CLIENT_ROUTES.MySessions, ScreenComponent: ClientMySessionsScreen },
  { routeName: CLIENT_ROUTES.RequestSession, ScreenComponent: ClientRequestSessionScreen },
  { routeName: CLIENT_ROUTES.AI, ScreenComponent: ClientCoachHomeScreen },
  { routeName: CLIENT_ROUTES.AIChat, ScreenComponent: ClientCoachConversationScreen },
  { routeName: QA_ROUTE_AI_COACH_TESTS, ScreenComponent: ClientAICoachTestScreen },
  { routeName: QA_ROUTE_NB_PREVIEW, ScreenComponent: NbComponentsPreview },
];

// ===== HELPER FUNCTIONS =====

/**
 * One pushed card route. Shared options: slide from right, no native header.
 */
function PushedClientRoute({ routeName, ScreenComponent }) {
  return (
    <Stack.Screen
      name={routeName}
      component={ScreenComponent}
      options={pushedScreenOptions}
    />
  );
}

/**
 * Build the list of Stack.Screen nodes for every pushed route.
 * Kept out of the main return so the navigator reads as a short recipe.
 */
function buildPushedRouteScreens() {
  const routeScreens = [];
  let routeIndex = 0;
  while (routeIndex < CLIENT_PUSHED_SCREENS.length) {
    const routeEntry = CLIENT_PUSHED_SCREENS[routeIndex];
    const routeName = routeEntry.routeName;
    const ScreenComponent = routeEntry.ScreenComponent;
    routeScreens.push(
      <PushedClientRoute
        key={routeName}
        routeName={routeName}
        ScreenComponent={ScreenComponent}
      />,
    );
    routeIndex += 1;
  }
  return routeScreens;
}

// ===== MAIN FUNCTION =====

/**
 * Client root stack: MainTabs first, then every overlay screen as a card push.
 * Flow: 1. build pushed routes  2. paint navigator with MainTabs as initial
 */
export default function ClientScreenList() {
  // 1. Materialize pushed Stack.Screen nodes from the route table.
  const pushedRouteScreens = buildPushedRouteScreens();

  // 2. Root stays on the tab shell; overlays slide in from the right.
  return (
    <Stack.Navigator
      screenOptions={rootNavigatorOptions}
      initialRouteName={CLIENT_ROUTES.MainTabs}
    >
      <Stack.Screen name={CLIENT_ROUTES.MainTabs} component={ClientMainScreen} />
      {pushedRouteScreens}
    </Stack.Navigator>
  );
}
