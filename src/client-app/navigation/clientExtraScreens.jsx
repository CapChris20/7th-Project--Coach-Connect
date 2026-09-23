/**
 * client Overlay Screens
 *
 * Purpose: UI screen or component: client Overlay Screens. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: ClientViewMyMyProfileScreen, ClientSettingsScreen, ClientHelpFAQScreen, ClientTermsScreen, ClientPrivacyScreen, ClientContactSupportScreen, ClientBugReportScreen, ClientDailyFoodLogScreen
 *
 * @file-header
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHELL_SAFE_AREA_EDGES, useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import { getTheme } from '../find-a-trainer/trainerFilters';
import { AppNavigationProvider } from '../../navigation/whichScreenIsOpen';
import { useClientAppStartShell } from './ClientOpenScreenTracker';
import ViewMyMyProfileScreen from '../../client-app/profile/MyProfileScreen';
import SettingsScreen from '../../settings/SettingsScreen';
import HelpFAQScreen from '../../settings/HelpFAQScreen';
import TermsOfServiceScreen from '../../settings/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../../settings/PrivacyPolicyScreen';
import ContactSupportScreen from '../../settings/ContactSupportScreen';
import BugReportScreen from '../../settings/BugReportScreen';
import DailyLogContent from '../../nutrition/daily-log/DailyLogContent';
import AddFilePopup from '../../for-both/files-and-notes/viewers/AddFilePopup';
import SearchTrainersScreen, { TrainerProfileSheet } from '../find-a-trainer/SearchTrainersScreen';
import ConfirmRequestPopup from '../find-a-trainer/ConfirmRequestPopup';
import RequestIntroPopup from '../find-a-trainer/RequestIntroPopup';
import { sendConnectionRequest } from '../find-a-trainer/sendConnectionRequest';
import WeeklyReportScreen from '../../for-both/weekly-report/WeeklyReportScreen';
import MyProgressPhotosScreen from '../../for-both/photo-gallery/MyProgressPhotosScreen';
import SavedWorkoutsScreen from '../../for-both/workout-plans/SavedWorkoutsScreen';
import CreateWorkoutPlanScreen from '../../workouts/create-plan/CreateWorkoutPlanScreen';
import CoachHomeScreen from '../../ai-coach/home-screen/CoachHomeScreen';
import CoachConversationScreen from '../../ai-coach/conversation/CoachConversationScreen';
import ClientBottomMenu from './ClientBottomMenu';
import TopHeader from '../../for-both/loading-and-header/TopHeader';

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

let CoachSelfTest = null;
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  CoachSelfTest = require('../../ai-coach/CoachSelfTest').default;
}
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../app-start/cloudConnection';
import { loadCachedOnboardingProfile, fillTraineeProfile } from '../../helpers/fillTraineeProfile';
import { rootNavigate } from '../../navigation/openScreenFromAnywhere';
import { buildNavigateFromShell } from '../../navigation/goToScreenByKeyword';

function rootNavigateTests(shell) {
  shell.setAiChatState('home');
  rootNavigate('ClientAICoachTests');
}

function withNav(children, shell, { activeTabKey, hideBottomNav = false } = {}) {
  return (
    <AppNavigationProvider {...shell.navProviderProps}>
      <View style={{ flex: 1 }}>
        {children}
        {hideBottomNav ? null : <ClientBottomMenu shell={shell} activeTabKey={activeTabKey} />}
      </View>
    </AppNavigationProvider>
  );
}

export function ClientViewMyMyProfileScreen() {
  const s = useClientAppStartShell();
  const onNavigate = buildNavigateFromShell(s);
  return withNav(
    <>
      <ViewMyMyProfileScreen
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
              const cached = await loadCachedOnboardingProfile(s.user.uid, AsyncStorage);
              const merged = fillTraineeProfile(
                cached,
                snap.exists() ? snap.data() : null,
                s.userData,
              );
              s.setOnboardingData(merged);
            }
          } catch (e) {
            console.warn('ViewMyMyProfileScreen refresh after save:', e?.message);
          }
        }}
      />
      {s.addNotesFilesModalEl}
    </>,
    s,
  );
}

export function ClientSettingsScreen() {
  const s = useClientAppStartShell();
  const onNavigate = buildNavigateFromShell(s);
  return withNav(
    <>
      <SettingsScreen
        onBack={s.rootGoBack}
        onNavigate={onNavigate}
        userData={s.userData}
        trainerData={s.trainerData}
        embedShellBottomNav
        onOpenCoachingPayment={s.openCoachingPayment}
      />
      {s.addNotesFilesModalEl}
    </>,
    s,
  );
}

export function ClientHelpFAQScreen() {
  const s = useClientAppStartShell();
  return withNav(<HelpFAQScreen onClose={s.rootGoBack} embedShellBottomNav />, s);
}

export function ClientTermsScreen() {
  const s = useClientAppStartShell();
  return withNav(<TermsOfServiceScreen onClose={s.rootGoBack} embedShellBottomNav />, s);
}

export function ClientPrivacyScreen() {
  const s = useClientAppStartShell();
  return withNav(<PrivacyPolicyScreen onClose={s.rootGoBack} embedShellBottomNav />, s);
}

export function ClientContactSupportScreen() {
  const s = useClientAppStartShell();
  return withNav(<ContactSupportScreen onClose={s.rootGoBack} embedShellBottomNav />, s);
}

export function ClientBugReportScreen() {
  const s = useClientAppStartShell();
  return withNav(<BugReportScreen onClose={s.rootGoBack} embedShellBottomNav />, s);
}

export function ClientDailyFoodLogScreen() {
  const s = useClientAppStartShell();
  return withNav(
    <>
      <DailyLogContent
        hideBottomNav
        onBack={() => {
          s.rootGoBack();
          s.refetchNutritionData?.();
        }}
        onNutritionDataChanged={s.refetchNutritionData}
        onProfilePress={s.openProfile}
        onSettingsPress={s.openSettings}
        onHomePress={s.handleHomePress}
        onPlusPress={() => s.setShowAddFilePopup(true)}
        onVoicePress={s.openAIChatHome}
        onNutritionPress={s.openNutrition}
        onWorkoutPress={s.openWorkout}
        onMessagesPress={s.handleOpenConversations}
      />
      <AddFilePopup
        visible={s.showAddFilePopup}
        onClose={() => s.setShowAddFilePopup(false)}
        onAdded={s.refreshNotesAndFiles}
        isDark={s.isDark}
      />
    </>,
    s,
  );
}

export function ClientWorkoutPlanScreen() {
  const s = useClientAppStartShell();
  return withNav(
    <>
      <CreateWorkoutPlanScreen
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
  const s = useClientAppStartShell();
  return withNav(
    <>
      <SearchTrainersScreen
        onBack={s.rootGoBack}
        showBottomNav={false}
        reserveShellBottomNav
        onRequestTrainer={s.requestTrainerConnection}
      />
      {s.addNotesFilesModalEl}
    </>,
    s,
  );
}

export function ClientTrainerViewMyMyProfileScreen() {
  const s = useClientAppStartShell();
  const shellBottomInset = useShellBottomNavInset(12);

  const closeProfile = () => {
    s.setProfileTrainer(null);
    s.rootGoBack();
  };

  const connect = sendConnectionRequest({
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
      <TopHeader
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
          shellBottomInset={shellBottomInset}
        />
      </View>
      <ConfirmRequestPopup
        visible={!!connect.requestConfirmTrainer}
        trainer={connect.requestConfirmTrainer?._firebase || connect.requestConfirmTrainer}
        onCancel={connect.closeRequestConfirm}
        onConfirm={connect.confirmSendRequest}
        isDark={s.isDark}
        busy={connect.requesting}
      />
      <RequestIntroPopup
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
  );
}

export function ClientWeeklyReportScreen() {
  const s = useClientAppStartShell();
  if (!s.user?.uid) return null;
  return withNav(
    <>
      <WeeklyReportScreen
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
          s.setShowAddFilePopup(true);
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
  const s = useClientAppStartShell();
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
  const s = useClientAppStartShell();
  if (!s.day6Client?.id) return null;
  return withNav(
    <SavedWorkoutsScreen
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

export function ClientMyWorkoutPlanScreen() {
  const s = useClientAppStartShell();
  if (!s.viewingPlan) return null;
  return withNav(
    <CreateWorkoutPlanScreen
      plan={s.viewingPlan}
      readOnly
      hideBottomNav
      onBack={s.rootGoBack}
    />,
    s,
  );
}

export function ClientCoachHomeScreen() {
  const s = useClientAppStartShell();
  return withNav(
    <>
      <CoachHomeScreen
        hideBottomNav
        userId={s.user?.uid}
        onStartChat={(payload = {}) => s.openAIChatSession(payload)}
        onSessionPress={(session) =>
          s.openAIChatSession({ sessionId: session.sessionId || session.id })
        }
        onOpenTestSuite={__DEV__ ? () => rootNavigateTests(s) : undefined}
        {...s.aiChatNavHandlers}
      />
      <AddFilePopup
        visible={s.showAddFilePopup}
        onClose={() => s.setShowAddFilePopup(false)}
        onAdded={s.refreshNotesAndFiles}
        isDark={s.isDark}
      />
    </>,
    s,
  );
}

export function ClientCoachConversationScreen() {
  const s = useClientAppStartShell();
  const chatState = s.aiChatState && typeof s.aiChatState === 'object' ? s.aiChatState : {};
  return withNav(
    <>
      <CoachConversationScreen
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
      <AddFilePopup
        visible={s.showAddFilePopup}
        onClose={() => s.setShowAddFilePopup(false)}
        onAdded={s.refreshNotesAndFiles}
        isDark={s.isDark}
      />
    </>,
    s,
  );
}

export function ClientAICoachTestScreen() {
  const s = useClientAppStartShell();
  if (!CoachSelfTest) {
    return withNav(null, s);
  }
  return withNav(
    <CoachSelfTest
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
