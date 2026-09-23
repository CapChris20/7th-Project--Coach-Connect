/**
 * trainer Overlay Screens
 *
 * Purpose: UI screen or component: trainer Overlay Screens. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: TrainerViewMyMyProfileScreen, TrainerSettingsScreen, TrainerHelpFAQScreen, TrainerTermsScreen, TrainerPrivacyScreen, TrainerContactSupportScreen, TrainerBugReportScreen, TrainerDailyFoodLogScreen
 *
 * @file-header
 */
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

function withNav(children, shell) {
  return <AppNavigationProvider {...shell.navProviderProps}>{children}</AppNavigationProvider>;
}

export function TrainerViewMyMyProfileScreen() {
  const s = useTrainerAppStartShell();
  return withNav(
    <ViewMyMyProfileScreen
      onBack={s.rootGoBack}
      userRole="Trainer"
      userData={s.trainerProfileDoc || {}}
      onboardingData={s.trainerProfileDoc || {}}
      onNavigate={s.onNavigate}
      onProfileSaved={s.refreshTrainerUserDoc}
      onOpenPayments={s.openPayments}
      trainerClientCount={s.clients?.length ?? 0}
    />,
    s,
  );
}

export function TrainerSettingsScreen() {
  const s = useTrainerAppStartShell();
  const onNavigate = buildNavigateFromShell(s);
  const subscriptionProps = useTrainerPlatformSubscriptionSettings();
  return withNav(
    <SettingsScreen
      userRole="trainer"
      onClose={s.rootGoBack}
      onNavigate={onNavigate}
      {...subscriptionProps}
    />,
    s,
  );
}

function useTrainerPlatformSubscriptionSettings() {
  const { accessState, restorePurchases, actionLoading, firestoreSubscription } = useSubscription();

  if (Platform.OS !== 'ios' || !TRAINER_PLATFORM_SUBSCRIPTION_ENABLED) {
    return {};
  }

  const statusLabel = (() => {
    if (accessState.access === 'free_trial') return 'Free trial active';
    if (accessState.access === 'active') return 'Pro — active';
    if (accessState.access === 'expired') return 'Expired';
    return 'No active subscription';
  })();

  return {
    platformSubscriptionStatus: statusLabel,
    platformSubscriptionProductId: firestoreSubscription?.productId || null,
    onRestorePurchases: restorePurchases,
    restorePurchasesLoading: actionLoading,
  };
}

export function TrainerHelpFAQScreen() {
  const s = useTrainerAppStartShell();
  return withNav(<HelpFAQScreen onClose={s.rootGoBack} />, s);
}

export function TrainerTermsScreen() {
  const s = useTrainerAppStartShell();
  return withNav(<TermsOfServiceScreen onClose={s.rootGoBack} />, s);
}

export function TrainerPrivacyScreen() {
  const s = useTrainerAppStartShell();
  return withNav(<PrivacyPolicyScreen onClose={s.rootGoBack} />, s);
}

export function TrainerContactSupportScreen() {
  const s = useTrainerAppStartShell();
  return withNav(<ContactSupportScreen onClose={s.rootGoBack} />, s);
}

export function TrainerBugReportScreen() {
  const s = useTrainerAppStartShell();
  return withNav(<BugReportScreen onClose={s.rootGoBack} />, s);
}

export function TrainerDailyFoodLogScreen() {
  const s = useTrainerAppStartShell();
  return withNav(
    <DailyLogContent
      onBack={s.handleHomePress}
      onProfilePress={s.openProfile}
      onSettingsPress={s.openSettings}
      onHomePress={s.handleHomePress}
      onPlusPress={() => {}}
      onVoicePress={s.openVoiceAI}
      onNutritionPress={() => {}}
      onWorkoutPress={s.openWorkoutPlan}
      onMessagesPress={() => {
        s.setShowTrainerMessaging(false);
        s.setShowConversationsList(true);
      }}
    />,
    s,
  );
}

export function SearchTrainersScreenOverlay() {
  const s = useTrainerAppStartShell();
  return withNav(
    <SearchTrainersScreen
      title="Find a Trainer"
      onBack={s.rootGoBack}
      onSelectTrainer={(t) => {
        s.setSelectedTrainer(t);
        s.rootGoBack();
        s.setShowTrainerMessaging(true);
      }}
      onProfilePress={s.openProfile}
      onSettingsPress={s.openSettings}
      isDark={s.isDark}
      onHomePress={s.handleHomePress}
      onPlusPress={s.handlePlusPress}
      onVoicePress={s.openVoiceAI}
      onNutritionPress={s.openNutrition}
      onWorkoutPress={s.openWorkoutPlan}
      onMessagesPress={() => s.setShowConversationsList(true)}
    />,
    s,
  );
}

