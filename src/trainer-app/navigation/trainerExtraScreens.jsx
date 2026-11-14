// Overlay screens the trainer stack opens from home: profile, settings, FAQ, coach, plans, earnings.
// Flow: read trainer shell → wrap shared screen in AppNavigationProvider → pass the same back/nav handlers.
// Used by the trainer navigator. Route name strings stay exactly as the stack registers them.
// Read order: constants → wrap helpers → exported overlay screens → PLUMBING subcomponents + hooks.

import React from 'react';
import { Platform } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { AppNavigationProvider } from '../../navigation/whichScreenIsOpen';
import { useTrainerAppStartShell } from './TrainerOpenScreenTracker';
import { buildNavigateFromShell } from '../../navigation/goToScreenByKeyword';
import ViewMyMyProfileScreen from '../../client-app/profile/MyProfileScreen';
import SettingsScreen from '../../settings/SettingsScreen';
import HelpFAQScreen from '../../settings/HelpFAQScreen';
import TermsOfServiceScreen from '../../settings/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../../settings/PrivacyPolicyScreen';
import ContactSupportScreen from '../../settings/ContactSupportScreen';
import BugReportScreen from '../../settings/BugReportScreen';
import PrivacyDataRightsScreen from '../../settings/PrivacyDataRightsScreen';
import DailyLogContent from '../../nutrition/daily-log/DailyLogContent';
import SearchTrainersScreen from '../../client-app/find-a-trainer/SearchTrainersScreen';
import VoiceCoachScreen from '../../ai-coach/home-screen/CoachHomeScreen';
import CoachConversationScreen from '../../ai-coach/conversation/CoachConversationScreen';
import CreateWorkoutPlanScreen from '../../workouts/create-plan/CreateWorkoutPlanScreen';
import TrainerWeeklyReportScreen from '../../for-both/weekly-report/WeeklyReportScreen';
import ManualWorkoutPlanBuilderScreen from '../workout-plans/ManualWorkoutPlanBuilderScreen';
import EarningsScreen from '../earnings/EarningsScreen';
import AddFilePopup from '../../for-both/files-and-notes/viewers/AddFilePopup';
import NotificationsScreen from '../../notifications/NotificationsScreen';
import { useSubscription } from '../../trainer-pro-plan/ProPlanSetup';
import { TRAINER_PLATFORM_SUBSCRIPTION_ENABLED } from '../../trainer-pro-plan/proPlanSwitches';

// ===== NAMED CONSTANTS =====

const USER_ROLE_TRAINER_PROFILE = 'Trainer';
const USER_ROLE_TRAINER_SETTINGS = 'trainer';
const SETTINGS_ROUTE = 'settings';
const ACCESS_FREE_TRIAL = 'free_trial';
const ACCESS_ACTIVE = 'active';
const ACCESS_EXPIRED = 'expired';
const ADDED_BY_TRAINER = 'trainer';
const IOS_PLATFORM = 'ios';
const AI_CHAT_HOME_STATE = 'home';
const NOOP = () => {};

// ===== HELPER FUNCTIONS =====

/**
 * Coerce any value to a trimmed string (empty when missing).
 * @param {*} value
 * @returns {string}
 */
function asTrimmedString(value) {
  return asTrimmedString(value);
}


/**
 * Every overlay gets the same bottom-nav provider props from the trainer shell.
 * @param {import('react').ReactElement} screenBody
 * @param {object} shell
 * @returns {import('react').ReactElement}
 */
function wrapTrainerScreenWithNav(screenBody, shell) {
  return <AppNavigationProvider {...shell.navProviderProps}>{screenBody}</AppNavigationProvider>;
}

/**
 * Open the conversations list and close direct messaging overlay.
 * @param {object} shell
 * @returns {void}
 */
function openConversationsList(shell) {
  shell.setShowTrainerMessaging(false);
  shell.setShowConversationsList(true);
}

/**
 * Dashboard client the workout tab is editing. Empty roster → no userId.
 * @param {object} shell
 * @returns {{ clientId: string|null, clientName: string }}
 */
function workoutTabClient(shell) {
  const rosterHasClients = shell.clients?.length > 0;
  if (!rosterHasClients) {
    return { clientId: null, clientName: '' };
  }
  const clientId = shell.selectedClientIdFromDashboard || shell.clients[0]?.id || null;
  const clientRow = clientId
    ? shell.clients.find((client) => client.id === clientId)
    : null;
  const rawName = clientRow?.name || clientRow?.displayName || '';
  const clientName = String(rawName).trim() || '';
  return { clientId, clientName };
}

