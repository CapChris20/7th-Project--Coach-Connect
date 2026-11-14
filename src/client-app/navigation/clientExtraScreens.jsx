// Overlay client screens that sit on the stack (Profile, Settings, find-a-trainer, AI chat).
// Flow: read shared shell → wrap the real screen with nav provider + floating bottom bar.
// Used by ClientScreenList. Route names and userRole "Client" stay as the stack registers them.

import React from 'react';
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
import PrivacyDataRightsScreen from '../../settings/PrivacyDataRightsScreen';
import DailyLogContent from '../../nutrition/daily-log/DailyLogContent';
import AddFilePopup from '../../for-both/files-and-notes/viewers/AddFilePopup';
import SearchTrainersScreen, { TrainerProfileSheet } from '../find-a-trainer/SearchTrainersScreen';
import ConfirmRequestPopup from '../find-a-trainer/ConfirmRequestPopup';
import RequestIntroPopup from '../find-a-trainer/RequestIntroPopup';
import { sendConnectionRequest } from '../find-a-trainer/sendConnectionRequest';
import WeeklyReportScreen from '../../for-both/weekly-report/WeeklyReportScreen';
import MyProgressPhotosScreen from '../../for-both/photo-gallery/MyProgressPhotosScreen';
import ProgressChartsScreen from '../progress/ProgressChartsScreen';
import NotificationsScreen from '../../notifications/NotificationsScreen';
import SavedWorkoutsScreen from '../../for-both/workout-plans/SavedWorkoutsScreen';
import CreateWorkoutPlanScreen from '../../workouts/create-plan/CreateWorkoutPlanScreen';
import WorkoutSessionScreen from '../../workouts/session/WorkoutSessionScreen';
import CoachHomeScreen from '../../ai-coach/home-screen/CoachHomeScreen';
import CoachConversationScreen from '../../ai-coach/conversation/CoachConversationScreen';
import MySessionsScreen from '../scheduling/MySessionsScreen';
import RequestSessionScreen from '../scheduling/RequestSessionScreen';
import LogWorkoutScreen from '../check-in/LogWorkoutScreen';
import DailyCheckInScreen from '../check-in/DailyCheckInScreen';
import MoodCheckInScreen from '../check-in/MoodCheckInScreen';
import WeeklyMomentumScreen from '../../nutrition/momentum/WeeklyMomentumScreen';
import ClientBottomMenu from './ClientBottomMenu';
import TopHeader from '../../for-both/loading-and-header/TopHeader';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../app-start/cloudConnection';
import { loadCachedOnboardingProfile, fillTraineeProfile } from '../../helpers/fillTraineeProfile';
import { rootNavigate } from '../../navigation/openScreenFromAnywhere';
import { CLIENT_ROUTES } from '../../navigation/screenNames';
import { buildNavigateFromShell } from '../../navigation/goToScreenByKeyword';

// ===== NAMED CONSTANTS =====

const FIRESTORE_USERS_COLLECTION = 'users';
const PROFILE_USER_ROLE_CLIENT = 'Client';
const FALLBACK_TRAINER_SHEET_TITLE = 'Trainer profile';
const FALLBACK_TRAINER_NAME = 'Trainer';
const FALLBACK_SELF_DISPLAY_NAME = 'You';
const FALLBACK_COACH_NAME = 'Coach';
const AI_CHAT_HOME_STATE = 'home';
const SAVED_WORKOUTS_VIEWER_ROLE = 'client';
const NUTRITION_TAB_KEY = 'nutrition';
// Manipulate here: extra padding above the floating tab bar on embedded trainer sheet
const TRAINER_SHEET_BOTTOM_INSET_EXTRA = 12;
// Manipulate here: default calorie goal when shell has no nutrition target yet
const DEFAULT_WEEKLY_MOMENTUM_CALORIES = 2300;

// Dev-only AI self-test screen — keep null in production builds.
let CoachSelfTest = null;
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  CoachSelfTest = require('../../ai-coach/CoachSelfTest').default;
}

// ===== HELPER FUNCTIONS =====
// Shared shell chrome: nav provider, floating tabs, add-file popup, profile refresh.

/**
 * Wrap a stack body with the nav provider and optional floating bottom tabs.
 * hideBottomNav = focused flows (workout session) that need the full screen.
 */
