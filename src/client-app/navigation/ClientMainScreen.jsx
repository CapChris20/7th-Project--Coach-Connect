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
import OfflineBanner from '../../for-both/loading-and-header/OfflineBanner';
import useNetworkStatus from '../../for-both/online-connection/useNetworkStatus';
import { useIsFocused } from '@react-navigation/native';
import { CLIENT_MAIN_TABS } from './goToClientScreen';
import { useClientAppStartShell } from './ClientOpenScreenTracker';
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const AI_CHAT_HOME = 'home';
const DEFAULT_SELF_NAME = 'You';
const SCROLL_BOTTOM_PAD = 130;
const INBOX_LIGHT_BACKGROUND = '#F7F7FA';

// ===== HELPER FUNCTIONS =====

// Workout-tab badge: "ready" only when background generation finished and user is not on Workout tab.
// Ignore sessions written for a different uid so stale storage cannot flip this user's badge.
function applyWorkoutGenerationSession(session, uid, mainTab, setWorkoutGenInFlight, setWorkoutPlanReadyBadge) {
  if (session && session.uid && session.uid !== uid) return;
  const sessionIsInFlight = Boolean(session && session.inFlight);
  setWorkoutGenInFlight(sessionIsInFlight);
  const generationFinished = Boolean(session && session.pendingReady) && !sessionIsInFlight;
  const userNotOnWorkoutTab = mainTab !== CLIENT_MAIN_TABS.workout;
  setWorkoutPlanReadyBadge(generationFinished && userNotOnWorkoutTab);
}

// One exercise's sets → { reps, weight } rows for dailyLogs.workoutLog (freeze shape).
function setRowsFromExerciseSets(sets) {
  const setRows = [];
  if (!Array.isArray(sets)) return setRows;
  for (const setRow of sets) {
    setRows.push({
      reps: parseInt(setRow.reps, 10) || 0,
      weight: parseFloat(setRow.weight) || 0,
    });
  }
  return setRows;
}

// Saved workoutLog rows use exerciseName + numeric reps/weight; the editor form uses name.
function workoutLogRowsFromExercises(workoutExercises) {
  const logRows = [];
  for (const exercise of workoutExercises) {
    const exerciseName = exercise.name || exercise.exerciseName || '';
    const setRows = setRowsFromExerciseSets(exercise.sets);
    logRows.push({ exerciseName, sets: setRows });
  }
  return logRows;
}

// dailyLogs field names stay dashboard_water / dashboard_sleep / dashboard_workouts (freeze).
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

function applyWaterSleepWorkoutToLocalState(patch, updateData, setters) {
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

  const hasWorkoutName = patch.workoutName != null;
  const hasWorkoutExercises =
    Array.isArray(patch.workoutExercises) && patch.workoutExercises.length > 0;
  if (!hasWorkoutName && !hasWorkoutExercises) return;

  updateData.workoutName = patch.workoutName;
  updateData.workoutExercises = patch.workoutExercises;
  setters.setTodayWorkout({
    name: patch.workoutName || '',
    exercises: Array.isArray(patch.workoutExercises) ? patch.workoutExercises : [],
  });
}

// Write dashboard numbers to dailyLogs + legacy tracking, then mirror onto TrainingHome state.
async function saveTrainerMetricsPatch(patch, user, setters) {
  const updateData = {};
  applyWaterSleepWorkoutToLocalState(patch, updateData, setters);
  if (Object.keys(updateData).length === 0) return;

  const todayKey = getClientDateKey();
  const logsPatch = buildDailyLogsPatch(patch);
  await mergeClientDailyMetrics(user.uid, todayKey, {
    logs: logsPatch,
    tracking: updateData,
  });
}

function applyWellnessRatingsToLocalState(patch, setters) {
  if (patch.soreness != null && patch.soreness !== '') {
    setters.setSoreness(String(patch.soreness));
  }
  if (patch.energyLevel != null && patch.energyLevel !== '') {
    setters.setEnergyLevel(String(patch.energyLevel));
  }
  if (patch.stressLevel != null && patch.stressLevel !== '') {
    setters.setStressLevel(String(patch.stressLevel));
  }
}

