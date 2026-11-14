// Client app navigation: which main tab is open, plus overlay flags for chat, files, and AI.
// Flow: bottom-nav keywords stay on MainTabs → full screens use rootNavigate → overlays are useState flags.
// Used by ClientMainScreen / ClientAppStart. Route name strings (CLIENT_ROUTES.*) must stay as registered.

import { useCallback, useState } from 'react';
import { CommonActions } from '@react-navigation/native';
import { CLIENT_ROUTES } from '../../navigation/screenNames';
import { rootGoBack, rootNavigate, rootNavigationRef, rootResetTo } from '../../navigation/openScreenFromAnywhere';

// ===== NAMED CONSTANTS =====

/** Primary bottom-nav destinations stay on MainTabs (not stack) so the tab bar stays visible. */
export const CLIENT_MAIN_TABS = {
  home: 'home',
  nutrition: 'nutrition',
  workout: 'workout',
  ai: 'ai',
};

// Keyword strings BottomMenuBar / onNavigate pass in — letters frozen.
const NAV_KEYWORD_HOME = 'home';
const NAV_KEYWORD_PROFILE = 'profile';
const NAV_KEYWORD_PROFILE_LEGACY = 'ViewMyMyProfileScreen';
const NAV_KEYWORD_SETTINGS = 'settings';
const NAV_KEYWORD_SETTINGS_LEGACY = 'SettingsScreen';
const NAV_KEYWORD_HELP_FAQ = 'helpFaq';
const NAV_KEYWORD_TERMS = 'terms';
const NAV_KEYWORD_PRIVACY = 'privacy';
const NAV_KEYWORD_CONTACT_SUPPORT = 'contactSupport';
const NAV_KEYWORD_BUG_REPORT = 'bugReport';
const NAV_KEYWORD_PRIVACY_DATA_RIGHTS = 'privacyDataRights';
const NAV_KEYWORD_NUTRITION = 'nutrition';
const NAV_KEYWORD_WORKOUT = 'workout';
const NAV_KEYWORD_MESSAGES = 'messages';
const NAV_KEYWORD_CREATE = 'create';
const NAV_KEYWORD_VOICE = 'voice';
const NAV_KEYWORD_AI_CHAT = 'aiChat';
const NAV_KEYWORD_DASHBOARD_BILLING = 'dashboardBilling';
const NAV_KEYWORD_COACHING_PAYMENT = 'coachingPayment';

// ===== HELPER FUNCTIONS =====

// vocab: CommonActions.reset = wipe nav history and put one route at index 0
function dropStackRoutesUntilOnlyMainTabs() {
  if (!rootNavigationRef.isReady()) return;

  const currentState = rootNavigationRef.getState();
  const howManyStackRoutes = currentState?.routes?.length || 0;
  const stackHasPushedScreens = howManyStackRoutes > 1;
  if (!stackHasPushedScreens) return;

  rootNavigationRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: CLIENT_ROUTES.MainTabs }],
    }),
  );
}

// Bottom bar paints nutrition / workout / ai; everything else paints as home.
function bottomNavKeywordForMainTab(mainTab) {
  if (mainTab === CLIENT_MAIN_TABS.nutrition) return NAV_KEYWORD_NUTRITION;
  if (mainTab === CLIENT_MAIN_TABS.workout) return NAV_KEYWORD_WORKOUT;
  if (mainTab === CLIENT_MAIN_TABS.ai) return CLIENT_MAIN_TABS.ai;
  return NAV_KEYWORD_HOME;
}

// Chat list rows pass a trainer object or just an id string.
function trainerRecordFromConversationParticipant(otherParticipant) {
  const participantIsObject =
    otherParticipant && typeof otherParticipant === 'object';
  if (participantIsObject) return otherParticipant;
  return { id: otherParticipant };
}

function goHomeOnMainTabs(actions) {
  actions.handleHomePress();
}

function goHomeThenOpenProfile(actions) {
  actions.handleHomePress();
  actions.openProfile();
}

