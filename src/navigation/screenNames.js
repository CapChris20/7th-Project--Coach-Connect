// React Navigation route names for the client app and the trainer app.
// Flow: navigators register these strings → navigate() and web links look up the same strings.
// Used by every screen change, so a route name is written once instead of typed by hand.

// ===== NAMED CONSTANTS =====

// The value is prefixed because both shells can be registered at once. React Navigation route
// names are global, so "Profile" in the client app would otherwise collide with the trainer one.
// Manipulate here: the key is the nickname code uses. The value is the registered route.
// Changing a value means updating the navigator that registers it and the deep link in webLinks.js.

export const CLIENT_ROUTES = {
  // MainTabs is the tab container. The five names under it are the tabs inside that container.
  MainTabs: 'ClientMainTabs',
  Home: 'ClientHome',
  Dashboard: 'ClientDashboard',
  Files: 'ClientFiles',
  Nutrition: 'ClientNutrition',
  AI: 'ClientAI',
  // Everything below is pushed on top of the tabs as a full screen, not a tab.
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
  // Main is the trainer hub, their equivalent of the client's tab container.
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

// ===== HELPER FUNCTIONS =====
// Route tables only. Nothing here is computed.

// ===== MAIN FUNCTION =====
// Screens import CLIENT_ROUTES and TRAINER_ROUTES directly.