// Wellness ratings touch UI immediately; water / sleep / workout persist through saveTrainerMetricsPatch.
async function applyDashboardMetricsPatch(patch, user, setters) {
  // 1. Wellness ratings update the home row immediately (empty string is ignored).
  applyWellnessRatingsToLocalState(patch, setters);

  try {
    // 2. Water / sleep / workout persist to dailyLogs, then mirror onto home-row state.
    await saveTrainerMetricsPatch(patch, user, setters);
  } catch (error) {
    console.error('❌ Failed to save trainer metrics:', error);
  }
}

function unreadNotesCount(notesAndFiles) {
  if (!Array.isArray(notesAndFiles)) return 0;
  let unreadCount = 0;
  for (const file of notesAndFiles) {
    if (file && file.isRead === false) unreadCount += 1;
  }
  return unreadCount;
}

function notesFileCount(notesAndFiles) {
  if (!Array.isArray(notesAndFiles)) return 0;
  return notesAndFiles.length;
}

// Pull one macro row's gram value from the home nutrition macro list (Protein / Carbs / Fats).
function gramValueFromMacroList(macroRows, label) {
  if (!Array.isArray(macroRows)) return undefined;
  const match = macroRows.find((row) => row.label === label);
  if (!match) return undefined;
  return parseFloat(String(match.value));
}

function clientSelfDisplayName(user, userData) {
  if (userData && userData.firstName) return userData.firstName;
  if (user && user.displayName) return user.displayName;
  return DEFAULT_SELF_NAME;
}

function clientDay6SelfRecord(user, userData) {
  let userId = null;
  if (user) userId = user.uid;
  return { id: userId, name: clientSelfDisplayName(user, userData) };
}

function buildHomeMetricsSetters(shellSetters) {
  return {
    setSoreness: shellSetters.setSoreness,
    setEnergyLevel: shellSetters.setEnergyLevel,
    setStressLevel: shellSetters.setStressLevel,
    setWaterIntake: shellSetters.setWaterIntake,
    setSleepHours: shellSetters.setSleepHours,
    setDashboardWorkoutSummary: shellSetters.setDashboardWorkoutSummary,
    setTodayWorkout: shellSetters.setTodayWorkout,
  };
}

function decideClientTabVisibility(mainTab, nutritionOnboardingActive, showTrainerMessaging, aiChatPayload) {
  const showHomeTab =
    mainTab !== CLIENT_MAIN_TABS.nutrition &&
    mainTab !== CLIENT_MAIN_TABS.ai &&
    mainTab !== CLIENT_MAIN_TABS.workout;

  const hideBottomNav =
    (mainTab === CLIENT_MAIN_TABS.nutrition && nutritionOnboardingActive) ||
    showTrainerMessaging;

  const keepAiCoachMounted = mainTab === CLIENT_MAIN_TABS.ai || Boolean(aiChatPayload);

  return { showHomeTab, hideBottomNav, keepAiCoachMounted };
}

function safeAreaThemeStyles(styles, isDark) {
  if (!isDark) return [styles.safeArea, styles.safeAreaLight];
  return [styles.safeArea, styles.safeAreaDark];
}

function statusBarStyleForTheme(isDark) {
  if (!isDark) return 'dark-content';
  return 'light-content';
}

function homeColumnBackground(isDark) {
  if (isDark) return darkColors.nbBackground;
  return lightColors.nbBackground;
}

function inboxBackground(isDark) {
  if (isDark) return lightColors.nbInk;
  return INBOX_LIGHT_BACKGROUND;
}

// vocab: absolute overlay — full-screen layer stacked above Home so tab switches do not remount Home.
function ClientTabOverlay({ active, children }) {
  let pointerEvents = 'none';
  let hiddenStyle = { opacity: 0, zIndex: -1 };
  if (active) {
    pointerEvents = 'auto';
    hiddenStyle = null;
  }
  const overlayStyle = [
    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    hiddenStyle,
  ];
  return (
    <View style={overlayStyle} pointerEvents={pointerEvents} collapsable={false}>
      {children}
    </View>
  );
}

