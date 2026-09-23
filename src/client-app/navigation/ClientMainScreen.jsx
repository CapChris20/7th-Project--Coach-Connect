/**
 * Client Main Screen
 *
 * Purpose: UI screen or component: Client Main Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: ClientMainScreen
 *
 * @file-header
 */
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../app-start/cloudConnection';
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
import {
  HomeTopBanner,
  TopStatsRow,
  WellnessStatsRow,
  TrainingAgenda,
  NutritionCard,
} from '../home/homeScreenPieces';
import FilesHeaderCard from '../../for-both/home-cards/FilesHeaderCard';
import FilesSection from '../../for-both/files-and-notes/viewers/FilesSection';
import { UpcomingSessionCard } from '../../for-both/home-cards/UpcomingSessionCard';
import TrainerSharedFilesPopup from '../files-and-notes/TrainerSharedFilesPopup';
import AddFilePopup from '../../for-both/files-and-notes/viewers/AddFilePopup';
import PdfViewer from '../../for-both/files-and-notes/viewers/PdfViewer';
import SpreadsheetViewer from '../../for-both/files-and-notes/viewers/SpreadsheetViewer';
import DocumentViewer from '../../for-both/files-and-notes/viewers/DocumentViewer';
import PhotoVideoViewer from '../../for-both/files-and-notes/viewers/PhotoVideoViewer';
import WebPageViewer from '../../for-both/files-and-notes/viewers/WebPageViewer';
import RemoveTrainerPopup from '../../for-both/popups/RemoveTrainerPopup';
import WriteTrainerReviewPopup from '../home/WriteTrainerReviewPopup';
import FindTrainerBanner from '../../for-both/home-cards/FindTrainerBanner';
import TopBannerCard from '../home/TopBannerCard';
import DailyLogContent from '../../nutrition/daily-log/DailyLogContent';
import CreateWorkoutPlanScreen from '../../workouts/create-plan/CreateWorkoutPlanScreen';
import CoachHomeScreen from '../../ai-coach/home-screen/CoachHomeScreen';
import CoachConversationScreen from '../../ai-coach/conversation/CoachConversationScreen';
import { useIsFocused } from '@react-navigation/native';
import { CLIENT_MAIN_TABS } from './goToClientScreen';
import { useClientAppStartShell } from './ClientOpenScreenTracker';

