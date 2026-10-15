// Overlay client screens that sit on the stack (Profile, Settings, find-a-trainer, AI chat).
// Flow: read the shared shell → wrap the real screen with nav + the floating bottom bar.
// Used by the client stack. Route names and userRole "Client" stay as the stack registers them.

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
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../app-start/cloudConnection';
import { loadCachedOnboardingProfile, fillTraineeProfile } from '../../helpers/fillTraineeProfile';
import { rootNavigate } from '../../navigation/openScreenFromAnywhere';
import { buildNavigateFromShell } from '../../navigation/goToScreenByKeyword';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const USER_ROLE_CLIENT = 'Client';
const DEFAULT_TRAINER_TITLE = 'Trainer profile';
const DEFAULT_TRAINER_NAME = 'Trainer';
const DEFAULT_SELF_NAME = 'You';
const DEFAULT_COACH_NAME = 'Coach';
const AI_CHAT_HOME = 'home';
const VIEWER_ROLE_CLIENT = 'client';
const SHELL_BOTTOM_INSET_EXTRA = 12;

// ===== HELPER FUNCTIONS =====

let CoachSelfTest = null;
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  CoachSelfTest = require('../../ai-coach/CoachSelfTest').default;
}

/**
 * Firestore id from whichever field the trainer card happened to use.
 * @param {object} trainer
 * @returns {string|null}
 */
function trainerDocId(trainer) {
  return trainer?.id || trainer?._firebase?.id || trainer?.uid || null;
}

/**
 * True when this profile sheet is the coach already linked to the signed-in client.
 * @param {object} profileTrainer
 * @param {object} trainerData
 * @param {object} userData
 * @param {boolean} hasTrainer
 * @returns {boolean}
 */
function isConnectedCoachProfile(profileTrainer, trainerData, userData, hasTrainer) {
  if (!hasTrainer) return false;
  const profileId = trainerDocId(profileTrainer);
  const connectedId =
    trainerDocId(trainerData) ||
    (userData?.trainerId ? String(userData.trainerId) : null);
  return !!(profileId && connectedId && String(profileId) === String(connectedId));
}

function openCoachSelfTest(shell) {
  shell.setAiChatState(AI_CHAT_HOME);
  rootNavigate('ClientAICoachTests');
}

/**
 * Pin the floating client tab bar under a stack screen. hideBottomNav skips the bar
 * for focused flows (food log, a live chat) that bring their own chrome.
 * @param {import('react').ReactNode} children
 * @param {object} shell
 * @param {{ activeTabKey?: string, hideBottomNav?: boolean }} [options]
 * @returns {import('react').ReactElement}
 */
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

/**
 * After the client saves profile fields, refresh the shell from Firestore + the phone cache.
 * Cached onboarding wins on missing keys so an offline wizard is not overwritten.
 * @param {object} shell
 */
async function refreshProfileAfterSave(shell) {
  try {
    shell.onRefetchUserData?.();
    if (!shell.user?.uid || !db) return;
    const snapshot = await getDoc(doc(db, USERS_COLLECTION, shell.user.uid));
    const cached = await loadCachedOnboardingProfile(shell.user.uid, AsyncStorage);
    const merged = fillTraineeProfile(
      cached,
      snapshot.exists() ? snapshot.data() : null,
      shell.userData,
    );
    shell.setOnboardingData(merged);
  } catch (error) {
    console.warn('ViewMyMyProfileScreen refresh after save:', error?.message);
  }
}

function weeklyReportNavHandlers(shell) {
  return {
    onHomePress: () => {
      shell.rootGoBack();
      shell.handleHomePress();
    },
    onPlusPress: () => {
      shell.rootGoBack();
      shell.setShowAddFilePopup(true);
    },
    onVoicePress: () => {
      shell.rootGoBack();
      shell.openAIChatHome();
    },
    onNutritionPress: () => {
      shell.rootGoBack();
      shell.openNutrition();
    },
    onWorkoutPress: () => {
      shell.rootGoBack();
      shell.openWorkout();
    },
    onMessagesPress: () => {
      shell.rootGoBack();
      shell.handleOpenConversations();
    },
    onProfilePress: () => {
      shell.rootGoBack();
      shell.openProfile();
    },
    onSettingsPress: () => {
      shell.rootGoBack();
      shell.openSettings();
    },
  };
}

function addFilePopupForShell(shell) {
  return (
    <AddFilePopup
      visible={shell.showAddFilePopup}
      onClose={() => shell.setShowAddFilePopup(false)}
      onAdded={shell.refreshNotesAndFiles}
      isDark={shell.isDark}
    />
  );
}

function trainerProfileTitle(profileTrainer) {
  if (profileTrainer && profileTrainer.name) return profileTrainer.name;
  if (profileTrainer && profileTrainer.displayName) return profileTrainer.displayName;
  return DEFAULT_TRAINER_TITLE;
}