/**
 * True when aiChatState is a session object (not the home string).
 * @param {unknown} aiChatState
 * @returns {boolean}
 */
function isOpenCoachConversation(aiChatState) {
  return aiChatState != null && typeof aiChatState === 'object';
}

/**
 * Stable React key for the open coach conversation screen.
 * @param {object} aiChatState
 * @returns {string}
 */
function trainerChatSessionKey(aiChatState) {
  return JSON.stringify({
    sid: aiChatState.sessionId ?? null,
    pf: aiChatState.prefill ?? null,
  });
}

/**
 * Short label for Settings. Empty object when this build does not sell the iOS trainer plan.
 * @param {string} access
 * @returns {string}
 */
function platformSubscriptionStatusLabel(access) {
  if (access === ACCESS_FREE_TRIAL) return 'Free trial active';
  if (access === ACCESS_ACTIVE) return 'Pro — active';
  if (access === ACCESS_EXPIRED) return 'Expired';
  return 'No active subscription';
}

/**
 * Close manual plan builder and optionally bounce back into AI workouts.
 * @param {object} shell
 * @returns {void}
 */
function closeManualPlanBuilder(shell) {
  const returnToAiWorkouts = shell.manualBuilderReturnToAI;
  shell.setManualPlanEditId(null);
  shell.setManualPlanBuilderClientIds([]);
  shell.setManualBuilderReturnToAI(false);
  shell.rootGoBack();
  const shouldReopenAiWorkouts = returnToAiWorkouts && shell.day6Client?.id;
  if (!shouldReopenAiWorkouts) return;
  shell.setShowAIWorkouts(true);
  shell.setAiWorkoutsListKey((listKey) => listKey + 1);
}

/**
 * Create-plan screen nested navigate: settings pops then opens Settings; anything else goes home.
 * @param {object} shell
 * @param {string} route
 * @returns {void}
 */
function handleWorkoutPlanNavigate(shell, route) {
  if (route === SETTINGS_ROUTE) {
    shell.rootGoBack();
    shell.openSettings();
    return;
  }
  shell.handleHomePress();
}

/**
 * Weekly report “messages” control: select that client and open the conversations list.
 * @param {object} shell
 * @param {string} clientId
 * @returns {void}
 */
function openWeeklyReportMessages(shell, clientId) {
  shell.setSelectedClientIdForMessages(clientId);
  shell.setShowTrainerMessaging(false);
  shell.setShowConversationsList(true);
}

// ===== MAIN FUNCTION =====

/**
 * Trainer's own profile, with trainer-role copy and payout entry.
 * @returns {import('react').ReactElement}
 */
export function TrainerViewMyMyProfileScreen() {
  const shell = useTrainerAppStartShell();
  // 1. Profile body with trainer doc + payout entry.
  const trainerDoc = shell.trainerProfileDoc || {};
  const clientCount = shell.clients?.length ?? 0;
  const profileScreen = (
    <ViewMyMyProfileScreen
      onBack={shell.rootGoBack}
      userRole={USER_ROLE_TRAINER_PROFILE}
      userData={trainerDoc}
      onboardingData={trainerDoc}
      onNavigate={shell.onNavigate}
      onProfileSaved={shell.refreshTrainerUserDoc}
      onOpenPayments={shell.openPayments}
      trainerClientCount={clientCount}
    />
  );
  // 2. Publish shell nav props around the body.
  return wrapTrainerScreenWithNav(profileScreen, shell);
}

/**
 * Settings. iOS Pro restore controls are added only when that product is enabled.
 * @returns {import('react').ReactElement}
 */
export function TrainerSettingsScreen() {
  const shell = useTrainerAppStartShell();
  // 1. Keyword router for nested settings links.
  const onNavigate = buildNavigateFromShell(shell);
  // 2. Optional StoreKit props when iOS trainer Pro is enabled for this build.
  const subscriptionProps = useTrainerPlatformSubscriptionSettings();
  const settingsScreen = (
    <SettingsScreen
      userRole={USER_ROLE_TRAINER_SETTINGS}
      onClose={shell.rootGoBack}
      onNavigate={onNavigate}
      {...subscriptionProps}
    />
  );
  return wrapTrainerScreenWithNav(settingsScreen, shell);
}