function ClientReviewPromptStrip({ reviewPromptTrainer, isDark, onOpenReview, onDismiss }) {
  if (!reviewPromptTrainer) return null;

  const chipBackground = isDark ? darkColors.nbSurfaceChip : lightColors.nbSoft;
  const borderColor = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  const inkColor = isDark ? darkColors.nbInk : lightColors.nbInk;
  const mutedColor = isDark ? darkColors.nbMuted : lightColors.nbMuted;
  const stripStyle = {
    backgroundColor: chipBackground,
    borderColor,
    borderWidth: 3,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
  };
  const promptTextStyle = { flex: 1, marginLeft: 10, fontSize: 13, color: inkColor };
  const reviewLinkStyle = {
    color: inkColor,
    fontWeight: '900',
    textDecorationLine: 'underline',
  };

  return (
    <View style={stripStyle}>
      <Ionicons name="star-outline" size={18} color={inkColor} />
      <Text style={promptTextStyle}>
        How was your experience with {reviewPromptTrainer.name}?{' '}
        <Text style={reviewLinkStyle} onPress={onOpenReview}>
          Leave a review
        </Text>
      </Text>
      <TouchableOpacity onPress={onDismiss}>
        <Ionicons name="close" size={18} color={mutedColor} />
      </TouchableOpacity>
    </View>
  );
}

function ClientNotesAndFilesPanel({
  isDark,
  notesAndFiles,
  userUid,
  deletingMyFiles,
  onBack,
  onOpenItem,
  onUploadPress,
  onDeleteItem,
}) {
  const panelBackground = isDark ? darkColors.nbBackground : lightColors.nbBackground;

  const handleShareItem = (fileItem) => {
    if (!fileItem || !fileItem.url) return;
    const fileTitle = fileItem.name || fileItem.title || 'File';
    Share.share({ message: `${fileTitle}\n${fileItem.url}` }).catch(() => {});
  };

  const handleMarkRead = async (fileItem) => {
    if (!userUid || !fileItem || !fileItem.id) return;
    try {
      await markNotesAndFilesItemRead(userUid, fileItem.id);
    } catch (_) {
      /* read flag is best-effort */
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: panelBackground }}>
      <NbPageHeader
        title="Your Notes & Files"
        subtitle="Everything shared between you and your coach, all in one place."
        onBack={onBack}
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
          onOpenItem={onOpenItem}
          onDownloadItem={(fileItem) => {
            if (fileItem && fileItem.url) onOpenItem(fileItem);
          }}
          onShareItem={handleShareItem}
          onDeleteItem={(fileItem) => {
            if (deletingMyFiles) return;
            onDeleteItem(fileItem);
          }}
          onMarkRead={handleMarkRead}
          onUploadPress={onUploadPress}
        />
      </ScrollView>
    </View>
  );
}

function aiCoachConversationMountKey(aiChatPayload) {
  const attachmentCount = Array.isArray(aiChatPayload.initialAttachments)
    ? aiChatPayload.initialAttachments.length
    : 0;
  return JSON.stringify({
    sid: aiChatPayload.sessionId ?? null,
    pf: aiChatPayload.prefill ?? null,
    att: attachmentCount,
  });
}

