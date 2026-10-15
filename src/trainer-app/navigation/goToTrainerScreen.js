// Trainer hub flags plus stack navigation for full-screen flows (profile, settings, AI, payments…).
// Flow: hold overlay booleans → expose open* helpers → onNavigate maps a keyword to those helpers.
// Used by: TrainerAppStart. Hook order is load-bearing — do not reorder the useState / useCallback calls.

import { useCallback, useState } from 'react';
import { CommonActions } from '@react-navigation/native';
import { TRAINER_ROUTES } from '../../navigation/screenNames';
import { rootGoBack, rootNavigate, rootNavigationRef, rootResetTo } from '../../navigation/openScreenFromAnywhere';

// ===== NAMED CONSTANTS =====

const AI_CHAT_HOME = 'home';
const KEYWORD_HOME = 'home';
const KEYWORD_CREATE = 'create';

// ===== HELPER FUNCTIONS =====

/**
 * Pop nested trainer screens back to Main when the stack actually has more than the hub.
 * vocab: CommonActions.reset rebuilds the stack so Back cannot return to a closed overlay.
 * @returns {void}
 */
function resetTrainerStackToMain() {
  const isReady = rootNavigationRef.isReady();
  const hasNestedRoutes = rootNavigationRef.getState()?.routes?.length > 1;
  if (!isReady || !hasNestedRoutes) return;
  rootNavigationRef.dispatch(
    CommonActions.reset({ index: 0, routes: [{ name: TRAINER_ROUTES.Main }] }),
  );
}

/**
 * Keyword → navigation. Sequential early returns (not else-if) so nesting stays at 1.
 * `create` is a no-op here: the plus button is handled by the shell's handlePlusPress.
 * @param {string} screen
 * @param {object} actions
 */
function runTrainerScreenKeyword(screen, actions) {
  if (!screen) return;

  if (screen === KEYWORD_HOME) {
    actions.handleHomePress();
    return;
  }
  if (screen === 'profile' || screen === 'ViewMyMyProfileScreen') {
    actions.handleHomePress();
    actions.openProfile();
    return;
  }
  if (screen === 'settings' || screen === 'SettingsScreen') {
    actions.handleHomePress();
    actions.openSettings();
    return;
  }
  if (screen === 'helpFaq') {
    rootGoBack();
    actions.openHelpFAQ();
    return;
  }
  if (screen === 'terms') {
    rootGoBack();
    actions.openTerms();
    return;
  }
  if (screen === 'privacy') {
    rootGoBack();
    actions.openPrivacy();
    return;
  }
  if (screen === 'contactSupport') {
    rootGoBack();
    actions.openContactSupport();
    return;
  }
  if (screen === 'bugReport') {
    rootGoBack();
    actions.openBugReport();
    return;
  }
  if (screen === 'nutrition') {
    actions.handleHomePress();
    actions.openNutrition();
    return;
  }
  if (screen === 'workout') {
    actions.handleHomePress();
    actions.openWorkoutPlan();
    return;
  }
  if (screen === 'messages') {
    actions.handleHomePress();
    actions.setShowTrainerMessaging(false);
    actions.setShowConversationsList(true);
    return;
  }
  if (screen === 'voice' || screen === 'aiChat') {
    actions.handleHomePress();
    actions.openVoiceAI();
    return;
  }
  if (screen === 'payments' || screen === 'EarningsScreen') {
    rootGoBack();
    actions.openPayments();
    return;
  }
  if (screen === KEYWORD_CREATE) {
    /* plus handled by shell handlePlusPress via navProviderProps */
  }
}

// ===== MAIN FUNCTION =====

/**
 * Trainer navigation hook: overlay flags for the hub, plus stack pushes for full screens.
 * vocab: useState holds which hub overlay is open. vocab: useCallback keeps the same function
 * identity so child screens do not re-render on every parent paint.
 * @returns {object}
 */
export function goToTrainerScreen() {
  const [showTrainerMessaging, setShowTrainerMessaging] = useState(false);
  const [showConversationsList, setShowConversationsList] = useState(false);
  const [showClientRequests, setShowClientRequests] = useState(false);
  const [showClientsList, setShowClientsList] = useState(false);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [showAIWorkouts, setShowAIWorkouts] = useState(false);
  const [showWorkoutGenerator, setShowWorkoutGenerator] = useState(false);
  const [showPlanViewer, setShowPlanViewer] = useState(false);
  const [showAddFilePopup, setShowAddFilePopup] = useState(false);
  const [addNotesFilesClientId, setAddNotesFilesClientId] = useState(null);
  const [weeklyReportScreen, setWeeklyReportScreen] = useState(null);
  const [aiChatState, setAiChatState] = useState(AI_CHAT_HOME);
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
    setAiChatState(AI_CHAT_HOME);
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
    setWeeklyReportScreen(null);
    setAiChatState(AI_CHAT_HOME);
    resetTrainerStackToMain();
  }, []);

  const handleHomePress = useCallback(() => resetMainLayout(), [resetMainLayout]);

  const handlePlusPress = useCallback((clientId) => {
    if (!clientId) return;
    setAddNotesFilesClientId(clientId);
    setShowAddFilePopup(true);
  }, []);

  const onNavigate = useCallback(
    (screen) => {
      runTrainerScreenKeyword(screen, {
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
        setShowTrainerMessaging,
        setShowConversationsList,
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
      if (addNotesFilesClientId) setShowAddFilePopup(true);
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
    showAddFilePopup,
    setShowAddFilePopup,
    addNotesFilesClientId,
    setAddNotesFilesClientId,
    weeklyReportScreen,
    setWeeklyReportScreen,
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
