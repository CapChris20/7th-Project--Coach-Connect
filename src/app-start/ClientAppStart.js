// The client-side app shell: owns all of a client's data and which panel is on screen.
// Flow: LoginGate mounts this with the signed-in user → effects load profile/trainer/nutrition/workout data and
//       attach live Firestore listeners → everything is bundled into one `shell` object → published via
//       ClientAppStartShellProvider so screens read it from context instead of prop-drilling.
// Note this file holds almost no UI itself; the navigator inside ClientScreenList renders the actual screens.

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
import BlurredBackground from '../look-and-feel/BlurredBackground';
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

import { auth, db, functions } from './cloudConnection';
import { calculateBMR, calculateTDEE } from '../for-both/calorieAndMacroMath';
import { getClientDateKey } from '../helpers/dateStrings';
import { getLocalDateKey } from '../helpers/getLocalDay';
import {
  mergeClientDailyMetrics,
  parseDailyMetricsFromSnapshots,
} from '../daily-stats/saveDailyStats';
import { keepDailyStatsFresh } from '../client-app/home/keepDailyStatsFresh';
import styles from '../client-app/home/homeLooks';
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
} from '../client-app/home/homeScreenPieces';
import { loadHomeScreenData } from '../client-app/home/loadHomeScreenData';
import { goToClientScreen } from '../client-app/navigation/goToClientScreen';

// Re-reads today's food log and pushes the totals into home-screen state.
// Handed to anything that can change what the user ate (the nutrition screen, the AI coach logging a
// meal), so the home cards update without a full refresh.
function useClientHomeNutrition({ user, db, setCaloriesConsumed, setMacroTotals }) {
  // vocab: useCallback = keep the SAME function identity between renders unless a dependency changes.
  // It matters here because this function is passed into the shell object and into child screens —
  // a new identity every render would retrigger their effects.
  const refetchNutritionData = useCallback(async () => {
    if (!user?.uid || !db) return;
    try {
      // Local date, not UTC: "today's food" must follow the phone's calendar day or logs jump at
      // midnight for anyone not on UTC.
      const todayKey = getLocalDateKey();
      const nutritionLogs = await getFoodLogsForDate(user.uid, todayKey);
      const totals = calculateMacroTotals(nutritionLogs);
      setCaloriesConsumed(totals.calories || 0);
      setMacroTotals({
        protein: totals.protein || 0,
        carbs: totals.carbs || 0,
        // Note the rename: the calculator returns `fat` (singular), the UI state uses `fats`.
        fats: totals.fat || 0,
      });
    } catch (e) {
      console.error('Refetch nutrition:', e);
    }
  }, [user?.uid, db, setCaloriesConsumed, setMacroTotals]);

  return refetchNutritionData;
}