function trainerProfileVariant(isConnectedCoach) {
  if (isConnectedCoach) return 'connected';
  return 'marketplace';
}

function trainerMessageHandler(isConnectedCoach, openCoachMessage) {
  if (isConnectedCoach) return openCoachMessage;
  return undefined;
}

function trainerConnectHandler(isConnectedCoach, openConnectFlow) {
  if (isConnectedCoach) return undefined;
  return openConnectFlow;
}

function introTrainerName(trainer) {
  if (trainer && trainer.name) return trainer.name;
  if (trainer && trainer.displayName) return trainer.displayName;
  return DEFAULT_TRAINER_NAME;
}

function coachChatStateFromShell(aiChatState) {
  if (aiChatState && typeof aiChatState === 'object') return aiChatState;
  return {};
}

function coachChatKey(chatState) {
  return JSON.stringify({
    sid: chatState.sessionId ?? null,
    pf: chatState.prefill ?? null,
    att: Array.isArray(chatState.initialAttachments) ? chatState.initialAttachments.length : 0,
  });
}

// ===== MAIN FUNCTION =====

/**
 * Client profile stack screen. userRole stays "Client" — the profile screen reads that string.
 * @returns {import('react').ReactElement}
 */
export function ClientViewMyMyProfileScreen() {
  const shell = useClientAppStartShell();
  const onNavigate = buildNavigateFromShell(shell);
  return withNav(
    <>
      <ViewMyMyProfileScreen
        onBack={shell.rootGoBack}
        embedShellBottomNav
        userRole={USER_ROLE_CLIENT}
        userData={shell.userData}
        onboardingData={shell.onboardingData}
        onNavigate={onNavigate}
        onProfileSaved={() => refreshProfileAfterSave(shell)}
      />
      {shell.addNotesFilesModalEl}
    </>,
    shell,
  );
}

/**
 * Settings stack screen, including the coaching-payment opener from the shell.
 * @returns {import('react').ReactElement}
 */
export function ClientSettingsScreen() {
  const shell = useClientAppStartShell();
  const onNavigate = buildNavigateFromShell(shell);
  return withNav(
    <>
      <SettingsScreen
        onBack={shell.rootGoBack}
        onNavigate={onNavigate}
        userData={shell.userData}
        trainerData={shell.trainerData}
        embedShellBottomNav
        onOpenCoachingPayment={shell.openCoachingPayment}
      />
      {shell.addNotesFilesModalEl}
    </>,
    shell,
  );
}

/**
 * @returns {import('react').ReactElement}
 */
export function ClientHelpFAQScreen() {
  const shell = useClientAppStartShell();
  return withNav(<HelpFAQScreen onClose={shell.rootGoBack} embedShellBottomNav />, shell);
}

/**
 * @returns {import('react').ReactElement}
 */
export function ClientTermsScreen() {
  const shell = useClientAppStartShell();
  return withNav(<TermsOfServiceScreen onClose={shell.rootGoBack} embedShellBottomNav />, shell);
}

/**
 * @returns {import('react').ReactElement}
 */
export function ClientPrivacyScreen() {
  const shell = useClientAppStartShell();
  return withNav(<PrivacyPolicyScreen onClose={shell.rootGoBack} embedShellBottomNav />, shell);
}

/**
 * @returns {import('react').ReactElement}
 */
export function ClientContactSupportScreen() {
  const shell = useClientAppStartShell();
  return withNav(<ContactSupportScreen onClose={shell.rootGoBack} embedShellBottomNav />, shell);
}

/**
 * @returns {import('react').ReactElement}
 */
export function ClientBugReportScreen() {
  const shell = useClientAppStartShell();
  return withNav(<BugReportScreen onClose={shell.rootGoBack} embedShellBottomNav />, shell);
}

/**
 * Daily food log as a stack screen. The add-file popup stays mounted here because
 * the + tab on this screen opens it.
 * @returns {import('react').ReactElement}
 */
export function ClientDailyFoodLogScreen() {
  const shell = useClientAppStartShell();
  return withNav(
    <>
      <DailyLogContent
        hideBottomNav
        onBack={() => {
          shell.rootGoBack();
          shell.refetchNutritionData?.();
        }}
        onNutritionDataChanged={shell.refetchNutritionData}
        onProfilePress={shell.openProfile}
        onSettingsPress={shell.openSettings}
        onHomePress={shell.handleHomePress}
        onPlusPress={() => shell.setShowAddFilePopup(true)}
        onVoicePress={shell.openAIChatHome}
        onNutritionPress={shell.openNutrition}
        onWorkoutPress={shell.openWorkout}
        onMessagesPress={shell.handleOpenConversations}
      />
      {addFilePopupForShell(shell)}
    </>,
    shell,
  );
}