function ClientHomeColumn({
  isDark,
  showHomeTab,
  mainTab,
  openProfile,
  openSettings,
  reviewPromptTrainer,
  setShowReviewSheetForPrompt,
  setReviewPromptTrainer,
  trainerData,
  userData,
  openCoachingPayment,
  unreadMessageCount,
  setShowRemoveTrainerPopup,
  setProfileTrainer,
  openTrainerProfile,
  caloriesConsumed,
  calorieGoal,
  proteinG,
  carbsG,
  fatsG,
  nutritionGoals,
  waterIntake,
  sleepHours,
  user,
  homeMetricsSetters,
  handleOpenConversations,
  handleFindTrainers,
  openTrainerSearch,
  setDay6Client,
  selfDay6,
  selfName,
  openPhotoGallery,
  openProgressCharts,
  openLogWorkout,
  openDailyCheckIn,
  openMoodCheckIn,
  openAIWorkouts,
  openWeeklyReport,
  openNotifications,
  openMySessions,
  openNutrition,
  setShowNotesFiles,
  notesAndFiles,
}) {
  const columnBackground = homeColumnBackground(isDark);
  let hideHomeWhileNutrition = null;
  if (mainTab === CLIENT_MAIN_TABS.nutrition) {
    hideHomeWhileNutrition = { opacity: 0 };
  }
  const columnStyle = [{ flex: 1, backgroundColor: columnBackground }, hideHomeWhileNutrition];
  let pointerEvents = 'none';
  if (showHomeTab) {
    pointerEvents = 'auto';
  }
  let openRemoveTrainer;
  if (trainerData) {
    openRemoveTrainer = () => setShowRemoveTrainerPopup(true);
  }

  let proteinGoal;
  let carbsGoal;
  let fatsGoal;
  if (nutritionGoals) {
    if (nutritionGoals.proteinTarget) proteinGoal = nutritionGoals.proteinTarget;
    else if (nutritionGoals.macroSplit) proteinGoal = nutritionGoals.macroSplit.protein;
    if (nutritionGoals.carbsTarget) carbsGoal = nutritionGoals.carbsTarget;
    else if (nutritionGoals.macroSplit) carbsGoal = nutritionGoals.macroSplit.carbs;
    if (nutritionGoals.fatTarget) fatsGoal = nutritionGoals.fatTarget;
    else if (nutritionGoals.macroSplit) fatsGoal = nutritionGoals.macroSplit.fat;
  }

  return (
    <View style={columnStyle} pointerEvents={pointerEvents}>
      <TopHeader
        isDark={isDark}
        onProfilePress={() => openProfile()}
        onSettingsPress={() => openSettings()}
      />
      <ClientReviewPromptStrip
        reviewPromptTrainer={reviewPromptTrainer}
        isDark={isDark}
        onOpenReview={() => setShowReviewSheetForPrompt(true)}
        onDismiss={() => setReviewPromptTrainer(null)}
      />
      <TrainingHomeScreen
        embedInLayout
        trainer={trainerData}
        userData={userData}
        onOpenCoachingPayment={openCoachingPayment}
        unreadMessageCount={unreadMessageCount}
        onOpenRemoveTrainer={openRemoveTrainer}
        onPressViewProfile={() => {
          if (!trainerData) return;
          setProfileTrainer(trainerData);
          openTrainerProfile();
        }}
        todayCalories={caloriesConsumed}
        calorieGoal={calorieGoal}
        proteinG={proteinG}
        carbsG={carbsG}
        fatsG={fatsG}
        proteinGoal={proteinGoal}
        carbsGoal={carbsGoal}
        fatsGoal={fatsGoal}
        waterOz={waterIntake}
        sleepHoursValue={sleepHours}
        onMetricsChange={(patch) => applyDashboardMetricsPatch(patch, user, homeMetricsSetters)}
        onPressMessage={handleOpenConversations}
        onPressFindTrainer={handleFindTrainers || openTrainerSearch}
        trainerClientId={user ? user.uid : undefined}
        trainerClientName={selfName}
        onOpenPhotoGallery={() => {
          setDay6Client(selfDay6);
          openPhotoGallery();
        }}
        onOpenProgressCharts={() => openProgressCharts()}
        onOpenLogWorkout={() => {
          if (typeof openLogWorkout === 'function') openLogWorkout();
        }}
        onOpenDailyCheckIn={() => {
          if (typeof openDailyCheckIn === 'function') openDailyCheckIn();
        }}
        onOpenMoodCheckIn={() => {
          if (typeof openMoodCheckIn === 'function') openMoodCheckIn();
        }}
        onOpenAIWorkouts={() => {
          setDay6Client(selfDay6);
          openAIWorkouts();
        }}
        onOpenWeeklyReport={() => openWeeklyReport()}
        onOpenNotifications={() => {
          if (typeof openNotifications === 'function') openNotifications();
        }}
        onOpenMySessions={() => openMySessions()}
        onPressCalories={() => openNutrition()}
        onOpenNotesFiles={() => setShowNotesFiles(true)}
        notesFilesCount={notesFileCount(notesAndFiles)}
        notesFilesNewCount={unreadNotesCount(notesAndFiles)}
      />
    </View>
  );
}

