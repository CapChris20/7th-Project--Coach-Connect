// Client home shell: Home tab IS the mockup client-home screen (no separate Dashboard).
// Flow: read the shared shell → Home paints TrainingHomeScreen → other tabs/overlays stay as before.
// Used once as the client MainTabs screen. Tab keys stay CLIENT_MAIN_TABS.*.

import React, { useState, useEffect } from 'react';
import {
  ScrollView,
  Share,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../../app-start/cloudConnection';
import { getClientDateKey } from '../../helpers/dateStrings';
import { mergeClientDailyMetrics } from '../../daily-stats/saveDailyStats';
import { markNotesAndFilesItemRead } from '../../for-both/files-and-notes/saveNotesAndFiles';
import ChatWithTrainerScreen from '../../messaging/ChatScreen';
import InboxScreen from '../../messaging/InboxScreen';
import TrainingHomeScreen from '../home/TrainingHomeScreen';
import TopHeader from '../../for-both/loading-and-header/TopHeader';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import { SHELL_SAFE_AREA_EDGES, ShellBottomNavAnchor } from '../../navigation/bottomMenuSpacing';
import {
  readWorkoutGenerationSession,
  subscribeWorkoutGenerationSession,
} from '../../workouts/create-plan/keepPlanBuildingInBackground';
import { AppNavigationProvider } from '../../navigation/whichScreenIsOpen';
import FilesSection from '../../for-both/files-and-notes/viewers/FilesSection';
import TrainerSharedFilesPopup from '../files-and-notes/TrainerSharedFilesPopup';
import AddFilePopup from '../../for-both/files-and-notes/viewers/AddFilePopup';
import PdfViewer from '../../for-both/files-and-notes/viewers/PdfViewer';
import SpreadsheetViewer from '../../for-both/files-and-notes/viewers/SpreadsheetViewer';
import DocumentViewer from '../../for-both/files-and-notes/viewers/DocumentViewer';
import PhotoVideoViewer from '../../for-both/files-and-notes/viewers/PhotoVideoViewer';
import WebPageViewer from '../../for-both/files-and-notes/viewers/WebPageViewer';
import WriteTrainerReviewPopup from '../home/WriteTrainerReviewPopup';
import DailyLogContent from '../../nutrition/daily-log/DailyLogContent';
import CreateWorkoutPlanScreen from '../../workouts/create-plan/CreateWorkoutPlanScreen';
import CoachHomeScreen from '../../ai-coach/home-screen/CoachHomeScreen';
import CoachConversationScreen from '../../ai-coach/conversation/CoachConversationScreen';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import { useIsFocused } from '@react-navigation/native';
import { CLIENT_MAIN_TABS } from './goToClientScreen';
import { useClientAppStartShell } from './ClientOpenScreenTracker';
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const AI_CHAT_HOME = 'home';
const DEFAULT_SELF_NAME = 'You';
const SCROLL_BOTTOM_PAD = 130;

// ===== HELPER FUNCTIONS =====

/**
 * Workout-tab badge: show "ready" only when a background generate finished and the user is not already on Workout.
 * A session for a different uid is ignored so a stale write cannot flip this user's badge.
 * @param {object} session
 * @param {string} uid
 * @param {string} mainTab
 * @param {Function} setWorkoutGenInFlight
 * @param {Function} setWorkoutPlanReadyBadge
 */
function applyWorkoutGenerationSession(session, uid, mainTab, setWorkoutGenInFlight, setWorkoutPlanReadyBadge) {
  if (session?.uid && session.uid !== uid) return;
  setWorkoutGenInFlight(!!session?.inFlight);
  const showReadyBadge =
    !!session?.pendingReady &&
    !session?.inFlight &&
    mainTab !== CLIENT_MAIN_TABS.workout;
  setWorkoutPlanReadyBadge(showReadyBadge);
}

/**
 * Saved workoutLog rows use exerciseName + numeric reps/weight. The form uses name.
 * @param {object[]} workoutExercises
 * @returns {object[]}
 */
function workoutLogRowsFromExercises(workoutExercises) {
  return workoutExercises.map((exercise) => ({
    exerciseName: exercise.name || exercise.exerciseName || '',
    sets: Array.isArray(exercise.sets)
      ? exercise.sets.map((setRow) => ({
          reps: parseInt(setRow.reps, 10) || 0,
          weight: parseFloat(setRow.weight) || 0,
        }))
      : [],
  }));
}

/**
 * dailyLogs field names stay dashboard_water / dashboard_sleep / dashboard_workouts.
 * @param {object} patch
 * @returns {object}
 */
function buildDailyLogsPatch(patch) {
  const logsPatch = {};
  if (typeof patch.waterIntake === 'number') {
    logsPatch.dashboard_water = String(patch.waterIntake);
  }
  if (typeof patch.sleepHours === 'number') {
    logsPatch.dashboard_sleep = String(patch.sleepHours);
  }
  if (patch.workoutSummary != null) {
    logsPatch.dashboard_workouts = patch.workoutSummary;
  }
  if (patch.workoutName != null) {
    logsPatch.dashboard_workout_name = patch.workoutName;
  }
  if (Array.isArray(patch.workoutExercises) && patch.workoutExercises.length > 0) {
    logsPatch.workoutLog = workoutLogRowsFromExercises(patch.workoutExercises);
  }
  return logsPatch;
}

/**
 * Write the dashboard patch to dailyLogs + the legacy tracking copy, and mirror it onto home-row state.
 * @param {object} patch
 * @param {object} user
 * @param {object} setters
 */
async function saveTrainerMetricsPatch(patch, user, setters) {
  const updateData = {};
  if (typeof patch.waterIntake === 'number') {
    updateData.waterIntake = patch.waterIntake;
    setters.setWaterIntake(patch.waterIntake);
  }
  if (typeof patch.sleepHours === 'number') {
    updateData.sleepHours = patch.sleepHours;
    setters.setSleepHours(patch.sleepHours);
  }
  if (patch.workoutSummary != null) {
    updateData.workoutSummary = patch.workoutSummary;
    setters.setDashboardWorkoutSummary(patch.workoutSummary);
  }
  if (patch.workoutName != null || (Array.isArray(patch.workoutExercises) && patch.workoutExercises.length > 0)) {
    updateData.workoutName = patch.workoutName;
    updateData.workoutExercises = patch.workoutExercises;
    setters.setTodayWorkout({
      name: patch.workoutName || '',
      exercises: Array.isArray(patch.workoutExercises) ? patch.workoutExercises : [],
    });
  }

  if (Object.keys(updateData).length === 0) return;

  const todayKey = getClientDateKey();
  const logsPatch = buildDailyLogsPatch(patch);
  await mergeClientDailyMetrics(user.uid, todayKey, {
    logs: logsPatch,
    tracking: updateData,
  });
}

/**
 * Wellness ratings update the home row immediately. Water / sleep / workout persist first.
 * @param {object} patch
 * @param {object} user
 * @param {object} setters
 */
async function applyDashboardMetricsPatch(patch, user, setters) {
  // 1. Wellness ratings update the home row immediately (empty string is ignored).
  if (patch.soreness != null && patch.soreness !== '') {
    setters.setSoreness(String(patch.soreness));
  }
  if (patch.energyLevel != null && patch.energyLevel !== '') {
    setters.setEnergyLevel(String(patch.energyLevel));
  }
  if (patch.stressLevel != null && patch.stressLevel !== '') {
    setters.setStressLevel(String(patch.stressLevel));
  }

  try {
    // 2. Water / sleep / workout persist to dailyLogs, then mirror onto home-row state.
    await saveTrainerMetricsPatch(patch, user, setters);
  } catch (error) {
    console.error('❌ Failed to save trainer metrics:', error);
  }
}

function unreadNotesCount(notesAndFiles) {
  if (!Array.isArray(notesAndFiles)) return 0;
  return notesAndFiles.filter((file) => file?.isRead === false).length;
}

function notesFileCount(notesAndFiles) {
  return Array.isArray(notesAndFiles) ? notesAndFiles.length : 0;
}

// ===== MAIN FUNCTION =====

/**
 * Client main tabs: mockup Home (TrainingHomeScreen), nutrition, workout, AI, plus overlays.
 * @returns {import('react').ReactElement}
 */
export default function ClientMainScreen() {
  const shell = useClientAppStartShell();
  const {
    navProviderProps,
    isDark,
    styles,
    showTrainerMessaging,
    reviewPromptTrainer,
    setReviewPromptTrainer,
    setShowReviewSheetForPrompt,
    selectedTrainer,
    selectedConversation,
    handleCloseMessaging,
    handleOpenConversations,
    openProfile,
    openSettings,
    handleHomePress,
    setShowAddFilePopup,
    openAIChatHome,
    openNutrition,
    openWorkout,
    showConversationsList,
    handleSelectConversation,
    handleCloseConversationsList,
    trainerData,
    unreadMessageCount,
    setShowRemoveTrainerPopup,
    setProfileTrainer,
    openTrainerProfile,
    caloriesConsumed,
    calorieGoal,
    nutritionGoals,
    nutritionMacros,
    waterIntake,
    sleepHours,
    setSoreness,
    setEnergyLevel,
    setStressLevel,
    setWaterIntake,
    setSleepHours,
    setTodayWorkout,
    setDashboardWorkoutSummary,
    user,
    handleFindTrainers,
    day6Client,
    setDay6Client,
    openPhotoGallery,
    openAIWorkouts,
    openWeeklyReport,
    openNutrition: goNutrition,
    userData,
    showNotesFiles,
    setShowNotesFiles,
    notesAndFiles,
    openNotesFile,
    deleteSingleMyFile,
    deletingMyFiles,
    refreshNotesAndFiles,
    showTrainerSharedFilesPopup,
    setShowTrainerSharedFilesPopup,
    trainerSharedFiles,
    showAddFilePopup,
    pdfViewer,
    setPdfViewer,
    spreadsheetViewer,
    setSpreadsheetViewer,
    documentViewer,
    setDocumentViewer,
    mediaViewer,
    setMediaViewer,
    embedWebViewer,
    setEmbedWebViewer,
    showRemoveTrainerPopup,
    showReviewSheetForPrompt,
    openTrainerSearch,
    onboardingData,
    mainTab,
    mainTabActiveKey,
    aiChatState,
    setAiChatState,
    openAIChatSession,
    refetchNutritionData,
    onNavigate,
    aiChatNavHandlers,
    openCoachingPayment,
    setTrainerData,
  } = shell;

  const [workoutPlanReadyBadge, setWorkoutPlanReadyBadge] = useState(false);
  const [workoutGenInFlight, setWorkoutGenInFlight] = useState(false);

  useEffect(() => {
    const uid = user?.uid;
    if (!uid) {
      setWorkoutPlanReadyBadge(false);
      setWorkoutGenInFlight(false);
      return undefined;
    }

    const syncSession = (session) => {
      applyWorkoutGenerationSession(session, uid, mainTab, setWorkoutGenInFlight, setWorkoutPlanReadyBadge);
    };

    readWorkoutGenerationSession(uid).then(syncSession);
    return subscribeWorkoutGenerationSession(syncSession);
  }, [user?.uid, mainTab]);

  const aiChatPayload = aiChatState && typeof aiChatState === 'object' ? aiChatState : null;
  const isMainFocused = useIsFocused();
  const [nutritionOnboardingActive, setNutritionOnboardingActive] = useState(false);
  const keepAiCoachMounted = mainTab === CLIENT_MAIN_TABS.ai || Boolean(aiChatPayload);
  // Keep shell BottomMenuBar on Dashboard, Messages list, Goals, etc.
  // Only hide for focused flows: nutrition onboarding, or an open chat thread.
  const hideBottomNav =
    (mainTab === CLIENT_MAIN_TABS.nutrition && nutritionOnboardingActive) ||
    showTrainerMessaging;

  return (
    <AppNavigationProvider {...navProviderProps}>
    <SafeAreaView
      style={[styles.safeArea, !isDark ? styles.safeAreaLight : styles.safeAreaDark]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <StatusBar barStyle={!isDark ? 'dark-content' : 'light-content'} />
      <View style={{ flex: 1 }}>

      {showTrainerMessaging ? (
        <ChatWithTrainerScreen
          embedInLayout
          trainer={selectedTrainer}
          conversation={selectedConversation}
          onClose={handleCloseMessaging}
          onProfilePress={() => openProfile()}
          onSettingsPress={() => openSettings()}
        />
      ) : showConversationsList ? (
        <View
          style={{ flex: 1, backgroundColor: isDark ? lightColors.nbInk : '#F7F7FA' }}
        >
          <InboxScreen
            embedInLayout
            onSelectConversation={handleSelectConversation}
            onClose={handleCloseConversationsList}
            onProfilePress={() => openProfile()}
            onSettingsPress={() => openSettings()}
          />
        </View>
      ) : showNotesFiles ? (
        <View
          style={{ flex: 1, backgroundColor: isDark ? darkColors.nbBackground : lightColors.nbBackground }}
        >
          {/* Design Law PNG 01: NbPageHeader (not TopHeader) + FilesSection segmented workspace */}
          <NbPageHeader
            title="Your Notes & Files"
            subtitle="Everything shared between you and your coach, all in one place."
            onBack={() => setShowNotesFiles(false)}
          />
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: SCROLL_BOTTOM_PAD }}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <FilesSection
              items={notesAndFiles}
              isDark={isDark}
              showHero={false}
              onOpenItem={openNotesFile}
              onDownloadItem={(x) => x?.url && openNotesFile(x)}
              onShareItem={(x) => x?.url && Share.share({ message: `${x?.name || x?.title || 'File'}\n${x.url}` }).catch(() => {})}
              onDeleteItem={(x) => {
                if (deletingMyFiles) return;
                deleteSingleMyFile(x);
              }}
              onMarkRead={async (x) => {
                if (!user?.uid || !x?.id) return;
                try { await markNotesAndFilesItemRead(user.uid, x.id); } catch (_) {}
              }}
              onUploadPress={() => setShowAddFilePopup(true)}
            />
          </ScrollView>
        </View>
      ) : mainTab === CLIENT_MAIN_TABS.nutrition ? (
        <DailyLogContent
          hideBottomNav
          onOnboardingActiveChange={setNutritionOnboardingActive}
          onBack={() => {
            handleHomePress();
            refetchNutritionData?.();
          }}
          onNutritionDataChanged={refetchNutritionData}
          onProfilePress={openProfile}
          onSettingsPress={openSettings}
          onHomePress={handleHomePress}
          onPlusPress={() => setShowAddFilePopup(true)}
          onVoicePress={openAIChatHome}
          onNutritionPress={openNutrition}
          onWorkoutPress={openWorkout}
          onMessagesPress={handleOpenConversations}
        />
      ) : mainTab === CLIENT_MAIN_TABS.ai ? null : mainTab === CLIENT_MAIN_TABS.workout ? null : (
        // Home tab = Design Law client-home + Design Law TopHeader (profile + settings chips).
        <View style={{ flex: 1, backgroundColor: isDark ? darkColors.nbBackground : lightColors.nbBackground }}>
          <TopHeader
            isDark={isDark}
            onProfilePress={() => openProfile()}
            onSettingsPress={() => openSettings()}
          />
          {reviewPromptTrainer ? (
            <View
              style={{
                backgroundColor: isDark ? darkColors.nbSurfaceChip : lightColors.nbSoft,
                borderColor: isDark ? darkColors.nbBorder : lightColors.nbBorder,
                borderWidth: 3,
                borderRadius: 10,
                padding: 14,
                flexDirection: 'row',
                alignItems: 'center',
                marginHorizontal: 16,
                marginTop: 8,
              }}
            >
              <Ionicons name="star-outline" size={18} color={isDark ? darkColors.nbInk : lightColors.nbInk} />
              <Text style={{ flex: 1, marginLeft: 10, fontSize: 13, color: isDark ? darkColors.nbInk : lightColors.nbInk }}>
                How was your experience with {reviewPromptTrainer.name}?{' '}
                <Text
                  style={{ color: isDark ? darkColors.nbInk : lightColors.nbInk, fontWeight: '900', textDecorationLine: 'underline' }}
                  onPress={() => setShowReviewSheetForPrompt(true)}
                >
                  Leave a review
                </Text>
              </Text>
              <TouchableOpacity onPress={() => setReviewPromptTrainer(null)}>
                <Ionicons name="close" size={18} color={isDark ? darkColors.nbMuted : lightColors.nbMuted} />
              </TouchableOpacity>
            </View>
          ) : null}
          <TrainingHomeScreen
            embedInLayout
            trainer={trainerData}
            userData={userData}
            onOpenCoachingPayment={openCoachingPayment}
            unreadMessageCount={unreadMessageCount}
            onOpenRemoveTrainer={trainerData ? () => setShowRemoveTrainerPopup(true) : undefined}
            onPressViewProfile={() => {
              if (!trainerData) return;
              setProfileTrainer(trainerData);
              openTrainerProfile();
            }}
            todayCalories={caloriesConsumed}
            calorieGoal={calorieGoal}
            proteinG={nutritionMacros?.find?.((m) => m.label === 'Protein') ? parseFloat(String(nutritionMacros.find((m) => m.label === 'Protein').value)) : undefined}
            carbsG={nutritionMacros?.find?.((m) => m.label === 'Carbs') ? parseFloat(String(nutritionMacros.find((m) => m.label === 'Carbs').value)) : undefined}
            fatsG={nutritionMacros?.find?.((m) => m.label === 'Fats') ? parseFloat(String(nutritionMacros.find((m) => m.label === 'Fats').value)) : undefined}
            proteinGoal={nutritionGoals?.proteinTarget || nutritionGoals?.macroSplit?.protein}
            carbsGoal={nutritionGoals?.carbsTarget || nutritionGoals?.macroSplit?.carbs}
            fatsGoal={nutritionGoals?.fatTarget || nutritionGoals?.macroSplit?.fat}
            waterOz={waterIntake}
            sleepHoursValue={sleepHours}
            onMetricsChange={(patch) =>
              applyDashboardMetricsPatch(patch, user, {
                setSoreness,
                setEnergyLevel,
                setStressLevel,
                setWaterIntake,
                setSleepHours,
                setDashboardWorkoutSummary,
                setTodayWorkout,
              })
            }
            onPressMessage={handleOpenConversations}
            onPressFindTrainer={handleFindTrainers || openTrainerSearch}
            trainerClientId={user?.uid}
            trainerClientName={userData?.firstName || user?.displayName || DEFAULT_SELF_NAME}
            onOpenPhotoGallery={() => {
              setDay6Client({ id: user?.uid, name: userData?.firstName || user?.displayName || DEFAULT_SELF_NAME });
              openPhotoGallery();
            }}
            onOpenAIWorkouts={() => {
              setDay6Client({ id: user?.uid, name: userData?.firstName || user?.displayName || DEFAULT_SELF_NAME });
              openAIWorkouts();
            }}
            onOpenWeeklyReport={() => openWeeklyReport()}
            onPressCalories={() => openNutrition()}
            onOpenNotesFiles={() => setShowNotesFiles(true)}
            notesFilesCount={notesFileCount(notesAndFiles)}
            notesFilesNewCount={unreadNotesCount(notesAndFiles)}
          />
        </View>
      )}

      {(mainTab === CLIENT_MAIN_TABS.workout || workoutGenInFlight) ? (
        <View
          style={[
            { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
            mainTab !== CLIENT_MAIN_TABS.workout && { opacity: 0, zIndex: -1 },
          ]}
          pointerEvents={mainTab === CLIENT_MAIN_TABS.workout ? 'auto' : 'none'}
          collapsable={false}
        >
          <CreateWorkoutPlanScreen
            hideBottomNav
            onBack={handleHomePress}
            onNavigate={onNavigate}
            onProfilePress={openProfile}
            onSettingsPress={openSettings}
          />
        </View>
      ) : null}

      {keepAiCoachMounted ? (
        <View
          style={[
            { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
            mainTab !== CLIENT_MAIN_TABS.ai && { opacity: 0, zIndex: -1 },
          ]}
          pointerEvents={mainTab === CLIENT_MAIN_TABS.ai ? 'auto' : 'none'}
          collapsable={false}
        >
          {aiChatPayload ? (
            <CoachConversationScreen
              hideBottomNav
              key={JSON.stringify({
                sid: aiChatPayload.sessionId ?? null,
                pf: aiChatPayload.prefill ?? null,
                att: Array.isArray(aiChatPayload.initialAttachments)
                  ? aiChatPayload.initialAttachments.length
                  : 0,
              })}
              userId={user?.uid}
              userProfile={{ ...(onboardingData || {}), ...(userData || {}) }}
              trainerId={userData?.trainerId}
              prefill={aiChatPayload.prefill}
              sessionId={aiChatPayload.sessionId}
              initialAttachments={aiChatPayload.initialAttachments}
              onBack={() => {
                setAiChatState(AI_CHAT_HOME);
              }}
              onSessionSwitch={(session) =>
                openAIChatSession({ sessionId: session.sessionId || session.id })
              }
              onNewChat={() => openAIChatSession({})}
              openAttachmentsOnMount={false}
              {...aiChatNavHandlers}
            />
          ) : (
            <CoachHomeScreen
              hideBottomNav
              userId={user?.uid}
              onStartChat={(payload = {}) => openAIChatSession(payload)}
              onSessionPress={(session) =>
                openAIChatSession({ sessionId: session.sessionId || session.id })
              }
              {...aiChatNavHandlers}
            />
          )}
        </View>
      ) : null}
      </View>

      <TrainerSharedFilesPopup
        visible={showTrainerSharedFilesPopup}
        onClose={() => setShowTrainerSharedFilesPopup(false)}
        isDark={isDark}
        files={trainerSharedFiles}
        onPressItem={(file) => {
          setShowTrainerSharedFilesPopup(false);
          openNotesFile(file);
        }}
      />
      <AddFilePopup
        visible={showAddFilePopup}
        onClose={() => setShowAddFilePopup(false)}
        onAdded={refreshNotesAndFiles}
        isDark={isDark}
      />
      <PdfViewer
        visible={pdfViewer.visible}
        url={pdfViewer.url}
        name={pdfViewer.name}
        isDark={isDark}
        onClose={() => setPdfViewer({ visible: false, url: null, name: null })}
      />
      <SpreadsheetViewer
        visible={spreadsheetViewer.visible}
        url={spreadsheetViewer.url}
        rows={spreadsheetViewer.rows}
        name={spreadsheetViewer.name}
        isDark={isDark}
        onClose={() => setSpreadsheetViewer({ visible: false, url: null, name: null, rows: null })}
      />
      <DocumentViewer
        visible={documentViewer.visible}
        trainerId={documentViewer.trainerId}
        documentId={documentViewer.documentId}
        title={documentViewer.title}
        isDark={isDark}
        onClose={() => setDocumentViewer({ visible: false, trainerId: null, documentId: null, title: null })}
      />
      <PhotoVideoViewer
        visible={mediaViewer.visible}
        url={mediaViewer.url}
        kind={mediaViewer.kind}
        name={mediaViewer.name}
        isDark={isDark}
        onClose={() => setMediaViewer({ visible: false, url: null, kind: 'image', name: null })}
      />
      <WebPageViewer
        visible={embedWebViewer.visible}
        uri={embedWebViewer.uri}
        title={embedWebViewer.title}
        isDark={isDark}
        onClose={() => setEmbedWebViewer({ visible: false, uri: null, title: null })}
      />
      {/* RemoveTrainerPopup mounts on ClientAppShellLayout so Settings can open it too. */}
      {reviewPromptTrainer && (
        <WriteTrainerReviewPopup
          visible={showReviewSheetForPrompt}
          onClose={() => setShowReviewSheetForPrompt(false)}
          onSubmitComplete={() => {
            setShowReviewSheetForPrompt(false);
            setReviewPromptTrainer(null);
          }}
          trainerName={reviewPromptTrainer.name}
          trainerId={reviewPromptTrainer.id}
          clientId={user?.uid}
          clientFirstName={userData?.firstName || user?.displayName?.split(' ')[0]}
          existingReview={null}
        />
      )}
      {isMainFocused && !hideBottomNav ? (
        <ShellBottomNavAnchor>
          <BottomMenuBar
            {...navProviderProps}
            activeTabKey={mainTabActiveKey}
            workoutTabBadge={workoutPlanReadyBadge}
          />
        </ShellBottomNavAnchor>
      ) : null}
    </SafeAreaView>
    </AppNavigationProvider>
  );
}