/**
 * @returns {import('react').ReactElement}
 */
export function ClientWorkoutPlanScreen() {
  const shell = useClientAppStartShell();
  return withNav(
    <>
      <CreateWorkoutPlanScreen
        hideBottomNav
        onBack={shell.rootGoBack}
        onProfilePress={shell.openProfile}
        onSettingsPress={shell.openSettings}
      />
      {shell.addNotesFilesModalEl}
    </>,
    shell,
  );
}

/**
 * Marketplace search. onRequestTrainer stays the shell function — same payload as home.
 * @returns {import('react').ReactElement}
 */
export function ClientSearchTrainersScreen() {
  const shell = useClientAppStartShell();
  return withNav(
    <>
      <SearchTrainersScreen
        onBack={shell.rootGoBack}
        showBottomNav={false}
        reserveShellBottomNav
        onRequestTrainer={shell.requestTrainerConnection}
      />
      {shell.addNotesFilesModalEl}
    </>,
    shell,
  );
}

/**
 * Trainer profile sheet. Connected coaches get Message; marketplace coaches get Connect.
 * @returns {import('react').ReactElement|null}
 */
export function ClientTrainerViewMyMyProfileScreen() {
  const shell = useClientAppStartShell();
  const shellBottomInset = useShellBottomNavInset(SHELL_BOTTOM_INSET_EXTRA);

  const closeProfile = () => {
    shell.setProfileTrainer(null);
    shell.rootGoBack();
  };

  const connect = sendConnectionRequest({
    onRequestTrainer: shell.requestTrainerConnection,
    onAfterSuccess: closeProfile,
  });

  if (!shell.profileTrainer) return null;

  const isConnectedCoach = isConnectedCoachProfile(
    shell.profileTrainer,
    shell.trainerData,
    shell.userData,
    shell.hasTrainer,
  );
  const openCoachMessage = () => {
    shell.setSelectedTrainer(shell.profileTrainer);
    shell.setProfileTrainer(null);
    shell.rootGoBack();
    shell.setShowTrainerMessaging(true);
  };

  const profileTitle = trainerProfileTitle(shell.profileTrainer);
  const profileVariant = trainerProfileVariant(isConnectedCoach);
  const messageHandler = trainerMessageHandler(isConnectedCoach, openCoachMessage);
  const connectHandler = trainerConnectHandler(isConnectedCoach, connect.openConnectFlow);

  const theme = getTheme(shell.isDark);

  return withNav(
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }} edges={SHELL_SAFE_AREA_EDGES}>
      <TopHeader
        title={profileTitle}
        isDark={shell.isDark}
        skipTopSafeInset
        onBack={closeProfile}
        onProfilePress={shell.openProfile}
        onSettingsPress={shell.openSettings}
      />
      <View style={{ flex: 1, minHeight: 0 }}>
        <TrainerProfileSheet
          embedded
          visible
          isDark={shell.isDark}
          trainer={shell.profileTrainer}
          onClose={closeProfile}
          variant={profileVariant}
          onMessage={messageHandler}
          onConnect={connectHandler}
          requesting={connect.requesting}
          shellBottomInset={shellBottomInset}
        />
      </View>
      <ConfirmRequestPopup
        visible={!!connect.requestConfirmTrainer}
        trainer={connect.requestConfirmTrainer?._firebase || connect.requestConfirmTrainer}
        onCancel={connect.closeRequestConfirm}
        onConfirm={connect.confirmSendRequest}
        isDark={shell.isDark}
        busy={connect.requesting}
      />
      <RequestIntroPopup
        visible={!!connect.requestIntroTrainer}
        trainerName={introTrainerName(connect.requestIntroTrainer)}
        messageDraft={connect.requestIntroDraft}
        onChangeMessage={connect.setRequestIntroDraft}
        onSkip={connect.completeFromIntro}
        onSendMessage={connect.completeFromIntro}
        onClose={connect.closeRequestIntro}
        isDark={shell.isDark}
        busy={connect.requesting}
      />
      {shell.addNotesFilesModalEl}
    </SafeAreaView>,
    shell,
  );
}

/**
 * Weekly report for the signed-in client. clientName key stays clientName.
 * @returns {import('react').ReactElement|null}
 */
export function ClientWeeklyReportScreen() {
  const shell = useClientAppStartShell();
  if (!shell.user?.uid) return null;
  const weeklyNav = weeklyReportNavHandlers(shell);
  return withNav(
    <>
      <WeeklyReportScreen
        clientId={shell.user.uid}
        clientName={shell.userData?.firstName || shell.user?.displayName || DEFAULT_SELF_NAME}
        isClientSelfView
        isDark={shell.isDark}
        reserveShellBottomNav
        onClose={shell.rootGoBack}
        {...weeklyNav}
      />
      {shell.addNotesFilesModalEl}
    </>,
    shell,
  );
}