function goHomeThenOpenSettings(actions) {
  actions.handleHomePress();
  actions.openSettings();
}

function popStackThenOpenScreen(openScreen) {
  rootGoBack();
  openScreen();
}

function goHomeThenOpenNutrition(actions) {
  actions.handleHomePress();
  actions.openNutrition();
}

function goHomeThenOpenMessages(actions) {
  actions.handleHomePress();
  actions.handleOpenConversations();
}

function goHomeThenOpenAiTab(actions) {
  actions.handleHomePress();
  actions.openAIChatHome();
}

function popStackThenOpenCoachingPayment(actions) {
  rootGoBack();
  actions.openCoachingPayment();
}

function openHelpFaqFromStack(actions) {
  popStackThenOpenScreen(actions.openHelpFAQ);
}

function openTermsFromStack(actions) {
  popStackThenOpenScreen(actions.openTerms);
}

function openPrivacyFromStack(actions) {
  popStackThenOpenScreen(actions.openPrivacy);
}

function openContactSupportFromStack(actions) {
  popStackThenOpenScreen(actions.openContactSupport);
}

function openBugReportFromStack(actions) {
  popStackThenOpenScreen(actions.openBugReport);
}

function openPrivacyDataRightsFromStack(actions) {
  popStackThenOpenScreen(actions.openPrivacyDataRights);
}

function openWorkoutFromKeyword(actions) {
  actions.openWorkout();
}

function openAddFilePopupFromKeyword(actions) {
  actions.setShowAddFilePopup(true);
}

function runNavigationKeyword(screenKeyword, actionBag) {
  const handler = NAV_KEYWORD_HANDLERS[screenKeyword];
  if (!handler) return;
  handler(actionBag);
}

