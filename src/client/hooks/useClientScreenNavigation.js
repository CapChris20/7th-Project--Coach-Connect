import { useCallback, useState } from 'react';
import { CommonActions } from '@react-navigation/native';
import { CLIENT_ROUTES } from '../../navigation/routes';
import { rootGoBack, rootNavigate, rootNavigationRef, rootResetTo } from '../../navigation/navigationRef';

/** Primary bottom-nav destinations stay on MainTabs (not stack) so the bar stays visible. */
export const CLIENT_MAIN_TABS = {
  home: 'home',
  nutrition: 'nutrition',
  workout: 'workout',
  ai: 'ai',
};

/** Screen flags for main layout + React Navigation for full-screen flows. */
export function useClientScreenNavigation({ refetchNutritionData } = {}) {
  const [mainTab, setMainTab] = useState(CLIENT_MAIN_TABS.home);
  const [showTrainerMessaging, setShowTrainerMessaging] = useState(false);
  const [showConversationsList, setShowConversationsList] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showMyDashboard, setShowMyDashboard] = useState(false);
  const [showAddNotesFilesModal, setShowAddNotesFilesModal] = useState(false);
  const [showTrainerSharedFilesModal, setShowTrainerSharedFilesModal] = useState(false);
  const [showClientFilesScreen, setShowClientFilesScreen] = useState(false);
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
    if (rootNavigationRef.isReady()) {
      const state = rootNavigationRef.getState();
      if (state?.routes?.length > 1) {
        rootNavigationRef.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: CLIENT_ROUTES.MainTabs }],
          }),
        );
      }
    }
  }, []);

  const openNutrition = useCallback(() => {
    popStackToMainTabs();
    setMainTab(CLIENT_MAIN_TABS.nutrition);
  }, [popStackToMainTabs]);

  const openWorkoutPlan = useCallback(() => {
    popStackToMainTabs();
    setMainTab(CLIENT_MAIN_TABS.workout);
  }, [popStackToMainTabs]);
  const openTrainerSearch = useCallback(() => rootNavigate(CLIENT_ROUTES.TrainerSearch), []);
  const openTrainerProfile = useCallback(() => rootNavigate(CLIENT_ROUTES.TrainerProfile), []);
  const openWeeklyReport = useCallback(() => rootNavigate(CLIENT_ROUTES.WeeklyReport), []);
  const openPhotoGallery = useCallback(() => rootNavigate(CLIENT_ROUTES.PhotoGallery), []);
  const openAIWorkouts = useCallback(() => rootNavigate(CLIENT_ROUTES.AIWorkouts), []);
  const openPlanViewer = useCallback(() => rootNavigate(CLIENT_ROUTES.PlanViewer), []);
  const openAIChatHome = useCallback(() => {
    popStackToMainTabs();
    setAiChatState('home');
    setMainTab(CLIENT_MAIN_TABS.ai);
  }, [popStackToMainTabs]);
  const openAIChatSession = useCallback((payload) => {
    popStackToMainTabs();
    setAiChatState(payload);
    setMainTab(CLIENT_MAIN_TABS.ai);
  }, [popStackToMainTabs]);

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
    setSelectedTrainer(
      otherParticipant && typeof otherParticipant === 'object' ? otherParticipant : { id: otherParticipant },
    );
    setShowConversationsList(false);
    setShowTrainerMessaging(true);
  }, []);

  const handleCloseMessaging = useCallback(() => {
    setShowTrainerMessaging(false);
    setShowConversationsList(false);
    setShowMyDashboard(true);
    setSelectedConversation(null);
  }, []);

  const handleCloseConversationsList = useCallback(() => {
    setShowConversationsList(false);
  }, []);

  const handleFindTrainers = useCallback(() => {
    openTrainerSearch();
  }, [openTrainerSearch]);

  const resetMainLayout = useCallback(() => {
    setMainTab(CLIENT_MAIN_TABS.home);
    setAiChatState(null);
    setShowTrainerMessaging(false);
    setShowConversationsList(false);
    setShowMyDashboard(false);
    setSelectedConversation(null);
    setShowClientFilesScreen(false);
    popStackToMainTabs();
  }, [popStackToMainTabs]);

  const handleHomePress = useCallback(() => {
    resetMainLayout();
  }, [resetMainLayout]);

  const openWorkout = useCallback(() => {
    setShowTrainerMessaging(false);
    setShowConversationsList(false);
    setShowMyDashboard(false);
    setSelectedConversation(null);
    popStackToMainTabs();
    setMainTab(CLIENT_MAIN_TABS.workout);
  }, [popStackToMainTabs]);

  const handleStartWorkout = useCallback(() => openWorkout(), [openWorkout]);
  const handleAddWorkout = useCallback(() => openWorkout(), [openWorkout]);

  const onNavigate = useCallback(
    (screen) => {
      if (!screen) return;
      if (screen === 'home') {
        handleHomePress();
        return;
      }
      if (screen === 'profile' || screen === 'ProfileScreen') {
        handleHomePress();
        openProfile();
        return;
      }
      if (screen === 'settings' || screen === 'SettingsScreen') {
        handleHomePress();
        openSettings();
        return;
      }
      if (screen === 'helpFaq') {
        rootGoBack();
        openHelpFAQ();
        return;
      }
      if (screen === 'terms') {
        rootGoBack();
        openTerms();
        return;
      }
      if (screen === 'privacy') {
        rootGoBack();
        openPrivacy();
        return;
      }
      if (screen === 'contactSupport') {
        rootGoBack();
        openContactSupport();
        return;
      }
      if (screen === 'bugReport') {
        rootGoBack();
        openBugReport();
        return;
      }
      if (screen === 'nutrition') {
        handleHomePress();
        openNutrition();
        return;
      }
      if (screen === 'workout') {
        openWorkout();
        return;
      }
      if (screen === 'messages') {
        handleHomePress();
        handleOpenConversations();
        return;
      }
      if (screen === 'create') {
        setShowAddNotesFilesModal(true);
        return;
      }
      if (screen === 'voice' || screen === 'aiChat') {
        handleHomePress();
        openAIChatHome();
        return;
      }
      if (screen === 'dashboardBilling' || screen === 'coachingPayment') {
        rootGoBack();
        openCoachingPayment();
        return;
      }
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
    onPlusPress: () => setShowAddNotesFilesModal(true),
    onVoicePress: openAIChatHome,
    onNutritionPress: openNutrition,
    onWorkoutPress: openWorkout,
    onMessagesPress: handleOpenConversations,
  };

  const mainTabActiveKey =
    mainTab === CLIENT_MAIN_TABS.nutrition
      ? 'nutrition'
      : mainTab === CLIENT_MAIN_TABS.workout
        ? 'workout'
        : mainTab === CLIENT_MAIN_TABS.ai
          ? 'ai'
          : 'home';

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
    showAddNotesFilesModal,
    setShowAddNotesFilesModal,
    showTrainerSharedFilesModal,
    setShowTrainerSharedFilesModal,
    showClientFilesScreen,
    setShowClientFilesScreen,
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