/**
 * Progress photos. route.params.clientId / clientName stay those keys.
 * @returns {import('react').ReactElement|null}
 */
export function ClientMyProgressPhotosScreen() {
  const shell = useClientAppStartShell();
  if (!shell.day6Client?.id) return null;
  return withNav(
    <MyProgressPhotosScreen
      route={{ params: { clientId: shell.day6Client.id, clientName: shell.day6Client.name, allowUpload: true } }}
      navigation={{ goBack: shell.rootGoBack }}
      onRegisterAddHandler={shell.registerProgressPhotoAddHandler}
      useShellHeader
      onBack={shell.rootGoBack}
      reserveShellBottomNav
    />,
    shell,
  );
}

/**
 * Saved AI workout plans for the day-6 client card.
 * @returns {import('react').ReactElement|null}
 */
export function ClientAIWorkoutsScreen() {
  const shell = useClientAppStartShell();
  if (!shell.day6Client?.id) return null;
  return withNav(
    <SavedWorkoutsScreen
      embedInLayout={false}
      client={shell.day6Client}
      trainerId={shell.userData?.trainerId}
      viewerRole={VIEWER_ROLE_CLIENT}
      onBack={shell.rootGoBack}
      route={{ params: { clientId: shell.day6Client.id, clientName: shell.day6Client.name } }}
      navigation={{ goBack: shell.rootGoBack }}
      onViewPlan={(plan) => {
        shell.setViewingPlan(plan);
        shell.openPlanViewer();
      }}
    />,
    shell,
  );
}

/**
 * Read-only plan viewer when the client taps a saved plan.
 * @returns {import('react').ReactElement|null}
 */
export function ClientMyWorkoutPlanScreen() {
  const shell = useClientAppStartShell();
  if (!shell.viewingPlan) return null;
  return withNav(
    <CreateWorkoutPlanScreen
      plan={shell.viewingPlan}
      readOnly
      hideBottomNav
      onBack={shell.rootGoBack}
    />,
    shell,
  );
}

/**
 * AI coach home (session list). Dev builds also get the self-test suite opener.
 * @returns {import('react').ReactElement}
 */
export function ClientCoachHomeScreen() {
  const shell = useClientAppStartShell();
  return withNav(
    <>
      <CoachHomeScreen
        hideBottomNav
        userId={shell.user?.uid}
        onStartChat={(payload = {}) => shell.openAIChatSession(payload)}
        onSessionPress={(session) =>
          shell.openAIChatSession({ sessionId: session.sessionId || session.id })
        }
        onOpenTestSuite={__DEV__ ? () => openCoachSelfTest(shell) : undefined}
        {...shell.aiChatNavHandlers}
      />
      {addFilePopupForShell(shell)}
    </>,
    shell,
  );
}

/**
 * Open AI coach thread. sessionId / prefill / initialAttachments keys stay as the chat screen reads them.
 * @returns {import('react').ReactElement}
 */
export function ClientCoachConversationScreen() {
  const shell = useClientAppStartShell();
  const chatState = coachChatStateFromShell(shell.aiChatState);
  return withNav(
    <>
      <CoachConversationScreen
        hideBottomNav
        key={coachChatKey(chatState)}
        userId={shell.user?.uid}
        userProfile={{ ...(shell.onboardingData || {}), ...(shell.userData || {}) }}
        trainerId={shell.userData?.trainerId}
        prefill={chatState.prefill}
        sessionId={chatState.sessionId}
        initialAttachments={chatState.initialAttachments}
        onBack={() => {
          shell.setAiChatState(AI_CHAT_HOME);
          shell.rootGoBack();
        }}
        onSessionSwitch={(session) =>
          shell.openAIChatSession({ sessionId: session.sessionId || session.id })
        }
        onNewChat={() => shell.openAIChatSession({})}
        openAttachmentsOnMount={false}
        {...shell.aiChatNavHandlers}
      />
      {addFilePopupForShell(shell)}
    </>,
    shell,
  );
}

/**
 * Dev-only coach self-test. Production builds render an empty nav wrapper.
 * @returns {import('react').ReactElement}
 */
export function ClientAICoachTestScreen() {
  const shell = useClientAppStartShell();
  if (!CoachSelfTest) {
    return withNav(null, shell);
  }
  return withNav(
    <CoachSelfTest
      userId={shell.user?.uid}
      userProfile={{ ...(shell.onboardingData || {}), ...(shell.userData || {}) }}
      trainerName={shell.userData?.trainerName || shell.userData?.trainer?.name || DEFAULT_COACH_NAME}
      onBack={() => {
        shell.setAiChatState(AI_CHAT_HOME);
        shell.rootGoBack();
      }}
    />,
    shell,
  );
}
