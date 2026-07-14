/**
 * trainer Overlay Screens
 *
 * Purpose: UI screen or component: trainer Overlay Screens. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: TrainerViewMyViewMyProfileScreen, TrainerSettingsScreen, TrainerHelpFAQScreen, TrainerTermsScreen, TrainerPrivacyScreen, TrainerContactSupportScreen, TrainerBugReportScreen, TrainerNutritionScreen
 *
 * @file-header
 */
import React from 'react';
import { Alert, Platform } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { AppNavigationProvider } from '../../navigation/AppNavigationContext';
import { useTrainerAppShell } from './TrainerAppShellContext';
import { buildNavigateFromShell } from '../../navigation/shellNavigate';
import ViewMyViewMyProfileScreen from '../../client-app/profile/ViewMyProfileScreen';
import SettingsScreen from '../../settings/screens/SettingsScreen';
import HelpFAQScreen from '../../settings/screens/HelpFAQScreen';
import TermsOfServiceScreen from '../../settings/screens/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../../settings/screens/PrivacyPolicyScreen';
import ContactSupportScreen from '../../settings/screens/ContactSupportScreen';
import BugReportScreen from '../../settings/screens/BugReportScreen';
import NutritionContainer from '../../nutrition/daily-log/NutritionContainer';
import SearchTrainersScreen from '../../client-app/marketplace/SearchTrainersScreen';
import VoiceCoachScreen from '../../ai-coach/chat-ui/voice/VoiceCoachScreen';
import ChatWithCoachScreen from '../../ai-coach/chat-ui/chat-thread/ChatWithCoachScreen';
import WorkoutPlanGeneratorScreen from '../../workouts/active-workout/workout';
import TrainerViewWeekProgressReportScreen from '../../shared/weekly-report/ViewWeekProgressReportScreen';
import ManualWorkoutPlanBuilderScreen from '../workout-plans/ManualWorkoutPlanBuilderScreen';
import PaymentsScreen from '../payments/PaymentsScreen';
import AddNotesFilesModal from '../../shared/components/notes-files/AddNotesFilesModal';
import { useSubscription } from '../../subscription/SubscriptionProvider';
import { TRAINER_PLATFORM_SUBSCRIPTION_ENABLED } from '../../subscription/constants';

function withNav(children, shell) {
  return <AppNavigationProvider {...shell.navProviderProps}>{children}</AppNavigationProvider>;
}

export function TrainerViewMyViewMyProfileScreen() {
  const s = useTrainerAppShell();
  return withNav(
    <ViewMyViewMyProfileScreen
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
  const s = useTrainerAppShell();
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
  const s = useTrainerAppShell();
  return withNav(<HelpFAQScreen onClose={s.rootGoBack} />, s);
}

export function TrainerTermsScreen() {
  const s = useTrainerAppShell();
  return withNav(<TermsOfServiceScreen onClose={s.rootGoBack} />, s);
}

export function TrainerPrivacyScreen() {
  const s = useTrainerAppShell();
  return withNav(<PrivacyPolicyScreen onClose={s.rootGoBack} />, s);
}

export function TrainerContactSupportScreen() {
  const s = useTrainerAppShell();
  return withNav(<ContactSupportScreen onClose={s.rootGoBack} />, s);
}

export function TrainerBugReportScreen() {
  const s = useTrainerAppShell();
  return withNav(<BugReportScreen onClose={s.rootGoBack} />, s);
}

export function TrainerNutritionScreen() {
  const s = useTrainerAppShell();
  return withNav(
    <NutritionContainer
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
  const s = useTrainerAppShell();
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
  const s = useTrainerAppShell();
  if (s.aiChatState != null && typeof s.aiChatState === 'object') {
    return withNav(
      <ChatWithCoachScreen
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
      <AddNotesFilesModal
        visible={s.showAddNotesFilesModal}
        onClose={() => s.setShowAddNotesFilesModal(false)}
        onAdded={() => {
          s.setShowAddNotesFilesModal(false);
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

export function TrainerViewWeekProgressReportScreenOverlay() {
  const s = useTrainerAppShell();
  const route = useRoute();
  const clientId = route.params?.clientId || s.weeklyReportScreen?.clientId;
  const clientName = route.params?.clientName || s.weeklyReportScreen?.clientName || '';
  if (!clientId) {
    s.rootGoBack();
    return null;
  }
  return withNav(
    <TrainerViewWeekProgressReportScreen
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
  const s = useTrainerAppShell();
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
    <WorkoutPlanGeneratorScreen
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
  const s = useTrainerAppShell();
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

export function TrainerPaymentsScreen() {
  const s = useTrainerAppShell();
  return withNav(<PaymentsScreen />, s);
}