/**
 * Help & FAQ overlay.
 * @returns {import('react').ReactElement}
 */
export function TrainerHelpFAQScreen() {
  const shell = useTrainerAppStartShell();
  const helpScreen = <HelpFAQScreen onClose={shell.rootGoBack} />;
  return wrapTrainerScreenWithNav(helpScreen, shell);
}

/**
 * Terms of service overlay.
 * @returns {import('react').ReactElement}
 */
export function TrainerTermsScreen() {
  const shell = useTrainerAppStartShell();
  const termsScreen = <TermsOfServiceScreen onClose={shell.rootGoBack} />;
  return wrapTrainerScreenWithNav(termsScreen, shell);
}

/**
 * Privacy policy overlay.
 * @returns {import('react').ReactElement}
 */
export function TrainerPrivacyScreen() {
  const shell = useTrainerAppStartShell();
  const privacyScreen = <PrivacyPolicyScreen onClose={shell.rootGoBack} />;
  return wrapTrainerScreenWithNav(privacyScreen, shell);
}

/**
 * Contact support overlay.
 * @returns {import('react').ReactElement}
 */
export function TrainerContactSupportScreen() {
  const shell = useTrainerAppStartShell();
  const contactScreen = <ContactSupportScreen onClose={shell.rootGoBack} />;
  return wrapTrainerScreenWithNav(contactScreen, shell);
}

/**
 * Bug report overlay.
 * @returns {import('react').ReactElement}
 */
export function TrainerBugReportScreen() {
  const shell = useTrainerAppStartShell();
  const bugReportScreen = <BugReportScreen onClose={shell.rootGoBack} />;
  return wrapTrainerScreenWithNav(bugReportScreen, shell);
}

/**
 * Privacy / data-rights overlay with keyword navigate for nested links.
 * @returns {import('react').ReactElement}
 */
export function TrainerPrivacyDataRightsScreen() {
  const shell = useTrainerAppStartShell();
  const onNavigate = buildNavigateFromShell(shell);
  const privacyRightsScreen = (
    <PrivacyDataRightsScreen onClose={shell.rootGoBack} onNavigate={onNavigate} />
  );
  return wrapTrainerScreenWithNav(privacyRightsScreen, shell);
}

/**
 * Trainer viewing a client's daily food log.
 * @returns {import('react').ReactElement}
 */
export function TrainerDailyFoodLogScreen() {
  const shell = useTrainerAppStartShell();
  const dailyLogScreen = (
    <DailyLogContent
      onBack={shell.handleHomePress}
      onProfilePress={shell.openProfile}
      onSettingsPress={shell.openSettings}
      onHomePress={shell.handleHomePress}
      onPlusPress={NOOP}
      onVoicePress={shell.openVoiceAI}
      onNutritionPress={NOOP}
      onWorkoutPress={shell.openWorkoutPlan}
      onMessagesPress={() => openConversationsList(shell)}
    />
  );
  return wrapTrainerScreenWithNav(dailyLogScreen, shell);
}

/**
 * Find-a-trainer overlay, same marketplace screen the client uses.
 * @returns {import('react').ReactElement}
 */
export function SearchTrainersScreenOverlay() {
  const shell = useTrainerAppStartShell();

  const handleSelectTrainer = (trainer) => {
    shell.setSelectedTrainer(trainer);
    shell.rootGoBack();
    shell.setShowTrainerMessaging(true);
  };

  const searchScreen = (
    <SearchTrainersScreen
      title="Find a Trainer"
      onBack={shell.rootGoBack}
      onSelectTrainer={handleSelectTrainer}
      onProfilePress={shell.openProfile}
      onSettingsPress={shell.openSettings}
      isDark={shell.isDark}
      onHomePress={shell.handleHomePress}
      onPlusPress={shell.handlePlusPress}
      onVoicePress={shell.openVoiceAI}
      onNutritionPress={shell.openNutrition}
      onWorkoutPress={shell.openWorkoutPlan}
      onMessagesPress={() => shell.setShowConversationsList(true)}
    />
  );
  return wrapTrainerScreenWithNav(searchScreen, shell);
}

/**
 * AI Coach home, or the open conversation when aiChatState is a session object.
 * @returns {import('react').ReactElement}
 */
