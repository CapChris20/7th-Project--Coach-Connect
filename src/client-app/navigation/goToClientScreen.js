// Client app navigation: which tab is open, plus the overlay flags for chat, files, and AI.
// Flow: bottom-nav keywords stay on MainTabs → full screens use rootNavigate → overlays are useState flags.
// Used by ClientMainScreen. Route name strings (CLIENT_ROUTES.*) must stay as the stack registers them.

import { useCallback, useState } from 'react';
import { CommonActions } from '@react-navigation/native';
import { CLIENT_ROUTES } from '../../navigation/screenNames';
import { rootGoBack, rootNavigate, rootNavigationRef, rootResetTo } from '../../navigation/openScreenFromAnywhere';

// ===== NAMED CONSTANTS =====

/** Primary bottom-nav destinations stay on MainTabs (not stack) so the bar stays visible. */
export const CLIENT_MAIN_TABS = {
  home: 'home',
  nutrition: 'nutrition',
  workout: 'workout',
  ai: 'ai',
};

const SCREEN_HOME = 'home';
const SCREEN_PROFILE = 'profile';
const SCREEN_PROFILE_ALIAS = 'ViewMyMyProfileScreen';
const SCREEN_SETTINGS = 'settings';
const SCREEN_SETTINGS_ALIAS = 'SettingsScreen';
const SCREEN_HELP_FAQ = 'helpFaq';
const SCREEN_TERMS = 'terms';
const SCREEN_PRIVACY = 'privacy';
const SCREEN_CONTACT_SUPPORT = 'contactSupport';
const SCREEN_BUG_REPORT = 'bugReport';
const SCREEN_NUTRITION = 'nutrition';
const SCREEN_WORKOUT = 'workout';
const SCREEN_MESSAGES = 'messages';
const SCREEN_CREATE = 'create';
const SCREEN_VOICE = 'voice';
const SCREEN_AI_CHAT = 'aiChat';
const SCREEN_DASHBOARD_BILLING = 'dashboardBilling';
const SCREEN_COACHING_PAYMENT = 'coachingPayment';

// ===== HELPER FUNCTIONS =====

/**
 * Drop stack screens so MainTabs is the only route. The bottom bar is on that screen.
 * vocab: CommonActions.reset rebuilds the nav state. index 0 = show the first (only) route.
 * @returns {void}
 */
function resetRootToMainTabs() {
  if (!rootNavigationRef.isReady()) return;
  const navigationState = rootNavigationRef.getState();
  if (!(navigationState?.routes?.length > 1)) return;
  rootNavigationRef.dispatch(
    CommonActions.reset({
      index: 0,
      routes: [{ name: CLIENT_ROUTES.MainTabs }],
    }),
  );
}

function openClientHome(actions) {
  actions.handleHomePress();
}

function openClientProfile(actions) {
  actions.handleHomePress();
  actions.openProfile();
}

function openClientSettings(actions) {
  actions.handleHomePress();
  actions.openSettings();
}

function openAfterBack(actions, openScreen) {
  rootGoBack();
  openScreen();
}

function openClientNutrition(actions) {
  actions.handleHomePress();
  actions.openNutrition();
}

function openClientMessages(actions) {
  actions.handleHomePress();
  actions.handleOpenConversations();
}

function openClientAi(actions) {
  actions.handleHomePress();
  actions.openAIChatHome();
}

function openClientCoachingPayment(actions) {
  rootGoBack();
  actions.openCoachingPayment();
}

const SCREEN_KEYWORD_ACTIONS = {
  [SCREEN_HOME]: openClientHome,
  [SCREEN_PROFILE]: openClientProfile,
  [SCREEN_PROFILE_ALIAS]: openClientProfile,
  [SCREEN_SETTINGS]: openClientSettings,
  [SCREEN_SETTINGS_ALIAS]: openClientSettings,
  [SCREEN_HELP_FAQ]: (actions) => openAfterBack(actions, actions.openHelpFAQ),
  [SCREEN_TERMS]: (actions) => openAfterBack(actions, actions.openTerms),
  [SCREEN_PRIVACY]: (actions) => openAfterBack(actions, actions.openPrivacy),
  [SCREEN_CONTACT_SUPPORT]: (actions) => openAfterBack(actions, actions.openContactSupport),
  [SCREEN_BUG_REPORT]: (actions) => openAfterBack(actions, actions.openBugReport),
  [SCREEN_NUTRITION]: openClientNutrition,
  [SCREEN_WORKOUT]: (actions) => actions.openWorkout(),
  [SCREEN_MESSAGES]: openClientMessages,
  [SCREEN_CREATE]: (actions) => actions.setShowAddFilePopup(true),
  [SCREEN_VOICE]: openClientAi,
  [SCREEN_AI_CHAT]: openClientAi,
  [SCREEN_DASHBOARD_BILLING]: openClientCoachingPayment,
  [SCREEN_COACHING_PAYMENT]: openClientCoachingPayment,
};