import { subscribeToUnreadCount, rebuildUnreadIndexForUser } from '../ai-coach/past-chats/loadOlderChats';
import { getOrCreateConversation, sendClientRequest } from '../ai-coach/coach-actions/alertTrainer';
import CoachHomeScreen from '../ai-coach/home-screen/CoachHomeScreen';
import CoachConversationScreen from '../ai-coach/conversation/CoachConversationScreen';
import SearchTrainersScreen, { TrainerProfileSheet } from '../client-app/find-a-trainer/SearchTrainersScreen';
import TrainingHomeScreen from '../client-app/home/TrainingHomeScreen';
import SettingsScreen from '../settings/SettingsScreen';
import HelpFAQScreen from '../settings/HelpFAQScreen';
import TermsOfServiceScreen from '../settings/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../settings/PrivacyPolicyScreen';
import ContactSupportScreen from '../settings/ContactSupportScreen';
import BugReportScreen from '../settings/BugReportScreen';
import { AppNavigationProvider } from '../navigation/whichScreenIsOpen';
import { NavigationContainer } from '@react-navigation/native';
import { rootNavigationRef } from '../navigation/openScreenFromAnywhere';
import { CLIENT_ROUTES } from '../navigation/screenNames';
import { clientLinking } from '../navigation/webLinks';
import { ClientAppStartShellProvider } from '../client-app/navigation/ClientOpenScreenTracker';
import { CrashCatcher } from '../crash-reports/CrashCatcher';
import ClientScreenList from '../client-app/navigation/ClientScreenList';
import BottomMenuBar from '../navigation/BottomMenuBar';
import { calculateMacroTotals, getDailyGoals, getFoodLogsForDate } from '../nutrition/daily-log/saveLoggedFood';
import LogTodaysMealsScreen from '../client-app/meals/LogTodaysMealsScreen';
import DailyLogContent from '../nutrition/daily-log/DailyLogContent';
import AddFilePopup from '../for-both/files-and-notes/viewers/AddFilePopup';
import { useStartupLoadingCoverLock } from '../for-both/loading-and-header/StartupLoadingCover';
import TopHeader from '../for-both/loading-and-header/TopHeader';
import DailyQuoteCard, { DailyQuotePill } from '../for-both/home-cards/DailyQuoteCard';
import DocumentViewer from '../for-both/files-and-notes/viewers/DocumentViewer';
import { PayTrainerPopup } from '../for-both/payments/PayTrainerPopup';
import WebPageViewer from '../for-both/files-and-notes/viewers/WebPageViewer';
import FileGrid, { FILE_GALLERY_THEME_COLORS } from '../for-both/files-and-notes/viewers/FileGrid';
import PhotoVideoViewer from '../for-both/files-and-notes/viewers/PhotoVideoViewer';
import PdfViewer from '../for-both/files-and-notes/viewers/PdfViewer';
import RemoveTrainerPopup from '../for-both/popups/RemoveTrainerPopup';
import WriteTrainerReviewPopup from '../client-app/home/WriteTrainerReviewPopup';
import { UpcomingSessionCard } from '../for-both/home-cards/UpcomingSessionCard';
import SpreadsheetViewer from '../for-both/files-and-notes/viewers/SpreadsheetViewer';
import TrainerSharedFilesPopup from '../client-app/files-and-notes/TrainerSharedFilesPopup';
import FilesScreen from '../client-app/files-and-notes/FilesScreen';
import FindTrainerBanner from '../for-both/home-cards/FindTrainerBanner';
import TopBannerCard from '../client-app/home/TopBannerCard';
import FilesHeaderCard from '../for-both/home-cards/FilesHeaderCard';
import { MyFilesSection } from '../client-app/files-and-notes/MyFilesSection';
import { SharedByTrainerSection } from '../client-app/files-and-notes/SharedByTrainerSection';
import { NotesFromTrainerSection } from '../client-app/files-and-notes/NotesFromTrainerSection';
import FilesSection from '../for-both/files-and-notes/viewers/FilesSection';
import {
  persistPushTokensForUid,
  pendingPushTokenStorageKey,
  setNotificationTapHandler,
  flushInitialNotificationResponse,
  subscribePushTokenRefreshOnResume,
} from '../notifications/manageAlerts';
import { postRemotePushNotify } from '../for-both/online-connection/sendPhoneAlert';
import { deleteNotesAndFilesItem, getNotesAndFiles, markNotesAndFilesItemRead, resolveTrainerSpreadsheetView, packSpreadsheetRowsHaveContent } from '../for-both/files-and-notes/saveNotesAndFiles';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { trainerPhotoUri } from '../helpers/trainerProfilePhoto';
import {
  getEmbedViewerUri,
  isImageFile as isNotesImageFile,
  isPdfFile as isNotesPdfFile,
  isVideoFile as isNotesVideoFile,
} from '../helpers/whichViewerForFile';
import InboxScreen from '../messaging/InboxScreen';
import MyProgressPhotosScreen from '../for-both/photo-gallery/MyProgressPhotosScreen';
import ChatWithTrainerScreen from '../messaging/ChatScreen';
import SavedWorkoutsScreen from '../for-both/workout-plans/SavedWorkoutsScreen';
import WeeklyReportScreen from '../for-both/weekly-report/WeeklyReportScreen';
import { fetchWorkoutHistory, getActiveWorkout, getCurrentWorkoutPlan } from '../workouts/create-plan/saveAndLoadWorkoutPlan';
import CreateWorkoutPlanScreen from '../workouts/create-plan/CreateWorkoutPlanScreen';
import { clearAllUserData } from '../logout-cleanup/clearDataOnLogout';
import { logSnapshotError, isFirestorePermissionDenied } from '../for-both/cloud-database/handleLiveUpdateErrors';

const CARD_GAP = 16;
/** Kept for any layout/style references; prefer useWindowDimensions() inside components for live width. */
const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** Horizontal padding inside home stat ScrollViews — keep in sync with `styles.statsRowContent.paddingHorizontal` (20×2). */
const STATS_ROW_PAD_H = 40;
/** Gap between cards in stat rows — keep in sync with `styles.statsRowContent.gap`. */
const STATS_ROW_CARD_GAP = 12;


// vocab: Lottie = JSON-described vector animations (exported from After Effects) played natively.
// These are the "nothing logged yet" illustrations in the wellness row.
// Manipulate here: swap a path to change which animation shows for an empty metric.
const LOTTIE_SORENESS_EMPTY = require('../assets/sad reaction.json');
const LOTTIE_ENERGY_EMPTY = require('../assets/Run Hamster... run.json');
const LOTTIE_STRESS_EMPTY = require('../assets/Stressed Employee At Work.json');
const LOTTIE_NUTRITION_EMPTY = require('../assets/animations/legacy/Food squeeze_With Burger and hot dog.json');
const WORKOUT_EMPTY_ICON = require('../assets/icons/workout.png');