export function TrainerVoiceAIScreen() {
  const shell = useTrainerAppStartShell();
  const coachIsInConversation = isOpenCoachConversation(shell.aiChatState);
  if (coachIsInConversation) {
    const conversationScreen = <TrainerCoachConversation shell={shell} />;
    return wrapTrainerScreenWithNav(conversationScreen, shell);
  }
  const coachHomeScreen = <TrainerCoachHome shell={shell} />;
  return wrapTrainerScreenWithNav(coachHomeScreen, shell);
}

/**
 * Weekly report for the client in route params, or the shell's stored client.
 * @returns {import('react').ReactElement|null}
 */
export function TrainerWeeklyReportScreenOverlay() {
  const shell = useTrainerAppStartShell();
  // vocab: useRoute = React Navigation hook for the active screen's params
  const route = useRoute();
  const clientIdFromRoute = route.params?.clientId;
  const clientIdFromShell = shell.weeklyReportScreen?.clientId;
  const clientId = clientIdFromRoute || clientIdFromShell;
  const clientNameFromRoute = route.params?.clientName;
  const clientNameFromShell = shell.weeklyReportScreen?.clientName || '';
  const clientName = clientNameFromRoute || clientNameFromShell || '';

  if (!clientId) {
    shell.rootGoBack();
    return null;
  }

  const weeklyReportScreen = (
    <TrainerWeeklyReportScreen
      clientId={clientId}
      clientName={clientName}
      isDark={shell.isDark}
      onClose={shell.rootGoBack}
      onHomePress={shell.handleHomePress}
      onPlusPress={shell.handlePlusPress}
      onVoicePress={shell.openVoiceAI}
      onNutritionPress={shell.openNutrition}
      onWorkoutPress={shell.openWorkoutPlan}
      onMessagesPress={(id) => openWeeklyReportMessages(shell, id)}
      onProfilePress={shell.openProfile}
      onSettingsPress={shell.openSettings}
    />
  );
  return wrapTrainerScreenWithNav(weeklyReportScreen, shell);
}

/**
 * Create-plan screen aimed at the dashboard's selected client.
 * @returns {import('react').ReactElement}
 */
export function TrainerWorkoutPlanScreen() {
  const shell = useTrainerAppStartShell();
  const { clientId, clientName } = workoutTabClient(shell);
  const rosterIsEmpty = !shell.clients?.length;
  const workoutPlanScreen = (
    <CreateWorkoutPlanScreen
      userId={clientId || undefined}
      trainerRosterEmpty={rosterIsEmpty}
      viewingClientName={clientName}
      onBack={shell.handleHomePress}
      onPlanGenerated={shell.handleHomePress}
      onNavigate={(route) => handleWorkoutPlanNavigate(shell, route)}
      onProfilePress={shell.openProfile}
      onSettingsPress={shell.openSettings}
    />
  );
  return wrapTrainerScreenWithNav(workoutPlanScreen, shell);
}

/**
 * Manual spreadsheet-style plan builder. Missing uid returns null so we do not save as nobody.
 * @returns {import('react').ReactElement|null}
 */
export function TrainerManualPlanBuilderScreen() {
  const shell = useTrainerAppStartShell();
  const trainerUid = shell.user?.uid;
  if (!trainerUid) return null;

  const manualBuilderScreen = (
    <ManualWorkoutPlanBuilderScreen
      trainerId={trainerUid}
      clients={shell.clients}
      editPlanId={shell.manualPlanEditId}
      defaultAssignedClientIds={shell.manualPlanBuilderClientIds}
      onClose={() => closeManualPlanBuilder(shell)}
      onProfilePress={shell.openProfile}
      onSettingsPress={shell.openSettings}
    />
  );
  return wrapTrainerScreenWithNav(manualBuilderScreen, shell);
}

/**
 * Earnings / payouts overlay.
 * @returns {import('react').ReactElement}
 */
export function TrainerEarningsScreen() {
  const shell = useTrainerAppStartShell();
  const earningsScreen = <EarningsScreen />;
  return wrapTrainerScreenWithNav(earningsScreen, shell);
}

/**
 * Design Law Notifications list (trainer = trainerUid field).
 * @returns {import('react').ReactElement}
 */
export function TrainerNotificationsScreen() {
  const shell = useTrainerAppStartShell();
  const onBack = shell.rootGoBack || shell.handleHomePress;
  const notificationsScreen = (
    <NotificationsScreen onBack={onBack} roleField="trainerUid" />
  );
  return wrapTrainerScreenWithNav(notificationsScreen, shell);
}

