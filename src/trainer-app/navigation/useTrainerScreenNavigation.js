/**
 * use Trainer Screen Navigation
 *
 * Purpose: UI screen or component: use Trainer Screen Navigation. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: useTrainerScreenNavigation
 *
 * @file-header
 */
import { useCallback, useState } from 'react';
import { CommonActions } from '@react-navigation/native';
import { TRAINER_ROUTES } from '../../navigation/routes';
import { rootGoBack, rootNavigate, rootNavigationRef, rootResetTo } from '../../navigation/navigationRef';

/** Trainer hub layout flags + stack navigation for full-screen flows. */
export function useTrainerScreenNavigation() {
  const [showTrainerMessaging, setShowTrainerMessaging] = useState(false);
  const [showConversationsList, setShowConversationsList] = useState(false);
  const [showClientRequests, setShowClientRequests] = useState(false);
  const [showClientsList, setShowClientsList] = useState(false);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [showAIWorkouts, setShowAIWorkouts] = useState(false);
  const [showWorkoutGenerator, setShowWorkoutGenerator] = useState(false);
  const [showPlanViewer, setShowPlanViewer] = useState(false);
  const [showAddNotesFilesModal, setShowAddNotesFilesModal] = useState(false);
  const [addNotesFilesClientId, setAddNotesFilesClientId] = useState(null);
  const [weeklyReportScreen, setViewWeekProgressReportScreen] = useState(null);
  const [aiChatState, setAiChatState] = useState('home');
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);

  const openProfile = useCallback(() => rootNavigate(TRAINER_ROUTES.Profile), []);
  const openSettings = useCallback(() => rootNavigate(TRAINER_ROUTES.Settings), []);
  const openHelpFAQ = useCallback(() => rootNavigate(TRAINER_ROUTES.HelpFAQ), []);
  const openTerms = useCallback(() => rootNavigate(TRAINER_ROUTES.Terms), []);
  const openPrivacy = useCallback(() => rootNavigate(TRAINER_ROUTES.Privacy), []);
  const openContactSupport = useCallback(() => rootNavigate(TRAINER_ROUTES.ContactSupport), []);
  const openBugReport = useCallback(() => rootNavigate(TRAINER_ROUTES.BugReport), []);
  const openNutrition = useCallback(() => rootNavigate(TRAINER_ROUTES.Nutrition), []);
  const openWorkoutPlan = useCallback(() => rootNavigate(TRAINER_ROUTES.WorkoutPlan), []);
  const openTrainerSearch = useCallback(() => rootNavigate(TRAINER_ROUTES.TrainerSearch), []);
  const openVoiceAI = useCallback(() => {
    setAiChatState('home');
    rootNavigate(TRAINER_ROUTES.VoiceAI);
  }, []);
  const openAIChatSession = useCallback((payload) => {
    setAiChatState(payload);
    rootNavigate(TRAINER_ROUTES.AIChat, payload);
  }, []);
  const openWeeklyReport = useCallback((clientId, clientName) => {
    rootNavigate(TRAINER_ROUTES.WeeklyReport, { clientId, clientName: clientName || '' });
  }, []);
  const openManualPlanBuilder = useCallback(() => rootNavigate(TRAINER_ROUTES.ManualPlanBuilder), []);
  const openPayments = useCallback(() => rootNavigate(TRAINER_ROUTES.Payments), []);

  const resetMainLayout = useCallback(() => {
    setShowTrainerMessaging(false);
    setShowConversationsList(false);
    setShowClientRequests(false);
    setShowClientsList(false);
    setShowPhotoGallery(false);
    setShowAIWorkouts(false);
    setShowWorkoutGenerator(false);
    setShowPlanViewer(false);
    setViewWeekProgressReportScreen(null);
    setAiChatState('home');
    if (rootNavigationRef.isReady() && rootNavigationRef.getState()?.routes?.length > 1) {
      rootNavigationRef.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: TRAINER_ROUTES.Main }] }),
      );
    }
  }, []);

  const handleHomePress = useCallback(() => resetMainLayout(), [resetMainLayout]);

  const handlePlusPress = useCallback(
    (clientId) => {
      if (clientId) {
        setAddNotesFilesClientId(clientId);
        setShowAddNotesFilesModal(true);
      }
    },
    [],
  );

  const onNavigate = useCallback(
    (screen) => {
      if (!screen) return;
      if (screen === 'home') {
        handleHomePress();
        return;
      }
      if (screen === 'profile' || screen === 'ViewMyViewMyProfileScreen') {
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
        handleHomePress();
        openWorkoutPlan();
        return;
      }
      if (screen === 'messages') {
        handleHomePress();
        setShowTrainerMessaging(false);
        setShowConversationsList(true);
        return;
      }
      if (screen === 'voice' || screen === 'aiChat') {
        handleHomePress();
        openVoiceAI();
        return;
      }
      if (screen === 'payments' || screen === 'PaymentsScreen') {
        rootGoBack();
        openPayments();
        return;
      }
      if (screen === 'create') {
        /* plus handled by shell handlePlusPress via navProviderProps */
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
      openWorkoutPlan,
      openVoiceAI,
      openPayments,
    ],
  );

  const navProviderProps = {
    onProfilePress: openProfile,
    onSettingsPress: openSettings,
    onHomePress: handleHomePress,
    onPlusPress: () => {
      if (addNotesFilesClientId) setShowAddNotesFilesModal(true);
    },
    onVoicePress: openVoiceAI,
    onNutritionPress: openNutrition,
    onWorkoutPress: openWorkoutPlan,
    onMessagesPress: () => {
      setShowTrainerMessaging(false);
      setShowConversationsList(true);
    },
  };

  return {
    showTrainerMessaging,
    setShowTrainerMessaging,
    showConversationsList,
    setShowConversationsList,
    showClientRequests,
    setShowClientRequests,
    showClientsList,
    setShowClientsList,
    showPhotoGallery,
    setShowPhotoGallery,
    showAIWorkouts,
    setShowAIWorkouts,
    showWorkoutGenerator,
    setShowWorkoutGenerator,
    showPlanViewer,
    setShowPlanViewer,
    showAddNotesFilesModal,
    setShowAddNotesFilesModal,
    addNotesFilesClientId,
    setAddNotesFilesClientId,
    weeklyReportScreen,
    setViewWeekProgressReportScreen,
    aiChatState,
    setAiChatState,
    selectedTrainer,
    setSelectedTrainer,
    selectedConversation,
    setSelectedConversation,
    openProfile,
    openSettings,
    openNutrition,
    openWorkoutPlan,
    openTrainerSearch,
    openVoiceAI,
    openAIChatSession,
    openWeeklyReport,
    openManualPlanBuilder,
    openPayments,
    handleHomePress,
    handlePlusPress,
    onNavigate,
    navProviderProps,
    rootGoBack,
    rootResetTo,
  };
}