function runClientScreenKeyword(screen, actions) {
  const openScreen = SCREEN_KEYWORD_ACTIONS[screen];
  if (!openScreen) return;
  openScreen(actions);
}

/**
 * Bottom-bar highlight. Anything that is not nutrition/workout/ai is Home.
 * @param {string} mainTab
 * @returns {string}
 */
function mainTabBarKey(mainTab) {
  if (mainTab === CLIENT_MAIN_TABS.nutrition) return SCREEN_NUTRITION;
  if (mainTab === CLIENT_MAIN_TABS.workout) return SCREEN_WORKOUT;
  if (mainTab === CLIENT_MAIN_TABS.ai) return CLIENT_MAIN_TABS.ai;
  return SCREEN_HOME;
}

/**
 * Chat list rows pass either a user object or a raw id.
 * @param {object|string} otherParticipant
 * @returns {object}
 */
function trainerFromParticipant(otherParticipant) {
  if (otherParticipant && typeof otherParticipant === 'object') return otherParticipant;
  return { id: otherParticipant };
}

// ===== MAIN FUNCTION =====

/**
 * Screen flags for the client layout, plus navigation for full-screen flows.
 * @param {{ refetchNutritionData?: Function }} [options]
 * @returns {object}
 */
export function goToClientScreen({ refetchNutritionData } = {}) {
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

  const openProfile = useCallback(() => rootNavigate(CLIENT_ROUTES.Profile), []);
  const openSettings = useCallback(() => rootNavigate(CLIENT_ROUTES.Settings), []);
  const openHelpFAQ = useCallback(() => rootNavigate(CLIENT_ROUTES.HelpFAQ), []);
  const openTerms = useCallback(() => rootNavigate(CLIENT_ROUTES.Terms), []);
  const openPrivacy = useCallback(() => rootNavigate(CLIENT_ROUTES.Privacy), []);
  const openContactSupport = useCallback(() => rootNavigate(CLIENT_ROUTES.ContactSupport), []);
  const openBugReport = useCallback(() => rootNavigate(CLIENT_ROUTES.BugReport), []);
  const popStackToMainTabs = useCallback(() => {
    resetRootToMainTabs();
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
  const openPhotoGallery = useCallback(() => rootNavigate(CLIENT_ROUTES.PhotoGallery), []);
  const openAIWorkouts = useCallback(() => rootNavigate(CLIENT_ROUTES.AIWorkouts), []);
  const openPlanViewer = useCallback(() => rootNavigate(CLIENT_ROUTES.PlanViewer), []);
  const openAIChatHome = useCallback(() => {
    popStackToMainTabs();
    dismissMainOverlays();
    setAiChatState('home');
    setMainTab(CLIENT_MAIN_TABS.ai);
  }, [popStackToMainTabs, dismissMainOverlays]);
  const openAIChatSession = useCallback((payload) => {
    popStackToMainTabs();
    dismissMainOverlays();
    setAiChatState(payload);
    setMainTab(CLIENT_MAIN_TABS.ai);
  }, [popStackToMainTabs, dismissMainOverlays]);

  const openMyDashboardBilling = useCallback(() => {
    popStackToMainTabs();
    setShowMyDashboard(true);
  }, [popStackToMainTabs]);

  const openCoachingPayment = useCallback(() => {
    setShowCoachingPaymentModal(true);
  }, []);

  const closeCoachingPayment = useCallback(() => {
    setShowCoachingPaymentModal(false);
  }, []);

  const handleOpenConversations = useCallback(() => {
    setShowConversationsList(true);
    setShowTrainerMessaging(false);
    setShowMyDashboard(false);
  }, []);

  const handleSelectConversation = useCallback((conversation, otherParticipant) => {
    setSelectedConversation(conversation);
    setSelectedTrainer(trainerFromParticipant(otherParticipant));
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

  const onNavigate = useCallback(
    (screen) => {
      if (!screen) return;
      runClientScreenKeyword(screen, {
        handleHomePress,
        openProfile,
        openSettings,
        openHelpFAQ,
        openTerms,
        openPrivacy,
        openContactSupport,
        openBugReport,
        openNutrition,
        openWorkout,
        handleOpenConversations,
        openAIChatHome,
        openCoachingPayment,
        setShowAddFilePopup,
      });
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

  const mainTabActiveKey = mainTabBarKey(mainTab);

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
    openNutrition,
    openWorkoutPlan,
    openTrainerSearch,
    openTrainerProfile,
    openWeeklyReport,
    openPhotoGallery,
    openAIWorkouts,
    openPlanViewer,
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