// ===== PLUMBING — skip unless debugging coach sub-screens or iOS Pro settings =====

/**
 * Short label for Settings. Empty object when this build does not sell the iOS trainer plan.
 * vocab: useSubscription = live Pro access from Firestore + StoreKit.
 * @returns {object}
 */
function useTrainerPlatformSubscriptionSettings() {
  const { accessState, restorePurchases, actionLoading, firestoreSubscription } = useSubscription();

  const isIos = Platform.OS === IOS_PLATFORM;
  const productIsEnabled = TRAINER_PLATFORM_SUBSCRIPTION_ENABLED;
  if (!isIos || !productIsEnabled) {
    return {};
  }

  return {
    platformSubscriptionStatus: platformSubscriptionStatusLabel(accessState.access),
    platformSubscriptionProductId: firestoreSubscription?.productId || null,
    onRestorePurchases: restorePurchases,
    restorePurchasesLoading: actionLoading,
  };
}

/**
 * Open coach conversation for the current aiChatState session.
 * @param {{ shell: object }} props
 * @returns {import('react').ReactElement}
 */
function TrainerCoachConversation({ shell }) {
  const sessionKey = trainerChatSessionKey(shell.aiChatState);
  const trainerUid = shell.user?.uid;

  const handleSessionSwitch = (session) => {
    shell.openAIChatSession({ sessionId: session.sessionId || session.id });
  };

  const handleNewChat = () => {
    shell.openAIChatSession({});
  };

  const handleBackToCoachHome = () => {
    shell.setAiChatState(AI_CHAT_HOME_STATE);
  };

  const handleHomeFromConversation = () => {
    shell.handleHomePress();
    shell.setAiChatState(AI_CHAT_HOME_STATE);
  };

  return (
    <CoachConversationScreen
      key={sessionKey}
      userId={trainerUid}
      prefill={shell.aiChatState.prefill}
      sessionId={shell.aiChatState.sessionId}
      enableHistorySidebar
      hideBottomNav={false}
      viewerRole="trainer"
      onSessionSwitch={handleSessionSwitch}
      onNewChat={handleNewChat}
      onBack={handleBackToCoachHome}
      onHomePress={handleHomeFromConversation}
      onPlusPress={shell.handlePlusPress}
      onVoicePress={shell.openVoiceAI}
      onNutritionPress={shell.openNutrition}
      onWorkoutPress={shell.openWorkoutPlan}
      onMessagesPress={() => shell.setShowConversationsList(true)}
      onProfilePress={shell.openProfile}
    />
  );
}

/**
 * Coach home plus the add-file popup for the selected client.
 * @param {{ shell: object }} props
 * @returns {import('react').ReactElement}
 */
function TrainerCoachHome({ shell }) {
  const trainerUid = shell.user?.uid;
  const clientCount = shell.clients?.length ?? 0;

  const handleStartChat = ({ prefill } = {}) => {
    shell.openAIChatSession({ prefill });
  };

  const handleSessionPress = (session) => {
    shell.openAIChatSession({ sessionId: session.sessionId || session.id });
  };

  const handleCloseAddFilePopup = () => {
    shell.setShowAddFilePopup(false);
  };

  const handleFileAdded = () => {
    shell.setShowAddFilePopup(false);
    shell.refreshClients?.();
  };

  const stubNavigate = () => {};

  return (
    <>
      <VoiceCoachScreen
        userId={trainerUid}
        hideBottomNav={false}
        // Design Law missing-screens 17/18 — trainer coach home copy + Do-it-for-me tools
        viewerRole="trainer"
        clientCount={clientCount}
        onStartChat={handleStartChat}
        onSessionPress={handleSessionPress}
        onHomePress={shell.handleHomePress}
        onPlusPress={shell.handlePlusPress}
        onVoicePress={shell.openVoiceAI}
        onNutritionPress={shell.openNutrition}
        onWorkoutPress={shell.openWorkoutPlan}
        onMessagesPress={() => shell.setShowConversationsList(true)}
        onProfilePress={shell.openProfile}
        navigation={{ navigate: stubNavigate, goBack: shell.handleHomePress }}
      />
      <AddFilePopup
        visible={shell.showAddFilePopup}
        onClose={handleCloseAddFilePopup}
        onAdded={handleFileAdded}
        isDark={shell.isDark}
        clientId={shell.addNotesFilesClientId}
        addedBy={ADDED_BY_TRAINER}
      />
    </>
  );
}
