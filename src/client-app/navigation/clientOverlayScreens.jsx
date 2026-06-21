/**
 * client Overlay Screens
 *
 * Purpose: UI screen or component: client Overlay Screens. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: ClientViewMyViewMyProfileScreen, ClientSettingsScreen, ClientHelpFAQScreen, ClientTermsScreen, ClientPrivacyScreen, ClientContactSupportScreen, ClientBugReportScreen, ClientNutritionScreen
 *
 * @file-header
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { AppNavigationProvider } from '../../navigation/AppNavigationContext';
import { useClientAppShell } from './ClientAppShellContext';
import ViewMyViewMyProfileScreen from '../../client-app/profile/ViewMyProfileScreen';
import SettingsScreen from '../../settings/screens/SettingsScreen';
import HelpFAQScreen from '../../settings/screens/HelpFAQScreen';
import TermsOfServiceScreen from '../../settings/screens/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../../settings/screens/PrivacyPolicyScreen';
import ContactSupportScreen from '../../settings/screens/ContactSupportScreen';
import BugReportScreen from '../../settings/screens/BugReportScreen';
import NutritionContainer from '../../nutrition/daily-log/NutritionContainer';
import AddNotesFilesModal from '../../shared/components/notes-files/AddNotesFilesModal';
import SearchTrainersScreen, { TrainerProfileSheet } from '../marketplace/screens/SearchTrainersScreen';
import ViewWeekProgressReportScreen from '../screens/ViewWeekProgressReportScreen';
import MyProgressPhotosScreen from '../screens/MyProgressPhotosScreen';
import BrowseSavedWorkoutsScreen from '../screens/BrowseSavedWorkoutsScreen';
import WorkoutPlanGeneratorScreen from '../../workouts/active-workout/workout';
import StartCoachChatScreen from '../../ai-coach/chat-ui/chat-home/StartCoachChatScreen';
import ChatWithCoachScreen from '../../ai-coach/chat-ui/chat-thread/ChatWithCoachScreen';
import ClientShellBottomNav from './ClientShellBottomNav';

let AICoachTestSuite = null;
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  AICoachTestSuite = require('../../ai-coach/chat-ui/AICoachTestSuite').default;
}
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app-start/config';
import { rootNavigate } from '../../navigation/navigationRef';
import { buildNavigateFromShell } from '../../navigation/shellNavigate';

function rootNavigateTests(shell) {
  shell.setAiChatState('home');
  rootNavigate('ClientAICoachTests');
}

function withNav(children, shell, { activeTabKey } = {}) {
  return (
    <AppNavigationProvider {...shell.navProviderProps}>
      <View style={{ flex: 1 }}>
        {children}
        <ClientShellBottomNav shell={shell} activeTabKey={activeTabKey} />
      </View>
    </AppNavigationProvider>
  );
}

export function ClientViewMyViewMyProfileScreen() {
  const s = useClientAppShell();
  const onNavigate = buildNavigateFromShell(s);
  return withNav(
    <>
      <ViewMyViewMyProfileScreen
        onBack={s.rootGoBack}
        embedShellBottomNav
        userRole="Client"
        userData={s.userData}
        onboardingData={s.onboardingData}
        onNavigate={onNavigate}
        onProfileSaved={async () => {
          try {
            s.onRefetchUserData?.();
            if (s.user?.uid && db) {
              const snap = await getDoc(doc(db, 'users', s.user.uid));
              if (snap.exists()) s.setOnboardingData(snap.data());
            }
          } catch (e) {
            console.warn('ViewMyViewMyProfileScreen refresh after save:', e?.message);
          }
        }}
      />
      {s.addNotesFilesModalEl}
    </>,
    s,
  );
}

export function ClientSettingsScreen() {
  const s = useClientAppShell();
  const onNavigate = buildNavigateFromShell(s);
  return withNav(
    <>
      <SettingsScreen
        onBack={s.rootGoBack}
        onNavigate={onNavigate}
        userData={s.userData}
        trainerData={s.trainerData}
        embedShellBottomNav
      />
      {s.addNotesFilesModalEl}
    </>,
    s,
  );
}

export function ClientHelpFAQScreen() {
  const s = useClientAppShell();
  return withNav(<HelpFAQScreen onClose={s.rootGoBack} embedShellBottomNav />, s);
}

export function ClientTermsScreen() {
  const s = useClientAppShell();
  return withNav(<TermsOfServiceScreen onClose={s.rootGoBack} embedShellBottomNav />, s);
}

export function ClientPrivacyScreen() {
  const s = useClientAppShell();
  return withNav(<PrivacyPolicyScreen onClose={s.rootGoBack} embedShellBottomNav />, s);
}

export function ClientContactSupportScreen() {
  const s = useClientAppShell();
  return withNav(<ContactSupportScreen onClose={s.rootGoBack} embedShellBottomNav />, s);
}

export function ClientBugReportScreen() {
  const s = useClientAppShell();
  return withNav(<BugReportScreen onClose={s.rootGoBack} embedShellBottomNav />, s);
}

export function ClientNutritionScreen() {
  const s = useClientAppShell();
  return withNav(
    <>
      <NutritionContainer
        hideBottomNav
        onBack={() => {
          s.rootGoBack();
          s.refetchNutritionData?.();
        }}
        onNutritionDataChanged={s.refetchNutritionData}
        onProfilePress={s.openProfile}
        onSettingsPress={s.openSettings}
        onHomePress={s.handleHomePress}
        onPlusPress={() => s.setShowAddNotesFilesModal(true)}
        onVoicePress={s.openAIChatHome}
        onNutritionPress={s.openNutrition}
        onWorkoutPress={s.openWorkout}
        onMessagesPress={s.handleOpenConversations}
      />
      <AddNotesFilesModal
        visible={s.showAddNotesFilesModal}
        onClose={() => s.setShowAddNotesFilesModal(false)}
        onAdded={s.refreshNotesAndFiles}
        isDark={s.isDark}
      />
    </>,
    s,
  );
}

export function ClientWorkoutPlanScreen() {
  const s = useClientAppShell();
  return withNav(
    <>
      <WorkoutPlanGeneratorScreen
        hideBottomNav
        onBack={s.rootGoBack}
        onProfilePress={s.openProfile}
        onSettingsPress={s.openSettings}
      />
      {s.addNotesFilesModalEl}
    </>,
    s,
  );
}

export function ClientSearchTrainersScreen() {
  const s = useClientAppShell();
  return withNav(
    <>
      <SearchTrainersScreen
        onBack={s.rootGoBack}
        showBottomNav={false}
        onSelectTrainer={(trainer) => {
          s.setProfileTrainer(trainer);
          s.rootGoBack();
          s.openTrainerProfile();
        }}
      />
      {s.addNotesFilesModalEl}
    </>,
    s,
  );
}

export function ClientTrainerViewMyViewMyProfileScreen() {
  const s = useClientAppShell();
  useEffect(() => {
    if (!s.profileTrainer) s.rootGoBack();
  }, [s.profileTrainer, s.rootGoBack]);
  if (!s.profileTrainer) return null;
  return withNav(
    <>
      <TrainerProfileSheet
        embedded
        visible
        isDark={s.isDark}
        trainer={s.profileTrainer}
        onClose={s.rootGoBack}
      />
      {s.addNotesFilesModalEl}
    </>,
    s,
  );
}

export function ClientViewWeekProgressReportScreen() {
  const s = useClientAppShell();
  if (!s.user?.uid) return null;
  return withNav(
    <>
      <ViewWeekProgressReportScreen
        clientId={s.user.uid}
        clientName={s.userData?.firstName || s.user?.displayName || 'You'}
        isClientSelfView
        isDark={s.isDark}
        onClose={s.rootGoBack}
        onHomePress={() => {
          s.rootGoBack();
          s.handleHomePress();
        }}
        onPlusPress={() => {
          s.rootGoBack();
          s.setShowAddNotesFilesModal(true);
        }}
        onVoicePress={() => {
          s.rootGoBack();
          s.openAIChatHome();
        }}
        onNutritionPress={() => {
          s.rootGoBack();
          s.openNutrition();
        }}
        onWorkoutPress={() => {
          s.rootGoBack();
          s.openWorkout();
        }}
        onMessagesPress={() => {
          s.rootGoBack();
          s.handleOpenConversations();
        }}
        onProfilePress={() => {
          s.rootGoBack();
          s.openProfile();
        }}
        onSettingsPress={() => {
          s.rootGoBack();
          s.openSettings();
        }}
      />
      {s.addNotesFilesModalEl}
    </>,
    s,
  );
}

export function ClientMyProgressPhotosScreen() {
  const s = useClientAppShell();
  if (!s.day6Client?.id) return null;
  return withNav(
    <MyProgressPhotosScreen
      route={{ params: { clientId: s.day6Client.id, clientName: s.day6Client.name, allowUpload: true } }}
      navigation={{ goBack: s.rootGoBack }}
      onRegisterAddHandler={s.registerProgressPhotoAddHandler}
      useShellHeader
      onBack={s.rootGoBack}
      reserveShellBottomNav
    />,
    s,
  );
}

export function ClientAIWorkoutsScreen() {
  const s = useClientAppShell();
  if (!s.day6Client?.id) return null;
  return withNav(
    <BrowseSavedWorkoutsScreen
      embedInLayout={false}
      client={s.day6Client}
      trainerId={s.userData?.trainerId}
      viewerRole="client"
      onBack={s.rootGoBack}
      route={{ params: { clientId: s.day6Client.id, clientName: s.day6Client.name } }}
      navigation={{ goBack: s.rootGoBack }}
      onViewPlan={(plan) => {
        s.setViewingPlan(plan);
        s.openPlanViewer();
      }}
    />,
    s,
  );
}

export function ClientViewMyWorkoutPlanScreen() {
  const s = useClientAppShell();
  if (!s.viewingPlan) return null;
  return withNav(
    <WorkoutPlanGeneratorScreen
      plan={s.viewingPlan}
      readOnly
      hideBottomNav
      onBack={s.rootGoBack}
    />,
    s,
  );
}

export function ClientStartCoachChatScreen() {
  const s = useClientAppShell();
  return withNav(
    <>
      <StartCoachChatScreen
        hideBottomNav
        userId={s.user?.uid}
        onStartChat={(payload = {}) => s.openAIChatSession(payload)}
        onSessionPress={(session) =>
          s.openAIChatSession({ sessionId: session.sessionId || session.id })
        }
        onOpenTestSuite={__DEV__ ? () => rootNavigateTests(s) : undefined}
        {...s.aiChatNavHandlers}
      />
      <AddNotesFilesModal
        visible={s.showAddNotesFilesModal}
        onClose={() => s.setShowAddNotesFilesModal(false)}
        onAdded={s.refreshNotesAndFiles}
        isDark={s.isDark}
      />
    </>,
    s,
  );
}

export function ClientChatWithCoachScreen() {
  const s = useClientAppShell();
  const chatState = s.aiChatState && typeof s.aiChatState === 'object' ? s.aiChatState : {};
  return withNav(
    <>
      <ChatWithCoachScreen
        hideBottomNav
        key={JSON.stringify({
          sid: chatState.sessionId ?? null,
          pf: chatState.prefill ?? null,
          att: Array.isArray(chatState.initialAttachments) ? chatState.initialAttachments.length : 0,
        })}
        userId={s.user?.uid}
        userProfile={{ ...(s.onboardingData || {}), ...(s.userData || {}) }}
        trainerId={s.userData?.trainerId}
        prefill={chatState.prefill}
        sessionId={chatState.sessionId}
        initialAttachments={chatState.initialAttachments}
        onBack={() => {
          s.setAiChatState('home');
          s.rootGoBack();
        }}
        openAttachmentsOnMount={false}
        {...s.aiChatNavHandlers}
      />
      <AddNotesFilesModal
        visible={s.showAddNotesFilesModal}
        onClose={() => s.setShowAddNotesFilesModal(false)}
        onAdded={s.refreshNotesAndFiles}
        isDark={s.isDark}
      />
    </>,
    s,
  );
}

export function ClientAICoachTestScreen() {
  const s = useClientAppShell();
  if (!AICoachTestSuite) {
    return withNav(null, s);
  }
  return withNav(
    <AICoachTestSuite
      userId={s.user?.uid}
      userProfile={{ ...(s.onboardingData || {}), ...(s.userData || {}) }}
      trainerName={s.userData?.trainerName || s.userData?.trainer?.name || 'Coach'}
      onBack={() => {
        s.setAiChatState('home');
        s.rootGoBack();
      }}
    />,
    s,
  );
}