function ClientFileViewers({
  isDark,
  showTrainerSharedFilesPopup,
  setShowTrainerSharedFilesPopup,
  trainerSharedFiles,
  openNotesFile,
  showAddFilePopup,
  setShowAddFilePopup,
  refreshNotesAndFiles,
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
  reviewPromptTrainer,
  showReviewSheetForPrompt,
  setShowReviewSheetForPrompt,
  setReviewPromptTrainer,
  user,
  userData,
}) {
  let clientFirstName;
  if (userData && userData.firstName) {
    clientFirstName = userData.firstName;
  } else if (user && user.displayName) {
    clientFirstName = user.displayName.split(' ')[0];
  }

  return (
    <>
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
      {reviewPromptTrainer ? (
        <WriteTrainerReviewPopup
          visible={showReviewSheetForPrompt}
          onClose={() => setShowReviewSheetForPrompt(false)}
          onSubmitComplete={() => {
            setShowReviewSheetForPrompt(false);
            setReviewPromptTrainer(null);
          }}
          trainerName={reviewPromptTrainer.name}
          trainerId={reviewPromptTrainer.id}
          clientId={user ? user.uid : undefined}
          clientFirstName={clientFirstName}
          existingReview={null}
        />
      ) : null}
    </>
  );
}

// Mutual exclusivity: chat → inbox → notes → home. Early returns keep nesting flat
// (else-if chains count as nested IfStatements in the AST checker).
function paintClientPrimarySurface(args) {
  // 1. Live trainer chat takes the whole primary pane.
  if (args.showTrainerMessaging) {
    return (
      <ChatWithTrainerScreen
        embedInLayout
        trainer={args.selectedTrainer}
        conversation={args.selectedConversation}
        onClose={args.handleCloseMessaging}
        onProfilePress={() => args.openProfile()}
        onSettingsPress={() => args.openSettings()}
      />
    );
  }

  // 2. Inbox list (pick a conversation).
  if (args.showConversationsList) {
    return (
      <View style={{ flex: 1, backgroundColor: args.inboxPaneBackground }}>
        <InboxScreen
          embedInLayout
          onSelectConversation={args.handleSelectConversation}
          onClose={args.handleCloseConversationsList}
          onProfilePress={() => args.openProfile()}
          onSettingsPress={() => args.openSettings()}
        />
      </View>
    );
  }

  // 3. Notes & files panel.
  if (args.showNotesFiles) {
    return (
      <ClientNotesAndFilesPanel
        isDark={args.isDark}
        notesAndFiles={args.notesAndFiles}
        userUid={(args.user ? args.user.uid : undefined)}
        deletingMyFiles={args.deletingMyFiles}
        onBack={() => args.setShowNotesFiles(false)}
        onOpenItem={args.openNotesFile}
        onUploadPress={() => args.setShowAddFilePopup(true)}
        onDeleteItem={args.deleteSingleMyFile}
      />
    );
  }

  // 4. Default home column (hidden while AI / Workout tabs own the overlays).
  if (args.showPrimaryHomeColumn) {
    return (
      <ClientHomeColumn
        isDark={args.isDark}
        showHomeTab={args.showHomeTab}
        mainTab={args.mainTab}
        openProfile={args.openProfile}
        openSettings={args.openSettings}
        reviewPromptTrainer={args.reviewPromptTrainer}
        setShowReviewSheetForPrompt={args.setShowReviewSheetForPrompt}
        setReviewPromptTrainer={args.setReviewPromptTrainer}
        trainerData={args.trainerData}
        userData={args.userData}
        openCoachingPayment={args.openCoachingPayment}
        unreadMessageCount={args.unreadMessageCount}
        setShowRemoveTrainerPopup={args.setShowRemoveTrainerPopup}
        setProfileTrainer={args.setProfileTrainer}
        openTrainerProfile={args.openTrainerProfile}
        caloriesConsumed={args.caloriesConsumed}
        calorieGoal={args.calorieGoal}
        proteinG={args.proteinG}
        carbsG={args.carbsG}
        fatsG={args.fatsG}
        nutritionGoals={args.nutritionGoals}
        waterIntake={args.waterIntake}
        sleepHours={args.sleepHours}
        user={args.user}
        homeMetricsSetters={args.homeMetricsSetters}
        handleOpenConversations={args.handleOpenConversations}
        handleFindTrainers={args.handleFindTrainers}
        openTrainerSearch={args.openTrainerSearch}
        setDay6Client={args.setDay6Client}
        selfDay6={args.selfDay6}
        selfName={args.selfName}
        openPhotoGallery={args.openPhotoGallery}
        openProgressCharts={args.openProgressCharts}
        openLogWorkout={args.openLogWorkout}
        openDailyCheckIn={args.openDailyCheckIn}
        openMoodCheckIn={args.openMoodCheckIn}
        openAIWorkouts={args.openAIWorkouts}
        openWeeklyReport={args.openWeeklyReport}
        openNotifications={args.openNotifications}
        openMySessions={args.openMySessions}
        openNutrition={args.openNutrition}
        setShowNotesFiles={args.setShowNotesFiles}
        notesAndFiles={args.notesAndFiles}
      />
    );
  }

  return null;
}

