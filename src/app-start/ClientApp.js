/**
 * Client App
 *
 * Purpose: Client App — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/app
 * Key exports: ClientApp
 *
 * @file-header
 */
/**
 * ClientApp - Client-specific application interface with integrated home screen
 * 
 * Responsibilities:
 * - Client dashboard rendering
 * - Client screen navigation and state management
 * - Client-specific data loading (conversations, trainer info, workouts, nutrition)
 * - Real-time conversation updates
 * - Premium home screen UI (iOS 18 Bento Box Design)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Image,
  Linking,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaskedView from '@react-native-masked-view/masked-view';
import BlurBackdropPlate from '../shared-ui/BlurBackdropPlate';
import { LinearGradient } from 'expo-linear-gradient';
import { Video } from 'expo-video';
import LottieView from 'lottie-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { auth, db, functions } from './config';
import { calculateBMR, calculateTDEE } from '../shared/fitness-calculations/calculations';
import { getClientDateKey } from '../shared-utils/dateKeys';
import { getLocalDateKey } from '../shared-utils/getLocalDay';
import {
  mergeClientDailyMetrics,
  parseDailyMetricsFromSnapshots,
} from '../metrics/daily-metrics/saveDailyMetricsToFirestore';
import { useClientHomeDailyMetrics } from '../client-app/hooks/useClientHomeDailyMetrics';
import styles from '../client-app/home/clientAppStyles';
import {
  getPremiumTheme,
  TopStatsRow,
  WellnessStatsRow,
  GreetingSection,
  NewCalendar,
  TrainingAgenda,
  NutritionCard,
  NotesFiles,
  calculateCalorieGoal,
  calculateStreak,
} from '../client-app/home/clientHomeComponents';
import { useClientHomeBootstrap } from '../client-app/home/useClientHomeBootstrap';
import { useClientScreenNavigation } from '../client-app/navigation/useClientScreenNavigation';

function useClientHomeNutrition({ user, db, setCaloriesConsumed, setMacroTotals }) {
  const refetchNutritionData = useCallback(async () => {
    if (!user?.uid || !db) return;
    try {
      const todayKey = getLocalDateKey();
      const nutritionLogs = await getFoodLogsForDate(user.uid, todayKey);
      const totals = calculateMacroTotals(nutritionLogs);
      setCaloriesConsumed(totals.calories || 0);
      setMacroTotals({
        protein: totals.protein || 0,
        carbs: totals.carbs || 0,
        fats: totals.fat || 0,
      });
    } catch (e) {
      console.error('Refetch nutrition:', e);
    }
  }, [user?.uid, db, setCaloriesConsumed, setMacroTotals]);

  return refetchNutritionData;
}


import { subscribeToUnreadCount } from '../ai-coach/server-logic/chat-api/loadMoreCoachConversations';
import { getOrCreateConversation, sendClientRequest } from '../ai-coach/server-logic/trainer-messaging/sendTrainerNotification';
import StartCoachChatScreen from '../ai-coach/chat-ui/chat-home/StartCoachChatScreen';
import ChatWithCoachScreen from '../ai-coach/chat-ui/chat-thread/ChatWithCoachScreen';
import SearchTrainersScreen, { TrainerProfileSheet } from '../client-app/marketplace/screens/SearchTrainersScreen';
import TrainingDashboardScreen from '../client-app/dashboard/TrainingDashboardScreen';
import SettingsScreen from '../settings/screens/SettingsScreen';
import HelpFAQScreen from '../settings/screens/HelpFAQScreen';
import TermsOfServiceScreen from '../settings/screens/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../settings/screens/PrivacyPolicyScreen';
import ContactSupportScreen from '../settings/screens/ContactSupportScreen';
import BugReportScreen from '../settings/screens/BugReportScreen';
import { AppNavigationProvider } from '../navigation/AppNavigationContext';
import { NavigationContainer } from '@react-navigation/native';
import { rootNavigationRef } from '../navigation/navigationRef';
import { CLIENT_ROUTES } from '../navigation/routes';
import { clientLinking } from '../navigation/linking';
import { ClientAppShellProvider } from '../client-app/navigation/ClientAppShellContext';
import ClientRootNavigator from '../client-app/navigation/ClientRootNavigator';
import BottomNavBar from '../navigation/BottomNavBar';
import { calculateMacroTotals, getDailyGoals, getFoodLogsForDate } from '../nutrition/daily-log/logFoodToFirestore';
import LogTodaysMealsScreen from '../client-app/screens/LogTodaysMealsScreen';
import NutritionContainer from '../nutrition/daily-log/NutritionContainer';
import ViewMyProfileScreen from '../client-app/profile/ViewMyProfileScreen';
import AddNotesFilesModal from '../shared/components/notes-files/AddNotesFilesModal';
import AppLoadingScreen from '../shared/components/shell/AppLoadingScreen';
import CoachConnectHeader from '../shared/components/shell/CoachConnectHeader';
import DailyQuoteCard, { DailyQuotePill } from '../shared/components/home/DailyQuoteCard';
import DocumentViewerModal from '../shared/components/notes-files/DocumentViewerModal';
import EmbedWebViewModal from '../shared/components/notes-files/EmbedWebViewModal';
import FileGalleryGrid, { FILE_GALLERY_THEME_COLORS } from '../shared/components/notes-files/FileGalleryGrid';
import MediaViewerModal from '../shared/components/notes-files/MediaViewerModal';
import PdfViewerModal from '../shared/components/notes-files/PdfViewerModal';
import RemoveTrainerSheet from '../shared/components/modals/RemoveTrainerSheet';
import ReviewSubmitSheet from '../client-app/components/ReviewSubmitSheet';
import { SessionMeetingCard } from '../shared/components/home/SessionMeetingCard';
import SpreadsheetViewerModal from '../shared/components/notes-files/SpreadsheetViewerModal';
import TrainerSharedFilesModal from '../client-app/components/TrainerSharedFilesModal';
import ClientFilesScreen from '../client-app/files/ClientFilesScreen';
import MarketplaceHeroCard from '../shared/components/MarketplaceHeroCard';
import DashboardHeroCard from '../client-app/dashboard/DashboardHeroCard';
import FilesNotesHeroCard from '../shared/components/FilesNotesHeroCard';
import { MyFilesSection } from '../client-app/files/MyFilesSection';
import { TrainerSharedSection } from '../client-app/files/TrainerSharedSection';
import { NotesFromTrainerSection } from '../client-app/files/NotesFromTrainerSection';
import FilesNotesSectionPremium from '../shared/components/notes-files/FilesNotesSectionPremium';
import {
  persistPushTokensForUid,
  pendingPushTokenStorageKey,
  setNotificationTapHandler,
  flushInitialNotificationResponse,
  subscribePushTokenRefreshOnResume,
} from '../notifications/manageNotifications';
import { postRemotePushNotify } from '../shared/api/sendPushNotification';
import { deleteNotesAndFilesItem, getNotesAndFiles, markNotesAndFilesItemRead, resolveTrainerSpreadsheetView, spreadsheetRowsHaveContent } from '../shared/notes-files/manageNotesAndFiles';
import { useTheme } from '../shared-ui/ThemeContext';
import { trainerPhotoUri } from '../shared-utils/getTrainerProfileMedia';
import {
  getEmbedViewerUri,
  isImageFile as isNotesImageFile,
  isPdfFile as isNotesPdfFile,
  isVideoFile as isNotesVideoFile,
} from '../shared-utils/getFileViewType';
import MyMessagesScreen from '../client-app/screens/MyMessagesScreen';
import MyProgressPhotosScreen from '../client-app/screens/MyProgressPhotosScreen';
import ChatWithTrainerScreen from '../client-app/screens/ChatWithTrainerScreen';
import BrowseSavedWorkoutsScreen from '../client-app/screens/BrowseSavedWorkoutsScreen';
import ViewWeekProgressReportScreen from '../client-app/screens/ViewWeekProgressReportScreen';
import { fetchWorkoutHistory, getActiveWorkout, getCurrentWorkoutPlan } from '../workouts/active-workout/workoutService';
import WorkoutPlanGeneratorScreen from '../workouts/active-workout/workout';
import { clearAllUserData } from '../utils/clearDataOnLogout';

const CARD_GAP = 16;
/** Kept for any layout/style references; prefer useWindowDimensions() inside components for live width. */
const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** Horizontal padding inside home stat ScrollViews — keep in sync with `styles.statsRowContent.paddingHorizontal` (20×2). */
const STATS_ROW_PAD_H = 40;
/** Gap between cards in stat rows — keep in sync with `styles.statsRowContent.gap`. */
const STATS_ROW_CARD_GAP = 12;