function wrapClientStackScreen(children, shell, options = {}) {
  const activeTabKey = options.activeTabKey;
  const hideBottomNav = options.hideBottomNav === true;
  const showFloatingTabs = !hideBottomNav;

  // Named local so JSX does not bury the tab-bar decision.
  let floatingTabs = null;
  if (showFloatingTabs) {
    floatingTabs = <ClientBottomMenu shell={shell} activeTabKey={activeTabKey} />;
  }

  return (
    <AppNavigationProvider {...shell.navProviderProps}>
      <View style={{ flex: 1 }}>
        {children}
        {floatingTabs}
      </View>
    </AppNavigationProvider>
  );
}

/**
 * Factory for legal/help screens that only need Close → rootGoBack.
 */
function makeClientCloseOnlyScreen(InnerScreen, displayName) {
  function ClientScreenWithCloseButton() {
    const shell = useClientAppStartShell();
    const screenBody = <InnerScreen onClose={shell.rootGoBack} embedShellBottomNav />;
    return wrapClientStackScreen(screenBody, shell);
  }
  ClientScreenWithCloseButton.displayName = displayName;
  return ClientScreenWithCloseButton;
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

/**
 * After profile save: refetch shell user data, then merge Firestore + cached onboarding.
 * vocab: fillTraineeProfile = merges onboarding cache + users doc into one trainee shape
 */
async function refreshProfileAfterSave(shell) {
  try {
    if (shell.onRefetchUserData) {
      shell.onRefetchUserData();
    }
    const signedInUser = shell.user;
    if (!signedInUser || !signedInUser.uid || !db) return;

    const userSnapshot = await getDoc(doc(db, FIRESTORE_USERS_COLLECTION, signedInUser.uid));
    const cachedOnboarding = await loadCachedOnboardingProfile(signedInUser.uid, AsyncStorage);
    const firestoreUserData = userSnapshot.exists() ? userSnapshot.data() : null;
    const mergedProfile = fillTraineeProfile(
      cachedOnboarding,
      firestoreUserData,
      shell.userData,
    );
    shell.setOnboardingData(mergedProfile);
  } catch (error) {
    let errorMessage = '';
    if (error) errorMessage = error.message;
    console.warn('ViewMyMyProfileScreen refresh after save:', errorMessage);
  }
}

/**
 * Weekly report nav: pop the stack first, then run the shell tab action.
 * Why pop first? Report sits on the overlay stack — leaving it open would cover Home.
 */
function backThenPopStackThen(shell, runShellAction) {
  return () => {
    shell.rootGoBack();
    runShellAction();
  };
}

function weeklyReportNavHandlers(shell) {
  return {
    onHomePress: backThenPopStackThen(shell, () => shell.handleHomePress()),
    onPlusPress: backThenPopStackThen(shell, () => shell.setShowAddFilePopup(true)),
    onVoicePress: backThenPopStackThen(shell, () => shell.openAIChatHome()),
    onNutritionPress: backThenPopStackThen(shell, () => shell.openNutrition()),
    onWorkoutPress: backThenPopStackThen(shell, () => shell.openWorkout()),
    onMessagesPress: backThenPopStackThen(shell, () => shell.handleOpenConversations()),
    onProfilePress: backThenPopStackThen(shell, () => shell.openProfile()),
    onSettingsPress: backThenPopStackThen(shell, () => shell.openSettings()),
  };
}

function mergedClientProfileForSearch(shell) {
  return {
    ...(shell.onboardingData || {}),
    ...(shell.userData || {}),
  };
}

function signedInUserIdFromShell(shell) {
  const signedInUser = shell.user;
  if (!signedInUser) return null;
  if (!signedInUser.uid) return null;
  return signedInUser.uid;
}

function coachIdFromShell(shell) {
  const linkedTrainer = shell.trainerData;
  if (linkedTrainer && linkedTrainer.id) return linkedTrainer.id;
  if (linkedTrainer && linkedTrainer.uid) return linkedTrainer.uid;
  const userData = shell.userData;
  if (userData && userData.trainerId) return userData.trainerId;
  return null;
}

function coachNameFromShell(shell) {
  const linkedTrainer = shell.trainerData;
  if (linkedTrainer && linkedTrainer.name) return linkedTrainer.name;
  if (linkedTrainer && linkedTrainer.displayName) return linkedTrainer.displayName;
  const userData = shell.userData;
  if (userData && userData.trainerName) return userData.trainerName;
  return FALLBACK_COACH_NAME;
}

function coachIdAndNameFromShell(shell) {
  return {
    coachId: coachIdFromShell(shell),
    coachName: coachNameFromShell(shell),
  };
}

function trainerFullNameFromShell(shell) {
  const linkedTrainer = shell.trainerData;
  if (linkedTrainer && linkedTrainer.name) return linkedTrainer.name;
  if (linkedTrainer && linkedTrainer.displayName) return linkedTrainer.displayName;
  const userData = shell.userData;
  if (userData && userData.trainerName) return userData.trainerName;
  return '';
}

function trainerFirstNameFromShell(shell) {
  const fullName = trainerFullNameFromShell(shell);
  const firstToken = String(fullName).split(' ')[0];
  if (firstToken) return firstToken;
  return '';
}

function weeklyMomentumCalorieGoalFromShell(shell) {
  const nutritionGoals = shell.nutritionGoals;
  if (nutritionGoals && nutritionGoals.calories) return nutritionGoals.calories;
  const userData = shell.userData;
  if (userData && userData.calorieGoal) return userData.calorieGoal;
  if (userData && userData.caloriesTarget) return userData.caloriesTarget;
  return DEFAULT_WEEKLY_MOMENTUM_CALORIES;
}

function openCoachSelfTestFromShell(shell) {
  shell.setAiChatState(AI_CHAT_HOME_STATE);
  rootNavigate('ClientAICoachTests');
}

function openRemoveTrainerWhenLinked(shell) {
  if (!shell.trainerData) return undefined;
  return () => {
    if (shell.setShowRemoveTrainerPopup) {
      shell.setShowRemoveTrainerPopup(true);
    }
  };
}

function buildTrainerProfileSheetBody(shell, shellBottomInset) {
  const closeTrainerProfile = () => {
    shell.setProfileTrainer(null);
    shell.rootGoBack();
  };

  const connectionFlow = sendConnectionRequest({
    onRequestTrainer: shell.requestTrainerConnection,
    onAfterSuccess: closeTrainerProfile,
  });

  const profileIsLinkedCoach = profileMatchesLinkedCoach(
    shell.profileTrainer,
    shell.trainerData,
    shell.userData,
    shell.hasTrainer,
  );

  const openMessagingWithThisCoach = () => {
    shell.setSelectedTrainer(shell.profileTrainer);
    shell.setProfileTrainer(null);
    shell.rootGoBack();
    shell.setShowTrainerMessaging(true);
  };

  const sheetTitle = trainerDisplayTitle(shell.profileTrainer);
  const sheetVariant = profileIsLinkedCoach ? 'connected' : 'marketplace';
  const messageButtonHandler = profileIsLinkedCoach ? openMessagingWithThisCoach : undefined;
  const connectButtonHandler = profileIsLinkedCoach ? undefined : connectionFlow.openConnectFlow;
  const screenTheme = getTheme(shell.isDark);
  const requestConfirmTrainer = connectionFlow.requestConfirmTrainer;
  let confirmTrainer = requestConfirmTrainer;
  if (requestConfirmTrainer && requestConfirmTrainer._firebase) {
    confirmTrainer = requestConfirmTrainer._firebase;
  }
  const introTrainerName = trainerNameForIntro(connectionFlow.requestIntroTrainer);
  const confirmPopupVisible = !!connectionFlow.requestConfirmTrainer;
  const introPopupVisible = !!connectionFlow.requestIntroTrainer;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: screenTheme.background }}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <TopHeader
        title={sheetTitle}
        isDark={shell.isDark}
        skipTopSafeInset
        onBack={closeTrainerProfile}
        onProfilePress={shell.openProfile}
        onSettingsPress={shell.openSettings}
      />
      <View style={{ flex: 1, minHeight: 0 }}>
        <TrainerProfileSheet
          embedded
          visible
          isDark={shell.isDark}
          trainer={shell.profileTrainer}
          onClose={closeTrainerProfile}
          variant={sheetVariant}
          onMessage={messageButtonHandler}
          onConnect={connectButtonHandler}
          requesting={connectionFlow.requesting}
          shellBottomInset={shellBottomInset}
        />
      </View>
      <ConfirmRequestPopup
        visible={confirmPopupVisible}
        trainer={confirmTrainer}
        onCancel={connectionFlow.closeRequestConfirm}
        onConfirm={connectionFlow.confirmSendRequest}
        isDark={shell.isDark}
        busy={connectionFlow.requesting}
      />
      <RequestIntroPopup
        visible={introPopupVisible}
        trainerName={introTrainerName}
        messageDraft={connectionFlow.requestIntroDraft}
        onChangeMessage={connectionFlow.setRequestIntroDraft}
        onSkip={connectionFlow.completeFromIntro}
        onSendMessage={connectionFlow.completeFromIntro}
        onClose={connectionFlow.closeRequestIntro}
        isDark={shell.isDark}
        busy={connectionFlow.requesting}
      />
      {shell.addNotesFilesModalEl}
    </SafeAreaView>
  );
}

