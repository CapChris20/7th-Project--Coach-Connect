// Overlay screens the trainer stack opens from home: profile, settings, FAQ, coach, plans, earnings.
// Flow: read the trainer shell → wrap the shared screen in AppNavigationProvider → pass the same back/nav handlers.
// Used by the trainer navigator. Route name strings stay exactly as the stack registers them.

import React from 'react';
import { Alert, Platform } from 'react-native';
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
import DailyLogContent from '../../nutrition/daily-log/DailyLogContent';
import SearchTrainersScreen from '../../client-app/find-a-trainer/SearchTrainersScreen';
import VoiceCoachScreen from '../../ai-coach/home-screen/CoachHomeScreen';
import CoachConversationScreen from '../../ai-coach/conversation/CoachConversationScreen';
import CreateWorkoutPlanScreen from '../../workouts/create-plan/CreateWorkoutPlanScreen';
import TrainerWeeklyReportScreen from '../../for-both/weekly-report/WeeklyReportScreen';
import ManualWorkoutPlanBuilderScreen from '../workout-plans/ManualWorkoutPlanBuilderScreen';
import EarningsScreen from '../earnings/EarningsScreen';
import AddFilePopup from '../../for-both/files-and-notes/viewers/AddFilePopup';
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

// ===== HELPER FUNCTIONS =====

function withNav(children, shell) {
  return <AppNavigationProvider {...shell.navProviderProps}>{children}</AppNavigationProvider>;
}

/**
 * Short label for Settings. Empty object when this build does not sell the iOS trainer plan.
 * vocab: useSubscription = live Pro access from Firestore + StoreKit.
 * @returns {object}
 */
