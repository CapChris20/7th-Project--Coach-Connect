// The master list of React Navigation screen names, split by which app shell owns them.
// Flow: navigators register screens under these names → navigate()/linking look screens up by the same strings.
// Used everywhere we navigate, so nobody has to hand-type a route string and typo it silently.
// Key exports: CLIENT_ROUTES, TRAINER_ROUTES

// Why the values are prefixed ('ClientProfile', 'TrainerProfile'): client and trainer stacks can both
// be registered at once, and React Navigation route names must be globally unique — the prefix is what
// keeps "Profile" in one shell from hijacking "Profile" in the other.
//
// Manipulate here: the KEY (left) is the nickname your code uses; the VALUE (right) is the real
// registered route name. Renaming a value means updating the navigator that registers it AND any deep
// link path in linking.js — these strings are also what deep links resolve to, so keep them stable.

export const CLIENT_ROUTES = {
  // MainTabs is the tab container; the five names under it are the tabs living inside it.
  MainTabs: 'ClientMainTabs',
  Home: 'ClientHome',
  Dashboard: 'ClientDashboard',
  Files: 'ClientFiles',
  Nutrition: 'ClientNutrition',
  AI: 'ClientAI',
  // Everything below is pushed on top of the tabs as a full screen rather than living in the tab bar.
  Profile: 'ClientProfile',
  Settings: 'ClientSettings',
  HelpFAQ: 'ClientHelpFAQ',
  Terms: 'ClientTerms',
  Privacy: 'ClientPrivacy',
  ContactSupport: 'ClientContactSupport',
  BugReport: 'ClientBugReport',
  WorkoutPlan: 'ClientWorkoutPlan',
  TrainerSearch: 'ClientTrainerSearch',
  TrainerProfile: 'ClientTrainerProfile',
  WeeklyReport: 'ClientWeeklyReport',
  PhotoGallery: 'ClientPhotoGallery',
  AIWorkouts: 'ClientAIWorkouts',
  PlanViewer: 'ClientPlanViewer',
  AIChat: 'ClientAIChat',
};

export const TRAINER_ROUTES = {
  // Main is the trainer hub (their equivalent of the client's tab container).
  Main: 'TrainerMain',
  Profile: 'TrainerProfile',
  Settings: 'TrainerSettings',
  HelpFAQ: 'TrainerHelpFAQ',
  Terms: 'TrainerTerms',
  Privacy: 'TrainerPrivacy',
  ContactSupport: 'TrainerContactSupport',
  BugReport: 'TrainerBugReport',
  Nutrition: 'TrainerNutrition',
  VoiceAI: 'TrainerVoiceAI',
  TrainerSearch: 'TrainerSearch',
  WeeklyReport: 'TrainerWeeklyReport',
  WorkoutPlan: 'TrainerWorkoutPlan',
  ManualPlanBuilder: 'TrainerManualPlanBuilder',
  AIChat: 'TrainerAIChat',
  PhotoGallery: 'TrainerPhotoGallery',
  AIWorkouts: 'TrainerAIWorkouts',
  WorkoutGenerator: 'TrainerWorkoutGenerator',
  PlanViewer: 'TrainerPlanViewer',
  Payments: 'TrainerPayments',
};
