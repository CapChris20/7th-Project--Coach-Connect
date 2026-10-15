// Top-level route table for the client side of the app.
// Flow: the tab shell is the base screen → every other route pushes on top of it.
// Used by the client app root after we know the signed-in user is a client.

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
  ClientDailyFoodLogScreen,
  ClientWorkoutPlanScreen,
  ClientSearchTrainersScreen,
  ClientTrainerViewMyMyProfileScreen,
  ClientWeeklyReportScreen,
  ClientMyProgressPhotosScreen,
  ClientAIWorkoutsScreen,
  ClientMyWorkoutPlanScreen,
  ClientCoachHomeScreen,
  ClientCoachConversationScreen,
  ClientAICoachTestScreen,
} from './clientExtraScreens';

// ===== NAMED CONSTANTS =====

const Stack = createNativeStackNavigator();

const STACK_PRESENTATION_CARD = 'card';
const STACK_ANIMATION_SLIDE_FROM_RIGHT = 'slide_from_right';
const QA_COACH_TEST_ROUTE = 'ClientAICoachTests';

const modalOptions = {
  presentation: STACK_PRESENTATION_CARD,
  animation: STACK_ANIMATION_SLIDE_FROM_RIGHT,
  headerShown: false,
};

// ===== HELPER FUNCTIONS =====

function pushedClientScreen(routeName, ScreenComponent) {
  return <Stack.Screen name={routeName} component={ScreenComponent} options={modalOptions} />;
}

// ===== MAIN FUNCTION =====

export default function ClientScreenList() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: STACK_ANIMATION_SLIDE_FROM_RIGHT }}
      initialRouteName={CLIENT_ROUTES.MainTabs}
    >
      <Stack.Screen name={CLIENT_ROUTES.MainTabs} component={ClientMainScreen} />
      {pushedClientScreen(CLIENT_ROUTES.Profile, ClientViewMyMyProfileScreen)}
      {pushedClientScreen(CLIENT_ROUTES.Settings, ClientSettingsScreen)}
      {pushedClientScreen(CLIENT_ROUTES.HelpFAQ, ClientHelpFAQScreen)}
      {pushedClientScreen(CLIENT_ROUTES.Terms, ClientTermsScreen)}
      {pushedClientScreen(CLIENT_ROUTES.Privacy, ClientPrivacyScreen)}
      {pushedClientScreen(CLIENT_ROUTES.ContactSupport, ClientContactSupportScreen)}
      {pushedClientScreen(CLIENT_ROUTES.BugReport, ClientBugReportScreen)}
      {pushedClientScreen(CLIENT_ROUTES.Nutrition, ClientDailyFoodLogScreen)}
      {pushedClientScreen(CLIENT_ROUTES.WorkoutPlan, ClientWorkoutPlanScreen)}
      {pushedClientScreen(CLIENT_ROUTES.TrainerSearch, ClientSearchTrainersScreen)}
      {pushedClientScreen(CLIENT_ROUTES.TrainerProfile, ClientTrainerViewMyMyProfileScreen)}
      {pushedClientScreen(CLIENT_ROUTES.WeeklyReport, ClientWeeklyReportScreen)}
      {pushedClientScreen(CLIENT_ROUTES.PhotoGallery, ClientMyProgressPhotosScreen)}
      {pushedClientScreen(CLIENT_ROUTES.AIWorkouts, ClientAIWorkoutsScreen)}
      {pushedClientScreen(CLIENT_ROUTES.PlanViewer, ClientMyWorkoutPlanScreen)}
      {pushedClientScreen(CLIENT_ROUTES.AI, ClientCoachHomeScreen)}
      {pushedClientScreen(CLIENT_ROUTES.AIChat, ClientCoachConversationScreen)}
      {pushedClientScreen(QA_COACH_TEST_ROUTE, ClientAICoachTestScreen)}
    </Stack.Navigator>
  );
}
