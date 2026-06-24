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
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHELL_SAFE_AREA_EDGES } from '../../navigation/bottomNavMetrics';
import { getTheme } from '../marketplace/marketplaceFilters';
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
import SearchTrainersScreen, { TrainerProfileSheet } from '../marketplace/SearchTrainersScreen';
import TrainerRequestConfirmModal from '../marketplace/TrainerRequestConfirmModal';
import TrainerRequestIntroModal from '../marketplace/TrainerRequestIntroModal';
import { useTrainerConnectFlow } from '../marketplace/useTrainerConnectFlow';
import ViewWeekProgressReportScreen from '../../shared/screens/ViewWeekProgressReportScreen';
import MyProgressPhotosScreen from '../../shared/screens/MyProgressPhotosScreen';
import BrowseSavedWorkoutsScreen from '../../shared/screens/BrowseSavedWorkoutsScreen';
import WorkoutPlanGeneratorScreen from '../../workouts/active-workout/workout';
import StartCoachChatScreen from '../../ai-coach/chat-ui/chat-home/StartCoachChatScreen';
import ChatWithCoachScreen from '../../ai-coach/chat-ui/chat-thread/ChatWithCoachScreen';
import ClientShellBottomNav from './ClientShellBottomNav';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';

function trainerDocId(trainer) {
  return trainer?.id || trainer?._firebase?.id || trainer?.uid || null;
}

function isConnectedCoachProfile(profileTrainer, trainerData, userData, hasTrainer) {
  if (!hasTrainer) return false;
  const profileId = trainerDocId(profileTrainer);
  const connectedId =
    trainerDocId(trainerData) ||
    (userData?.trainerId ? String(userData.trainerId) : null);
  return !!(profileId && connectedId && String(profileId) === String(connectedId));
}

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

function withNav(children, shell, { activeTabKey, hideBottomNav = false } = {}) {
  return (
    <AppNavigationProvider {...shell.navProviderProps}>
      <View style={{ flex: 1 }}>
        {children}
        {hideBottomNav ? null : <ClientShellBottomNav shell={shell} activeTabKey={activeTabKey} />}
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
        onRequestTrainer={s.requestTrainerConnection}
      />
      {s.addNotesFilesModalEl}
    </>,
    s,
  );
}

export function ClientTrainerViewMyViewMyProfileScreen() {
  const s = useClientAppShell();

  const closeProfile = () => {
    s.setProfileTrainer(null);
    s.rootGoBack();
  };

  const connect = useTrainerConnectFlow({
    onRequestTrainer: s.requestTrainerConnection,
    onAfterSuccess: closeProfile,
  });

  if (!s.profileTrainer) return null;

  const isConnectedCoach = isConnectedCoachProfile(
    s.profileTrainer,
    s.trainerData,
    s.userData,
    s.hasTrainer,
  );
  const profileTitle =
    s.profileTrainer?.name || s.profileTrainer?.displayName || 'Trainer profile';

  const openCoachMessage = () => {
    s.setSelectedTrainer(s.profileTrainer);
    s.setProfileTrainer(null);
    s.rootGoBack();
    s.setShowTrainerMessaging(true);
  };

  const theme = getTheme(s.isDark);

  return withNav(
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={SHELL_SAFE_AREA_EDGES}>
      <CoachConnectHeader
        title={profileTitle}
        isDark={s.isDark}
        skipTopSafeInset
        onBack={closeProfile}
        onProfilePress={s.openProfile}
        onSettingsPress={s.openSettings}
      />
      <View style={{ flex: 1, minHeight: 0 }}>
        <TrainerProfileSheet
          embedded
          visible
          isDark={s.isDark}
          trainer={s.profileTrainer}
          onClose={closeProfile}
          variant={isConnectedCoach ? 'connected' : 'marketplace'}
          onMessage={isConnectedCoach ? openCoachMessage : undefined}
          onConnect={isConnectedCoach ? undefined : connect.openConnectFlow}
          requesting={connect.requesting}
          shellBottomInset={0}
        />
      </View>
      <TrainerRequestConfirmModal
        visible={!!connect.requestConfirmTrainer}
        trainer={connect.requestConfirmTrainer?._firebase || connect.requestConfirmTrainer}
        onCancel={connect.closeRequestConfirm}
        onConfirm={connect.confirmSendRequest}
        isDark={s.isDark}
        busy={connect.requesting}
      />
      <TrainerRequestIntroModal
        visible={!!connect.requestIntroTrainer}
        trainerName={
          connect.requestIntroTrainer?.name || connect.requestIntroTrainer?.displayName || 'Trainer'
        }
        messageDraft={connect.requestIntroDraft}
        onChangeMessage={connect.setRequestIntroDraft}
        onSkip={connect.completeFromIntro}
        onSendMessage={connect.completeFromIntro}
        onClose={connect.closeRequestIntro}
        isDark={s.isDark}
        busy={connect.requesting}
      />
      {s.addNotesFilesModalEl}
    </SafeAreaView>,
    s,
    { hideBottomNav: true },
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
        reserveShellBottomNav
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
        onSessionSwitch={(session) =>
          s.openAIChatSession({ sessionId: session.sessionId || session.id })
        }
        onNewChat={() => s.openAIChatSession({})}
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