function useTrainerPlatformSubscriptionSettings() {
  const { accessState, restorePurchases, actionLoading, firestoreSubscription } = useSubscription();

  if (Platform.OS !== IOS_PLATFORM || !TRAINER_PLATFORM_SUBSCRIPTION_ENABLED) {
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
 * Dashboard client the workout tab is editing. Empty roster → no userId.
 * @param {object} shell
 * @returns {{ clientId: string|null, clientName: string }}
 */
function workoutTabClient(shell) {
  const hasClients = shell.clients?.length > 0;
  const clientId = hasClients
    ? shell.selectedClientIdFromDashboard || shell.clients[0]?.id
    : null;
  const clientRow = clientId
    ? shell.clients.find((client) => client.id === clientId)
    : null;
  const clientName = String(clientRow?.name || clientRow?.displayName || '').trim() || '';
  return { clientId, clientName };
}

function openConversationsList(shell) {
  shell.setShowTrainerMessaging(false);
  shell.setShowConversationsList(true);
}

function trainerChatSessionKey(aiChatState) {
  return JSON.stringify({
    sid: aiChatState.sessionId ?? null,
    pf: aiChatState.prefill ?? null,
  });
}

function isOpenCoachConversation(aiChatState) {
  return aiChatState != null && typeof aiChatState === 'object';
}

function TrainerCoachConversation({ shell }) {
  return (
    <CoachConversationScreen
      key={trainerChatSessionKey(shell.aiChatState)}
      userId={shell.user?.uid}
      prefill={shell.aiChatState.prefill}
      sessionId={shell.aiChatState.sessionId}
      enableHistorySidebar
      hideBottomNav={false}
      onSessionSwitch={(session) =>
        shell.openAIChatSession({ sessionId: session.sessionId || session.id })
      }
      onNewChat={() => shell.openAIChatSession({})}
      onBack={() => shell.setAiChatState('home')}
      onHomePress={() => {
        shell.handleHomePress();
        shell.setAiChatState('home');
      }}
      onPlusPress={shell.handlePlusPress}
      onVoicePress={shell.openVoiceAI}
      onNutritionPress={shell.openNutrition}
      onWorkoutPress={shell.openWorkoutPlan}
      onMessagesPress={() => shell.setShowConversationsList(true)}
      onProfilePress={shell.openProfile}
    />
  );
}

function TrainerCoachHome({ shell }) {
  return (
    <>
      <VoiceCoachScreen
        userId={shell.user?.uid}
        hideBottomNav={false}
        onStartChat={({ prefill } = {}) => shell.openAIChatSession({ prefill })}
        onSessionPress={(session) =>
          shell.openAIChatSession({ sessionId: session.sessionId || session.id })
        }
        onHomePress={shell.handleHomePress}
        onPlusPress={shell.handlePlusPress}
        onVoicePress={shell.openVoiceAI}
        onNutritionPress={shell.openNutrition}
        onWorkoutPress={shell.openWorkoutPlan}
        onMessagesPress={() => shell.setShowConversationsList(true)}
        onProfilePress={shell.openProfile}
        navigation={{ navigate: () => {}, goBack: shell.handleHomePress }}
      />
      <AddFilePopup
        visible={shell.showAddFilePopup}
        onClose={() => shell.setShowAddFilePopup(false)}
        onAdded={() => {
          shell.setShowAddFilePopup(false);
          shell.refreshClients?.();
        }}
        isDark={shell.isDark}
        clientId={shell.addNotesFilesClientId}
        addedBy={ADDED_BY_TRAINER}
      />
    </>
  );
}

function closeManualPlanBuilder(shell) {
  const returnTo = shell.manualBuilderReturnToAI;
  shell.setManualPlanEditId(null);
  shell.setManualPlanBuilderClientIds([]);
  shell.setManualBuilderReturnToAI(false);
  shell.rootGoBack();
  if (returnTo && shell.day6Client?.id) {
    shell.setShowAIWorkouts(true);
    shell.setAiWorkoutsListKey((listKey) => listKey + 1);
  }
}

function handleWorkoutPlanNavigate(shell, route) {
  if (route === SETTINGS_ROUTE) {
    shell.rootGoBack();
    shell.openSettings();
    return;
  }
  shell.handleHomePress();
}

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
  return withNav(
    <ViewMyMyProfileScreen
      onBack={shell.rootGoBack}
      userRole={USER_ROLE_TRAINER_PROFILE}
      userData={shell.trainerProfileDoc || {}}
      onboardingData={shell.trainerProfileDoc || {}}
      onNavigate={shell.onNavigate}
      onProfileSaved={shell.refreshTrainerUserDoc}
      onOpenPayments={shell.openPayments}
      trainerClientCount={shell.clients?.length ?? 0}
    />,
    shell,
  );
}

/**
 * Settings. iOS Pro restore controls are added only when that product is enabled.
 * @returns {import('react').ReactElement}
 */
export function TrainerSettingsScreen() {
  const shell = useTrainerAppStartShell();
  const onNavigate = buildNavigateFromShell(shell);
  const subscriptionProps = useTrainerPlatformSubscriptionSettings();
  return withNav(
    <SettingsScreen
      userRole={USER_ROLE_TRAINER_SETTINGS}
      onClose={shell.rootGoBack}
      onNavigate={onNavigate}
      {...subscriptionProps}
    />,
    shell,
  );
}

/**
 * @returns {import('react').ReactElement}
 */
export function TrainerHelpFAQScreen() {
  const shell = useTrainerAppStartShell();
  return withNav(<HelpFAQScreen onClose={shell.rootGoBack} />, shell);
}

/**
 * @returns {import('react').ReactElement}
 */
export function TrainerTermsScreen() {
  const shell = useTrainerAppStartShell();
  return withNav(<TermsOfServiceScreen onClose={shell.rootGoBack} />, shell);
}

/**
 * @returns {import('react').ReactElement}
 */
export function TrainerPrivacyScreen() {
  const shell = useTrainerAppStartShell();
  return withNav(<PrivacyPolicyScreen onClose={shell.rootGoBack} />, shell);
}

/**
 * @returns {import('react').ReactElement}
 */
export function TrainerContactSupportScreen() {
  const shell = useTrainerAppStartShell();
  return withNav(<ContactSupportScreen onClose={shell.rootGoBack} />, shell);
}

/**
 * @returns {import('react').ReactElement}
 */
export function TrainerBugReportScreen() {
  const shell = useTrainerAppStartShell();
  return withNav(<BugReportScreen onClose={shell.rootGoBack} />, shell);
}

/**
 * Trainer viewing a client's daily food log.
 * @returns {import('react').ReactElement}
 */
export function TrainerDailyFoodLogScreen() {
  const shell = useTrainerAppStartShell();
  return withNav(
    <DailyLogContent
      onBack={shell.handleHomePress}
      onProfilePress={shell.openProfile}
      onSettingsPress={shell.openSettings}
      onHomePress={shell.handleHomePress}
      onPlusPress={() => {}}
      onVoicePress={shell.openVoiceAI}
      onNutritionPress={() => {}}
      onWorkoutPress={shell.openWorkoutPlan}
      onMessagesPress={() => openConversationsList(shell)}
    />,
    shell,
  );
}

/**
 * Find-a-trainer overlay, same marketplace screen the client uses.
 * @returns {import('react').ReactElement}
 */
export function SearchTrainersScreenOverlay() {
  const shell = useTrainerAppStartShell();
  return withNav(
    <SearchTrainersScreen
      title="Find a Trainer"
      onBack={shell.rootGoBack}
      onSelectTrainer={(trainer) => {
        shell.setSelectedTrainer(trainer);
        shell.rootGoBack();
        shell.setShowTrainerMessaging(true);
      }}
      onProfilePress={shell.openProfile}
      onSettingsPress={shell.openSettings}
      isDark={shell.isDark}
      onHomePress={shell.handleHomePress}
      onPlusPress={shell.handlePlusPress}
      onVoicePress={shell.openVoiceAI}
      onNutritionPress={shell.openNutrition}
      onWorkoutPress={shell.openWorkoutPlan}
      onMessagesPress={() => shell.setShowConversationsList(true)}
    />,
    shell,
  );
}

/**
 * AI Coach home, or the open conversation when aiChatState is a session object.
 * @returns {import('react').ReactElement}
 */
export function TrainerVoiceAIScreen() {
  const shell = useTrainerAppStartShell();
  if (isOpenCoachConversation(shell.aiChatState)) {
    return withNav(<TrainerCoachConversation shell={shell} />, shell);
  }
  return withNav(<TrainerCoachHome shell={shell} />, shell);
}

/**
 * Weekly report for the client in route params, or the shell's stored client.
 * @returns {import('react').ReactElement|null}
 */
export function TrainerWeeklyReportScreenOverlay() {
  const shell = useTrainerAppStartShell();
  const route = useRoute();
  const clientId = route.params?.clientId || shell.weeklyReportScreen?.clientId;
  const clientName = route.params?.clientName || shell.weeklyReportScreen?.clientName || '';
  if (!clientId) {
    shell.rootGoBack();
    return null;
  }
  return withNav(
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
    />,
    shell,
  );
}

/**
 * Create-plan screen aimed at the dashboard's selected client.
 * @returns {import('react').ReactElement}
 */
export function TrainerWorkoutPlanScreen() {
  const shell = useTrainerAppStartShell();
  const { clientId, clientName } = workoutTabClient(shell);

  return withNav(
    <CreateWorkoutPlanScreen
      userId={clientId || undefined}
      trainerRosterEmpty={!shell.clients?.length}
      viewingClientName={clientName}
      onBack={shell.handleHomePress}
      onPlanGenerated={shell.handleHomePress}
      onNavigate={(route) => handleWorkoutPlanNavigate(shell, route)}
      onProfilePress={shell.openProfile}
      onSettingsPress={shell.openSettings}
    />,
    shell,
  );
}

/**
 * Manual spreadsheet-style plan builder. Missing uid returns null so we do not save as nobody.
 * @returns {import('react').ReactElement|null}
 */
export function TrainerManualPlanBuilderScreen() {
  const shell = useTrainerAppStartShell();
  if (!shell.user?.uid) return null;
  return withNav(
    <ManualWorkoutPlanBuilderScreen
      trainerId={shell.user.uid}
      clients={shell.clients}
      editPlanId={shell.manualPlanEditId}
      defaultAssignedClientIds={shell.manualPlanBuilderClientIds}
      onClose={() => closeManualPlanBuilder(shell)}
      onProfilePress={shell.openProfile}
      onSettingsPress={shell.openSettings}
    />,
    shell,
  );
}

/**
 * @returns {import('react').ReactElement}
 */
export function TrainerEarningsScreen() {
  const shell = useTrainerAppStartShell();
  return withNav(<EarningsScreen />, shell);
}