// user = the Firebase auth user; userData = their profile document; onRefetchUserData = ask LoginGate
// to re-read that profile (used after we change something on it, e.g. webLinks a trainer).
export default function ClientAppStart({ user, userData, onRefetchUserData }) {
  const { colors, spacing, isDark, themeMode } = useTheme();
  const t = getPremiumTheme(isDark, colors);

  // --- State: trainer relationship + viewers -------------------------------------------------
  // trainerData is the linked coach's profile (null = no coach yet, which changes large parts of
  // the home screen). trainerLinkError means "we think there's a link but couldn't establish it".
  const [trainerData, setTrainerData] = useState(null);
  const [trainerLinkError, setTrainerLinkError] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [notesAndFiles, setNotesAndFiles] = useState([]);
  // Each *Viewer below is one modal. They're objects rather than booleans because opening a viewer
  // also needs to carry WHAT to show — so a single setState both opens the modal and loads its content.
  const [pdfViewer, setPdfViewer] = useState({ visible: false, url: null, name: null });
  const [spreadsheetViewer, setSpreadsheetViewer] = useState({ visible: false, url: null, name: null, rows: null });
  const [documentViewer, setDocumentViewer] = useState({ visible: false, trainerId: null, documentId: null, title: null });
  const [mediaViewer, setMediaViewer] = useState({ visible: false, url: null, kind: 'image', name: null });
  const [embedWebViewer, setEmbedWebViewer] = useState({ visible: false, uri: null, title: null });
  const [pendingSessions, setPendingSessions] = useState([]);
  const [day6Client, setDay6Client] = useState(null);
  const [showRemoveTrainerPopup, setShowRemoveTrainerPopup] = useState(false);
  const [reviewPromptTrainer, setReviewPromptTrainer] = useState(null);
  const [showReviewSheetForPrompt, setShowReviewSheetForPrompt] = useState(false);

  // Inverted callback: the photo gallery screen registers its own "add photo" function here so the
  // bottom nav's "+" can trigger the gallery's picker. A ref (not state) because storing it must not
  // cause a re-render, and it's cleared when the gallery unmounts so "+" doesn't call a dead screen.
  const progressGalleryAddRef = useRef(null);
  const registerProgressPhotoAddHandler = useCallback((fn) => {
    progressGalleryAddRef.current = typeof fn === 'function' ? fn : null;
  }, []);

  // --- State: home screen data ---------------------------------------------------------------
  // `refreshing` drives pull-to-refresh; `loading` is the initial cold load, and while it's true the
  // shared boot overlay stays up so the user never sees a half-populated home screen.
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  useStartupLoadingCoverLock(loading);
  const [onboardingData, setOnboardingData] = useState(null);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  // Manipulate here: 2000 is the placeholder calorie goal shown before the real goal loads from the
  // user's profile — it's a display default, not the actual target.
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
  // Wellness metrics start as null rather than 0 on purpose: null means "not logged today" (shows
  // the empty-state Lottie), while 0 is a real answer the user chose.
  const [loadingStartTime, setLoadingStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  // Re-entrancy guard, not UI state: stops a second bootstrap from starting while one is mid-flight.
  // A ref because flipping it must not re-render.
  const isFetching = useRef(false);

  // The cold-load pipeline. It's a hook in its own file because it fills ~15 pieces of state at
  // once; passing the setters in keeps that logic out of this already-large component.
  loadHomeScreenData({
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

  // All "which panel is open" state and every open*/handle* function lives in this hook. The big
  // destructure below is just unpacking it — the shell object at the bottom republishes most of it
  // so screens can call these without importing the hook themselves.
  const nav = goToClientScreen({ refetchNutritionData });
  const {
    showTrainerMessaging,
    setShowTrainerMessaging,
    showConversationsList,
    setShowConversationsList,
    showMyDashboard,
    setShowMyDashboard,
    showAddFilePopup,
    setShowAddFilePopup,
    showTrainerSharedFilesPopup,
    setShowTrainerSharedFilesPopup,
    showFilesScreen,
    setShowFilesScreen,
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

  const { applyFromSnapshots } = keepDailyStatsFresh(user?.uid, {
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

  // Account switch safety net. This component can stay mounted across a user change, so every piece
  // of state is explicitly reset — otherwise the new user briefly sees the previous user's calories,
  // trainer, and files. Long and repetitive by design: anything missed here leaks between accounts.
  useEffect(() => {
    if (!user?.uid) return;
    
    console.log(`🔄 ClientAppStart: User changed to ${user.uid} - resetting state`);
    
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
      console.log('⚠️ Failed to clear cache in ClientAppStart:', e.message);
    });
  }, [user?.uid]);

  // Badge count for the messages icon. One listener on a precomputed index rather than counting
  // unread messages across conversations, which would mean many reads on every render.
  useEffect(() => {
    if (!user || !user.uid) return;

    // Rebuild the index first in case it drifted (messages written while the app was closed).
    // Fire-and-forget: the listener below will pick up the corrected numbers when it lands.
    rebuildUnreadIndexForUser(user.uid).catch(() => {});

    const unsubscribe = subscribeToUnreadCount(user.uid, (count) => {
      setUnreadMessageCount(count);
    });

    // Always detach Firestore listeners on unmount or they keep streaming (and billing) forever.
    return () => {
      unsubscribe();
    };
  }, [user]);

  // Heals a broken client↔trainer link.
  // Why this exists: the link is stored in two places — `trainerId` on the user doc (fast to read)
  // and a `trainer_clients` document (the real relationship). They can fall out of sync when a
  // request is accepted or rejected while the app is closed, so on mount we check and repair.
  useEffect(() => {
    if (!user?.uid || !db || userData?.role !== 'client') return;

    const reconcileTrainerId = async () => {
      try {
        const clientUid = user.uid;

        // Case 1: we think we have a trainer. Verify the relationship actually exists.
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
          // No link document. Two very different explanations, so look for evidence: did the
          // trainer REJECT the request (then we must forget them), or is the link merely missing
          // (then we should try to rebuild it)? A rejected request message is that evidence.
          const conversationId = `conv_${clientUid}_${userData.trainerId}`;
          const messagesRef = collection(db, 'messages');
          // vocab: query/where = Firestore's filter builder; limit(1) because we only need to know
          // whether ANY rejection exists, and fetching more would cost reads for nothing.
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
              // Rejected → scrub the stale trainer fields off the user doc.
              // vocab: deleteField() = Firestore's "remove this key entirely", as opposed to writing
              // null, which would leave the key present with an empty value.
              // Not an error state: being rejected is a normal outcome, so trainerLinkError stays false.
              await updateDoc(doc(db, 'users', clientUid), { trainerId: deleteField(), trainerName: deleteField(), trainerAssignedAt: deleteField() });
              setTrainerData(null);
              setTrainerLinkError(false);
              // Tell LoginGate to re-read the profile so `userData` here stops carrying the old trainerId.
              onRefetchUserData?.();
            }
            return;
          }
          // No link and no rejection → the link doc probably failed to write. Ask the server to
          // rebuild it: security rules don't let a client create that document itself, which is why
          // this has to go through a Cloud Function.
          if (functions) {
            try {
              // vocab: httpsCallable = call a Cloud Function like a normal async function, with the
              // user's auth token attached automatically.
              const linkClient = httpsCallable(functions, 'linkClientWithTrainerCode');
              await linkClient({ clientId: clientUid, trainerId: userData.trainerId });
              const trainerDoc = await getDoc(doc(db, 'users', userData.trainerId));
              if (trainerDoc.exists()) {
                setTrainerData({ id: trainerDoc.id, ...trainerDoc.data() });
              }
              setTrainerLinkError(false);
            } catch (linkErr) {
              // Rebuild refused (usually the trainer removed this client). Clear the fields and
              // flag it as an error — unlike the rejection path, this one is unexpected.
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

        // Case 2: no trainerId on the profile — but a trainer may have accepted us while the app was
        // closed. We can't query trainer_clients directly (rules forbid scanning other trainers'
        // collections), so we walk our own conversations and check each other participant for a link.
        const convsRef = collection(db, 'conversations');
        // vocab: 'array-contains' = match documents whose `participants` array includes this uid.
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
            // break: a client has at most one coach, so stop at the first confirmed link.
            break;
          }
        }
      } catch (error) {
        console.error('Reconcile trainerId:', error);
      }
    };

    reconcileTrainerId();
  }, [user?.uid, userData?.trainerId, userData?.role, onRefetchUserData]);

  // Live version of the reconcile above: watches the flat `trainer_client_links` collection so a
  // trainer accepting you updates the UI immediately, no refresh needed.
  // The collection is flat (rather than nested under each trainer) specifically so a client can
  // query it. The obvious alternative — collectionGroup('clients') filtered by documentId() — is
  // rejected by Firestore, which demands a full path for documentId() on a collection group and
  // throws an "odd number of segments" error on device.
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

        // Treat a missing/empty status as active: older link documents were written before the
        // status field existed, and excluding them would silently unlink long-standing clients.
        const activeDocs = snap.docs.filter((d) => {
          const st = d.data()?.status;
          if (st == null || st === '') return true;
          return st === 'active';
        });
        if (!activeDocs.length) {
          setTrainerData(null);
          return;
        }

        // Take the first active link — one coach per client.
        const linkDoc = activeDocs[0];
        const trainerUid = String(linkDoc.data()?.trainerId || '').trim();
        // Sanity guard: a link pointing at yourself is corrupt data and would make you your own coach.
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
          // Refuse to treat a non-trainer account as a coach even if a link points at them.
          if (tData?.role !== 'trainer') {
            setTrainerData(null);
            return;
          }
          setTrainerData({ id: trainerUid, ...tData });

          // Mirror the link back onto our own user doc so the fast path (userData.trainerId) agrees
          // with the live listener. Guarded by a comparison so we only write when it's actually
          // different — an unconditional write here would fire on every snapshot.
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
      (err) => logSnapshotError(err, 'trainer_client_links listener:'),
    );

    return () => {
      cancelled = true;
      try {
        unsub();
      } catch (_) {}
    };
  }, [db, user?.uid, userData?.role, onRefetchUserData]);

  // If a trainer accepts while the user is browsing "Find a Trainer", close that screen — they have
  // a coach now, and leaving the marketplace open invites them to request a second one.
  useEffect(() => {
    if (!trainerData?.id || !rootNavigationRef.isReady()) return;
    const route = rootNavigationRef.getCurrentRoute();
    if (route?.name === CLIENT_ROUTES.TrainerSearch) {
      rootGoBack();
    }
  }, [trainerData?.id, rootGoBack]);



  // Stopwatch showing how long the cold load has taken — a diagnostic for slow launches.
  useEffect(() => {
    let interval;
    if (loading && loadingStartTime) {
      // Manipulate here: ticks every 100ms but displays whole seconds (Math.floor(ms / 1000)). The
      // fast tick just keeps the displayed second from lagging behind the real one.
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - loadingStartTime) / 1000));
      }, 100);
    } else {
      setElapsedTime(0);
      setLoadingStartTime(null);
    }
    
    // Without this cleanup the interval keeps firing after loading ends and leaks a timer.
    return () => clearInterval(interval);
  }, [loading, loadingStartTime]);

  // When returning from dashboard, refetch soreness/energy/stress so the wellness row updates
  // When returning from dashboard we previously refetched soreness/energy/stress.
  // The dashboard is now always visible, so the wellness row is kept in sync via direct metric updates.

  // Push-notification token upkeep.
  // vocab: push token = the address the notification service uses to reach THIS install. It can be
  // issued before the user is signed in (so we stash it locally) and it can rotate at any time.
  useEffect(() => {
    if (!user?.uid || !db) return undefined;
    let cancelled = false;

    (async () => {
      try {
        // Confirm the user doc exists before writing a token onto it — for a brand-new account the
        // doc may not be created yet, and the write would fail.
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists() || cancelled) return;

        // Claim any token that was issued before sign-in and parked in local storage, then remove
        // the local copy so it isn't re-attached to a different account later.
        const pendingToken = await AsyncStorage.getItem(pendingPushTokenStorageKey(user.uid));
        if (pendingToken) {
          await persistPushTokensForUid(user.uid, pendingToken);
          await AsyncStorage.removeItem(pendingPushTokenStorageKey(user.uid));
        }
      } catch (e) {
        // vocab: __DEV__ = true only in development builds, so this noise never ships to users.
        if (__DEV__) console.warn('[push] pending token flush failed:', e?.message || e);
      }

      if (!cancelled) {
        // Refresh the current token. skipIfDisabled respects the user's notification setting —
        // without it we'd re-register someone who deliberately turned notifications off.
        persistPushTokensForUid(user.uid, { skipIfDisabled: true }).catch(() => {});
      }
    })();

    // Tokens can rotate while the app is backgrounded, so re-check every time it comes back.
    const unsubResume = subscribePushTokenRefreshOnResume(user.uid, () => true);
    return () => {
      cancelled = true;
      unsubResume();
    };
  }, [user?.uid]);

  // "What happens when the user taps a notification."
  // Stored in a ref so the handler registered with the notification system (further down, once) can
  // always call the LATEST version. Registering the function directly would freeze today's state and
  // navigation functions inside it forever — the classic stale-closure bug.
  const clientNotifTapRef = useRef(async () => {});

  useEffect(() => {
    clientNotifTapRef.current = async (data) => {
      try {
        if (!user?.uid || !data || typeof data !== 'object') return;
        // `type` is set by whatever sent the push; each branch below is one destination.
        // The repeated rootGoBack() calls are deliberate: this shell stacks panels, and a tap can
        // arrive with any number of them open, so we pop several times to get back to a known base
        // before opening the target. (Extra pops on an empty stack are safely ignored.)
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
          setShowTrainerSharedFilesPopup(true);
          return;
        }
        if (type === 'client_request_accepted') {
          onRefetchUserData?.();
          rootGoBack();
          rootGoBack();
          rootGoBack();
          setAiChatState(null);
          setShowTrainerMessaging(false);
          setShowConversationsList(false);
          setShowMyDashboard(true);
          return;
        }
        // Anything we don't have a specific destination for lands on the conversations list — the
        // safest generic place, since most unclassified notifications are message-adjacent.
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
        // A real message tap: load the conversation and open the thread directly.
        const convSnap = await getDoc(doc(db, 'conversations', conversationId));
        if (!convSnap.exists()) {
          setShowConversationsList(true);
          return;
        }
        const convData = convSnap.data();
        const participants = convData?.participants || [];
        // "The other person" = the participant who isn't us. Two-party conversations only.
        const otherId = participants.find((p) => p !== user.uid);
        // Start with just the id so the thread can render even if the profile fetch fails; the
        // enrichment below upgrades it to a full profile (name, photo) when it succeeds.
        let otherParticipant = otherId ? { id: otherId } : null;
        if (otherId) {
          try {
            const uSnap = await getDoc(doc(db, 'users', otherId));
            if (uSnap.exists()) otherParticipant = { id: uSnap.id, ...uSnap.data() };
          } catch (_) {
            /* keep minimal otherParticipant */
          }
        }
        // Close everything else, then open the thread. Setting the conversation and participant
        // BEFORE flipping showTrainerMessaging avoids a frame of empty chat.
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
        // Any failure still lands somewhere useful rather than leaving the tap doing nothing.
        setShowConversationsList(true);
      }
    };
  }, [user?.uid]);

  // Register the tap handler exactly once. The arrow function reads through the ref each time it
  // fires, which is what keeps it current even though this effect never re-runs.
  useEffect(() => {
    setNotificationTapHandler((d) => {
      clientNotifTapRef.current?.(d);
    });
    return () => setNotificationTapHandler(null);
  }, []);

  // Handles the notification that LAUNCHED the app from a cold start. That tap happened before any
  // handler existed, so it's queued and replayed here.
  // Manipulate here: 650ms delay gives the navigator time to mount — replay too early and the
  // navigation is dropped.
  useEffect(() => {
    if (!user?.uid) return undefined;
    return flushInitialNotificationResponse(650);
  }, [user?.uid]);

  // Notes & Files live in the same subcollection the trainer writes to, so one realtime listener
  // covers both the client's own uploads and anything the coach shares.
  useEffect(() => {
    if (!user?.uid || !db) {
      setNotesAndFiles([]);            
      return;
    }
    const notesRef = collection(db, 'users', user.uid, 'notes_and_files');
    const unsubscribe = onSnapshot(
      notesRef,
      // The snapshot argument is ignored on purpose: we use the listener purely as a "something
      // changed" ping and then re-fetch through getNotesAndFiles, which also resolves download URLs
      // and trainer metadata that the raw documents don't contain.
      async () => {
        try {
          const list = await getNotesAndFiles(user.uid);
          setNotesAndFiles(list);
        } catch {
          setNotesAndFiles([]);
        }
      },
      (err) => logSnapshotError(err, 'Client notes_and_files listener:'),
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
    // Manipulate here: limit(5) caps how many pending invites the home card shows.
    // date >= todayKey hides invites that already passed.
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
      // Sort chronologically by concatenating date + time into one comparable string. This works
      // only because both are zero-padded fixed-width values ('2026-09-13' + '09:30'), so plain
      // text comparison happens to match chronological order — no Date parsing needed.
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
        logSnapshotError(err, 'Client pending sessions listener:');
        // Permission denied = the trainer link was removed. Not recoverable here, so just empty the
        // list rather than retrying.
        if (isFirestorePermissionDenied(err)) {
          setPendingSessions([]);
          return;
        }
        // vocab: composite index = Firestore requires a pre-built index for any query filtering on
        // several fields at once (here: clientId + status + date). If it hasn't been created in the
        // console yet, the query fails with failed-precondition. Firebase words this error a few
        // different ways, hence checking the code AND two message shapes.
        const msg = String(err?.message || '');
        const needsIndex =
          err?.code === 'failed-precondition' ||
          msg.toLowerCase().includes('requires an index') ||
          msg.toLowerCase().includes('create_composite');

        // Fallback: a single-field query needs no composite index, so fetch a wider set and do the
        // status/date filtering in JS. Costs a few extra reads but keeps the feature working
        // immediately instead of showing nothing until someone creates the index.
        if (needsIndex) {
          try {
            // Manipulate here: 15 is deliberately larger than the 5 we display, because the
            // status/date filtering happens after the fetch — too small a limit could return 15
            // past sessions and leave the card empty.
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

  // Accept/decline a session invite, then tell the trainer about it.
  // Note the ordering: the Firestore write happens first and the push is best-effort after — the
  // trainer's calendar must be correct even if the notification never sends.
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
        // Manipulate here: this phrasing is what the trainer sees in the push banner.
        const verb =
          status === 'accepted' ? 'accepted' : status === 'declined' ? 'declined' : 'updated';
        // vocab/symbol: `void <promise>` = "start this and explicitly don't wait for it" — it marks
        // the fire-and-forget as intentional rather than a forgotten await.
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
    <AddFilePopup
      visible={showAddFilePopup}
      onClose={() => setShowAddFilePopup(false)}
      onAdded={refreshNotesAndFiles}
      isDark={isDark}
    />
  );

  // One Firestore list feeds two UI sections, split here by who added the item.
  // Trainer-shared: explicitly tagged as from the trainer, OR a document that carries a trainerId
  // (older shares predate the addedBy field).
  const trainerSharedFiles = useMemo(
    () =>
      (notesAndFiles || []).filter(
        (x) => x.addedBy === 'trainer' || (x.type === 'document' && x.trainerId),
      ),
    [notesAndFiles],
  );

  // The client's own uploads (added via the "+" button).
  // Two exclusions: notes render in their own section, and `addedBy || 'client'` treats untagged
  // legacy rows as client-owned — with the second condition re-excluding trainer documents that
  // would otherwise slip through that default.
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
    // Hard guard: a client may only delete their own uploads. Deleting a trainer's shared file
    // would also fail at the security-rules layer, but refusing here avoids a confusing error.
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
      // Sequential rather than Promise.all: each delete touches both Cloud Storage and Firestore,
      // and firing 50 of those at once gets rate-limited. Slower, but it actually finishes.
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

  // Router for "the user tapped a file". Every branch ends in a `return`, so the order below IS the
  // precedence: trainer-authored content first (it needs a server lookup to resolve), then explicit
  // types, then guesses based on the file extension, then a generic web viewer as the last resort.
  const openNotesFile = useCallback((file) => {
    // Trainer spreadsheet/document: the row only stores ids, so we have to ask the server what it
    // actually is before we know which viewer to open.
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
          // A spreadsheet can arrive two ways: as parsed rows (render natively, best experience) or
          // as a stored file URL (render from the download). Prefer rows when they have content —
          // an empty rows array means the parse produced nothing, so fall through to the URL.
          if (packSpreadsheetRowsHaveContent(res.rows)) {
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
    // From here down we're guessing from the filename/extension, so order matters: image, then
    // video, then PDF, and finally an embedded web view for anything still unrecognized.
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

  // Pull-to-refresh on the home screen.
  const onRefresh = async () => {
    setRefreshing(true);
    refreshNotesAndFiles();
    if (user?.uid && db) {
      try {
        const todayKey = getLocalDateKey();
        // vocab: Promise.all = run both reads at the same time and wait for both. Sequential awaits
        // here would double the time the spinner stays up for no benefit.
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

  // The price label on the coaching payment card.
  const coachingRateLabel = useMemo(() => {
    // The rate agreed with THIS client wins over the trainer's public price.
    const rate = userData?.monthlyRate;
    if (rate != null && rate !== '') {
      const n = Number(rate);
      if (Number.isFinite(n) && n > 0) {
        // Historical data mess: some rates are stored in cents (12000) and some in dollars (120).
        // The >= 100 heuristic disambiguates them — it assumes nobody charges $100+/month as cents
        // and nobody charges under $1. Then: whole numbers print as $120, others as $99.50.
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

  // Trainer's display name, hunting through every field shape profiles have used over time and
  // falling back to generic copy so the payment sheet never shows "undefined".
  const coachingTrainerName = useMemo(() => {
    const tr = trainerData;
    if (!tr) return 'Your trainer';
    const first = tr.firstName || tr.givenName;
    const last = tr.lastName || tr.familyName;
    if (first || last) return `${first ?? ''} ${last ?? ''}`.trim();
    return tr.displayName || tr.name || 'Your trainer';
  }, [trainerData]);

  // "Request this coach" from the marketplace.
  // Throws (rather than returning a flag) so the calling screen can show the message in its own
  // error UI — each string below is user-facing copy.
  const requestTrainerConnection = useCallback(
    async (trainer, { clientIntro } = {}) => {
      const clientId = user?.uid;
      const trainerId = trainer?.id || trainer?.uid;
      if (!clientId) throw new Error('Please log in first.');
      if (!trainerId) throw new Error('Trainer not found.');
      // One coach at a time. Requesting a second would create a conflicting link the reconcile
      // effects above would then fight over.
      if (trainerData?.id && String(trainerData.id) !== String(trainerId)) {
        throw new Error('You already have a coach. Open your dashboard to message them.');
      }
      // Requests ride on the messaging system, so a conversation must exist first (created if needed).
      const conversationId = await getOrCreateConversation(clientId, trainerId);
      // The onboarding answers are attached so the trainer can judge the request without asking a
      // round of questions. Each field has several possible names across profile versions, hence the
      // || chains, and every one ends in a readable default rather than blank.
      await sendClientRequest(conversationId, clientId, clientIntro || '', {
        clientName: userData?.firstName || user?.displayName || 'Client',
        clientGoals: onboardingData?.goal || onboardingData?.primaryGoal || 'Not specified',
        clientExperienceLevel: onboardingData?.fitnessLevel || onboardingData?.experience || 'Beginner',
        clientEquipment: onboardingData?.equipment || onboardingData?.availableEquipment || 'Not specified',
        clientLimitations: onboardingData?.injuries || onboardingData?.limitations || 'None',
      });
    },
    [user?.uid, user?.displayName, userData, onboardingData, trainerData?.id],
  );

  // IMPORTANT: no early `return` above this point. React requires hooks to run in the same order on
  // every render, so the `if (loading)` bail-out has to stay below the last hook (the shell useMemo).

  // Navigation handlers given to the AI chat screen. Each one clears aiChatState first: the chat is
  // an overlay, and navigating away without closing it would leave it floating over the destination.
  const aiChatNavHandlers = {
    onHomePress: () => {
      setAiChatState(null);
      handleHomePress();
    },
    onPlusPress: () => setShowAddFilePopup(true),
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
    // Called by the AI coach when it decides to show the user a plan ("open my workout plan").
    // Unlike the other handlers it returns { success, message } — that message is spoken back to the
    // user by the assistant, which is why every failure path returns readable copy instead of throwing.
    onOpenWorkoutPlan: async ({ planId = 'current', title, todayPreview } = {}) => {
      const uid = user?.uid;
      if (!uid) return { success: false, message: 'Please sign in again.' };
      try {
        let planData = null;
        // 'current' is a keyword, not a document id — it means "whichever plan is active now".
        if (planId === 'current') {
          const current = await getCurrentWorkoutPlan(uid);
          if (current) planData = { id: 'current', ...current };
        } else {
          const snap = await getDoc(doc(db, 'users', uid, 'workoutPlans', planId));
          if (snap.exists()) planData = { id: planId, ...snap.data() };
        }
        // Plans have been stored in three shapes over time; if none of them is present there's
        // nothing the viewer could render, so treat it as "not found".
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

  // Display values derived from whatever data has loaded. Profile name first, then the auth
  // display name, then the onboarding answer, then a neutral default — so the greeting is never blank.
  const userName = userData?.firstName || user?.displayName || onboardingData?.name || 'User';
  const userRole = userData?.role || 'client';
  // vocab/symbol: !! = coerce to a real boolean, so children get `false` rather than `null`.
  const hasTrainer = !!trainerData;

  // Reshapes workout data into the flat { name, exercises, workoutName } rows TrainingAgenda expects.
  // Three-way fallback: today's actual workout → the dashboard's one-line summary → nothing at all.
  const agendaWorkouts = todayWorkout
    ? [
        {
          name: todayWorkout.name,
          // Exercises arrive either as plain strings (older/AI-generated plans) or as objects with
          // sets. This map flattens both into display strings like "Bench Press (8×135, 8×145)".
          exercises: Array.isArray(todayWorkout.exercises)
            ? todayWorkout.exercises
                .map((ex) => {
                  if (typeof ex === 'string') return ex;
                  const label = ex?.name || ex?.exerciseName || '';
                  // No name = unusable row; return '' and let the .filter(Boolean) below drop it.
                  if (!label) return '';
                  if (Array.isArray(ex.sets) && ex.sets.length > 0) {
                    const setsSummary = ex.sets
                      .map((s) => {
                        // Manipulate here: these three lines are the set label formats —
                        // both values → "8×135", reps only → "8 reps", weight only → "135".
                        const reps = s.reps != null ? s.reps : '';
                        const weight = s.weight != null ? s.weight : '';
                        if (reps && weight) return `${reps}×${weight}`;
                        if (reps) return `${reps} reps`;
                        if (weight) return `${weight}`;
                        return '';
                      })
                      // vocab: .filter(Boolean) = drop every falsy entry, i.e. remove the '' rows
                      // the map produced for unusable data.
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

  // The three headline macros on the nutrition card. Always shown, even at 0.
  // Manipulate here: the icon/label pairs and the `g` unit suffix are the card's copy.
  const nutritionMacros = [
    { icon: require('../assets/icons/Protein.png'), label: "Protein", value: `${Math.round(macroTotals.protein)}g` },
    { icon: require('../assets/icons/Carbs.png'), label: "Carbs", value: `${Math.round(macroTotals.carbs)}g` },
    { icon: require('../assets/icons/Fats.png'), label: "Fats", value: `${Math.round(macroTotals.fats || 0)}g` },
  ];

  console.log(`📊 Nutrition macros being passed to card:`, nutritionMacros.map(m => ({ label: m.label, value: m.value })));
  console.log(`🎯 Current nutrition goals:`, nutritionGoals);

  // Secondary nutrients, each added only when it's actually above zero — a row of "0g" everywhere
  // is noise, so the card grows as the user logs more detailed food data.
  // Manipulate here: the emoji icons, labels, and units (g vs mg) are all display copy.
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

  // THE handoff. Everything above — data, panel flags, open*/handle* functions, viewers — is bundled
  // into one object and published through ClientAppStartShellProvider, so any screen can pull what it
  // needs from context instead of having props threaded down through the navigator.
  // Wrapped in useMemo because a new object identity on every render would re-render every consumer
  // of that context, i.e. the whole client app. Note the dependency array below is intentionally
  // shorter than the object: setter functions and useCallback'd handlers are already stable, so
  // listing them would add noise without changing when this recomputes.
  const shell = useMemo(() => ({
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
    showAddFilePopup,
    setShowAddFilePopup,
    showTrainerSharedFilesPopup,
    setShowTrainerSharedFilesPopup,
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
    showRemoveTrainerPopup,
    setShowRemoveTrainerPopup,
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
    requestTrainerConnection,
    setSoreness,
    setEnergyLevel,
    setStressLevel,
    setWaterIntake,
    setSleepHours,
    setTodayWorkout,
    setDashboardWorkoutSummary,
  }), [
    user,
    userData,
    onRefetchUserData,
    isDark,
    styles,
    colors,
    themeMode,
    navProviderProps,
    addNotesFilesModalEl,
    aiChatNavHandlers,
    mainTab,
    mainTabActiveKey,
    nutritionTabFocusNonce,
    workoutTabFocusNonce,
    showTrainerMessaging,
    showConversationsList,
    showMyDashboard,
    showCoachingPaymentModal,
    showAddFilePopup,
    showTrainerSharedFilesPopup,
    trainerData,
    unreadMessageCount,
    notesAndFiles,
    selectedTrainer,
    selectedConversation,
    aiChatState,
    userName,
    userRole,
    hasTrainer,
    onboardingData,
    todayWorkout,
    waterIntake,
    sleepHours,
    refreshing,
    pendingSessions,
    dashboardWorkoutSummary,
    pdfViewer,
    spreadsheetViewer,
    documentViewer,
    mediaViewer,
    embedWebViewer,
    showRemoveTrainerPopup,
    reviewPromptTrainer,
    showReviewSheetForPrompt,
  ]);

  // Cold load: blank themed background while the boot overlay (locked above) covers the screen.
  if (loading) {
    return <View style={{ flex: 1, backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF' }} />;
  }

  return (
    <ClientAppStartShellProvider value={shell}>
      {/* CrashCatcher catches a render crash anywhere in the navigator and shows a fallback instead
          of a white screen. It wraps the navigator specifically so the payment modal below survives. */}
      <CrashCatcher>
        {/* The actual screens. The ref is the global openScreenFromAnywhere, which is how non-React code
            (notification taps, the auth listener) can navigate; `webLinks` wires up deep links. */}
        <NavigationContainer ref={rootNavigationRef} webLinks={clientLinking}>
          <ClientScreenList />
        </NavigationContainer>
      </CrashCatcher>

      {/* Coaching payment sheet. It lives OUTSIDE the NavigationContainer so it can cover the whole
          app (including the tab bar) and stay up regardless of which screen is underneath. */}
      <Modal
        visible={showCoachingPaymentModal}
        // transparent = the modal's own background is see-through, so the dimming layer below is
        // what darkens the app behind the sheet.
        transparent
        animationType="slide"
        // Android hardware back button. Without this, back does nothing and the sheet traps the user.
        onRequestClose={closeCoachingPayment}
      >
        {/* Card fields sit near the bottom, so the sheet has to lift when the keyboard opens.
            iOS and Android need different strategies for that, hence the platform check. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          // justifyContent 'flex-end' is what pins the sheet to the bottom of the screen.
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          {/* Tap-outside-to-close scrim. activeOpacity={1} stops it flashing on press — it's a
              backdrop, not a button, so it shouldn't look tappable.
              Manipulate here: rgba(0,0,0,0.55) is how dark the app behind the sheet goes. */}
          <TouchableOpacity
            style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' }}
            activeOpacity={1}
            onPress={closeCoachingPayment}
          />
          {/* overflow: 'hidden' is what actually clips the payment form's square corners to these
              rounded top corners — without it the radius has no visible effect. */}
          <View
            style={{
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: 'hidden',
            }}
          >
            {/* Three sources for the trainer id (live data, alternate field name, the profile copy)
                because the payment can be opened before trainerData has loaded. */}
            <PayTrainerPopup
              trainerId={trainerData?.id || trainerData?.uid || userData?.trainerId || ''}
              trainerName={coachingTrainerName}
              onClose={closeCoachingPayment}
              // Re-read the profile after paying: the server flips subscription/billing fields on
              // the user doc, and without this refetch the UI would keep showing "unpaid".
              onSuccess={() => {
                onRefetchUserData?.();
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ClientAppStartShellProvider>
  );
}