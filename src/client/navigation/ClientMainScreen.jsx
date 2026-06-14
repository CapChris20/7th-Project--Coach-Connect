import React, { useState } from 'react';
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
import { auth, db } from '../../app/config';
import { getClientDateKey } from '../../app/dateKey';
import { mergeClientDailyMetrics } from '../../shared/services/dailyMetricsService';
import { markNotesAndFilesItemRead } from '../../shared/services/notesAndFilesService';
import TrainerMessagingScreen from '../../trainer/screens/TrainerMessagingScreen';
import ConversationsListScreen from '../../trainer/screens/ConversationsListScreen';
import MyDashboardScreen from '../screens/MyDashboardScreen';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { AppNavigationProvider } from '../../navigation/AppNavigationContext';
import {
  AuroraHeroBanner,
  TopStatsRow,
  WellnessStatsRow,
  TrainingAgenda,
  NutritionCard,
} from '../components/home/clientHomeComponents';
import FilesNotesHeroCard from '../components/FilesNotesHeroCard';
import FilesNotesSectionPremium from '../../shared/components/FilesNotesSectionPremium';
import { SessionMeetingCard } from '../../shared/components/SessionMeetingCard';
import TrainerSharedFilesModal from '../../shared/components/TrainerSharedFilesModal';
import AddNotesFilesModal from '../../shared/components/AddNotesFilesModal';
import PdfViewerModal from '../../shared/components/PdfViewerModal';
import SpreadsheetViewerModal from '../../shared/components/SpreadsheetViewerModal';
import DocumentViewerModal from '../../shared/components/DocumentViewerModal';
import MediaViewerModal from '../../shared/components/MediaViewerModal';
import EmbedWebViewModal from '../../shared/components/EmbedWebViewModal';
import RemoveTrainerSheet from '../../shared/components/RemoveTrainerSheet';
import ReviewSubmitSheet from '../../shared/components/ReviewSubmitSheet';
import MarketplaceHeroCard from '../components/MarketplaceHeroCard';
import DashboardHeroCard from '../components/DashboardHeroCard';
import NutritionContainer from '../../nutrition/screens/NutritionContainer';
import WorkoutPlanGeneratorScreen from '../../workouts/screens/workout';
import AIChatHomeScreen from '../../aiChat/screens/AIChatHomeScreen';
import AIChatScreen from '../../aiChat/screens/AIChatScreen';
import { useIsFocused } from '@react-navigation/native';
import { CLIENT_MAIN_TABS } from '../hooks/useClientScreenNavigation';
import { useClientAppShell } from './ClientAppShellContext';