// AI tab overlay: conversation when payload exists, otherwise Coach home.
function paintClientAiCoachOverlay(args) {
  if (args.aiChatPayload) {
    return (
      <CoachConversationScreen
        hideBottomNav
        key={args.conversationMountKey}
        userId={(args.user ? args.user.uid : undefined)}
        userProfile={args.coachUserProfile}
        trainerId={(args.userData ? args.userData.trainerId : undefined)}
        prefill={args.aiChatPayload.prefill}
        sessionId={args.aiChatPayload.sessionId}
        initialAttachments={args.aiChatPayload.initialAttachments}
        onBack={() => {
          args.setAiChatState(AI_CHAT_HOME);
        }}
        onSessionSwitch={(session) =>
          args.openAIChatSession({ sessionId: session.sessionId || session.id })
        }
        onNewChat={() => args.openAIChatSession({})}
        openAttachmentsOnMount={false}
        {...args.aiChatNavHandlers}
      />
    );
  }

  return (
    <CoachHomeScreen
      hideBottomNav
      userId={(args.user ? args.user.uid : undefined)}
      onStartChat={(payload = {}) => args.openAIChatSession(payload)}
      onSessionPress={(session) =>
        args.openAIChatSession({ sessionId: session.sessionId || session.id })
      }
      {...args.aiChatNavHandlers}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Client main tabs: Home (TrainingHomeScreen), nutrition, workout, AI coach, plus messaging / file overlays.
 * Flow: 1. shell + badges  2. tab visibility  3. primary branch  4. overlays + viewers + nav
 */
export default function ClientMainScreen() {
  const shell = useClientAppStartShell();
  const { isOffline, refreshing: offlineRetrying, refresh: retryOffline } = useNetworkStatus();
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
    openProgressCharts,
    openLogWorkout,
    openDailyCheckIn,
    openMoodCheckIn,
    openWeeklyMomentum,
    openAIWorkouts,
    openWeeklyReport,
    openNotifications,
    openMySessions,
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
  const [nutritionOnboardingActive, setNutritionOnboardingActive] = useState(false);
  const [keepNutritionMounted, setKeepNutritionMounted] = useState(false);

  const isMainFocused = useIsFocused();

  // 1. Background workout-plan session drives Workout tab badge + keeps generator mounted while in flight.
  useEffect(() => {
    let uid = null;
    if (user) uid = user.uid;
    if (!uid) {
      setWorkoutPlanReadyBadge(false);
      setWorkoutGenInFlight(false);
      return undefined;
    }
    const syncWorkoutSession = (session) => {
      applyWorkoutGenerationSession(session, uid, mainTab, setWorkoutGenInFlight, setWorkoutPlanReadyBadge);
    };
    readWorkoutGenerationSession(uid).then(syncWorkoutSession);
    return subscribeWorkoutGenerationSession(syncWorkoutSession);
  }, [user && user.uid, mainTab]);

  // 2. After first Nutrition visit, keep DailyLog mounted so Home ↔ Nutrition does not remount-flash.
  useEffect(() => {
    if (mainTab === CLIENT_MAIN_TABS.nutrition) {
      setKeepNutritionMounted(true);
    }
  }, [mainTab]);

  const aiChatPayload = aiChatState && typeof aiChatState === 'object' ? aiChatState : null;
  const tabVisibility = decideClientTabVisibility(
    mainTab,
    nutritionOnboardingActive,
    showTrainerMessaging,
    aiChatPayload,
  );
  const { showHomeTab, hideBottomNav, keepAiCoachMounted } = tabVisibility;

  const statusBarStyle = statusBarStyleForTheme(isDark);
  const safeAreaStyle = safeAreaThemeStyles(styles, isDark);
  const selfName = clientSelfDisplayName(user, userData);
  const selfDay6 = clientDay6SelfRecord(user, userData);
  const homeMetricsSetters = buildHomeMetricsSetters({
    setSoreness,
    setEnergyLevel,
    setStressLevel,
    setWaterIntake,
    setSleepHours,
    setDashboardWorkoutSummary,
    setTodayWorkout,
  });
  const proteinG = gramValueFromMacroList(nutritionMacros, 'Protein');
  const carbsG = gramValueFromMacroList(nutritionMacros, 'Carbs');
  const fatsG = gramValueFromMacroList(nutritionMacros, 'Fats');

  const showPrimaryHomeColumn =
    !showTrainerMessaging &&
    !showConversationsList &&
    !showNotesFiles &&
    mainTab !== CLIENT_MAIN_TABS.ai &&
    mainTab !== CLIENT_MAIN_TABS.workout;

  const shouldMountNutrition =
    keepNutritionMounted || mainTab === CLIENT_MAIN_TABS.nutrition;
  const shouldMountWorkout =
    mainTab === CLIENT_MAIN_TABS.workout || workoutGenInFlight;
  const showBottomNav = isMainFocused && !hideBottomNav;
  const inboxPaneBackground = inboxBackground(isDark);
  const coachUserProfile = { ...(onboardingData || {}), ...(userData || {}) };
  const conversationMountKey = aiChatPayload
    ? aiCoachConversationMountKey(aiChatPayload)
    : null;

  // 3. Primary surface: messaging → inbox → notes → home column (mutually exclusive).
  const primaryBranch = paintClientPrimarySurface({
    showTrainerMessaging,
    selectedTrainer,
    selectedConversation,
    handleCloseMessaging,
    openProfile,
    openSettings,
    showConversationsList,
    inboxPaneBackground,
    handleSelectConversation,
    handleCloseConversationsList,
    showNotesFiles,
    isDark,
    notesAndFiles,
    user,
    deletingMyFiles,
    setShowNotesFiles,
    openNotesFile,
    setShowAddFilePopup,
    deleteSingleMyFile,
    showPrimaryHomeColumn,
    showHomeTab,
    mainTab,
    reviewPromptTrainer,
    setShowReviewSheetForPrompt,
    setReviewPromptTrainer,
    trainerData,
    userData,
    openCoachingPayment,
    unreadMessageCount,
    setShowRemoveTrainerPopup,
    setProfileTrainer,
    openTrainerProfile,
    caloriesConsumed,
    calorieGoal,
    proteinG,
    carbsG,
    fatsG,
    nutritionGoals,
    waterIntake,
    sleepHours,
    homeMetricsSetters,
    handleOpenConversations,
    handleFindTrainers,
    openTrainerSearch,
    setDay6Client,
    selfDay6,
    selfName,
    openPhotoGallery,
    openProgressCharts,
    openLogWorkout,
    openDailyCheckIn,
    openMoodCheckIn,
    openAIWorkouts,
    openWeeklyReport,
    openNotifications,
    openMySessions,
    openNutrition,
  });

  const aiCoachOverlay = paintClientAiCoachOverlay({
    aiChatPayload,
    conversationMountKey,
    user,
    coachUserProfile,
    userData,
    setAiChatState,
    openAIChatSession,
    aiChatNavHandlers,
  });

  // 4. Paint provider → SafeArea → primary + tab overlays → file viewers → bottom nav.
  return (
    <AppNavigationProvider {...navProviderProps}>
      <SafeAreaView style={safeAreaStyle} edges={SHELL_SAFE_AREA_EDGES}>
        <StatusBar barStyle={statusBarStyle} />
        <OfflineBanner
          visible={isOffline}
          retrying={offlineRetrying}
          onRetry={retryOffline}
        />
        <View style={{ flex: 1 }}>
          {primaryBranch}

          {shouldMountNutrition ? (
            <ClientTabOverlay active={mainTab === CLIENT_MAIN_TABS.nutrition}>
              <DailyLogContent
                hideBottomNav
                onOnboardingActiveChange={setNutritionOnboardingActive}
                onBack={() => {
                  handleHomePress();
                  if (typeof refetchNutritionData === 'function') refetchNutritionData();
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
                onOpenWeeklyMomentum={() => {
                  if (typeof openWeeklyMomentum === 'function') openWeeklyMomentum();
                }}
              />
            </ClientTabOverlay>
          ) : null}

          {shouldMountWorkout ? (
            <ClientTabOverlay active={mainTab === CLIENT_MAIN_TABS.workout}>
              <CreateWorkoutPlanScreen
                hideBottomNav
                onBack={handleHomePress}
                onNavigate={onNavigate}
                onProfilePress={openProfile}
                onSettingsPress={openSettings}
              />
            </ClientTabOverlay>
          ) : null}

          {keepAiCoachMounted ? (
            <ClientTabOverlay active={mainTab === CLIENT_MAIN_TABS.ai}>
              {aiCoachOverlay}
            </ClientTabOverlay>
          ) : null}
        </View>

        <ClientFileViewers
          isDark={isDark}
          showTrainerSharedFilesPopup={showTrainerSharedFilesPopup}
          setShowTrainerSharedFilesPopup={setShowTrainerSharedFilesPopup}
          trainerSharedFiles={trainerSharedFiles}
          openNotesFile={openNotesFile}
          showAddFilePopup={showAddFilePopup}
          setShowAddFilePopup={setShowAddFilePopup}
          refreshNotesAndFiles={refreshNotesAndFiles}
          pdfViewer={pdfViewer}
          setPdfViewer={setPdfViewer}
          spreadsheetViewer={spreadsheetViewer}
          setSpreadsheetViewer={setSpreadsheetViewer}
          documentViewer={documentViewer}
          setDocumentViewer={setDocumentViewer}
          mediaViewer={mediaViewer}
          setMediaViewer={setMediaViewer}
          embedWebViewer={embedWebViewer}
          setEmbedWebViewer={setEmbedWebViewer}
          reviewPromptTrainer={reviewPromptTrainer}
          showReviewSheetForPrompt={showReviewSheetForPrompt}
          setShowReviewSheetForPrompt={setShowReviewSheetForPrompt}
          setReviewPromptTrainer={setReviewPromptTrainer}
          user={user}
          userData={userData}
        />

        {showBottomNav ? (
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
