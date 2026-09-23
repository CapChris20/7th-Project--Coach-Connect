// Top-level route table for the trainer side of the app.
// Flow: TrainerMainScreen (the tab shell) is the base screen; every other route is pushed on top
// of it as a full-screen "overlay" (profile, settings, payments, plan builder, …).
// Where used: mounted once by the trainer app root, after we know the signed-in user is a trainer.
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

// vocab: native stack = navigation backed by the platform's real navigator (UINavigationController
// on iOS), so pushes/pops animate on the native thread instead of in JS. Created once at module
// scope — building it inside the component would reset the whole navigation tree on every render.
const Stack = createNativeStackNavigator();

// Shared options applied to every pushed screen. Kept as one object so all overlays animate
// identically; if these drifted per-screen the app would feel inconsistent.
// Manipulate here:
//   presentation 'card' = pushes in from the side like a normal screen. Switch to 'modal' for
//     the iOS sheet-from-bottom look, or 'transparentModal' to see the screen underneath.
//   animation 'slide_from_right' = the push transition. 'none' disables it, 'fade' cross-fades.
//   headerShown false because each screen draws its own custom header.
const modalOptions = {
  presentation: 'card',
  animation: 'slide_from_right',
  headerShown: false,
};

export default function TrainerScreenList() {
  return (
    // screenOptions is the default for every child; `options` on an individual Screen overrides it.
    // initialRouteName decides which screen is at the bottom of the back stack — the tab shell,
    // so backing out of any overlay always lands on the trainer's tabs rather than a blank screen.
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
      initialRouteName={TRAINER_ROUTES.Main}
    >
      {/* Base screen: the bottom-tab shell. Deliberately has NO modalOptions — it isn't an
          overlay, it's the thing overlays sit on top of.
          Every route name comes from TRAINER_ROUTES (a shared constants map) rather than a raw
          string, so a typo is a build-time undefined instead of a silent "route not found". */}
      <Stack.Screen name={TRAINER_ROUTES.Main} component={TrainerMainScreen} />
      {/* Everything below is a pushed overlay screen, all sharing modalOptions.
          To add a trainer route: add the key to TRAINER_ROUTES, export the screen from
          trainerExtraScreens, then add one line here. */}
      <Stack.Screen name={TRAINER_ROUTES.Profile} component={TrainerViewMyMyProfileScreen} options={modalOptions} />
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
      <Stack.Screen name={TRAINER_ROUTES.Nutrition} component={TrainerDailyFoodLogScreen} options={modalOptions} />
      {/* VoiceAI and AIChat intentionally point at the SAME component — two entry points (voice
          button vs chat button) into one AI screen, which decides its own mode from the route. */}
      <Stack.Screen name={TRAINER_ROUTES.VoiceAI} component={TrainerVoiceAIScreen} options={modalOptions} />
      <Stack.Screen name={TRAINER_ROUTES.AIChat} component={TrainerVoiceAIScreen} options={modalOptions} />
      <Stack.Screen name={TRAINER_ROUTES.TrainerSearch} component={SearchTrainersScreenOverlay} options={modalOptions} />
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
      <Stack.Screen name={TRAINER_ROUTES.Payments} component={TrainerEarningsScreen} options={modalOptions} />
    </Stack.Navigator>
  );
}
