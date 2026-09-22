// Top-level route table for the client (trainee) side of the app.
// Flow: ClientMainScreen (the bottom-tab shell) is the base screen; every other route is pushed
// on top of it as a full-screen overlay (profile, workout plan, coach chat, progress photos, …).
// Where used: mounted once by the client app root, after we know the signed-in user is a client.
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

// vocab: native stack = navigation backed by the platform's real navigator (UINavigationController
// on iOS), so pushes/pops animate on the native thread instead of in JS. Created once at module
// scope — building it inside the component would reset the whole navigation tree on every render.
const Stack = createNativeStackNavigator();

// Shared options applied to every pushed screen, so all client overlays feel identical.
// Manipulate here:
//   presentation 'card' = pushes in from the side like a normal screen. 'modal' gives the iOS
//     sheet-from-bottom look; 'transparentModal' lets the screen below show through.
//   animation 'slide_from_right' = the push transition ('none' / 'fade' are the alternatives).
//   headerShown false because each screen draws its own custom header.
const modalOptions = {
  presentation: 'card',
  animation: 'slide_from_right',
  headerShown: false,
};

export default function ClientRootNavigator() {
  return (
    // screenOptions sets the default for every child; a Screen's own `options` overrides it.
    // initialRouteName is the tab shell, so backing out of any overlay always lands on the
    // client's tabs instead of an empty stack.
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      initialRouteName={CLIENT_ROUTES.MainTabs}
    >
      {/* Base screen: the bottom-tab shell. No modalOptions on purpose — it's what the overlays
          are pushed on top of, not an overlay itself.
          Route names come from CLIENT_ROUTES (shared constants) instead of raw strings, so a typo
          shows up as undefined rather than a silent "route not found" at runtime. */}
      <Stack.Screen name={CLIENT_ROUTES.MainTabs} component={ClientMainScreen} />
      {/* Everything below is a pushed overlay screen sharing modalOptions.
          To add a client route: add the key to CLIENT_ROUTES, export the screen from
          clientOverlayScreens, then add one line here. */}
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
      {/* Two-step AI coach flow: `AI` is the entry/landing screen, `AIChat` is the live
          conversation. They're separate routes so the back gesture returns to the launcher. */}
      <Stack.Screen name={CLIENT_ROUTES.AI} component={ClientStartCoachChatScreen} options={modalOptions} />
      <Stack.Screen name={CLIENT_ROUTES.AIChat} component={ClientChatWithCoachScreen} options={modalOptions} />
      {/* Internal QA harness for the AI coach. The name is a raw string rather than a
          CLIENT_ROUTES key because nothing in the product UI links here — it's reached
          manually during development. */}
      <Stack.Screen
        name="ClientAICoachTests"
        component={ClientAICoachTestScreen}
        options={modalOptions}
      />
    </Stack.Navigator>
  );
}
