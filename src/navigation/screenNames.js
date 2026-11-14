// React Navigation route names for the client app and the trainer app.
// Flow: navigators register these strings → navigate() and webLinks look up the same strings.
// Used by every screen change so a route name is written once instead of typed by hand.
// Key exports: CLIENT_ROUTES, TRAINER_ROUTES — keys and values are frozen (freeze list).

// ===== NAMED CONSTANTS =====

// The value is prefixed because both shells can register at once. React Navigation route names
// are global, so "Profile" in the client app would otherwise collide with the trainer one.
// Manipulate here: the key is the nickname code uses. The value is the registered route string.
// Changing a value means updating the navigator that registers it and the deep link in webLinks.js.

// ===== HELPER FUNCTIONS =====

/**
 * Client tab container plus the five tabs inside MainTabs.
 * @returns {object}
 */
function buildClientTabRoutes() {
  return {
    // MainTabs is the tab container. The five names under it are the tabs inside that container.
    MainTabs: 'ClientMainTabs',
    Home: 'ClientHome',
    Dashboard: 'ClientDashboard',
    Files: 'ClientFiles',
    Nutrition: 'ClientNutrition',
    AI: 'ClientAI',
  };
}

/**
 * Client full screens pushed on top of the tab stack (not tabs).
 * @returns {object}
 */
function buildClientPushedRoutes() {
  return {
    Profile: 'ClientProfile',
    Settings: 'ClientSettings',
    HelpFAQ: 'ClientHelpFAQ',
    Terms: 'ClientTerms',
    Privacy: 'ClientPrivacy',
    ContactSupport: 'ClientContactSupport',
    BugReport: 'ClientBugReport',
    PrivacyDataRights: 'ClientPrivacyDataRights',
    WorkoutPlan: 'ClientWorkoutPlan',
    TrainerSearch: 'ClientTrainerSearch',
    TrainerProfile: 'ClientTrainerProfile',
    WeeklyReport: 'ClientWeeklyReport',
    PhotoGallery: 'ClientPhotoGallery',
    // Design Law Progress charts (Weight / Body fat / Lifts) — separate from PhotoGallery
    ProgressCharts: 'ClientProgressCharts',
    Notifications: 'ClientNotifications',
    AIWorkouts: 'ClientAIWorkouts',
    PlanViewer: 'ClientPlanViewer',
    // Design Law session mode (log set + rest) — opened from My workout plan Start session
    WorkoutSession: 'ClientWorkoutSession',
    // Design Law client scheduling (My sessions + Request)
    MySessions: 'ClientMySessions',
    RequestSession: 'ClientRequestSession',
    AIChat: 'ClientAIChat',
    // Design Law Batch 1 gap screens (missing-screens)
    LogWorkout: 'ClientLogWorkout',
    DailyCheckIn: 'ClientDailyCheckIn',
    MoodCheckIn: 'ClientMoodCheckIn',
    WeeklyMomentum: 'ClientWeeklyMomentum',
  };
}

/**
 * Merge tab routes and pushed routes into one lookup table.
 * @returns {object}
 */
function buildClientRouteTable() {
  const tabRoutes = buildClientTabRoutes();
  const pushedRoutes = buildClientPushedRoutes();
  return Object.assign({}, tabRoutes, pushedRoutes);
}

/**
 * Trainer hub route — their equivalent of the client's tab container.
 * @returns {object}
 */
function buildTrainerHubRoute() {
  return {
    Main: 'TrainerMain',
  };
}

/**
 * Trainer full screens pushed on top of the hub.
 * @returns {object}
 */
function buildTrainerPushedRoutes() {
  return {
    Profile: 'TrainerProfile',
    Settings: 'TrainerSettings',
    HelpFAQ: 'TrainerHelpFAQ',
    Terms: 'TrainerTerms',
    Privacy: 'TrainerPrivacy',
    ContactSupport: 'TrainerContactSupport',
    BugReport: 'TrainerBugReport',
    PrivacyDataRights: 'TrainerPrivacyDataRights',
    Nutrition: 'TrainerNutrition',
    VoiceAI: 'TrainerVoiceAI',
    TrainerSearch: 'TrainerSearch',
    WeeklyReport: 'TrainerWeeklyReport',
    WorkoutPlan: 'TrainerWorkoutPlan',
    ManualPlanBuilder: 'TrainerManualPlanBuilder',
    AIChat: 'TrainerAIChat',
    PhotoGallery: 'TrainerPhotoGallery',
    Notifications: 'TrainerNotifications',
    AIWorkouts: 'TrainerAIWorkouts',
    WorkoutGenerator: 'TrainerWorkoutGenerator',
    PlanViewer: 'TrainerPlanViewer',
    Payments: 'TrainerPayments',
  };
}

/**
 * Merge hub + pushed routes into one trainer lookup table.
 * @returns {object}
 */
function buildTrainerRouteTable() {
  const hubRoute = buildTrainerHubRoute();
  const pushedRoutes = buildTrainerPushedRoutes();
  return Object.assign({}, hubRoute, pushedRoutes);
}

// ===== MAIN FUNCTION =====

// Merged lookup table screens import as CLIENT_ROUTES.
export const CLIENT_ROUTES = buildClientRouteTable();

// Merged lookup table screens import as TRAINER_ROUTES.
export const TRAINER_ROUTES = buildTrainerRouteTable();