function buildKeywordActionBag(navHelpers) {
  return {
    handleHomePress: navHelpers.handleHomePress,
    openProfile: navHelpers.openProfile,
    openSettings: navHelpers.openSettings,
    openHelpFAQ: navHelpers.openHelpFAQ,
    openTerms: navHelpers.openTerms,
    openPrivacy: navHelpers.openPrivacy,
    openContactSupport: navHelpers.openContactSupport,
    openBugReport: navHelpers.openBugReport,
    openPrivacyDataRights: navHelpers.openPrivacyDataRights,
    openNutrition: navHelpers.openNutrition,
    openWorkout: navHelpers.openWorkout,
    handleOpenConversations: navHelpers.handleOpenConversations,
    openAIChatHome: navHelpers.openAIChatHome,
    openCoachingPayment: navHelpers.openCoachingPayment,
    setShowAddFilePopup: navHelpers.setShowAddFilePopup,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Client navigation state + open helpers for MainTabs and stack overlays.
 * Flow: 1. overlay/tab state  2. stack openers  3. tab/overlay handlers  4. keyword router  5. return bag
 * Hook order is frozen — do not reorder useState / useCallback calls.
 * @param {object} [options]
 * @param {Function} [options.refetchNutritionData] passed through for shell consumers
 * @returns {object}
 */
export function goToClientScreen({ refetchNutritionData } = {}) {
  // 1. Tab + overlay flags (hook order frozen).
  const [mainTab, setMainTab] = useState(CLIENT_MAIN_TABS.home);
  const [showTrainerMessaging, setShowTrainerMessaging] = useState(false);
  const [showConversationsList, setShowConversationsList] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showMyDashboard, setShowMyDashboard] = useState(false);
  const [showAddFilePopup, setShowAddFilePopup] = useState(false);
  const [showTrainerSharedFilesPopup, setShowTrainerSharedFilesPopup] = useState(false);
  const [showFilesScreen, setShowFilesScreen] = useState(false);
  const [profileTrainer, setProfileTrainer] = useState(null);
  const [viewingPlan, setViewingPlan] = useState(null);
  const [aiChatState, setAiChatState] = useState(null);
  const [showCoachingPaymentModal, setShowCoachingPaymentModal] = useState(false);

  // 2. Stack openers — rootNavigate pushes a registered CLIENT_ROUTES screen.
  // vocab: useCallback = stable function identity across renders (deps listed)
  const openProfile = useCallback(() => rootNavigate(CLIENT_ROUTES.Profile), []);
  const openSettings = useCallback(() => rootNavigate(CLIENT_ROUTES.Settings), []);
  const openHelpFAQ = useCallback(() => rootNavigate(CLIENT_ROUTES.HelpFAQ), []);
  const openTerms = useCallback(() => rootNavigate(CLIENT_ROUTES.Terms), []);
  const openPrivacy = useCallback(() => rootNavigate(CLIENT_ROUTES.Privacy), []);
  const openContactSupport = useCallback(() => rootNavigate(CLIENT_ROUTES.ContactSupport), []);
  const openBugReport = useCallback(() => rootNavigate(CLIENT_ROUTES.BugReport), []);
  const openPrivacyDataRights = useCallback(
    () => rootNavigate(CLIENT_ROUTES.PrivacyDataRights),
    [],
  );
  const popStackToMainTabs = useCallback(() => {
    dropStackRoutesUntilOnlyMainTabs();
  }, []);

  const dismissMainOverlays = useCallback(() => {
    setShowMyDashboard(false);
    setShowFilesScreen(false);
    setShowTrainerMessaging(false);
    setShowConversationsList(false);
    setSelectedConversation(null);
  }, []);

  const openNutrition = useCallback(() => {
    popStackToMainTabs();
    dismissMainOverlays();
    setMainTab(CLIENT_MAIN_TABS.nutrition);
  }, [popStackToMainTabs, dismissMainOverlays]);

  const openWorkoutPlan = useCallback(() => {
    popStackToMainTabs();
    dismissMainOverlays();
    setMainTab(CLIENT_MAIN_TABS.workout);
  }, [popStackToMainTabs, dismissMainOverlays]);

  const openTrainerSearch = useCallback(() => rootNavigate(CLIENT_ROUTES.TrainerSearch), []);
  const openTrainerProfile = useCallback(() => rootNavigate(CLIENT_ROUTES.TrainerProfile), []);
  const openWeeklyReport = useCallback(() => rootNavigate(CLIENT_ROUTES.WeeklyReport), []);
  const openMySessions = useCallback(() => rootNavigate(CLIENT_ROUTES.MySessions), []);
  const openRequestSession = useCallback(() => rootNavigate(CLIENT_ROUTES.RequestSession), []);
  const openPhotoGallery = useCallback(() => rootNavigate(CLIENT_ROUTES.PhotoGallery), []);
  const openProgressCharts = useCallback(() => rootNavigate(CLIENT_ROUTES.ProgressCharts), []);
  const openLogWorkout = useCallback(() => rootNavigate(CLIENT_ROUTES.LogWorkout), []);
  const openDailyCheckIn = useCallback(() => rootNavigate(CLIENT_ROUTES.DailyCheckIn), []);
  const openMoodCheckIn = useCallback(() => rootNavigate(CLIENT_ROUTES.MoodCheckIn), []);
  const openWeeklyMomentum = useCallback(() => rootNavigate(CLIENT_ROUTES.WeeklyMomentum), []);
  const openNotifications = useCallback(() => rootNavigate(CLIENT_ROUTES.Notifications), []);
  const openAIWorkouts = useCallback(() => rootNavigate(CLIENT_ROUTES.AIWorkouts), []);
  const openPlanViewer = useCallback(() => rootNavigate(CLIENT_ROUTES.PlanViewer), []);

  // vocab: session payload = { workoutName, exercises[] } from a plan day
  const openWorkoutSession = useCallback((payload = {}) => {
    rootNavigate(CLIENT_ROUTES.WorkoutSession, payload);
  }, []);

  const openAIChatHome = useCallback(() => {
    popStackToMainTabs();
    dismissMainOverlays();
    setAiChatState('home');
    setMainTab(CLIENT_MAIN_TABS.ai);
  }, [popStackToMainTabs, dismissMainOverlays]);

  const openAIChatSession = useCallback(
    (payload) => {
      popStackToMainTabs();
      dismissMainOverlays();
      setAiChatState(payload);
      setMainTab(CLIENT_MAIN_TABS.ai);
    },
    [popStackToMainTabs, dismissMainOverlays],
  );

  const openMyDashboardBilling = useCallback(() => {
    popStackToMainTabs();
    setShowMyDashboard(false);
    setMainTab(CLIENT_MAIN_TABS.home);
  }, [popStackToMainTabs]);

  const openCoachingPayment = useCallback(() => {
    setShowCoachingPaymentModal(true);
  }, []);

  const closeCoachingPayment = useCallback(() => {
    setShowCoachingPaymentModal(false);
  }, []);

  // 3. Messaging / home / workout tab handlers.
  const handleOpenConversations = useCallback(() => {
    setShowConversationsList(true);
    setShowTrainerMessaging(false);
    setShowMyDashboard(false);
  }, []);

  const handleSelectConversation = useCallback((conversation, otherParticipant) => {
    setSelectedConversation(conversation);
    setSelectedTrainer(trainerRecordFromConversationParticipant(otherParticipant));
    setShowConversationsList(false);
    setShowTrainerMessaging(true);
  }, []);

  const handleCloseMessaging = useCallback(() => {
    setShowTrainerMessaging(false);
    setShowConversationsList(false);
    setSelectedConversation(null);
  }, []);

  const handleCloseConversationsList = useCallback(() => {
    setShowConversationsList(false);
  }, []);

  const handleFindTrainers = useCallback(() => {
    openTrainerSearch();
  }, [openTrainerSearch]);

  const resetMainLayout = useCallback(() => {
    dismissMainOverlays();
    setMainTab(CLIENT_MAIN_TABS.home);
    setAiChatState(null);
    popStackToMainTabs();
  }, [popStackToMainTabs, dismissMainOverlays]);

  const handleHomePress = useCallback(() => {
    resetMainLayout();
  }, [resetMainLayout]);

  const openWorkout = useCallback(() => {
    dismissMainOverlays();
    popStackToMainTabs();
    setMainTab(CLIENT_MAIN_TABS.workout);
  }, [popStackToMainTabs, dismissMainOverlays]);

  const handleStartWorkout = useCallback(() => openWorkout(), [openWorkout]);
  const handleAddWorkout = useCallback(() => openWorkout(), [openWorkout]);

  // 4. Keyword router for BottomMenuBar / deep links.
  const onNavigate = useCallback(
    (screenKeyword) => {
      if (!screenKeyword) return;
      const actionBag = buildKeywordActionBag({
        handleHomePress,
        openProfile,
        openSettings,
        openHelpFAQ,
        openTerms,
        openPrivacy,
        openContactSupport,
        openBugReport,
        openPrivacyDataRights,
        openNutrition,
        openWorkout,
        handleOpenConversations,
        openAIChatHome,
        openCoachingPayment,
        setShowAddFilePopup,
      });
      runNavigationKeyword(screenKeyword, actionBag);
    },
    [
      handleHomePress,
      openProfile,
      openSettings,
      openHelpFAQ,
      openTerms,
      openPrivacy,
      openContactSupport,
      openBugReport,
      openPrivacyDataRights,
      openNutrition,
      openWorkout,
      handleOpenConversations,
      openAIChatHome,
      openMyDashboardBilling,
      openCoachingPayment,
    ],
  );

  const handleViewClients = useCallback(() => {
    handleOpenConversations();
  }, [handleOpenConversations]);

  // 5. Props bag BottomMenuBar expects, plus the full public shell object.
  const navProviderProps = {
    onProfilePress: openProfile,
    onSettingsPress: openSettings,
    onHomePress: handleHomePress,
    onPlusPress: () => setShowAddFilePopup(true),
    onVoicePress: openAIChatHome,
    onNutritionPress: openNutrition,
    onWorkoutPress: openWorkout,
    onMessagesPress: handleOpenConversations,
  };

  const mainTabActiveKey = bottomNavKeywordForMainTab(mainTab);

  return {
    mainTab,
    setMainTab,
    mainTabActiveKey,
    showTrainerMessaging,
    setShowTrainerMessaging,
    showConversationsList,
    setShowConversationsList,
    showMyDashboard,
    setShowMyDashboard,
    showAddFilePopup,
    setShowAddFilePopup,
    showTrainerSharedFilesPopup,
    setShowTrainerSharedFilesPopup,
    showFilesScreen,
    setShowFilesScreen,
    /** @deprecated use showFilesScreen — kept for ClientMainScreen / shell */
    showNotesFiles: showFilesScreen,
    setShowNotesFiles: setShowFilesScreen,
    selectedTrainer,
    setSelectedTrainer,
    profileTrainer,
    setProfileTrainer,
    selectedConversation,
    setSelectedConversation,
    viewingPlan,
    setViewingPlan,
    aiChatState,
    setAiChatState,
    showCoachingPaymentModal,
    setShowCoachingPaymentModal,
    openCoachingPayment,
    closeCoachingPayment,
    openMyDashboardBilling,
    openProfile,
    openSettings,
    openHelpFAQ,
    openTerms,
    openPrivacy,
    openContactSupport,
    openBugReport,
    openPrivacyDataRights,
    openNutrition,
    openWorkoutPlan,
    openTrainerSearch,
    openTrainerProfile,
    openWeeklyReport,
    openMySessions,
    openRequestSession,
    openPhotoGallery,
    openProgressCharts,
    openLogWorkout,
    openDailyCheckIn,
    openMoodCheckIn,
    openWeeklyMomentum,
    openNotifications,
    openAIWorkouts,
    openPlanViewer,
    openWorkoutSession,
    openAIChatHome,
    openAIChatSession,
    handleOpenConversations,
    handleSelectConversation,
    handleCloseMessaging,
    handleCloseConversationsList,
    handleFindTrainers,
    handleHomePress,
    openWorkout,
    handleStartWorkout,
    handleAddWorkout,
    onNavigate,
    handleViewClients,
    navProviderProps,
    refetchNutritionData,
    rootGoBack,
    rootResetTo,
  };
}

// PLUMBING — skip unless a bottom-nav keyword opens the wrong screen.

const NAV_KEYWORD_HANDLERS = {
  [NAV_KEYWORD_HOME]: goHomeOnMainTabs,
  [NAV_KEYWORD_PROFILE]: goHomeThenOpenProfile,
  [NAV_KEYWORD_PROFILE_LEGACY]: goHomeThenOpenProfile,
  [NAV_KEYWORD_SETTINGS]: goHomeThenOpenSettings,
  [NAV_KEYWORD_SETTINGS_LEGACY]: goHomeThenOpenSettings,
  [NAV_KEYWORD_HELP_FAQ]: openHelpFaqFromStack,
  [NAV_KEYWORD_TERMS]: openTermsFromStack,
  [NAV_KEYWORD_PRIVACY]: openPrivacyFromStack,
  [NAV_KEYWORD_CONTACT_SUPPORT]: openContactSupportFromStack,
  [NAV_KEYWORD_BUG_REPORT]: openBugReportFromStack,
  [NAV_KEYWORD_PRIVACY_DATA_RIGHTS]: openPrivacyDataRightsFromStack,
  [NAV_KEYWORD_NUTRITION]: goHomeThenOpenNutrition,
  [NAV_KEYWORD_WORKOUT]: openWorkoutFromKeyword,
  [NAV_KEYWORD_MESSAGES]: goHomeThenOpenMessages,
  [NAV_KEYWORD_CREATE]: openAddFilePopupFromKeyword,
  [NAV_KEYWORD_VOICE]: goHomeThenOpenAiTab,
  [NAV_KEYWORD_AI_CHAT]: goHomeThenOpenAiTab,
  [NAV_KEYWORD_DASHBOARD_BILLING]: popStackThenOpenCoachingPayment,
  [NAV_KEYWORD_COACHING_PAYMENT]: popStackThenOpenCoachingPayment,
};