export function TrainerVoiceAIScreen() {
  const s = useTrainerAppStartShell();
  if (s.aiChatState != null && typeof s.aiChatState === 'object') {
    return withNav(
      <CoachConversationScreen
        key={JSON.stringify({
          sid: s.aiChatState.sessionId ?? null,
          pf: s.aiChatState.prefill ?? null,
        })}
        userId={s.user?.uid}
        prefill={s.aiChatState.prefill}
        sessionId={s.aiChatState.sessionId}
        enableHistorySidebar
        hideBottomNav={false}
        onSessionSwitch={(session) =>
          s.openAIChatSession({ sessionId: session.sessionId || session.id })
        }
        onNewChat={() => s.openAIChatSession({})}
        onBack={() => s.setAiChatState('home')}
        onHomePress={() => {
          s.handleHomePress();
          s.setAiChatState('home');
        }}
        onPlusPress={s.handlePlusPress}
        onVoicePress={s.openVoiceAI}
        onNutritionPress={s.openNutrition}
        onWorkoutPress={s.openWorkoutPlan}
        onMessagesPress={() => s.setShowConversationsList(true)}
        onProfilePress={s.openProfile}
      />,
      s,
    );
  }
  return withNav(
    <>
      <VoiceCoachScreen
        userId={s.user?.uid}
        hideBottomNav={false}
        onStartChat={({ prefill } = {}) => s.openAIChatSession({ prefill })}
        onSessionPress={(session) =>
          s.openAIChatSession({ sessionId: session.sessionId || session.id })
        }
        onHomePress={s.handleHomePress}
        onPlusPress={s.handlePlusPress}
        onVoicePress={s.openVoiceAI}
        onNutritionPress={s.openNutrition}
        onWorkoutPress={s.openWorkoutPlan}
        onMessagesPress={() => s.setShowConversationsList(true)}
        onProfilePress={s.openProfile}
        navigation={{ navigate: () => {}, goBack: s.handleHomePress }}
      />
      <AddFilePopup
        visible={s.showAddFilePopup}
        onClose={() => s.setShowAddFilePopup(false)}
        onAdded={() => {
          s.setShowAddFilePopup(false);
          s.refreshClients?.();
        }}
        isDark={s.isDark}
        clientId={s.addNotesFilesClientId}
        addedBy="trainer"
      />
    </>,
    s,
  );
}

export function TrainerWeeklyReportScreenOverlay() {
  const s = useTrainerAppStartShell();
  const route = useRoute();
  const clientId = route.params?.clientId || s.weeklyReportScreen?.clientId;
  const clientName = route.params?.clientName || s.weeklyReportScreen?.clientName || '';
  if (!clientId) {
    s.rootGoBack();
    return null;
  }
  return withNav(
    <TrainerWeeklyReportScreen
      clientId={clientId}
      clientName={clientName}
      isDark={s.isDark}
      onClose={s.rootGoBack}
      onHomePress={s.handleHomePress}
      onPlusPress={s.handlePlusPress}
      onVoicePress={s.openVoiceAI}
      onNutritionPress={s.openNutrition}
      onWorkoutPress={s.openWorkoutPlan}
      onMessagesPress={(cid) => {
        s.setSelectedClientIdForMessages(cid);
        s.setShowTrainerMessaging(false);
        s.setShowConversationsList(true);
      }}
      onProfilePress={s.openProfile}
      onSettingsPress={s.openSettings}
    />,
    s,
  );
}

export function TrainerWorkoutPlanScreen() {
  const s = useTrainerAppStartShell();
  const workoutTabClientId =
    s.clients?.length > 0
      ? s.selectedClientIdFromDashboard || s.clients[0]?.id
      : null;
  const workoutTabClientRow = workoutTabClientId
    ? s.clients.find((c) => c.id === workoutTabClientId)
    : null;
  const workoutTabClientName =
    String(workoutTabClientRow?.name || workoutTabClientRow?.displayName || '').trim() || '';

  return withNav(
    <CreateWorkoutPlanScreen
      userId={workoutTabClientId || undefined}
      trainerRosterEmpty={!s.clients?.length}
      viewingClientName={workoutTabClientName}
      onBack={s.handleHomePress}
      onPlanGenerated={s.handleHomePress}
      onNavigate={(route) => {
        if (route === 'settings') {
          s.rootGoBack();
          s.openSettings();
          return;
        }
        s.handleHomePress();
      }}
      onProfilePress={s.openProfile}
      onSettingsPress={s.openSettings}
    />,
    s,
  );
}

export function TrainerManualPlanBuilderScreen() {
  const s = useTrainerAppStartShell();
  if (!s.user?.uid) return null;
  return withNav(
    <ManualWorkoutPlanBuilderScreen
      trainerId={s.user.uid}
      clients={s.clients}
      editPlanId={s.manualPlanEditId}
      defaultAssignedClientIds={s.manualPlanBuilderClientIds}
      onClose={() => {
        const returnTo = s.manualBuilderReturnToAI;
        s.setManualPlanEditId(null);
        s.setManualPlanBuilderClientIds([]);
        s.setManualBuilderReturnToAI(false);
        s.rootGoBack();
        if (returnTo && s.day6Client?.id) {
          s.setShowAIWorkouts(true);
          s.setAiWorkoutsListKey((k) => k + 1);
        }
      }}
      onProfilePress={s.openProfile}
      onSettingsPress={s.openSettings}
    />,
    s,
  );
}

export function TrainerEarningsScreen() {
  const s = useTrainerAppStartShell();
  return withNav(<EarningsScreen />, s);
}