// Wellness row empty-state Lotties
const LOTTIE_SORENESS_EMPTY = require('../assets/sad reaction.json');
const LOTTIE_ENERGY_EMPTY = require('../assets/Run Hamster... run.json');
const LOTTIE_STRESS_EMPTY = require('../assets/Stressed Employee At Work.json');
const LOTTIE_NUTRITION_EMPTY = require('../assets/animations/legacy/Food squeeze_With Burger and hot dog.json');
const WORKOUT_EMPTY_ICON = require('../assets/icons/workout.png');


// Main Component
export default function ClientApp({ user, userData, onRefetchUserData }) {
  const { colors, spacing, isDark, themeMode } = useTheme();
  const t = getPremiumTheme(isDark, colors);

  const [trainerData, setTrainerData] = useState(null);
  const [trainerLinkError, setTrainerLinkError] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [notesAndFiles, setNotesAndFiles] = useState([]);
  const [pdfViewer, setPdfViewer] = useState({ visible: false, url: null, name: null });
  const [spreadsheetViewer, setSpreadsheetViewer] = useState({ visible: false, url: null, name: null, rows: null });
  const [documentViewer, setDocumentViewer] = useState({ visible: false, trainerId: null, documentId: null, title: null });
  const [mediaViewer, setMediaViewer] = useState({ visible: false, url: null, kind: 'image', name: null });
  const [embedWebViewer, setEmbedWebViewer] = useState({ visible: false, uri: null, title: null });
  const [pendingSessions, setPendingSessions] = useState([]);
  const [day6Client, setDay6Client] = useState(null);
  const [showRemoveTrainerSheet, setShowRemoveTrainerSheet] = useState(false);
  const [reviewPromptTrainer, setReviewPromptTrainer] = useState(null);
  const [showReviewSheetForPrompt, setShowReviewSheetForPrompt] = useState(false);

  /** Progress Photos: bottom nav "+" calls into gallery (picker + Firebase). Cleared when gallery unmounts. */
  const progressGalleryAddRef = useRef(null);
  const registerProgressPhotoAddHandler = useCallback((fn) => {
    progressGalleryAddRef.current = typeof fn === 'function' ? fn : null;
  }, []);

  // Home screen data state
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onboardingData, setOnboardingData] = useState(null);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [nutritionGoals, setNutritionGoals] = useState(null);
  const [, setStreak] = useState(0);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [programCount, setProgramCount] = useState(0);
  const [upcomingItems, setUpcomingItems] = useState([]);
  const [userWeight, setUserWeight] = useState(null);
  const [macroTotals, setMacroTotals] = useState({ protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, potassium: 0 });
  const [waterIntake, setWaterIntake] = useState(null);
  const [sleepHours, setSleepHours] = useState(null);
  const [soreness, setSoreness] = useState(null);
  const [energyLevel, setEnergyLevel] = useState(null);
  const [stressLevel, setStressLevel] = useState(null);
  const [goalProgress, setGoalProgress] = useState(null);
  const [dashboardWorkoutSummary, setDashboardWorkoutSummary] = useState(null);
  const [loadingStartTime, setLoadingStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const isFetching = useRef(false);

  useClientHomeBootstrap({
    user,
    db,
    isFetching,
    setLoading,
    setLoadingStartTime,
    setOnboardingData,
    setUserWeight,
    setGoalProgress,
    setCalorieGoal,
    setWaterIntake,
    setSleepHours,
    setSoreness,
    setEnergyLevel,
    setStressLevel,
    setDashboardWorkoutSummary,
    setTodayWorkout,
    setCaloriesConsumed,
    setMacroTotals,
    setNutritionGoals,
    setStreak,
    setWorkoutCount,
    setCaloriesBurned,
  });

  const refetchNutritionData = useClientHomeNutrition({ user, db, setCaloriesConsumed, setMacroTotals });

  const nav = useClientScreenNavigation({ refetchNutritionData });
  const {
    showTrainerMessaging,
    setShowTrainerMessaging,
    showConversationsList,
    setShowConversationsList,
    showMyDashboard,
    setShowMyDashboard,
    showAddNotesFilesModal,
    setShowAddNotesFilesModal,
    showTrainerSharedFilesModal,
    setShowTrainerSharedFilesModal,
    showClientFilesScreen,
    setShowClientFilesScreen,
    showNotesFiles,
    setShowNotesFiles,
    nutritionTabFocusNonce,
    workoutTabFocusNonce,
    selectedTrainer,
    setSelectedTrainer,
    profileTrainer,
    setProfileTrainer,
    selectedConversation,
    setSelectedConversation,
    viewingPlan,
    setViewingPlan,
    aiChatState,
    setAiChatState,
    openMyDashboardBilling,
    showCoachingPaymentModal,
    openCoachingPayment,
    closeCoachingPayment,
    openProfile,
    openSettings,
    openHelpFAQ,
    openTerms,
    openPrivacy,
    openContactSupport,
    openBugReport,
    openNutrition,
    openWorkoutPlan,
    openTrainerSearch,
    openTrainerProfile,
    openWeeklyReport,
    openPhotoGallery,
    openAIWorkouts,
    openPlanViewer,
    openAIChatHome,
    openAIChatSession,
    handleOpenConversations,
    handleSelectConversation,
    handleCloseMessaging,
    handleCloseConversationsList,
    handleFindTrainers,
    handleHomePress,
    openWorkout,
    handleStartWorkout,
    handleAddWorkout,
    onNavigate,
    handleViewClients,
    navProviderProps,
    rootGoBack,
    mainTab,
    mainTabActiveKey,
  } = nav;

  const { applyFromSnapshots } = useClientHomeDailyMetrics(user?.uid, {
    setWaterIntake,
    setSleepHours,
    setSoreness,
    setEnergyLevel,
    setStressLevel,
    setTodayWorkout,
    setDashboardWorkoutSummary,
    setCaloriesConsumed,
    setMacroTotals,
  });

  // Clear cache and reset state when user changes
  useEffect(() => {
    if (!user?.uid) return;
    
    console.log(`🔄 ClientApp: User changed to ${user.uid} - resetting state`);
    
    // Reset all user-specific state
    setTrainerData(null);
    setOnboardingData(null);
    setTodayWorkout(null);
    setCaloriesConsumed(0);
    setCaloriesBurned(0);
    setCalorieGoal(2000);
    setNutritionGoals(null);
    setStreak(0);
    setWorkoutCount(0);
    setClientCount(0);
    setProgramCount(0);
    setUpcomingItems([]);
    setUserWeight(null);
    setMacroTotals({ protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, potassium: 0 });
    setWaterIntake(null);
    setSleepHours(null);
    setSoreness(null);
    setEnergyLevel(null);
    setStressLevel(null);
    setGoalProgress(null);
    setDashboardWorkoutSummary(null);
    setNotesAndFiles([]);
    
    // Clear any cached data
    clearAllUserData().catch(e => {
      console.log('⚠️ Failed to clear cache in ClientApp:', e.message);
    });
  }, [user?.uid]);

  // Subscribe to unread message count
  useEffect(() => {
    if (!user || !user.uid) return;

    const unsubscribe = subscribeToUnreadCount(user.uid, (count) => {
      setUnreadMessageCount(count);
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  // P1#3: Reconcile trainerId - discover accepted, clear if rejected
  useEffect(() => {
    if (!user?.uid || !db || userData?.role !== 'client') return;

    const reconcileTrainerId = async () => {
      try {
        const clientUid = user.uid;

        // Case 1: Has trainerId - verify link exists, clear if rejected, or re-create via Cloud Function
        if (userData.trainerId) {
          const linkDoc = await getDoc(doc(db, `trainer_clients/${userData.trainerId}/clients/${clientUid}`));
          if (linkDoc.exists()) {
            // Link exists - load trainer data
            const trainerDoc = await getDoc(doc(db, 'users', userData.trainerId));
            if (trainerDoc.exists()) {
              setTrainerData({ id: trainerDoc.id, ...trainerDoc.data() });
            }
            setTrainerLinkError(false);
            return;
          }
          // Link doesn't exist - check if rejected
          const conversationId = `conv_${clientUid}_${userData.trainerId}`;
          const messagesRef = collection(db, 'messages');
          const msgQuery = query(
            messagesRef,
            where('conversationId', '==', conversationId),
            where('senderId', '==', clientUid),
            where('status', '==', 'rejected'),
            limit(1)
          );
          const msgSnap = await getDocs(msgQuery);
          if (!msgSnap.empty) {
            const status = msgSnap.docs[0].data().status;
            if (status === 'rejected') {
              await updateDoc(doc(db, 'users', clientUid), { trainerId: deleteField(), trainerName: deleteField(), trainerAssignedAt: deleteField() });
              setTrainerData(null);
              setTrainerLinkError(false);
              onRefetchUserData?.();
            }
            return;
          }
          // Link doesn't exist and no rejected status - attempt to re-create via Cloud Function
          if (functions) {
            try {
              const linkClient = httpsCallable(functions, 'linkClientWithTrainerCode');
              await linkClient({ clientId: clientUid, trainerId: userData.trainerId });
              const trainerDoc = await getDoc(doc(db, 'users', userData.trainerId));
              if (trainerDoc.exists()) {
                setTrainerData({ id: trainerDoc.id, ...trainerDoc.data() });
              }
              setTrainerLinkError(false);
            } catch (linkErr) {
              await updateDoc(doc(db, 'users', clientUid), { trainerId: deleteField(), trainerName: deleteField(), trainerAssignedAt: deleteField() });
              setTrainerData(null);
              setTrainerLinkError(true);
              onRefetchUserData?.();
            }
          } else {
            setTrainerLinkError(true);
          }
          return;
        }

        // Case 2: No trainerId - discover if trainer accepted (trainer_clients exists)
        const convsRef = collection(db, 'conversations');
        const convQuery = query(convsRef, where('participants', 'array-contains', clientUid));
        const convSnap = await getDocs(convQuery);
        for (const convDoc of convSnap.docs) {
          const participants = convDoc.data().participants || [];
          const trainerUid = participants.find((p) => p !== clientUid);
          if (!trainerUid) continue;
          const linkDoc = await getDoc(doc(db, `trainer_clients/${trainerUid}/clients/${clientUid}`));
          if (linkDoc.exists()) {
            const trainerDoc = await getDoc(doc(db, 'users', trainerUid));
            const trainerData = trainerDoc.exists() ? trainerDoc.data() : {};
            await updateDoc(doc(db, 'users', clientUid), {
              trainerId: trainerUid,
              trainerName: trainerData.name || trainerData.displayName || 'Trainer',
              trainerAssignedAt: serverTimestamp(),
            });
            setTrainerData({ id: trainerUid, ...trainerData });
            onRefetchUserData?.();
            break;
          }
        }
      } catch (error) {
        console.error('Reconcile trainerId:', error);
      }
    };

    reconcileTrainerId();
  }, [user?.uid, userData?.trainerId, userData?.role, onRefetchUserData]);

  /**
   * Live trainer link via flat `trainer_client_links` (written when a trainer accepts).
   * Note: `collectionGroup('clients')` + `where(documentId(), '==', uid)` is invalid — Firestore requires
   * a full path for documentId() on collection groups (odd segment count error on device).
   */
  useEffect(() => {
    if (!db || !user?.uid || userData?.role !== 'client') return undefined;

    const clientUid = user.uid;
    let cancelled = false;

    const linksQuery = query(collection(db, 'trainer_client_links'), where('clientId', '==', clientUid));

    const unsub = onSnapshot(
      linksQuery,
      async (snap) => {
        if (cancelled) return;

        if (snap.empty) {
          setTrainerData(null);
          return;
        }

        const activeDocs = snap.docs.filter((d) => {
          const st = d.data()?.status;
          if (st == null || st === '') return true;
          return st === 'active';
        });
        if (!activeDocs.length) {
          setTrainerData(null);
          return;
        }

        const linkDoc = activeDocs[0];
        const trainerUid = String(linkDoc.data()?.trainerId || '').trim();
        if (!trainerUid || trainerUid === clientUid) {
          setTrainerData(null);
          return;
        }

        try {
          const trainerDoc = await getDoc(doc(db, 'users', trainerUid));
          if (!trainerDoc.exists()) {
            setTrainerData(null);
            return;
          }
          const tData = trainerDoc.data();
          if (tData?.role !== 'trainer') {
            setTrainerData(null);
            return;
          }
          setTrainerData({ id: trainerUid, ...tData });

          try {
            const userRef = doc(db, 'users', clientUid);
            const uSnap = await getDoc(userRef);
            const cur = uSnap.exists() ? uSnap.data() : {};
            if (!cur?.trainerId || String(cur.trainerId) !== String(trainerUid)) {
              await updateDoc(userRef, {
                trainerId: trainerUid,
                trainerName: tData.name || tData.displayName || 'Trainer',
                trainerAssignedAt: serverTimestamp(),
              });
              onRefetchUserData?.();
            }
          } catch (e) {
            console.warn('Mirror trainerId to client user doc skipped:', e?.message || e);
          }
        } catch (e) {
          console.warn('trainer_client_links listener handler:', e?.message || e);
        }
      },
      (err) => {
        console.warn('trainer_client_links listener:', err?.code || err?.message || err);
      }
    );

    return () => {
      cancelled = true;
      try {
        unsub();
      } catch (_) {}
    };
  }, [db, user?.uid, userData?.role, onRefetchUserData]);

  // If a CRM link appears while "Find a Trainer" is open, leave that screen — they already have a coach.
  useEffect(() => {
    if (!trainerData?.id || !rootNavigationRef.isReady()) return;
    const route = rootNavigationRef.getCurrentRoute();
    if (route?.name === CLIENT_ROUTES.TrainerSearch) {
      rootGoBack();
    }
  }, [trainerData?.id, rootGoBack]);



  // Stopwatch timer for loading screen
  useEffect(() => {
    let interval;
    if (loading && loadingStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - loadingStartTime) / 1000));
      }, 100);
    } else {
      setElapsedTime(0);
      setLoadingStartTime(null);
    }
    
    return () => clearInterval(interval);
  }, [loading, loadingStartTime]);

  // When returning from dashboard, refetch soreness/energy/stress so the wellness row updates
  // When returning from dashboard we previously refetched soreness/energy/stress.
  // The dashboard is now always visible, so the wellness row is kept in sync via direct metric updates.

  useEffect(() => {
    if (!user?.uid || !db) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists() || cancelled) return;

        const pendingToken = await AsyncStorage.getItem(pendingPushTokenStorageKey(user.uid));
        if (pendingToken) {
          await persistPushTokensForUid(user.uid, pendingToken);
          await AsyncStorage.removeItem(pendingPushTokenStorageKey(user.uid));
        }
      } catch (e) {
        if (__DEV__) console.warn('[push] pending token flush failed:', e?.message || e);
      }

      if (!cancelled) {
        persistPushTokensForUid(user.uid, { skipIfDisabled: true }).catch(() => {});
      }
    })();

    const unsubResume = subscribePushTokenRefreshOnResume(user.uid, () => true);
    return () => {
      cancelled = true;
      unsubResume();
    };
  }, [user?.uid]);

  const clientNotifTapRef = useRef(async () => {});

  useEffect(() => {
    clientNotifTapRef.current = async (data) => {
      try {
        if (!user?.uid || !data || typeof data !== 'object') return;
        const type = data.type;
        if (type === 'session_scheduled') {
          rootGoBack();
          setShowMyDashboard(false);
          rootGoBack();
          rootGoBack();
          setAiChatState(null);
          return;
        }
        if (type === 'session_reminder' || type === 'session_update') {
          rootGoBack();
          rootGoBack();
          rootGoBack();
          setAiChatState(null);
          setShowTrainerMessaging(false);
          setShowConversationsList(false);
          setShowMyDashboard(true);
          return;
        }
        if (type === 'nutrition_reminder') {
          rootGoBack();
          rootGoBack();
          setAiChatState(null);
          setShowTrainerMessaging(false);
          setShowConversationsList(false);
          setShowMyDashboard(false);
          openNutrition();
          return;
        }
        if (type === 'notes_shared') {
          rootGoBack();
          rootGoBack();
          setAiChatState(null);
          setShowTrainerMessaging(false);
          setShowConversationsList(false);
          rootGoBack();
          setShowMyDashboard(true);
          setShowTrainerSharedFilesModal(true);
          return;
        }
        if (type !== 'message') {
          rootGoBack();
          setShowMyDashboard(false);
          rootGoBack();
          rootGoBack();
          setAiChatState(null);
          setShowTrainerMessaging(false);
          setShowConversationsList(true);
          return;
        }
        const conversationId = data.conversationId;
        if (!conversationId || typeof conversationId !== 'string') {
          rootGoBack();
          setShowMyDashboard(false);
          rootGoBack();
          rootGoBack();
          setAiChatState(null);
          setShowTrainerMessaging(false);
          setShowConversationsList(true);
          return;
        }
        const convSnap = await getDoc(doc(db, 'conversations', conversationId));
        if (!convSnap.exists()) {
          setShowConversationsList(true);
          return;
        }
        const convData = convSnap.data();
        const participants = convData?.participants || [];
        const otherId = participants.find((p) => p !== user.uid);
        let otherParticipant = otherId ? { id: otherId } : null;
        if (otherId) {
          try {
            const uSnap = await getDoc(doc(db, 'users', otherId));
            if (uSnap.exists()) otherParticipant = { id: uSnap.id, ...uSnap.data() };
          } catch (_) {
            /* keep minimal otherParticipant */
          }
        }
        rootGoBack();
        setShowMyDashboard(false);
        rootGoBack();
        rootGoBack();
        setAiChatState(null);
        setShowConversationsList(false);
        setSelectedConversation({ id: conversationId, ...convData });
        setSelectedTrainer(otherParticipant);
        setShowTrainerMessaging(true);
      } catch (e) {
        setShowConversationsList(true);
      }
    };
  }, [user?.uid]);

  useEffect(() => {
    setNotificationTapHandler((d) => {
      clientNotifTapRef.current?.(d);
    });
    return () => setNotificationTapHandler(null);
  }, []);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return flushInitialNotificationResponse(650);
  }, [user?.uid]);

  // Notes & Files — same subcollection as trainer; realtime listener so uploads & trainer shares show immediately
  useEffect(() => {
    if (!user?.uid || !db) {
      setNotesAndFiles([]);            
      return;
    }
    const notesRef = collection(db, 'users', user.uid, 'notes_and_files');
    const unsubscribe = onSnapshot(
      notesRef,
      async () => {
        try {
          const list = await getNotesAndFiles(user.uid);
          setNotesAndFiles(list);
        } catch {
          setNotesAndFiles([]);
        }
      },
      (err) => console.error('Client notes_and_files listener:', err),
    );
    return () => {
      try {
        unsubscribe();
      } catch (_) {}
    };
  }, [user?.uid]);

  // Session invites (client): show upcoming pending sessions with accept/decline.
  useEffect(() => {
    if (!user?.uid || !db) {
      setPendingSessions([]);
      return;
    }
    const trainerUid = trainerData?.id || trainerData?.uid || null;
    if (!trainerUid) {
      setPendingSessions([]);
      return;
    }
    const todayKey = getClientDateKey();
    const sessionsRef = collection(db, `trainer_clients/${trainerUid}/sessions`);
    const primaryQuery = query(
      sessionsRef,
      where('clientId', '==', user.uid),
      where('status', '==', 'pending'),
      where('date', '>=', todayKey),
      limit(5),
    );
    const applySnap = (snap) => {
      const next = [];
      snap.forEach((d) => next.push({ id: d.id, ...d.data() }));
      next.sort((a, b) => (String(a.date) + String(a.time)).localeCompare(String(b.date) + String(b.time)));
      setPendingSessions(next);
    };

    let fallbackUnsub = null;
    const unsub = onSnapshot(
      primaryQuery,
      (snap) => {
        applySnap(snap);
      },
      (err) => {
        console.error('Client pending sessions listener:', err);
        const msg = String(err?.message || '');
        const needsIndex =
          err?.code === 'failed-precondition' ||
          msg.toLowerCase().includes('requires an index') ||
          msg.toLowerCase().includes('create_composite');

        // Fallback: use a simpler query (no composite index) and filter client-side.
        // This keeps the UI working immediately, even if the composite index isn’t created yet.
        if (needsIndex) {
          try {
            const fallbackQuery = query(
              sessionsRef,
              where('clientId', '==', user.uid),
              limit(15),
            );
            fallbackUnsub = onSnapshot(
              fallbackQuery,
              (snap) => {
                const all = [];
                snap.forEach((d) => all.push({ id: d.id, ...d.data() }));
                const filtered = all
                  .filter((s) => (s.status || 'pending') === 'pending' && String(s.date || '') >= String(todayKey))
                  .sort((a, b) => (String(a.date) + String(a.time)).localeCompare(String(b.date) + String(b.time)))
                  .slice(0, 5);
                setPendingSessions(filtered);
              },
              (e2) => {
                console.error('Client pending sessions fallback listener:', e2);
                setPendingSessions([]);
              },
            );
            return;
          } catch (e) {
            // continue to empty
          }
        }

        setPendingSessions([]);
      },
    );
    return () => {
      try { unsub(); } catch (_) {}
      try { fallbackUnsub?.(); } catch (_) {}
    };
  }, [user?.uid, trainerData?.id]);

  const respondToSession = useCallback(async ({ sessionId, status }) => {
    const trainerUid = trainerData?.id || trainerData?.uid || null;
    if (!trainerUid || !sessionId) return;
    try {
      await updateDoc(doc(db, `trainer_clients/${trainerUid}/sessions/${sessionId}`), {
        status,
        respondedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const clientUid = user?.uid;
      if (clientUid) {
        let clientName = user?.displayName || 'Client';
        try {
          const us = await getDoc(doc(db, 'users', clientUid));
          if (us.exists()) {
            const d = us.data();
            clientName = d?.firstName || d?.name || d?.displayName || clientName;
          }
        } catch (_) {}
        const verb =
          status === 'accepted' ? 'accepted' : status === 'declined' ? 'declined' : 'updated';
        void postRemotePushNotify({
          recipientId: trainerUid,
          senderName: clientName,
          messageText: `${clientName} ${verb} a session.`,
          senderId: clientUid,
          messageId: sessionId,
          notificationType: 'session_response',
        });
      }
    } catch (e) {
      console.error('Respond to session failed:', e);
      Alert.alert('Could not update', e?.message || 'Please try again.');
    }
  }, [trainerData?.id, trainerData?.uid, user?.uid, user?.displayName]);

  const refreshNotesAndFiles = () => {
    if (user?.uid) getNotesAndFiles(user.uid).then(setNotesAndFiles).catch(() => {});
  };

  const addNotesFilesModalEl = (
    <AddNotesFilesModal
      visible={showAddNotesFilesModal}
      onClose={() => setShowAddNotesFilesModal(false)}
      onAdded={refreshNotesAndFiles}
      isDark={isDark}
    />
  );

  const trainerSharedFiles = useMemo(
    () =>
      (notesAndFiles || []).filter(
        (x) => x.addedBy === 'trainer' || (x.type === 'document' && x.trainerId),
      ),
    [notesAndFiles],
  );

  /** Client uploads (plus button) — same Firestore list; previously hidden because home only showed trainer rows */
  const myOwnFiles = useMemo(
    () =>
      (notesAndFiles || []).filter((x) => {
        if (x.type === 'note') return false;
        return (
          (x.addedBy || 'client') === 'client' &&
          !(x.type === 'document' && x.trainerId && x.documentId)
        );
      }),
    [notesAndFiles],
  );

  const [deletingMyFiles, setDeletingMyFiles] = useState(false);

  const deleteSingleMyFile = useCallback(async (file) => {
    if (!user?.uid || !file?.id) return;
    if ((file.addedBy || 'client') !== 'client') return;
    setDeletingMyFiles(true);
    try {
      await deleteNotesAndFilesItem(user.uid, file);
      refreshNotesAndFiles();
    } catch (e) {
      console.error('Delete notes/file failed:', e);
      Alert.alert('Could not delete', e?.message || 'Please try again.');
    } finally {
      setDeletingMyFiles(false);
    }
  }, [user?.uid, refreshNotesAndFiles]);

  const deleteAllMyFiles = useCallback(async () => {
    if (!user?.uid) return;
    const list = (myOwnFiles || []).filter((f) => (f.addedBy || 'client') === 'client' && f?.id);
    if (list.length === 0) return;
    setDeletingMyFiles(true);
    try {
      // Sequential to avoid hammering Storage/Firestore on large sets.
      for (const f of list) {
        // eslint-disable-next-line no-await-in-loop
        await deleteNotesAndFilesItem(user.uid, f);
      }
      refreshNotesAndFiles();
    } catch (e) {
      console.error('Delete all notes/files failed:', e);
      Alert.alert('Could not delete all', e?.message || 'Some files may not have been deleted. Try again.');
      refreshNotesAndFiles();
    } finally {
      setDeletingMyFiles(false);
    }
  }, [user?.uid, myOwnFiles, refreshNotesAndFiles]);

  const openNotesFile = useCallback((file) => {
    if (file?.trainerId && file?.documentId) {
      resolveTrainerSpreadsheetView(file.trainerId, file.documentId)
        .then((res) => {
          if (!res) {
            if (file?.type === 'document' || file?.documentId) {
              setDocumentViewer({
                visible: true,
                trainerId: file.trainerId,
                documentId: file.documentId,
                title: file.title || 'Document',
              });
            } else {
              Alert.alert('Spreadsheet unavailable', 'Your coach may have removed this spreadsheet.');
            }
            return;
          }
          const name = file?.title || file?.name || res.title || 'Spreadsheet';
          if (spreadsheetRowsHaveContent(res.rows)) {
            setSpreadsheetViewer({
              visible: true,
              url: res.storageUrl || null,
              rows: res.rows,
              name,
            });
            return;
          }
          if (res.storageUrl) {
            setSpreadsheetViewer({
              visible: true,
              url: res.storageUrl,
              rows: null,
              name,
            });
            return;
          }
          Alert.alert('Spreadsheet unavailable', 'Your coach may have removed this spreadsheet.');
        })
        .catch(() => {
          Alert.alert('Spreadsheet unavailable', 'Could not load this spreadsheet.');
        });
      return;
    }
    if (file?.type === 'spreadsheet' && file.url) {
      setSpreadsheetViewer({ visible: true, url: file.url, name: file?.name || 'Spreadsheet', rows: null });
      return;
    }
    if (file?.type === 'document' || (file?.documentId && file?.trainerId)) {
      setDocumentViewer({
        visible: true,
        trainerId: file.trainerId,
        documentId: file.documentId,
        title: file.title || 'Document',
      });
      return;
    }
    if (file?.url && isNotesImageFile(file)) {
      setMediaViewer({ visible: true, url: file.url, kind: 'image', name: file?.name || file?.title || 'Photo' });
      return;
    }
    if (file?.url && isNotesVideoFile(file)) {
      setMediaViewer({ visible: true, url: file.url, kind: 'video', name: file?.name || file?.title || 'Video' });
      return;
    }
    if (file?.url && isNotesPdfFile(file, file.url)) {
      setPdfViewer({ visible: true, url: file.url, name: file?.name || 'Document' });
      return;
    }
    if (file?.url) {
      setEmbedWebViewer({
        visible: true,
        uri: getEmbedViewerUri(file, file.url),
        title: file.name || file.title || 'Document',
      });
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    refreshNotesAndFiles();
    if (user?.uid && db) {
      try {
        const todayKey = getLocalDateKey();
        const [logsDoc, trackingDoc] = await Promise.all([
          getDoc(doc(db, 'users', user.uid, 'dailyLogs', todayKey)),
          // TODO(phase-5): remove legacy daily_tracking read after backfill
          getDoc(doc(db, 'users', user.uid, 'daily_tracking', todayKey)),
        ]);
        applyFromSnapshots(logsDoc, trackingDoc);
        await refetchNutritionData();
      } catch (e) {
        console.warn('Home refresh daily metrics:', e?.message || e);
      }
    }
    setRefreshing(false);
  };

  const coachingRateLabel = useMemo(() => {
    const rate = userData?.monthlyRate;
    if (rate != null && rate !== '') {
      const n = Number(rate);
      if (Number.isFinite(n) && n > 0) {
        const dollars = n >= 100 ? n / 100 : n;
        return `$${dollars % 1 === 0 ? dollars.toFixed(0) : dollars.toFixed(2)}`;
      }
    }
    const pricing = trainerData?.pricing;
    if (pricing?.perMonth != null && pricing.perMonth !== '') {
      return `$${pricing.perMonth}`;
    }
    return null;
  }, [userData?.monthlyRate, trainerData?.pricing]);

  const coachingTrainerName = useMemo(() => {
    const tr = trainerData;
    if (!tr) return 'Your trainer';
    const first = tr.firstName || tr.givenName;
    const last = tr.lastName || tr.familyName;
    if (first || last) return `${first ?? ''} ${last ?? ''}`.trim();
    return tr.displayName || tr.name || 'Your trainer';
  }, [trainerData]);

  const handleConfirmCoachingPayment = useCallback(() => {
    console.log('[ClientApp] handleConfirmCoachingPayment placeholder');
    closeCoachingPayment();
  }, [closeCoachingPayment]);

    // Main home screen render — use shared app loading screen (same as AuthGate / entire app)
  if (loading) {
    return <AppLoadingScreen isDark={isDark} />;
  }

  const aiChatNavHandlers = {
    onHomePress: () => {
      setAiChatState(null);
      handleHomePress();
    },
    onPlusPress: () => setShowAddNotesFilesModal(true),
    onVoicePress: openAIChatHome,
    onNutritionPress: () => {
      setAiChatState(null);
      openNutrition();
    },
    onNutritionDataChanged: refetchNutritionData,
    onWorkoutPress: () => {
      setAiChatState(null);
      openWorkout();
    },
    onOpenWorkoutPlan: async ({ planId = 'current', title, todayPreview } = {}) => {
      const uid = user?.uid;
      if (!uid) return { success: false, message: 'Please sign in again.' };
      try {
        let planData = null;
        if (planId === 'current') {
          const current = await getCurrentWorkoutPlan(uid);
          if (current) planData = { id: 'current', ...current };
        } else {
          const snap = await getDoc(doc(db, 'users', uid, 'workoutPlans', planId));
          if (snap.exists()) planData = { id: planId, ...snap.data() };
        }
        if (!planData?.rawPlan && !planData?.planText && !planData?.structuredPlan) {
          return { success: false, message: 'Could not find that workout plan.' };
        }
        const planTitle = title || planData.title || planData.name || 'your workout plan';
        setViewingPlan(planData);
        openPlanViewer();
        const preview = todayPreview ? `\n\n${todayPreview}` : '';
        return {
          success: true,
          message: `Opened ${planTitle}.${preview}`.trim(),
        };
      } catch (e) {
        return { success: false, message: e?.message || 'Could not load workout plan.' };
      }
    },
    onMessagesPress: () => {
      setAiChatState(null);
      handleOpenConversations();
    },
    onProfilePress: () => {
      setAiChatState(null);
      openProfile();
    },
    onSettingsPress: () => {
      setAiChatState(null);
      openSettings();
    },
  };

  const userName = userData?.firstName || user?.displayName || onboardingData?.name || 'User';
  const userRole = userData?.role || 'client';
  const hasTrainer = !!trainerData;

  // Prepare workout data for TrainingAgenda
  const agendaWorkouts = todayWorkout
    ? [
        {
          name: todayWorkout.name,
          exercises: Array.isArray(todayWorkout.exercises)
            ? todayWorkout.exercises
                .map((ex) => {
                  if (typeof ex === 'string') return ex;
                  const label = ex?.name || ex?.exerciseName || '';
                  if (!label) return '';
                  if (Array.isArray(ex.sets) && ex.sets.length > 0) {
                    const setsSummary = ex.sets
                      .map((s) => {
                        const reps = s.reps != null ? s.reps : '';
                        const weight = s.weight != null ? s.weight : '';
                        if (reps && weight) return `${reps}×${weight}`;
                        if (reps) return `${reps} reps`;
                        if (weight) return `${weight}`;
                        return '';
                      })
                      .filter(Boolean)
                      .join(', ');
                    return setsSummary
                      ? `${label} (${setsSummary})`
                      : label;
                  }
                  return label;
                })
                .filter(Boolean)
            : todayWorkout.exercises,
          sets: null,
          reps: 0,
          workoutName: todayWorkout.name,
        },
      ]
    : dashboardWorkoutSummary
    ? [
        {
          name: dashboardWorkoutSummary,
          exercises: null,
          sets: null,
          reps: null,
          workoutName: dashboardWorkoutSummary,
        },
      ]
    : [];

  // Prepare macro data for NutritionCard
  const nutritionMacros = [
    { icon: require('../assets/icons/Protein.png'), label: "Protein", value: `${Math.round(macroTotals.protein)}g` },
    { icon: require('../assets/icons/Carbs.png'), label: "Carbs", value: `${Math.round(macroTotals.carbs)}g` },
    { icon: require('../assets/icons/Fats.png'), label: "Fats", value: `${Math.round(macroTotals.fats || 0)}g` },
  ];

  console.log(`📊 Nutrition macros being passed to card:`, nutritionMacros.map(m => ({ label: m.label, value: m.value })));
  console.log(`🎯 Current nutrition goals:`, nutritionGoals);

  // Prepare additional nutrition data (only show if data exists)
  const additionalNutrients = [];
  
  if (macroTotals.fiber > 0) {
    additionalNutrients.push({ 
      icon: "🌾", 
      label: "Fiber", 
      value: `${Math.round(macroTotals.fiber)}g` 
    });
  }
  
  if (macroTotals.sugar > 0) {
    additionalNutrients.push({ 
      icon: "🍯", 
      label: "Sugar", 
      value: `${Math.round(macroTotals.sugar)}g` 
    });
  }
  
  if (macroTotals.sodium > 0) {
    additionalNutrients.push({ 
      icon: "🧂", 
      label: "Sodium", 
      value: `${Math.round(macroTotals.sodium)}mg` 
    });
  }
  
  if (macroTotals.potassium > 0) {
    additionalNutrients.push({ 
      icon: "🥔", 
      label: "Potassium", 
      value: `${Math.round(macroTotals.potassium)}mg` 
    });
  }

  const shell = {
    user,
    userData,
    onRefetchUserData,
    isDark: Boolean(isDark),
    styles,
    colors,
    themeMode,
    navProviderProps,
    addNotesFilesModalEl,
    aiChatNavHandlers,
    refreshNotesAndFiles,
    refetchNutritionData,
    mainTab,
    mainTabActiveKey,
    nutritionTabFocusNonce,
    workoutTabFocusNonce,
    onNavigate,
    setOnboardingData,
    showTrainerMessaging,
    setShowTrainerMessaging,
    showConversationsList,
    setShowConversationsList,
    showMyDashboard,
    setShowMyDashboard,
    openMyDashboardBilling,
    showCoachingPaymentModal,
    openCoachingPayment,
    closeCoachingPayment,
    showAddNotesFilesModal,
    setShowAddNotesFilesModal,
    showTrainerSharedFilesModal,
    setShowTrainerSharedFilesModal,
    trainerData,
    setTrainerData,
    unreadMessageCount,
    showNotesFiles,
    setShowNotesFiles,
    notesAndFiles,
    day6Client,
    setDay6Client,
    viewingPlan,
    setViewingPlan,
    profileTrainer,
    setProfileTrainer,
    selectedTrainer,
    setSelectedTrainer,
    selectedConversation,
    setSelectedConversation,
    aiChatState,
    setAiChatState,
    openProfile: nav.openProfile,
    openSettings: nav.openSettings,
    openHelpFAQ: nav.openHelpFAQ,
    openTerms: nav.openTerms,
    openPrivacy: nav.openPrivacy,
    openContactSupport: nav.openContactSupport,
    openBugReport: nav.openBugReport,
    openNutrition,
    openWorkout,
    openWeeklyReport,
    openPhotoGallery,
    openAIWorkouts,
    openPlanViewer,
    openTrainerSearch,
    openTrainerProfile,
    openAIChatHome,
    openAIChatSession,
    handleHomePress,
    handleOpenConversations,
    handleSelectConversation,
    handleCloseMessaging,
    handleCloseConversationsList,
    handleFindTrainers,
    registerProgressPhotoAddHandler,
    userName,
    userRole,
    hasTrainer,
    onboardingData,
    todayWorkout,
    waterIntake,
    sleepHours,
    soreness,
    energyLevel,
    stressLevel,
    caloriesConsumed,
    calorieGoal,
    nutritionGoals,
    nutritionMacros,
    additionalNutrients,
    agendaWorkouts,
    goalProgress,
    dashboardWorkoutSummary,
    pendingSessions,
    respondToSession,
    handleAddWorkout,
    openNotesFile,
    deleteSingleMyFile,
    deletingMyFiles,
    showRemoveTrainerSheet,
    setShowRemoveTrainerSheet,
    reviewPromptTrainer,
    setReviewPromptTrainer,
    showReviewSheetForPrompt,
    setShowReviewSheetForPrompt,
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
    trainerSharedFiles,
    refreshing,
    onRefresh,
    rootGoBack,
    applyFromSnapshots,
    setSoreness,
    setEnergyLevel,
    setStressLevel,
    setWaterIntake,
    setSleepHours,
    setTodayWorkout,
    setDashboardWorkoutSummary,
  };

  return (
    <ClientAppShellProvider value={shell}>
      <NavigationContainer ref={rootNavigationRef} linking={clientLinking}>
        <ClientRootNavigator />
      </NavigationContainer>

      <Modal
        visible={showCoachingPaymentModal}
        transparent
        animationType="slide"
        onRequestClose={closeCoachingPayment}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <TouchableOpacity
            style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' }}
            activeOpacity={1}
            onPress={closeCoachingPayment}
          />
          <View
            style={{
              backgroundColor: isDark ? colors.surface : colors.surface,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              paddingBottom: 32,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '800', textAlign: 'center', color: colors.text, marginBottom: 16 }}>
              Coaching Payment
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <LinearGradient
                colors={['#FF6B9D', '#C084FC']}
                style={{ width: 48, height: 48, borderRadius: 24, padding: 2 }}
              >
                <View
                  style={{
                    flex: 1,
                    borderRadius: 22,
                    overflow: 'hidden',
                    backgroundColor: isDark ? colors.background : colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {trainerPhotoUri(trainerData) ? (
                    <Image source={{ uri: trainerPhotoUri(trainerData) }} style={{ width: 44, height: 44 }} />
                  ) : (
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>
                      {String(coachingTrainerName || '?').trim().charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>
                  {coachingTrainerName}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '700', marginTop: 2 }}>
                  {coachingRateLabel ? `${coachingRateLabel}/mo` : '—'}
                </Text>
              </View>
            </View>

            <View
              style={{
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: isDark ? colors.surfaceSecondary : colors.surfaceSecondary,
                padding: 14,
                marginBottom: 12,
              }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                Payment method — coming soon
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, opacity: 0.85 }}>
                Stripe card input will appear here.
              </Text>
            </View>

            <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18, marginBottom: 16 }}>
              {coachingRateLabel
                ? `You will be charged ${coachingRateLabel}/mo on the same date each month`
                : 'You will be charged monthly on the same date each month'}
            </Text>

            <TouchableOpacity activeOpacity={0.92} onPress={handleConfirmCoachingPayment}>
              <LinearGradient
                colors={['#FF6B9D', '#C084FC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 8 }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>Confirm</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={{ paddingVertical: 14, alignItems: 'center' }} onPress={closeCoachingPayment}>
              <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ClientAppShellProvider>
  );
}