export default function ClientMainScreen() {
  const s = useClientAppStartShell();
  const {
    navProviderProps,
    isDark,
    styles,
    colors,
    themeMode,
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
    showMyDashboard,
    trainerData,
    unreadMessageCount,
    setShowRemoveTrainerPopup,
    setProfileTrainer,
    setShowMyDashboard,
    openTrainerProfile,
    caloriesConsumed,
    calorieGoal,
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
    applyFromSnapshots,
    handleOpenConversations: openConversations,
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
    userName,
    userRole,
    hasTrainer,
    openTrainerSearch,
    agendaWorkouts,
    soreness,
    energyLevel,
    stressLevel,
    onboardingData,
    todayWorkout,
    goalProgress,
    handleAddWorkout,
    setShowMyDashboard: goDashboard,
    nutritionMacros,
    additionalNutrients,
    nutritionGoals,
    pendingSessions,
    respondToSession,
    refreshing,
    onRefresh,
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
  } = s;

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
      if (session?.uid && session.uid !== uid) return;
      setWorkoutGenInFlight(!!session?.inFlight);
      const show =
        !!session?.pendingReady &&
        !session?.inFlight &&
        mainTab !== CLIENT_MAIN_TABS.workout;
      setWorkoutPlanReadyBadge(show);
    };

    readWorkoutGenerationSession(uid).then(syncSession);
    return subscribeWorkoutGenerationSession(syncSession);
  }, [user?.uid, mainTab]);

  const clientPaymentStatus = userData?.paymentStatus || 'inactive';

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
          style={{ flex: 1, backgroundColor: isDark ? '#0A0A0F' : '#F7F7FA' }}
        >
          <InboxScreen
            embedInLayout
            onSelectConversation={handleSelectConversation}
            onClose={handleCloseConversationsList}
            onProfilePress={() => openProfile()}
            onSettingsPress={() => openSettings()}
          />
        </View>
      ) : showMyDashboard ? (
        <View style={{ flex: 1, backgroundColor: isDark ? '#0A0A0F' : '#F7F7FA' }}>
          <TopHeader
              title="Dashboard"
              skipTopSafeInset
              onBack={() => setShowMyDashboard(false)}
              onProfilePress={() => openProfile()}
              onSettingsPress={() => openSettings()}
            />
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
                setShowMyDashboard(false);
                openTrainerProfile();
              }}
              todayCalories={caloriesConsumed}
              calorieGoal={calorieGoal}
              waterOz={waterIntake}
              sleepHoursValue={sleepHours}
              onMetricsChange={async (patch) => {
                // Wellness ratings: saved to dailyLogs inside My Dashboard; sync home row immediately
                if (patch.soreness != null && patch.soreness !== '') {
                  setSoreness(String(patch.soreness));
                }
                if (patch.energyLevel != null && patch.energyLevel !== '') {
                  setEnergyLevel(String(patch.energyLevel));
                }
                if (patch.stressLevel != null && patch.stressLevel !== '') {
                  setStressLevel(String(patch.stressLevel));
                }

                // Save to Firebase first so data persists
                try {
                  const updateData = {};

                  if (typeof patch.waterIntake === 'number') {
                    updateData.waterIntake = patch.waterIntake;
                    setWaterIntake(patch.waterIntake);
                  }
                  if (typeof patch.sleepHours === 'number') {
                    updateData.sleepHours = patch.sleepHours;
                    setSleepHours(patch.sleepHours);
                  }
                  if (patch.workoutSummary != null) {
                    updateData.workoutSummary = patch.workoutSummary;
                    setDashboardWorkoutSummary(patch.workoutSummary);
                  }
                  if (patch.workoutName != null || (Array.isArray(patch.workoutExercises) && patch.workoutExercises.length > 0)) {
                    updateData.workoutName = patch.workoutName;
                    updateData.workoutExercises = patch.workoutExercises;
                    setTodayWorkout({
                      name: patch.workoutName || '',
                      exercises: Array.isArray(patch.workoutExercises) ? patch.workoutExercises : [],
                    });
                  }

                  if (Object.keys(updateData).length > 0) {
                    const todayKey = getClientDateKey();
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
                      logsPatch.workoutLog = patch.workoutExercises.map((ex) => ({
                        exerciseName: ex.name || ex.exerciseName || '',
                        sets: Array.isArray(ex.sets)
                          ? ex.sets.map((s) => ({
                              reps: parseInt(s.reps, 10) || 0,
                              weight: parseFloat(s.weight) || 0,
                            }))
                          : [],
                      }));
                    }
                    await mergeClientDailyMetrics(user.uid, todayKey, {
                      logs: logsPatch,
                      tracking: updateData,
                    });
                  }
                } catch (error) {
                  console.error('❌ Failed to save trainer metrics:', error);
                }
              }}
              onPressMessage={handleOpenConversations}
              onPressFindTrainer={handleFindTrainers}
              trainerClientId={user?.uid}
              trainerClientName={userData?.firstName || user?.displayName || 'You'}
              onOpenPhotoGallery={() => {
                setDay6Client({ id: user?.uid, name: userData?.firstName || user?.displayName || 'You' });
                openPhotoGallery();
              }}
              onOpenAIWorkouts={() => {
                setDay6Client({ id: user?.uid, name: userData?.firstName || user?.displayName || 'You' });
                openAIWorkouts();
              }}
              onOpenWeeklyReport={() => openWeeklyReport()}
              onPressCalories={() => {
                setShowMyDashboard(false);
                openNutrition();
              }}
            />
        </View>
      ) : showNotesFiles ? (
        <View
          style={{ flex: 1, backgroundColor: isDark ? '#0A0A0F' : '#F7F7FA' }}
        >
          <TopHeader
            title="Notes & Files"
            skipTopSafeInset
            onBack={() => setShowNotesFiles(false)}
            onProfilePress={() => openProfile()}
            onSettingsPress={() => openSettings()}
          />
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 130 }}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <FilesSection
              items={notesAndFiles}
              isDark={isDark}
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
      <View style={{ flex: 1 }}>
        <TopHeader
          isDark={isDark}
          skipTopSafeInset
          onProfilePress={() => openProfile()}
          onSettingsPress={() => openSettings()}
        />
        {reviewPromptTrainer ? (
          <View style={{
            backgroundColor: 'rgba(255,107,157,0.1)',
            borderColor: 'rgba(255,107,157,0.25)',
            borderWidth: 1,
            borderRadius: 12,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            marginHorizontal: 16,
            marginTop: 8,
          }}>
            <Ionicons name="star-outline" size={18} color="#FF6B9D" />
            <Text style={{ flex: 1, marginLeft: 10, fontSize: 13, color: '#fff' }}>
              How was your experience with {reviewPromptTrainer.name}?{' '}
              <Text style={{ color: '#FF6B9D', fontWeight: 'bold' }} onPress={() => setShowReviewSheetForPrompt(true)}>Leave a review</Text>
            </Text>
            <TouchableOpacity onPress={() => setReviewPromptTrainer(null)}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          </View>
        ) : null}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 130, paddingTop: 6 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={!isDark ? '#000' : '#fff'} />}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <HomeTopBanner isDark={isDark} userId={auth?.currentUser?.uid} userName={userName} />
        {userRole !== 'trainer' && !hasTrainer && (
          <FindTrainerBanner
            onPress={() => openTrainerSearch()}
            notificationCount={0}
            isDark={isDark}
          />
        )}
        {userRole !== 'trainer' && clientPaymentStatus === 'past_due' ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => openCoachingPayment?.()}
            style={{
              marginHorizontal: 16,
              marginTop: 8,
              marginBottom: 4,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(239,68,68,0.35)' : 'rgba(255,59,48,0.35)',
              backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.10)',
              paddingVertical: 10,
              paddingHorizontal: 12,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>
              Coaching payment past due — tap to update
            </Text>
          </TouchableOpacity>
        ) : null}
        {userRole !== 'trainer' && (
          <TopBannerCard
            onPress={() => setShowMyDashboard(true)}
            unreadMessageCount={unreadMessageCount}
            isDark={isDark}
          />
        )}
        <TopStatsRow
          isDark={isDark}
          themeMode={themeMode}
          colors={colors}
          todayWorkout={todayWorkout}
          waterIntake={waterIntake}
          sleepHours={sleepHours}
          primaryGoal={onboardingData?.primaryGoal}
          goalProgress={goalProgress}
          onPlanWorkout={handleAddWorkout}
          onOpenDashboard={() => setShowMyDashboard(true)}
        />
        <TrainingAgenda theme={isDark ? 'dark' : 'light'} workouts={agendaWorkouts} />
        {/* Weekly calendar removed */}
        {userRole !== 'trainer' && (
          <WellnessStatsRow
            isDark={isDark}
            colors={colors}
            soreness={soreness}
            energyLevel={energyLevel}
            stressLevel={stressLevel}
            onOpenDashboard={() => setShowMyDashboard(true)}
          />
        )}
        <NutritionCard 
          theme={isDark ? 'dark' : 'light'}
          consumed={caloriesConsumed}
          goal={calorieGoal}
          macros={nutritionMacros}
          additionalNutrients={additionalNutrients}
          nutritionGoals={nutritionGoals}
          compact
        />
        {/* Notes & Files hero card */}
        <FilesHeaderCard
          onPress={() => setShowNotesFiles(true)}
          fileCount={Array.isArray(notesAndFiles) ? notesAndFiles.length : 0}
          newCount={Array.isArray(notesAndFiles) ? notesAndFiles.filter((f) => f?.isRead === false).length : 0}
          isDark={isDark}
        />

        {pendingSessions.length > 0 && (
        <View style={{ paddingHorizontal: 16, marginTop: 10, marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="calendar" size={22} color="#C084FC" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 1.4,
                  color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(17, 24, 39, 0.55)',
                  textTransform: 'uppercase',
                }}
              >
                From your coach
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 16,
                  fontWeight: '800',
                  color: isDark ? '#fff' : '#0F172A',
                  letterSpacing: -0.3,
                }}
              >
                Session invites
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 12,
                  fontWeight: '600',
                  color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.55)',
                }}
              >
                Lock in a time or pass — your call.
              </Text>
            </View>
          </View>

          {pendingSessions.map((s) => (
            <UpcomingSessionCard
              key={s.id}
              mode="invite"
              isDark={isDark}
              coachName={trainerData?.displayName || trainerData?.name || 'Your coach'}
              session={s}
              onRespond={respondToSession}
            />
          ))}
        </View>
        )}

        {/* Trainer shared + notes are rendered inside FilesSection */}
      </ScrollView>
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
                setAiChatState('home');
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
      <RemoveTrainerPopup
        visible={showRemoveTrainerPopup}
        onClose={() => setShowRemoveTrainerPopup(false)}
        onRemovalComplete={() => {
          if (trainerData) {
            setReviewPromptTrainer({ id: trainerData.id, name: trainerData.displayName || trainerData.name || 'Your trainer' });
          }
          setTrainerData(null);
          setShowRemoveTrainerPopup(false);
        }}
        trainerName={trainerData?.displayName || trainerData?.name}
        clientName={user?.displayName || userData?.firstName}
        removedBy="client"
        trainerId={trainerData?.id}
        clientId={user?.uid}
      />
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