function buildCoachConversationBody(shell) {
  const chatState = normalizeAiChatState(shell.aiChatState);
  const userProfile = {
    ...(shell.onboardingData || {}),
    ...(shell.userData || {}),
  };
  const remountKey = aiChatScreenRemountKey(chatState);

  const leaveChatBackToHome = () => {
    shell.setAiChatState(AI_CHAT_HOME_STATE);
    shell.rootGoBack();
  };

  return (
    <>
      <CoachConversationScreen
        hideBottomNav
        key={remountKey}
        userId={signedInUserIdFromShell(shell)}
        userProfile={userProfile}
        trainerId={shell.userData ? shell.userData.trainerId : undefined}
        prefill={chatState.prefill}
        sessionId={chatState.sessionId}
        initialAttachments={chatState.initialAttachments}
        onBack={leaveChatBackToHome}
        onSessionSwitch={(session) =>
          shell.openAIChatSession({ sessionId: session.sessionId || session.id })
        }
        onNewChat={() => shell.openAIChatSession({})}
        openAttachmentsOnMount={false}
        {...shell.aiChatNavHandlers}
      />
      {addFilePopupForShell(shell)}
    </>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Client profile stack screen — Edit profile + notes modal + floating tabs.
 */
export function ClientViewMyMyProfileScreen() {
  const shell = useClientAppStartShell();
  const onNavigate = buildNavigateFromShell(shell);

  // 1. Profile body + notes/files modal from shell
  const profileBody = (
    <>
      <ViewMyMyProfileScreen
        onBack={shell.rootGoBack}
        embedShellBottomNav
        userRole={PROFILE_USER_ROLE_CLIENT}
        userData={shell.userData}
        onboardingData={shell.onboardingData}
        onNavigate={onNavigate}
        onProfileSaved={() => refreshProfileAfterSave(shell)}
      />
      {shell.addNotesFilesModalEl}
    </>
  );

  // 2. Floating tabs + nav provider
  return wrapClientStackScreen(profileBody, shell);
}

/**
 * Client settings stack screen.
 */
export function ClientSettingsScreen() {
  const shell = useClientAppStartShell();
  const onNavigate = buildNavigateFromShell(shell);
  const removeTrainerHandler = openRemoveTrainerWhenLinked(shell);

  // 1. Settings + notes modal
  const settingsBody = (
    <>
      <SettingsScreen
        onBack={shell.rootGoBack}
        onNavigate={onNavigate}
        userData={shell.userData}
        trainerData={shell.trainerData}
        embedShellBottomNav
        onOpenCoachingPayment={shell.openCoachingPayment}
        onOpenRemoveTrainer={removeTrainerHandler}
      />
      {shell.addNotesFilesModalEl}
    </>
  );

  // 2. Wrap with floating tabs
  return wrapClientStackScreen(settingsBody, shell);
}

export const ClientHelpFAQScreen = makeClientCloseOnlyScreen(HelpFAQScreen, 'ClientHelpFAQScreen');
export const ClientTermsScreen = makeClientCloseOnlyScreen(TermsOfServiceScreen, 'ClientTermsScreen');
export const ClientPrivacyScreen = makeClientCloseOnlyScreen(PrivacyPolicyScreen, 'ClientPrivacyScreen');
export const ClientContactSupportScreen = makeClientCloseOnlyScreen(
  ContactSupportScreen,
  'ClientContactSupportScreen',
);
export const ClientBugReportScreen = makeClientCloseOnlyScreen(BugReportScreen, 'ClientBugReportScreen');

/**
 * Privacy / data-rights stack screen.
 */
export function ClientPrivacyDataRightsScreen() {
  const shell = useClientAppStartShell();
  const onNavigate = buildNavigateFromShell(shell);
  const rightsBody = (
    <PrivacyDataRightsScreen
      onClose={shell.rootGoBack}
      onNavigate={onNavigate}
      embedShellBottomNav
    />
  );
  return wrapClientStackScreen(rightsBody, shell);
}

/**
 * Daily food log stack screen — pop refreshes nutrition on the shell.
 */
export function ClientDailyFoodLogScreen() {
  const shell = useClientAppStartShell();

  function leaveFoodLogAndRefresh() {
    shell.rootGoBack();
    if (shell.refetchNutritionData) {
      shell.refetchNutritionData();
    }
  }

  function openAddFilePopup() {
    shell.setShowAddFilePopup(true);
  }

  function openWeeklyMomentumFromFoodLog() {
    if (shell.openWeeklyMomentum) {
      shell.openWeeklyMomentum();
    }
  }

  // 1. Daily log + add-file popup (food log opens the popup itself)
  const foodLogBody = (
    <>
      <DailyLogContent
        hideBottomNav
        onBack={leaveFoodLogAndRefresh}
        onNutritionDataChanged={shell.refetchNutritionData}
        onProfilePress={shell.openProfile}
        onSettingsPress={shell.openSettings}
        onHomePress={shell.handleHomePress}
        onPlusPress={openAddFilePopup}
        onVoicePress={shell.openAIChatHome}
        onNutritionPress={shell.openNutrition}
        onWorkoutPress={shell.openWorkout}
        onMessagesPress={shell.handleOpenConversations}
        onOpenWeeklyMomentum={openWeeklyMomentumFromFoodLog}
      />
      {addFilePopupForShell(shell)}
    </>
  );

  // 2. Wrap with floating tabs
  return wrapClientStackScreen(foodLogBody, shell);
}

/**
 * Create / edit workout plan stack screen.
 */
export function ClientWorkoutPlanScreen() {
  const shell = useClientAppStartShell();
  const planBody = (
    <>
      <CreateWorkoutPlanScreen
        hideBottomNav
        onBack={shell.rootGoBack}
        onProfilePress={shell.openProfile}
        onSettingsPress={shell.openSettings}
        onStartSession={shell.openWorkoutSession}
      />
      {shell.addNotesFilesModalEl}
    </>
  );
  return wrapClientStackScreen(planBody, shell);
}

/**
 * Find-a-trainer marketplace stack screen.
 */
export function ClientSearchTrainersScreen() {
  const shell = useClientAppStartShell();
  const clientProfile = mergedClientProfileForSearch(shell);
  const searchBody = (
    <>
      <SearchTrainersScreen
        onBack={shell.rootGoBack}
        showBottomNav={false}
        reserveShellBottomNav
        onRequestTrainer={shell.requestTrainerConnection}
        clientProfile={clientProfile}
      />
      {shell.addNotesFilesModalEl}
    </>
  );
  return wrapClientStackScreen(searchBody, shell);
}

/**
 * Trainer profile sheet opened from home / search.
 */
export function ClientTrainerViewMyMyProfileScreen() {
  const shell = useClientAppStartShell();
  const shellBottomInset = useShellBottomNavInset(TRAINER_SHEET_BOTTOM_INSET_EXTRA);

  // 1. Nothing to show until home/search set profileTrainer on the shell
  if (!shell.profileTrainer) return null;

  // 2. Build sheet + connect/intro popups, then wrap
  const trainerSheetBody = buildTrainerProfileSheetBody(shell, shellBottomInset);
  return wrapClientStackScreen(trainerSheetBody, shell);
}

/**
 * Booked sessions list for the linked coach.
 */
export function ClientMySessionsScreen() {
  const shell = useClientAppStartShell();
  const sessionsUserId = signedInUserIdFromShell(shell);
  if (!sessionsUserId) return null;

  const { coachId, coachName } = coachIdAndNameFromShell(shell);
  function openRequestSessionScreen() {
    rootNavigate(CLIENT_ROUTES.RequestSession);
  }
  const sessionsBody = (
    <>
      <MySessionsScreen
        clientId={sessionsUserId}
        trainerId={coachId}
        trainerName={coachName}
        onBack={shell.rootGoBack}
        onRequestSession={openRequestSessionScreen}
      />
      {shell.addNotesFilesModalEl}
    </>
  );
  return wrapClientStackScreen(sessionsBody, shell);
}

/**
 * Request a new session with the linked coach.
 */
export function ClientRequestSessionScreen() {
  const shell = useClientAppStartShell();
  const requestUserId = signedInUserIdFromShell(shell);
  if (!requestUserId) return null;

  const { coachId, coachName } = coachIdAndNameFromShell(shell);
  const requestBody = (
    <>
      <RequestSessionScreen
        clientId={requestUserId}
        trainerId={coachId}
        trainerName={coachName}
        onBack={shell.rootGoBack}
      />
      {shell.addNotesFilesModalEl}
    </>
  );
  return wrapClientStackScreen(requestBody, shell);
}

/**
 * Client self-view weekly report.
 */
export function ClientWeeklyReportScreen() {
  const shell = useClientAppStartShell();
  const reportUserId = signedInUserIdFromShell(shell);
  if (!reportUserId) return null;

  const reportNavHandlers = weeklyReportNavHandlers(shell);
  let clientDisplayName = FALLBACK_SELF_DISPLAY_NAME;
  const userData = shell.userData;
  if (userData && userData.firstName) {
    clientDisplayName = userData.firstName;
  } else {
    const signedInUser = shell.user;
    if (signedInUser && signedInUser.displayName) {
      clientDisplayName = signedInUser.displayName;
    }
  }
  const reportBody = (
    <>
      <WeeklyReportScreen
        clientId={reportUserId}
        clientName={clientDisplayName}
        isClientSelfView
        isDark={shell.isDark}
        reserveShellBottomNav
        onClose={shell.rootGoBack}
        {...reportNavHandlers}
      />
      {shell.addNotesFilesModalEl}
    </>
  );
  return wrapClientStackScreen(reportBody, shell);
}

/**
 * Progress photo gallery for the day-6 client shape.
 */
export function ClientMyProgressPhotosScreen() {
  const shell = useClientAppStartShell();
  if (!shell.day6Client || !shell.day6Client.id) return null;

  const photoRouteParams = {
    clientId: shell.day6Client.id,
    clientName: shell.day6Client.name,
    allowUpload: true,
  };
  const photosBody = (
    <MyProgressPhotosScreen
      route={{ params: photoRouteParams }}
      navigation={{ goBack: shell.rootGoBack }}
      onRegisterAddHandler={shell.registerProgressPhotoAddHandler}
      useShellHeader
      onBack={shell.rootGoBack}
      reserveShellBottomNav
    />
  );
  return wrapClientStackScreen(photosBody, shell);
}

/**
 * Weight / body-fat / lifts charts.
 */
export function ClientProgressChartsScreen() {
  const shell = useClientAppStartShell();
  let chartUserId = signedInUserIdFromShell(shell);
  if (!chartUserId) {
    const day6Client = shell.day6Client;
    if (day6Client) chartUserId = day6Client.id;
  }
  let weightGoal = null;
  const chartUserData = shell.userData;
  if (chartUserData && chartUserData.goalWeight) {
    weightGoal = chartUserData.goalWeight;
  } else if (chartUserData && chartUserData.weightGoal) {
    weightGoal = chartUserData.weightGoal;
  }
  const chartsBody = (
    <ProgressChartsScreen
      userId={chartUserId}
      weightGoal={weightGoal}
      onBack={shell.rootGoBack}
      navigation={{ goBack: shell.rootGoBack }}
    />
  );
  return wrapClientStackScreen(chartsBody, shell);
}

/**
 * Quick log-workout overlay that can jump to the plan.
 */
export function ClientLogWorkoutScreen() {
  const shell = useClientAppStartShell();
  const openPlanAfterClosingLog = () => {
    shell.rootGoBack();
    if (shell.openWorkoutPlan) {
      shell.openWorkoutPlan();
    }
  };
  const logBody = (
    <LogWorkoutScreen onBack={shell.rootGoBack} onOpenPlan={openPlanAfterClosingLog} />
  );
  return wrapClientStackScreen(logBody, shell);
}

/**
 * Daily check-in with the linked coach’s first name.
 */
export function ClientDailyCheckInScreen() {
  const shell = useClientAppStartShell();
  const trainerFirstName = trainerFirstNameFromShell(shell);
  const checkInBody = (
    <DailyCheckInScreen
      userId={signedInUserIdFromShell(shell)}
      trainerFirstName={trainerFirstName}
      onBack={shell.rootGoBack}
    />
  );
  return wrapClientStackScreen(checkInBody, shell);
}

/**
 * Mood check-in stack screen.
 */
export function ClientMoodCheckInScreen() {
  const shell = useClientAppStartShell();
  const moodBody = (
    <MoodCheckInScreen userId={signedInUserIdFromShell(shell)} onBack={shell.rootGoBack} />
  );
  return wrapClientStackScreen(moodBody, shell);
}

/**
 * Weekly nutrition momentum; Keep nutrition tab highlighted.
 */
export function ClientWeeklyMomentumScreen() {
  const shell = useClientAppStartShell();
  const calorieGoal = weeklyMomentumCalorieGoalFromShell(shell);
  const logMealFromMomentum = () => {
    shell.rootGoBack();
    if (shell.openNutrition) {
      shell.openNutrition();
    }
  };
  const momentumBody = (
    <WeeklyMomentumScreen
      userId={signedInUserIdFromShell(shell)}
      calorieGoal={calorieGoal}
      onBack={shell.rootGoBack}
      onLogMeal={logMealFromMomentum}
    />
  );
  return wrapClientStackScreen(momentumBody, shell, { activeTabKey: NUTRITION_TAB_KEY });
}

/**
 * Client notifications inbox.
 */
export function ClientNotificationsScreen() {
  const shell = useClientAppStartShell();
  const notificationsBody = (
    <NotificationsScreen onBack={shell.rootGoBack} roleField="clientUid" />
  );
  return wrapClientStackScreen(notificationsBody, shell);
}

/**
 * Saved AI / coach workout plans list.
 */
export function ClientAIWorkoutsScreen() {
  const shell = useClientAppStartShell();
  if (!shell.day6Client || !shell.day6Client.id) return null;

  const openPlanViewerForSavedPlan = (plan) => {
    shell.setViewingPlan(plan);
    shell.openPlanViewer();
  };
  const savedWorkoutsTrainerId = shell.userData ? shell.userData.trainerId : undefined;
  const savedWorkoutsBody = (
    <SavedWorkoutsScreen
      embedInLayout={false}
      client={shell.day6Client}
      trainerId={savedWorkoutsTrainerId}
      viewerRole={SAVED_WORKOUTS_VIEWER_ROLE}
      onBack={shell.rootGoBack}
      route={{ params: { clientId: shell.day6Client.id, clientName: shell.day6Client.name } }}
      navigation={{ goBack: shell.rootGoBack }}
      onViewPlan={openPlanViewerForSavedPlan}
    />
  );
  return wrapClientStackScreen(savedWorkoutsBody, shell);
}

/**
 * Read-only plan viewer for a saved plan on the shell.
 */
export function ClientMyWorkoutPlanScreen() {
  const shell = useClientAppStartShell();
  if (!shell.viewingPlan) return null;

  const viewingPlanBody = (
    <CreateWorkoutPlanScreen
      plan={shell.viewingPlan}
      readOnly
      hideBottomNav
      onBack={shell.rootGoBack}
      onStartSession={shell.openWorkoutSession}
    />
  );
  return wrapClientStackScreen(viewingPlanBody, shell);
}

/**
 * Live workout session — floating tabs hidden.
 */
export function ClientWorkoutSessionScreen({ route, navigation }) {
  const shell = useClientAppStartShell();
  const sessionBody = (
    <WorkoutSessionScreen
      route={route}
      navigation={navigation}
      onClose={shell.rootGoBack}
    />
  );
  return wrapClientStackScreen(sessionBody, shell, { hideBottomNav: true });
}

/**
 * AI coach home (sessions list + start chat).
 */
export function ClientCoachHomeScreen() {
  const shell = useClientAppStartShell();
  let devTestSuiteOpener;
  if (__DEV__) {
    devTestSuiteOpener = () => openCoachSelfTestFromShell(shell);
  }
  function startNewChat(payload = {}) {
    shell.openAIChatSession(payload);
  }
  function openExistingChatSession(session) {
    const sessionId = session.sessionId || session.id;
    shell.openAIChatSession({ sessionId });
  }
  const coachHomeBody = (
    <>
      <CoachHomeScreen
        hideBottomNav
        userId={signedInUserIdFromShell(shell)}
        onStartChat={startNewChat}
        onSessionPress={openExistingChatSession}
        onOpenTestSuite={devTestSuiteOpener}
        {...shell.aiChatNavHandlers}
      />
      {addFilePopupForShell(shell)}
    </>
  );
  return wrapClientStackScreen(coachHomeBody, shell);
}

/**
 * AI coach conversation thread.
 */
export function ClientCoachConversationScreen() {
  const shell = useClientAppStartShell();
  // 1. Normalize chat state + build conversation + add-file popup
  const conversationBody = buildCoachConversationBody(shell);
  // 2. Wrap with floating tabs
  return wrapClientStackScreen(conversationBody, shell);
}

/**
 * Dev-only AI coach self-test suite.
 */
export function ClientAICoachTestScreen() {
  const shell = useClientAppStartShell();
  if (!CoachSelfTest) {
    return wrapClientStackScreen(null, shell);
  }

  let coachName = FALLBACK_COACH_NAME;
  const selfTestUserData = shell.userData;
  if (selfTestUserData && selfTestUserData.trainerName) {
    coachName = selfTestUserData.trainerName;
  } else if (selfTestUserData && selfTestUserData.trainer && selfTestUserData.trainer.name) {
    coachName = selfTestUserData.trainer.name;
  }
  const userProfile = {
    ...(shell.onboardingData || {}),
    ...(shell.userData || {}),
  };
  const leaveSelfTest = () => {
    shell.setAiChatState(AI_CHAT_HOME_STATE);
    shell.rootGoBack();
  };
  const selfTestBody = (
    <CoachSelfTest
      userId={signedInUserIdFromShell(shell)}
      userProfile={userProfile}
      trainerName={coachName}
      onBack={leaveSelfTest}
    />
  );
  return wrapClientStackScreen(selfTestBody, shell);
}

// PLUMBING — skip unless debugging trainer profile + AI chat edge cases

function firestoreIdFromTrainerCard(trainer) {
  if (!trainer) return null;
  if (trainer.id) return trainer.id;
  const firebaseMeta = trainer._firebase;
  if (firebaseMeta && firebaseMeta.id) return firebaseMeta.id;
  if (trainer.uid) return trainer.uid;
  return null;
}

function profileMatchesLinkedCoach(profileTrainer, trainerData, userData, clientHasCoach) {
  if (!clientHasCoach) return false;
  const profileId = firestoreIdFromTrainerCard(profileTrainer);
  let linkedCoachId = firestoreIdFromTrainerCard(trainerData);
  if (!linkedCoachId && userData && userData.trainerId) {
    linkedCoachId = String(userData.trainerId);
  }
  if (!profileId || !linkedCoachId) return false;
  return String(profileId) === String(linkedCoachId);
}

function trainerDisplayTitle(profileTrainer) {
  if (!profileTrainer) return FALLBACK_TRAINER_SHEET_TITLE;
  if (profileTrainer.name) return profileTrainer.name;
  if (profileTrainer.displayName) return profileTrainer.displayName;
  return FALLBACK_TRAINER_SHEET_TITLE;
}

function trainerNameForIntro(trainer) {
  if (!trainer) return FALLBACK_TRAINER_NAME;
  if (trainer.name) return trainer.name;
  if (trainer.displayName) return trainer.displayName;
  return FALLBACK_TRAINER_NAME;
}

function normalizeAiChatState(aiChatState) {
  if (aiChatState && typeof aiChatState === 'object') return aiChatState;
  return {};
}

/**
 * Remount key so switching session / prefill / attachments rebuilds the chat screen.
 * Letters sid / pf / att stay — CoachConversationScreen already keys off this shape.
 */
function aiChatScreenRemountKey(chatState) {
  const attachmentCount = Array.isArray(chatState.initialAttachments)
    ? chatState.initialAttachments.length
    : 0;
  return JSON.stringify({
    sid: chatState.sessionId ?? null,
    pf: chatState.prefill ?? null,
    att: attachmentCount,
  });
}