export default function ClientMainScreen() {
  const s = useClientAppShell();
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
    setShowAddNotesFilesModal,
    openAIChatHome,
    openNutrition,
    openWorkout,
    showConversationsList,
    handleSelectConversation,
    handleCloseConversationsList,
    showMyDashboard,
    trainerData,
    unreadMessageCount,
    setShowRemoveTrainerSheet,
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
    showTrainerSharedFilesModal,
    setShowTrainerSharedFilesModal,
    trainerSharedFiles,
    showAddNotesFilesModal,
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
    showRemoveTrainerSheet,
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
  } = s;

  const clientPaymentStatus = userData?.paymentStatus || 'inactive';

  const hideShellHeader =
    showTrainerMessaging ||
    mainTab === CLIENT_MAIN_TABS.nutrition ||
    mainTab === CLIENT_MAIN_TABS.workout ||
    mainTab === CLIENT_MAIN_TABS.ai;
  const aiChatPayload = aiChatState && typeof aiChatState === 'object' ? aiChatState : null;
  const isMainFocused = useIsFocused();
  const [nutritionOnboardingActive, setNutritionOnboardingActive] = useState(false);
  const [nutritionSettingsOpen, setNutritionSettingsOpen] = useState(false);
  const hideBottomNavForNutritionOnboarding =
    mainTab === CLIENT_MAIN_TABS.nutrition && (nutritionOnboardingActive || nutritionSettingsOpen);
  const hideBottomNavForMessagingOverlay = showTrainerMessaging || showConversationsList;
  const hideBottomNav =
    hideBottomNavForNutritionOnboarding || hideBottomNavForMessagingOverlay;

  return (
    <AppNavigationProvider {...navProviderProps}>
    <SafeAreaView
      style={[styles.safeArea, !isDark ? styles.safeAreaLight : styles.safeAreaDark]}
      edges={['left', 'right']}
    >
      <StatusBar barStyle={!isDark ? 'dark-content' : 'light-content'} />
      <View style={{ flex: 1 }}>
      {!hideShellHeader ? (
        <CoachConnectHeader
          isDark={isDark}
          onProfilePress={() => openProfile()}
          onSettingsPress={() => openSettings()}
        />
      ) : null}

      {reviewPromptTrainer && !hideBottomNavForMessagingOverlay && (
        <View style={{
          backgroundColor: 'rgba(255,107,157,0.1)',
          borderColor: 'rgba(255,107,157,0.25)',
          borderWidth: 1,
          borderRadius: 12,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          marginHorizontal: 16,
          marginTop: 16,
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
      )}

      {showTrainerMessaging ? (
        <TrainerMessagingScreen
          embedInLayout
          trainer={selectedTrainer}
          conversation={selectedConversation}
          onClose={handleCloseMessaging}
          onProfilePress={() => openProfile()}
          onSettingsPress={() => openSettings()}
        />
      ) : showConversationsList ? (
        <ConversationsListScreen
          embedInLayout
          onSelectConversation={handleSelectConversation}
          onClose={handleCloseConversationsList}
          onProfilePress={() => openProfile()}
          onSettingsPress={() => openSettings()}
        />
      ) : showMyDashboard ? (
        <MyDashboardScreen
          embedInLayout
          trainer={trainerData}
          userData={userData}
          onOpenCoachingPayment={openCoachingPayment}
          unreadMessageCount={unreadMessageCount}
          onOpenRemoveTrainer={trainerData ? () => setShowRemoveTrainerSheet(true) : undefined}
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
      ) : showNotesFiles ? (
        <View style={{ flex: 1, backgroundColor: isDark ? '#0A0A0F' : '#F7F7FA' }}>
          <SafeAreaView style={{ backgroundColor: isDark ? '#0A0A0F' : '#F7F7FA' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 }}>
              <TouchableOpacity onPress={() => setShowNotesFiles(false)} hitSlop={12} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={26} color={isDark ? '#fff' : '#1A1A2E'} />
              </TouchableOpacity>
              <Text style={{ flex: 1, fontSize: 20, fontWeight: '900', color: isDark ? '#fff' : '#1A1A2E', letterSpacing: -0.3 }}>Notes & Files</Text>
            </View>
          </SafeAreaView>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
          >
            <FilesNotesSectionPremium
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
              onUploadPress={() => setShowAddNotesFilesModal(true)}
            />
          </ScrollView>
        </View>
      ) : mainTab === CLIENT_MAIN_TABS.nutrition ? (
        <NutritionContainer
          hideBottomNav
          onOnboardingActiveChange={setNutritionOnboardingActive}
          onSettingsOverlayChange={setNutritionSettingsOpen}
          onBack={() => {
            handleHomePress();
            refetchNutritionData?.();
          }}
          onNutritionDataChanged={refetchNutritionData}
          onProfilePress={openProfile}
          onSettingsPress={openSettings}
          onHomePress={handleHomePress}
          onPlusPress={() => setShowAddNotesFilesModal(true)}
          onVoicePress={openAIChatHome}
          onNutritionPress={openNutrition}
          onWorkoutPress={openWorkout}
          onMessagesPress={handleOpenConversations}
        />
      ) : mainTab === CLIENT_MAIN_TABS.workout ? (
        <WorkoutPlanGeneratorScreen
          hideBottomNav
          onBack={handleHomePress}
          onNavigate={onNavigate}
          onProfilePress={openProfile}
          onSettingsPress={openSettings}
        />
      ) : mainTab === CLIENT_MAIN_TABS.ai ? (
        aiChatPayload ? (
          <AIChatScreen
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
            openAttachmentsOnMount={false}
            {...aiChatNavHandlers}
          />
        ) : (
          <AIChatHomeScreen
            hideBottomNav
            userId={user?.uid}
            onStartChat={(payload = {}) => openAIChatSession(payload)}
            onSessionPress={(session) =>
              openAIChatSession({ sessionId: session.sessionId || session.id })
            }
            {...aiChatNavHandlers}
          />
        )
      ) : (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 130, paddingTop: 6 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={!isDark ? '#000' : '#fff'} />}
        showsVerticalScrollIndicator={false}
      >
        <AuroraHeroBanner isDark={isDark} userId={auth?.currentUser?.uid} userName={userName} />
        {userRole !== 'trainer' && !hasTrainer && (
          <MarketplaceHeroCard
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
          <DashboardHeroCard
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
        <FilesNotesHeroCard
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
            <SessionMeetingCard
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

        {/* Trainer shared + notes are rendered inside FilesNotesSectionPremium */}
      </ScrollView>
      )}
      </View>

      <TrainerSharedFilesModal
        visible={showTrainerSharedFilesModal}
        onClose={() => setShowTrainerSharedFilesModal(false)}
        isDark={isDark}
        files={trainerSharedFiles}
        onPressItem={(file) => {
          setShowTrainerSharedFilesModal(false);
          openNotesFile(file);
        }}
      />
      <AddNotesFilesModal
        visible={showAddNotesFilesModal}
        onClose={() => setShowAddNotesFilesModal(false)}
        onAdded={refreshNotesAndFiles}
        isDark={isDark}
      />
      <PdfViewerModal
        visible={pdfViewer.visible}
        url={pdfViewer.url}
        name={pdfViewer.name}
        isDark={isDark}
        onClose={() => setPdfViewer({ visible: false, url: null, name: null })}
      />
      <SpreadsheetViewerModal
        visible={spreadsheetViewer.visible}
        url={spreadsheetViewer.url}
        name={spreadsheetViewer.name}
        isDark={isDark}
        onClose={() => setSpreadsheetViewer({ visible: false, url: null, name: null })}
      />
      <DocumentViewerModal
        visible={documentViewer.visible}
        trainerId={documentViewer.trainerId}
        documentId={documentViewer.documentId}
        title={documentViewer.title}
        isDark={isDark}
        onClose={() => setDocumentViewer({ visible: false, trainerId: null, documentId: null, title: null })}
      />
      <MediaViewerModal
        visible={mediaViewer.visible}
        url={mediaViewer.url}
        kind={mediaViewer.kind}
        name={mediaViewer.name}
        isDark={isDark}
        onClose={() => setMediaViewer({ visible: false, url: null, kind: 'image', name: null })}
      />
      <EmbedWebViewModal
        visible={embedWebViewer.visible}
        uri={embedWebViewer.uri}
        title={embedWebViewer.title}
        isDark={isDark}
        onClose={() => setEmbedWebViewer({ visible: false, uri: null, title: null })}
      />
      <RemoveTrainerSheet
        visible={showRemoveTrainerSheet}
        onClose={() => setShowRemoveTrainerSheet(false)}
        onRemovalComplete={() => {
          if (trainerData) {
            setReviewPromptTrainer({ id: trainerData.id, name: trainerData.displayName || trainerData.name || 'Your trainer' });
          }
          setTrainerData(null);
          setShowRemoveTrainerSheet(false);
        }}
        trainerName={trainerData?.displayName || trainerData?.name}
        clientName={user?.displayName || userData?.firstName}
        removedBy="client"
        trainerId={trainerData?.id}
        clientId={user?.uid}
      />
      {reviewPromptTrainer && (
        <ReviewSubmitSheet
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
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 200 }}>
        <BottomNavBar
          onHomePress={handleHomePress}
          onPlusPress={() => setShowAddNotesFilesModal(true)}
          onVoicePress={openAIChatHome}
          onNutritionPress={() => openNutrition()}
          onWorkoutPress={openWorkout}
          onMessagesPress={handleOpenConversations}
          onProfilePress={() => openProfile()}
          activeTabKey={mainTabActiveKey}
        />
      </View>
      ) : null}
    </SafeAreaView>
    </AppNavigationProvider>
  );
}
