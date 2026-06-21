/**
 * Client Root Navigator
 *
 * Purpose: Client Root Navigator — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: ClientRootNavigator
 *
 * @file-header
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CLIENT_ROUTES } from '../../navigation/routes';
import ClientMainScreen from './ClientMainScreen';
import {
  ClientViewMyViewMyProfileScreen,
  ClientSettingsScreen,
  ClientHelpFAQScreen,
  ClientTermsScreen,
  ClientPrivacyScreen,
  ClientContactSupportScreen,
  ClientBugReportScreen,
  ClientNutritionScreen,
  ClientWorkoutPlanScreen,
  ClientSearchTrainersScreen,
  ClientTrainerViewMyViewMyProfileScreen,
  ClientViewWeekProgressReportScreen,
  ClientMyProgressPhotosScreen,
  ClientAIWorkoutsScreen,
  ClientViewMyWorkoutPlanScreen,
  ClientStartCoachChatScreen,
  ClientChatWithCoachScreen,
  ClientAICoachTestScreen,
} from './clientOverlayScreens';

const Stack = createNativeStackNavigator();

const modalOptions = {
  presentation: 'card',
  animation: 'slide_from_right',
  headerShown: false,
};

export default function ClientRootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      initialRouteName={CLIENT_ROUTES.MainTabs}
    >
      <Stack.Screen name={CLIENT_ROUTES.MainTabs} component={ClientMainScreen} />
      <Stack.Screen name={CLIENT_ROUTES.Profile} component={ClientViewMyViewMyProfileScreen} options={modalOptions} />
      <Stack.Screen name={CLIENT_ROUTES.Settings} component={ClientSettingsScreen} options={modalOptions} />
      <Stack.Screen name={CLIENT_ROUTES.HelpFAQ} component={ClientHelpFAQScreen} options={modalOptions} />
      <Stack.Screen name={CLIENT_ROUTES.Terms} component={ClientTermsScreen} options={modalOptions} />
      <Stack.Screen name={CLIENT_ROUTES.Privacy} component={ClientPrivacyScreen} options={modalOptions} />
      <Stack.Screen
        name={CLIENT_ROUTES.ContactSupport}
        component={ClientContactSupportScreen}
        options={modalOptions}
      />
      <Stack.Screen name={CLIENT_ROUTES.BugReport} component={ClientBugReportScreen} options={modalOptions} />
      <Stack.Screen name={CLIENT_ROUTES.Nutrition} component={ClientNutritionScreen} options={modalOptions} />
      <Stack.Screen name={CLIENT_ROUTES.WorkoutPlan} component={ClientWorkoutPlanScreen} options={modalOptions} />
      <Stack.Screen name={CLIENT_ROUTES.TrainerSearch} component={ClientSearchTrainersScreen} options={modalOptions} />
      <Stack.Screen
        name={CLIENT_ROUTES.TrainerProfile}
        component={ClientTrainerViewMyViewMyProfileScreen}
        options={modalOptions}
      />
      <Stack.Screen name={CLIENT_ROUTES.WeeklyReport} component={ClientViewWeekProgressReportScreen} options={modalOptions} />
      <Stack.Screen name={CLIENT_ROUTES.PhotoGallery} component={ClientMyProgressPhotosScreen} options={modalOptions} />
      <Stack.Screen name={CLIENT_ROUTES.AIWorkouts} component={ClientAIWorkoutsScreen} options={modalOptions} />
      <Stack.Screen name={CLIENT_ROUTES.PlanViewer} component={ClientViewMyWorkoutPlanScreen} options={modalOptions} />
      <Stack.Screen name={CLIENT_ROUTES.AI} component={ClientStartCoachChatScreen} options={modalOptions} />
      <Stack.Screen name={CLIENT_ROUTES.AIChat} component={ClientChatWithCoachScreen} options={modalOptions} />
      <Stack.Screen
        name="ClientAICoachTests"
        component={ClientAICoachTestScreen}
        options={modalOptions}
      />
    </Stack.Navigator>
  );
}
