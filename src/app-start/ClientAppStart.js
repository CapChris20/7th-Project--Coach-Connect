// The client app shell: owns a client's data and which panel is on screen.
// Flow: LoginGate mounts this → load profile, trainer, and home data → screens read one shell.
// Used by LoginGate after a client signs in.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import DailyLogContent from '../nutrition/daily-log/DailyLogContent';
import AddFilePopup from '../for-both/files-and-notes/viewers/AddFilePopup';
import { useStartupLoadingCoverLock } from '../for-both/loading-and-header/StartupLoadingCover';
import TopHeader from '../for-both/loading-and-header/TopHeader';
import DailyQuoteCard, { DailyQuotePill } from '../for-both/home-cards/DailyQuoteCard';
import DocumentViewer from '../for-both/files-and-notes/viewers/DocumentViewer';
import CoachingPaymentScreen from '../settings/CoachingPaymentScreen';
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
import NbNoticeSheet from '../look-and-feel/NbNoticeSheet';
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
import { lightColors } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: default calorie ring goal when profile has none.

const DEFAULT_CALORIE_GOAL = 2000;
const MILLISECONDS_PER_SECOND = 1000;
// Manipulate here: cold-load stopwatch tick (ms) — lower = smoother second display, more wakeups
const LOADING_ELAPSED_TICK_MS = 100;
// Manipulate here: payment sheet top corners (matches Nb sheet chrome)
const PAYMENT_SHEET_TOP_RADIUS = 24;

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


// Empty macro totals object used when resetting or seeding home nutrition state.
// ===== HELPER FUNCTIONS =====

// ----- optional-field readers (plain ifs — no optional chaining in callers) -----

function uidFromUser(user) {
  if (!user) return null;
  return user.uid;
}

function displayNameFromUser(user) {
  if (!user) return null;
  return user.displayName;
}

function roleFromUserData(userData) {
  if (!userData) return null;
  return userData.role;
}

function trainerIdFromUserData(userData) {
  if (!userData) return null;
  return userData.trainerId;
}

function firstNameFromUserData(userData) {
  if (!userData) return null;
  return userData.firstName;
}

function monthlyRateFromUserData(userData) {
  if (!userData) return null;
  return userData.monthlyRate;
}

function sessionRateFromUserData(userData) {
  if (!userData) return null;
  return userData.sessionRate;
}

function idFromTrainerData(trainerData) {
  if (!trainerData) return null;
  return trainerData.id;
}

function uidFromTrainerData(trainerData) {
  if (!trainerData) return null;
  return trainerData.uid;
}

function pricingFromTrainerData(trainerData) {
  if (!trainerData) return null;
  return trainerData.pricing;
}

function sessionRateFromTrainerData(trainerData) {
  if (!trainerData) return null;
  return trainerData.sessionRate;
}

function monthlyRateFromTrainerData(trainerData) {
  if (!trainerData) return null;
  return trainerData.monthlyRate;
}

function pricingPerSession(trainerData) {
  const pricing = pricingFromTrainerData(trainerData);
  if (!pricing) return null;
  return pricing.perSession;
}

function pricingMonthly(trainerData) {
  const pricing = pricingFromTrainerData(trainerData);
  if (!pricing) return null;
  return pricing.monthly;
}

function pricingPerMonth(trainerData) {
  const pricing = pricingFromTrainerData(trainerData);
  if (!pricing) return null;
  return pricing.perMonth;
}

function messageFromCaughtError(caughtError) {
  if (!caughtError) return '';
  if (caughtError.message) return caughtError.message;
  return String(caughtError);
}

function nameFromFileRow(fileRow) {
  if (!fileRow) return null;
  return fileRow.name;
}

function titleFromFileRow(fileRow) {
  if (!fileRow) return null;
  return fileRow.title;
}

function urlFromFileRow(fileRow) {
  if (!fileRow) return null;
  return fileRow.url;
}

function typeFromFileRow(fileRow) {
  if (!fileRow) return null;
  return fileRow.type;
}

function documentIdFromFileRow(fileRow) {
  if (!fileRow) return null;
  return fileRow.documentId;
}

function trainerIdFromFileRow(fileRow) {
  if (!fileRow) return null;
  return fileRow.trainerId;
}

function idFromFileRow(fileRow) {
  if (!fileRow) return null;
  return fileRow.id;
}

function callIfFunction(fn, ...args) {
  if (typeof fn !== 'function') return undefined;
  return fn(...args);
}

function statusFromLinkDocData(linkDoc) {
  if (!linkDoc) return undefined;
  const data = linkDoc.data();
  if (!data) return undefined;
  return data.status;
}

function trainerIdFromLinkDocData(linkDoc) {
  if (!linkDoc) return '';
  const data = linkDoc.data();
  if (!data) return '';
  return data.trainerId || '';
}

function nutritionMacroLogLines(nutritionMacros) {
  const lines = [];
  for (const macroRow of nutritionMacros) {
    lines.push({ label: macroRow.label, value: macroRow.value });
  }
  return lines;
}


function emptyMacroTotals() {
  return { protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, potassium: 0 };
}

function bootScreenBackground(isDark) {
  if (isDark) return '#0A0A0A';
  return lightColors.white;
}

function keyboardAvoidBehavior() {
  if (Platform.OS === 'ios') return 'padding';
  return 'height';
}

// Prefer linked coach id fields; fall back to the client's trainerId on their profile.
function trainerUidForClientShell(trainerData, userData) {
  return idFromTrainerData(trainerData) || uidFromTrainerData(trainerData) || trainerIdFromUserData(userData) || '';
}

function coachingPaymentUserData(userData, trainerData, shellUserUid) {
  return {
    ...(userData || {}),
    uid: shellUserUid || (userData ? userData.uid : undefined),
    id: shellUserUid || (userData ? userData.id : undefined),
    sessionRate:
      sessionRateFromUserData(userData) ||
      sessionRateFromTrainerData(trainerData) ||
      pricingPerSession(trainerData) ||
      null,
    monthlyRate:
      monthlyRateFromUserData(userData) ||
      monthlyRateFromTrainerData(trainerData) ||
      pricingMonthly(trainerData) ||
      null,
  };
}

function formatOneExerciseSetLabel(setRow) {
  // Manipulate here: both values → "8×135", reps only → "8 reps", weight only → "135".
  const reps = setRow.reps != null ? setRow.reps : '';
  const weight = setRow.weight != null ? setRow.weight : '';
  if (reps && weight) return `${reps}×${weight}`;
  if (reps) return `${reps} reps`;
  if (weight) return `${weight}`;
  return '';
}

function formatExerciseDisplayLine(exercise) {
  if (typeof exercise === 'string') return exercise;
  const label = (exercise ? exercise.name : undefined) || (exercise ? exercise.exerciseName : undefined) || '';
  if (!label) return '';
  if (!Array.isArray(exercise.sets) || exercise.sets.length === 0) return label;

  const setLabels = [];
  for (const setRow of exercise.sets) {
    const setLabel = formatOneExerciseSetLabel(setRow);
    if (setLabel) setLabels.push(setLabel);
  }
  if (setLabels.length === 0) return label;
  return `${label} (${setLabels.join(', ')})`;
}

function exerciseLinesFromTodayWorkout(todayWorkout) {
  if (!Array.isArray(todayWorkout.exercises)) return todayWorkout.exercises;
  const lines = [];
  for (const exercise of todayWorkout.exercises) {
    const line = formatExerciseDisplayLine(exercise);
    if (line) lines.push(line);
  }
  return lines;
}

// Reshape workout data into the flat { name, exercises, workoutName } rows TrainingAgenda expects.
function buildAgendaWorkouts(todayWorkout, dashboardWorkoutSummary) {
  if (todayWorkout) {
    return [
      {
        name: todayWorkout.name,
        exercises: exerciseLinesFromTodayWorkout(todayWorkout),
        sets: null,
        reps: 0,
        workoutName: todayWorkout.name,
      },
    ];
  }
  if (dashboardWorkoutSummary) {
    return [
      {
        name: dashboardWorkoutSummary,
        exercises: null,
        sets: null,
        reps: null,
        workoutName: dashboardWorkoutSummary,
      },
    ];
  }
  return [];
}

function buildNutritionMacroRows(macroTotals) {
  // Manipulate here: the icon/label pairs and the `g` unit suffix are the card's copy.
  return [
    { icon: require('../assets/icons/Protein.png'), label: 'Protein', value: `${Math.round(macroTotals.protein)}g` },
    { icon: require('../assets/icons/Carbs.png'), label: 'Carbs', value: `${Math.round(macroTotals.carbs)}g` },
    { icon: require('../assets/icons/Fats.png'), label: 'Fats', value: `${Math.round(macroTotals.fats || 0)}g` },
  ];
}

function buildAdditionalNutrientRows(macroTotals) {
  // Manipulate here: emoji icons, labels, and units (g vs mg) are all display copy.
  const rows = [];
  if (macroTotals.fiber > 0) {
    rows.push({ icon: '🌾', label: 'Fiber', value: `${Math.round(macroTotals.fiber)}g` });
  }
  if (macroTotals.sugar > 0) {
    rows.push({ icon: '🍯', label: 'Sugar', value: `${Math.round(macroTotals.sugar)}g` });
  }
  if (macroTotals.sodium > 0) {
    rows.push({ icon: '🧂', label: 'Sodium', value: `${Math.round(macroTotals.sodium)}mg` });
  }
  if (macroTotals.potassium > 0) {
    rows.push({ icon: '🥔', label: 'Potassium', value: `${Math.round(macroTotals.potassium)}mg` });
  }
  return rows;
}

function isTrainerSharedFileRow(fileRow) {
  if (fileRow.addedBy === 'trainer') return true;
  if (fileRow.type === 'document' && fileRow.trainerId) return true;
  return false;
}

function isClientOwnedFileRow(fileRow) {
  if (fileRow.type === 'note') return false;
  const addedBy = fileRow.addedBy || 'client';
  if (addedBy !== 'client') return false;
  if (fileRow.type === 'document' && fileRow.trainerId && fileRow.documentId) return false;
  return true;
}

function dollarsLabelFromMonthlyRate(rate) {
  if (rate == null || rate === '') return null;
  const rateAmount = Number(rate);
  if (!Number.isFinite(rateAmount) || rateAmount <= 0) return null;
  // Some stored rates are cents (12000) and some are dollars (120). 100 is the split.
  const dollars = rateAmount >= 100 ? rateAmount / 100 : rateAmount;
  if (dollars % 1 === 0) return `$${dollars.toFixed(0)}`;
  return `$${dollars.toFixed(2)}`;
}

function coachingRateLabelFromProfiles(userData, trainerData) {
  const fromClient = dollarsLabelFromMonthlyRate(monthlyRateFromUserData(userData));
  if (fromClient) return fromClient;
  const pricing = pricingFromTrainerData(trainerData);
  if ((pricing ? pricing.perMonth : undefined) != null && pricing.perMonth !== '') {
    return `$${pricing.perMonth}`;
  }
  return null;
}

function coachingTrainerDisplayName(trainerRecord) {
  if (!trainerRecord) return 'Your trainer';
  const first = trainerRecord.firstName || trainerRecord.givenName;
  const last = trainerRecord.lastName || trainerRecord.familyName;
  if (first || last) return `${first ?? ''} ${last ?? ''}`.trim();
  return trainerRecord.displayName || trainerRecord.name || 'Your trainer';
}

function queryNeedsCompositeIndex(err) {
  // vocab: composite index = Firestore requires a pre-built index for multi-field filters.
  const msg = String((err ? err.message : undefined) || '');
  if ((err ? err.code : undefined) === 'failed-precondition') return true;
  if (msg.toLowerCase().includes('requires an index')) return true;
  if (msg.toLowerCase().includes('create_composite')) return true;
  return false;
}

function filterPendingSessionsClientSide(allSessions, todayKey) {
  const pendingOnly = [];
  for (const session of allSessions) {
    const status = session.status || 'pending';
    if (status !== 'pending') continue;
    if (String(session.date || '') < String(todayKey)) continue;
    pendingOnly.push(session);
  }
  pendingOnly.sort((left, right) => {
    const leftKey = String(left.date) + String(left.time);
    const rightKey = String(right.date) + String(right.time);
    return leftKey.localeCompare(rightKey);
  });
  return pendingOnly.slice(0, 5);
}

function openSpreadsheetViewerFromResolve(res, file, setSpreadsheetViewer, showNotice) {
  const name = titleFromFileRow(file) || nameFromFileRow(file) || res.title || 'Spreadsheet';
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
  showNotice('Spreadsheet unavailable', 'Your coach may have removed this spreadsheet.');
}

function openTrainerPackagedFile(file, setters) {
  const { setDocumentViewer, setSpreadsheetViewer, showNotice } = setters;
  resolveTrainerSpreadsheetView(file.trainerId, file.documentId)
    .then((res) => {
      if (!res) {
        if (typeFromFileRow(file) === 'document' || documentIdFromFileRow(file)) {
          setDocumentViewer({
            visible: true,
            trainerId: file.trainerId,
            documentId: file.documentId,
            title: file.title || 'Document',
          });
          return;
        }
        showNotice('Spreadsheet unavailable', 'Your coach may have removed this spreadsheet.');
        return;
      }
      openSpreadsheetViewerFromResolve(res, file, setSpreadsheetViewer, showNotice);
    })
    .catch(() => {
      showNotice('Spreadsheet unavailable', 'Could not load this spreadsheet.');
    });
}

function openLocalNotesFileByType(file, setters) {
  const {
    setSpreadsheetViewer,
    setDocumentViewer,
    setMediaViewer,
    setPdfViewer,
    setEmbedWebViewer,
  } = setters;

  if (typeFromFileRow(file) === 'spreadsheet' && file.url) {
    setSpreadsheetViewer({
      visible: true,
      url: file.url,
      name: nameFromFileRow(file) || 'Spreadsheet',
      rows: null,
    });
    return true;
  }
  if (typeFromFileRow(file) === 'document' || (documentIdFromFileRow(file) && trainerIdFromFileRow(file))) {
    setDocumentViewer({
      visible: true,
      trainerId: file.trainerId,
      documentId: file.documentId,
      title: file.title || 'Document',
    });
    return true;
  }
  if (urlFromFileRow(file) && isNotesImageFile(file)) {
    setMediaViewer({
      visible: true,
      url: file.url,
      kind: 'image',
      name: nameFromFileRow(file) || titleFromFileRow(file) || 'Photo',
    });
    return true;
  }
  if (urlFromFileRow(file) && isNotesVideoFile(file)) {
    setMediaViewer({
      visible: true,
      url: file.url,
      kind: 'video',
      name: nameFromFileRow(file) || titleFromFileRow(file) || 'Video',
    });
    return true;
  }
  if (urlFromFileRow(file) && isNotesPdfFile(file, file.url)) {
    setPdfViewer({ visible: true, url: file.url, name: nameFromFileRow(file) || 'Document' });
    return true;
  }
  if (urlFromFileRow(file)) {
    setEmbedWebViewer({
      visible: true,
      uri: getEmbedViewerUri(file, file.url),
      title: file.name || file.title || 'Document',
    });
    return true;
  }
  return false;
}


function ClientAppShellLayout({
  loading,
  isDark,
  shell,
  showCoachingPaymentModal,
  closeCoachingPayment,
  trainerData,
  userData,
  coachingTrainerName,
  onRefetchUserData,
}) {
  if (loading) {
    const bootBackground = bootScreenBackground(isDark);
    return <View style={{ flex: 1, backgroundColor: bootBackground }} />;
  }

  const keyboardBehavior = keyboardAvoidBehavior();
  const trainerId = trainerUidForClientShell(trainerData, userData);
  const shellUserUid = (shell ? shell.uidFromUser : undefined)(user);
  const paymentUserData = coachingPaymentUserData(userData, trainerData, shellUserUid);
  const noticeVisible = !!shell.notice;
  const noticeTitle = shell.(notice ? notice.title : undefined) || '';
  const noticeConfirmLabel = shell.(notice ? notice.confirmLabel : undefined) || 'OK';
  const removeTrainerVisible = !!shell.showRemoveTrainerPopup;
  const removeTrainerDisplayName = shell.(trainerData ? trainerData.displayName : undefined) || shell.(trainerData ? trainerData.name : undefined);
  const removeClientDisplayName = shell.displayNameFromUser(user) || shell.firstNameFromUserData(userData);
  const sheetLiftStyle = { flex: 1, justifyContent: 'flex-end' };
  // Manipulate here: rgba(0,0,0,0.55) is how dark the app behind the sheet goes.
  const scrimStyle = { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' };
  const paymentSheetFrameStyle = {
    borderTopLeftRadius: PAYMENT_SHEET_TOP_RADIUS,
    borderTopRightRadius: PAYMENT_SHEET_TOP_RADIUS,
    overflow: 'hidden',
  };

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
        <KeyboardAvoidingView behavior={keyboardBehavior} style={sheetLiftStyle}>
          {/* Tap-outside-to-close scrim. activeOpacity={1} stops it flashing on press — it's a
              backdrop, not a button, so it shouldn't look tappable. */}
          <TouchableOpacity
            style={scrimStyle}
            activeOpacity={1}
            onPress={closeCoachingPayment}
          />
          {/* overflow: 'hidden' is what actually clips the payment form's square corners to these
              rounded top corners — without it the radius has no visible effect. */}
          <View style={paymentSheetFrameStyle}>
            {/* Design Law Coaching payment (PNG 07/08). Card charge form opens from Update / Add. */}
            <CoachingPaymentScreen
              trainerId={trainerId}
              trainerName={coachingTrainerName}
              userData={paymentUserData}
              onClose={closeCoachingPayment}
              onSuccess={() => {
                callIfFunction(onRefetchUserData);
              }}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Remove-trainer sheet lives outside the navigator (same idea as PayTrainerPopup) so Dashboard
          and Settings can both open it without fighting the stack. */}
      <NbNoticeSheet
        visible={noticeVisible}
        onClose={() => callIfFunction(shell.dismissNotice)}
        title={noticeTitle}
        message={shell.(notice ? notice.message : undefined)}
        confirmLabel={noticeConfirmLabel}
        cancelLabel={shell.(notice ? notice.cancelLabel : undefined)}
        onConfirm={shell.(notice ? notice.onConfirm : undefined)}
      />

      <RemoveTrainerPopup
        visible={removeTrainerVisible}
        onClose={() => callIfFunction(shell.setShowRemoveTrainerPopup, false)}
        onRemovalComplete={() => {
          // Keep the removed coach’s name for the optional “leave a review” banner on home.
          if (shell.trainerData) {
            callIfFunction(shell.setReviewPromptTrainer, {
              id: shell.trainerData.id,
              name:
                shell.trainerData.displayName ||
                shell.trainerData.name ||
                'Your trainer',
            });
          }
          callIfFunction(shell.setTrainerData, null);
          callIfFunction(shell.setShowRemoveTrainerPopup, false);
        }}
        trainerName={removeTrainerDisplayName}
        clientName={removeClientDisplayName}
        removedBy="client"
        trainerId={shell.idFromTrainerData(trainerData)}
        clientId={shell.uidFromUser(user)}
      />
    </ClientAppStartShellProvider>
  );
}


// ===== MAIN FUNCTION =====

// ClientAppStart — numbered setup lives inside the export below.

// user = the Firebase auth user; userData = their profile document; onRefetchUserData = ask LoginGate
// to re-read that profile (used after we change something on it, e.g. webLinks a trainer).
export default function ClientAppStart({ user, userData, onRefetchUserData }) {
  const { colors, spacing, isDark, themeMode } = useTheme();

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
  const [notice, setNotice] = useState(null);
  const showNotice = useCallback(
    (title, message, extras = {}) => setNotice({ title, message, ...extras }),
    [],
  );
  const dismissNotice = useCallback(() => setNotice(null), []);

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
  const [calorieGoal, setCalorieGoal] = useState(DEFAULT_CALORIE_GOAL);
  const [nutritionGoals, setNutritionGoals] = useState(null);
  const [, setStreak] = useState(0);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [programCount, setProgramCount] = useState(0);
  const [upcomingItems, setUpcomingItems] = useState([]);
  const [userWeight, setUserWeight] = useState(null);
  const [macroTotals, setMacroTotals] = useState(emptyMacroTotals);
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
  const clientNavigation = goToClientScreen({ refetchNutritionData });
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
    openPrivacyDataRights,
    openNutrition,
    openWorkoutPlan,
    openTrainerSearch,
    openTrainerProfile,
    openWeeklyReport,
    openMySessions,
    openPhotoGallery,
    openProgressCharts,
    openNotifications,
    openAIWorkouts,
    openPlanViewer,
    openWorkoutSession,
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
  } = clientNavigation;

  const { applyFromSnapshots } = keepDailyStatsFresh(uidFromUser(user), {
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
    if (!uidFromUser(user)) return;
    
    console.log(`🔄 ClientAppStart: User changed to ${user.uid} - resetting state`);
    
    // Reset all user-specific state
    setTrainerData(null);
    setOnboardingData(null);
    setTodayWorkout(null);
    setCaloriesConsumed(0);
    setCaloriesBurned(0);
    setCalorieGoal(DEFAULT_CALORIE_GOAL);
    setNutritionGoals(null);
    setStreak(0);
    setWorkoutCount(0);
    setClientCount(0);
    setProgramCount(0);
    setUpcomingItems([]);
    setUserWeight(null);
    setMacroTotals(emptyMacroTotals());
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
  }, [uidFromUser(user)]);

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

  // trainerId on the user doc and trainer_clients can drift. Repair on mount.
  useEffect(() => {
    if (!uidFromUser(user) || !db || roleFromUserData(userData) !== 'client') return;

    reconcileClientTrainerLink(user.uid, userData.trainerId, {
      setTrainerData,
      setTrainerLinkError,
      onRefetchUserData,
    });
  }, [uidFromUser(user), trainerIdFromUserData(userData), roleFromUserData(userData), onRefetchUserData]);


  // Live version of the reconcile above: watches the flat `trainer_client_links` collection so a
  // trainer accepting you updates the UI immediately, no refresh needed.
  // The collection is flat (rather than nested under each trainer) specifically so a client can
  // query it. The obvious alternative — collectionGroup('clients') filtered by documentId() — is
  // rejected by Firestore, which demands a full path for documentId() on a collection group and
  // throws an "odd number of segments" error on device.
  useEffect(() => {
    if (!db || !uidFromUser(user) || roleFromUserData(userData) !== 'client') return undefined;

    const clientUid = user.uid;
    let cancelled = false;

    const linksQuery = query(collection(db, 'trainer_client_links'), where('clientId', '==', clientUid));

    const unsub = onSnapshot(
      linksQuery,
      (snap) => {
        if (cancelled) return;
        handleTrainerClientLinksSnapshot(snap, clientUid, {
          setTrainerData,
          onRefetchUserData,
        });
      },
      (err) => logSnapshotError(err, 'trainer_client_links listener:'),
    );

    return () => {
      cancelled = true;
      try {
        unsub();
      } catch (_) {}
    };
  }, [db, uidFromUser(user), roleFromUserData(userData), onRefetchUserData]);

  // If a trainer accepts while the user is browsing "Find a Trainer", close that screen — they have
  // a coach now, and leaving the marketplace open invites them to request a second one.
  useEffect(() => {
    if (!idFromTrainerData(trainerData) || !rootNavigationRef.isReady()) return;
    const route = rootNavigationRef.getCurrentRoute();
    if ((route ? route.name : undefined) === CLIENT_ROUTES.TrainerSearch) {
      rootGoBack();
    }
  }, [idFromTrainerData(trainerData), rootGoBack]);



  // Stopwatch showing how long the cold load has taken — a diagnostic for slow launches.
  useEffect(() => {
    let interval;
    if (loading && loadingStartTime) {
      // Manipulate here: LOADING_ELAPSED_TICK_MS — fast tick keeps the displayed second from lagging.
      interval = setInterval(() => {
        const elapsedMs = Date.now() - loadingStartTime;
        const elapsedWholeSeconds = Math.floor(elapsedMs / MILLISECONDS_PER_SECOND);
        setElapsedTime(elapsedWholeSeconds);
      }, LOADING_ELAPSED_TICK_MS);
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
    if (!uidFromUser(user) || !db) return undefined;
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
        if (__DEV__) console.warn('[push] pending token flush failed:', messageFromCaughtError(e) || e);
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
  }, [uidFromUser(user)]);

  // "What happens when the user taps a notification."
  // Stored in a ref so the handler registered with the notification system (further down, once) can
  // always call the LATEST version. Registering the function directly would freeze today's state and
  // navigation functions inside it forever — the classic stale-closure bug.
  const clientNotifTapRef = useRef(async () => {});

  useEffect(() => {
    clientNotifTapRef.current = async (data) => {
      try {
        await routeClientNotificationTap(data, {
          user,
          rootGoBack,
          setShowMyDashboard,
          setAiChatState,
          setShowTrainerMessaging,
          setShowConversationsList,
          openNutrition,
          setShowTrainerSharedFilesPopup,
          onRefetchUserData,
          setSelectedConversation,
          setSelectedTrainer,
        });
      } catch (tapError) {
        setShowConversationsList(true);
      }
    };
  }, [uidFromUser(user)]);

  // Register the tap handler exactly once. The arrow function reads through the ref each time it
  // fires, which is what keeps it current even though this effect never re-runs.
  useEffect(() => {
    setNotificationTapHandler((d) => {
      callIfFunction(clientNotifTapRef.current, d);
    });
    return () => setNotificationTapHandler(null);
  }, []);

  // Handles the notification that LAUNCHED the app from a cold start. That tap happened before any
  // handler existed, so it's queued and replayed here.
  // Manipulate here: 650ms delay gives the navigator time to mount — replay too early and the
  // navigation is dropped.
  useEffect(() => {
    if (!uidFromUser(user)) return undefined;
    return flushInitialNotificationResponse(650);
  }, [uidFromUser(user)]);

  // Notes & Files live in the same subcollection the trainer writes to, so one realtime listener
  // covers both the client's own uploads and anything the coach shares.
  useEffect(() => {
    if (!uidFromUser(user) || !db) {
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
  }, [uidFromUser(user)]);

  // Session invites (client): show upcoming pending sessions with accept/decline.
  useEffect(() => {
    if (!uidFromUser(user) || !db) {
      setPendingSessions([]);
      return;
    }
    const trainerUid = idFromTrainerData(trainerData) || uidFromTrainerData(trainerData) || null;
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
      setPendingSessions(pendingSessionsFromSnapshot(snap));
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
        const needsIndex = queryNeedsCompositeIndex(err);

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
                const allSessions = [];
                snap.forEach((sessionDoc) => {
                  allSessions.push({ id: sessionDoc.id, ...sessionDoc.data() });
                });
                setPendingSessions(filterPendingSessionsClientSide(allSessions, todayKey));
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
      try { callIfFunction(fallbackUnsub); } catch (_) {}
    };
  }, [uidFromUser(user), idFromTrainerData(trainerData)]);

  // Accept/decline a session invite, then tell the trainer about it.
  // Note the ordering: the Firestore write happens first and the push is best-effort after — the
  // trainer's calendar must be correct even if the notification never sends.
  const respondToSession = useCallback(async ({ sessionId, status }) => {
    const trainerUid = idFromTrainerData(trainerData) || uidFromTrainerData(trainerData) || null;
    if (!trainerUid || !sessionId) return;
    try {
      await updateDoc(doc(db, `trainer_clients/${trainerUid}/sessions/${sessionId}`), {
        status,
        respondedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await tellTrainerAboutSessionReply({
        trainerUid,
        clientUid: uidFromUser(user),
        fallbackName: displayNameFromUser(user) || 'Client',
        sessionId,
        status,
      });
    } catch (sessionError) {
      console.error('Respond to session failed:', sessionError);
      showNotice('Could not update', (sessionError ? sessionError.message : undefined) || 'Please try again.');
    }
  }, [idFromTrainerData(trainerData), uidFromTrainerData(trainerData), uidFromUser(user), displayNameFromUser(user), showNotice]);

  const refreshNotesAndFiles = () => {
    if (uidFromUser(user)) getNotesAndFiles(user.uid).then(setNotesAndFiles).catch(() => {});
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
    () => (notesAndFiles || []).filter(isTrainerSharedFileRow),
    [notesAndFiles],
  );

  // The client's own uploads (added via the "+" button).
  // Two exclusions: notes render in their own section, and `addedBy || 'client'` treats untagged
  // legacy rows as client-owned — with the second condition re-excluding trainer documents that
  // would otherwise slip through that default.
  const myOwnFiles = useMemo(
    () => (notesAndFiles || []).filter(isClientOwnedFileRow),
    [notesAndFiles],
  );

  const [deletingMyFiles, setDeletingMyFiles] = useState(false);

  const deleteSingleMyFile = useCallback(async (file) => {
    if (!uidFromUser(user) || !idFromFileRow(file)) return;
    // Hard guard: a client may only delete their own uploads. Deleting a trainer's shared file
    // would also fail at the security-rules layer, but refusing here avoids a confusing error.
    if ((file.addedBy || 'client') !== 'client') return;
    setDeletingMyFiles(true);
    try {
      await deleteNotesAndFilesItem(user.uid, file);
      refreshNotesAndFiles();
    } catch (e) {
      console.error('Delete notes/file failed:', e);
      showNotice('Could not delete', messageFromCaughtError(e) || 'Please try again.');
    } finally {
      setDeletingMyFiles(false);
    }
  }, [uidFromUser(user), refreshNotesAndFiles, showNotice]);

  const deleteAllMyFiles = useCallback(async () => {
    if (!uidFromUser(user)) return;
    const list = (myOwnFiles || []).filter((f) => (f.addedBy || 'client') === 'client' && (f ? f.id : undefined));
    if (list.length === 0) return;
    setDeletingMyFiles(true);
    try {
      // Sequential rather than Promise.all: each delete touches both Cloud Storage and Firestore,
      // and firing 50 of those at once gets rate-limited. Slower, but it actually finishes.
      for (const fileToDelete of list) {
        // eslint-disable-next-line no-await-in-loop
        await deleteNotesAndFilesItem(user.uid, fileToDelete);
      }
      refreshNotesAndFiles();
    } catch (e) {
      console.error('Delete all notes/files failed:', e);
      showNotice(
        'Could not delete all',
        messageFromCaughtError(e) || 'Some files may not have been deleted. Try again.',
      );
      refreshNotesAndFiles();
    } finally {
      setDeletingMyFiles(false);
    }
  }, [uidFromUser(user), myOwnFiles, refreshNotesAndFiles, showNotice]);

  // Router for "the user tapped a file". Every branch ends in a `return`, so the order below IS the
  // precedence: trainer-authored content first (it needs a server lookup to resolve), then explicit
  // types, then guesses based on the file extension, then a generic web viewer as the last resort.
  const openNotesFile = useCallback((file) => {
    const viewerSetters = {
      setDocumentViewer,
      setSpreadsheetViewer,
      setMediaViewer,
      setPdfViewer,
      setEmbedWebViewer,
      showNotice,
    };
    // Trainer spreadsheet/document: the row only stores ids, so we ask the server what it is.
    if (trainerIdFromFileRow(file) && documentIdFromFileRow(file)) {
      openTrainerPackagedFile(file, viewerSetters);
      return;
    }
    openLocalNotesFileByType(file, viewerSetters);
  }, [showNotice]);


  // Pull-to-refresh on the home screen.
  const onRefresh = async () => {
    setRefreshing(true);
    refreshNotesAndFiles();
    if (uidFromUser(user) && db) {
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
        console.warn('Home refresh daily metrics:', messageFromCaughtError(e) || e);
      }
    }
    setRefreshing(false);
  };

  // The price label on the coaching payment card.
  const coachingRateLabel = useMemo(
    () => coachingRateLabelFromProfiles(userData, trainerData),
    [monthlyRateFromUserData(userData), pricingFromTrainerData(trainerData)],
  );

  // Trainer's display name, hunting through every field shape profiles have used over time and
  // falling back to generic copy so the payment sheet never shows "undefined".
  const coachingTrainerName = useMemo(
    () => coachingTrainerDisplayName(trainerData),
    [trainerData],
  );

  // "Request this coach" from the marketplace.
  // Throws (rather than returning a flag) so the calling screen can show the message in its own
  // error UI — each string below is user-facing copy.
  const requestTrainerConnection = useCallback(
    async (trainer, { clientIntro } = {}) => {
      const clientId = uidFromUser(user);
      const trainerId = (trainer ? trainer.id : undefined) || (trainer ? trainer.uid : undefined);
      if (!clientId) throw new Error('Please log in first.');
      if (!trainerId) throw new Error('Trainer not found.');
      // One coach at a time. Requesting a second would create a conflicting link the reconcile
      // effects above would then fight over.
      if (idFromTrainerData(trainerData) && String(trainerData.id) !== String(trainerId)) {
        throw new Error('You already have a coach. Open your dashboard to message them.');
      }
      // Requests ride on the messaging system, so a conversation must exist first (created if needed).
      const conversationId = await getOrCreateConversation(clientId, trainerId);
      // The onboarding answers are attached so the trainer can judge the request without asking a
      // round of questions. Each field has several possible names across profile versions, hence the
      // || chains, and every one ends in a readable default rather than blank.
      await sendClientRequest(conversationId, clientId, clientIntro || '', {
        clientName: firstNameFromUserData(userData) || displayNameFromUser(user) || 'Client',
        clientGoals: (onboardingData ? onboardingData.goal : undefined) || (onboardingData ? onboardingData.primaryGoal : undefined) || 'Not specified',
        clientExperienceLevel: (onboardingData ? onboardingData.fitnessLevel : undefined) || (onboardingData ? onboardingData.experience : undefined) || 'Beginner',
        clientEquipment: (onboardingData ? onboardingData.equipment : undefined) || (onboardingData ? onboardingData.availableEquipment : undefined) || 'Not specified',
        clientLimitations: (onboardingData ? onboardingData.injuries : undefined) || (onboardingData ? onboardingData.limitations : undefined) || 'None',
      });
    },
    [uidFromUser(user), displayNameFromUser(user), userData, onboardingData, idFromTrainerData(trainerData)],
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
      const uid = uidFromUser(user);
      if (!uid) return { success: false, message: 'Please sign in again.' };
      try {
        const planData = await loadWorkoutPlanForViewer(uid, planId);
        const planIsMissing = !planHasViewableContent(planData);
        if (planIsMissing) {
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
      } catch (planError) {
        return { success: false, message: (planError ? planError.message : undefined) || 'Could not load workout plan.' };
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
  const userName = firstNameFromUserData(userData) || displayNameFromUser(user) || (onboardingData ? onboardingData.name : undefined) || 'User';
  const userRole = roleFromUserData(userData) || 'client';
  // vocab/symbol: !! = coerce to a real boolean, so children get `false` rather than `null`.
  const hasTrainer = !!trainerData;

  // Reshapes workout data into the flat { name, exercises, workoutName } rows TrainingAgenda expects.
  // Three-way fallback: today's actual workout → the dashboard's one-line summary → nothing at all.
  const agendaWorkouts = buildAgendaWorkouts(todayWorkout, dashboardWorkoutSummary);

  // The three headline macros on the nutrition card. Always shown, even at 0.
  const nutritionMacros = buildNutritionMacroRows(macroTotals);

  console.log(`📊 Nutrition macros being passed to card:`, nutritionMacroLogLines(nutritionMacros));
  console.log(`🎯 Current nutrition goals:`, nutritionGoals);

  // Secondary nutrients, each added only when it's actually above zero — a row of "0g" everywhere
  // is noise, so the card grows as the user logs more detailed food data.
  const additionalNutrients = buildAdditionalNutrientRows(macroTotals);

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
    openProfile: clientNavigation.openProfile,
    openSettings: clientNavigation.openSettings,
    openHelpFAQ: clientNavigation.openHelpFAQ,
    openTerms: clientNavigation.openTerms,
    openPrivacy: clientNavigation.openPrivacy,
    openContactSupport: clientNavigation.openContactSupport,
    openBugReport: clientNavigation.openBugReport,
    openPrivacyDataRights: clientNavigation.openPrivacyDataRights,
    openNutrition,
    openWorkout,
    openWeeklyReport,
    openMySessions,
    openPhotoGallery,
    openProgressCharts,
    openNotifications,
    openAIWorkouts,
    openPlanViewer,
    openWorkoutSession,
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
    notice,
    dismissNotice,
    showNotice,
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
    openWorkoutSession,
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
    notice,
    showNotice,
    dismissNotice,
  ]);

  return (
    <ClientAppShellLayout
      loading={loading}
      isDark={isDark}
      shell={shell}
      showCoachingPaymentModal={showCoachingPaymentModal}
      closeCoachingPayment={closeCoachingPayment}
      trainerData={trainerData}
      userData={userData}
      coachingTrainerName={coachingTrainerName}
      onRefetchUserData={onRefetchUserData}
    />
  );
}

// PLUMBING — skip unless debugging (trainer link repair, notification routes, nutrition refetch).
// ===== HELPER FUNCTIONS =====

/**
 * Pending session cards sort by date+time strings (zero-padded), not parsed Dates.
 * @param {Array} sessionRows
 * @returns {Array}
 */
function sortClientPendingSessions(sessionRows) {
  const sortedRows = [...sessionRows];
  sortedRows.sort((leftSession, rightSession) => {
    const leftKey = String(leftSession.date) + String(leftSession.time);
    const rightKey = String(rightSession.date) + String(rightSession.time);
    return leftKey.localeCompare(rightKey);
  });
  return sortedRows;
}

/**
 * @param {import('firebase/firestore').QuerySnapshot} snapshot
 * @returns {Array}
 */
function pendingSessionsFromSnapshot(snapshot) {
  const sessionRows = [];
  snapshot.forEach((sessionDoc) => {
    sessionRows.push({ id: sessionDoc.id, ...sessionDoc.data() });
  });
  return sortClientPendingSessions(sessionRows);
}

// Re-reads today's food log and pushes the totals into home-screen state.
// Handed to anything that can change what the user ate (the nutrition screen, the AI coach logging a
// meal), so the home cards update without a full refresh.
function useClientHomeNutrition({ user, db, setCaloriesConsumed, setMacroTotals }) {
  // vocab: useCallback = keep the SAME function identity between renders unless a dependency changes.
  // It matters here because this function is passed into the shell object and into child screens —
  // a new identity every render would retrigger their effects.
  const refetchNutritionData = useCallback(async () => {
    if (!uidFromUser(user) || !db) return;
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
    } catch (nutritionError) {
      console.error('Refetch nutrition:', nutritionError);
    }
  }, [uidFromUser(user), db, setCaloriesConsumed, setMacroTotals]);

  return refetchNutritionData;
}

async function clearTrainerFieldsOnClient(clientUid) {
  await updateDoc(doc(db, 'users', clientUid), {
    trainerId: deleteField(),
    trainerName: deleteField(),
    trainerAssignedAt: deleteField(),
  });
}

async function keepTrainerWhenLinkExists(clientUid, trainerId, setters) {
  const linkDoc = await getDoc(doc(db, `trainer_clients/${trainerId}/clients/${clientUid}`));
  if (!linkDoc.exists()) return false;
  const trainerDoc = await getDoc(doc(db, 'users', trainerId));
  if (trainerDoc.exists()) {
    setters.setTrainerData({ id: trainerDoc.id, ...trainerDoc.data() });
  }
  setters.setTrainerLinkError(false);
  return true;
}

async function dropTrainerAfterRejection(clientUid, trainerId, setters) {
  const conversationId = `conv_${clientUid}_${trainerId}`;
  const rejectedQuery = query(
    collection(db, 'messages'),
    where('conversationId', '==', conversationId),
    where('senderId', '==', clientUid),
    where('status', '==', 'rejected'),
    limit(1),
  );
  const rejectedSnap = await getDocs(rejectedQuery);
  if (rejectedSnap.empty) return false;
  const status = rejectedSnap.docs[0].data().status;
  if (status === 'rejected') {
    await clearTrainerFieldsOnClient(clientUid);
    setters.setTrainerData(null);
    setters.setTrainerLinkError(false);
    callIfFunction(setters.onRefetchUserData);
  }
  return true;
}

async function rebuildMissingTrainerLink(clientUid, trainerId, setters) {
  if (!functions) {
    setters.setTrainerLinkError(true);
    return;
  }
  try {
    const linkClient = httpsCallable(functions, 'linkClientWithTrainerCode');
    await linkClient({ clientId: clientUid, trainerId });
    const trainerDoc = await getDoc(doc(db, 'users', trainerId));
    if (trainerDoc.exists()) {
      setters.setTrainerData({ id: trainerDoc.id, ...trainerDoc.data() });
    }
    setters.setTrainerLinkError(false);
  } catch (linkError) {
    await clearTrainerFieldsOnClient(clientUid);
    setters.setTrainerData(null);
    setters.setTrainerLinkError(true);
    callIfFunction(setters.onRefetchUserData);
  }
}

async function repairKnownTrainerLink(clientUid, trainerId, setters) {
  const linkStillExists = await keepTrainerWhenLinkExists(clientUid, trainerId, setters);
  if (linkStillExists) return;
  const rejectionHandled = await dropTrainerAfterRejection(clientUid, trainerId, setters);
  if (rejectionHandled) return;
  await rebuildMissingTrainerLink(clientUid, trainerId, setters);
}

async function adoptTrainerFromConversation(conversationDoc, clientUid, setters) {
  const participants = conversationDoc.data().participants || [];
  const trainerUid = participants.find((participantId) => participantId !== clientUid);
  if (!trainerUid) return false;
  const linkDoc = await getDoc(doc(db, `trainer_clients/${trainerUid}/clients/${clientUid}`));
  if (!linkDoc.exists()) return false;
  const trainerDoc = await getDoc(doc(db, 'users', trainerUid));
  const trainerProfile = trainerDoc.exists() ? trainerDoc.data() : {};
  await updateDoc(doc(db, 'users', clientUid), {
    trainerId: trainerUid,
    trainerName: trainerProfile.name || trainerProfile.displayName || 'Trainer',
    trainerAssignedAt: serverTimestamp(),
  });
  setters.setTrainerData({ id: trainerUid, ...trainerProfile });
  callIfFunction(setters.onRefetchUserData);
  return true;
}

async function adoptFirstLinkedTrainer(clientUid, setters) {
  const conversationQuery = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', clientUid),
  );
  const conversationSnap = await getDocs(conversationQuery);
  for (const conversationDoc of conversationSnap.docs) {
    const adopted = await adoptTrainerFromConversation(conversationDoc, clientUid, setters);
    if (adopted) return;
  }
}

async function reconcileClientTrainerLink(clientUid, trainerId, setters) {
  try {
    if (trainerId) {
      await repairKnownTrainerLink(clientUid, trainerId, setters);
      return;
    }
    await adoptFirstLinkedTrainer(clientUid, setters);
  } catch (error) {
    console.error('Reconcile trainerId:', error);
  }
}

function activeTrainerLinkDocs(snap) {
  return snap.docs.filter((linkDoc) => {
    const status = statusFromLinkDocData(linkDoc);
    if (status == null || status === '') return true;
    return status === 'active';
  });
}

async function mirrorTrainerIdOntoClient(clientUid, trainerUid, trainerProfile, onRefetchUserData) {
  try {
    const userRef = doc(db, 'users', clientUid);
    const userSnap = await getDoc(userRef);
    const currentProfile = userSnap.exists() ? userSnap.data() : {};
    const savedTrainerId = (currentProfile ? currentProfile.trainerId : undefined);
    const trainerIdChanged = !savedTrainerId || String(savedTrainerId) !== String(trainerUid);
    if (!trainerIdChanged) return;
    await updateDoc(userRef, {
      trainerId: trainerUid,
      trainerName: trainerProfile.name || trainerProfile.displayName || 'Trainer',
      trainerAssignedAt: serverTimestamp(),
    });
    callIfFunction(onRefetchUserData);
  } catch (mirrorError) {
    console.warn('Mirror trainerId to client user doc skipped:', (mirrorError ? mirrorError.message : undefined) || mirrorError);
  }
}

async function applyTrainerFromLink(trainerUid, clientUid, setters) {
  const trainerDoc = await getDoc(doc(db, 'users', trainerUid));
  if (!trainerDoc.exists()) {
    setters.setTrainerData(null);
    return;
  }
  const trainerProfile = trainerDoc.data();
  if ((trainerProfile ? trainerProfile.role : undefined) !== 'trainer') {
    setters.setTrainerData(null);
    return;
  }
  setters.setTrainerData({ id: trainerUid, ...trainerProfile });
  await mirrorTrainerIdOntoClient(clientUid, trainerUid, trainerProfile, setters.onRefetchUserData);
}

async function handleTrainerClientLinksSnapshot(snap, clientUid, setters) {
  if (snap.empty) {
    setters.setTrainerData(null);
    return;
  }
  const activeDocs = activeTrainerLinkDocs(snap);
  if (!activeDocs.length) {
    setters.setTrainerData(null);
    return;
  }
  const linkDoc = activeDocs[0];
  const trainerUid = String(trainerIdFromLinkDocData(linkDoc) || '').trim();
  if (!trainerUid || trainerUid === clientUid) {
    setters.setTrainerData(null);
    return;
  }
  try {
    await applyTrainerFromLink(trainerUid, clientUid, setters);
  } catch (linkError) {
    console.warn('trainer_client_links listener handler:', (linkError ? linkError.message : undefined) || linkError);
  }
}

function openHomeFromScheduledSession(context) {
  context.rootGoBack();
  context.setShowMyDashboard(false);
  context.rootGoBack();
  context.rootGoBack();
  context.setAiChatState(null);
}

function openDashboardFromSessionAlert(context) {
  context.rootGoBack();
  context.rootGoBack();
  context.rootGoBack();
  context.setAiChatState(null);
  context.setShowTrainerMessaging(false);
  context.setShowConversationsList(false);
  context.setShowMyDashboard(true);
}

function openNutritionFromAlert(context) {
  context.rootGoBack();
  context.rootGoBack();
  context.setAiChatState(null);
  context.setShowTrainerMessaging(false);
  context.setShowConversationsList(false);
  context.setShowMyDashboard(false);
  context.openNutrition();
}

function openSharedFilesFromAlert(context) {
  context.rootGoBack();
  context.rootGoBack();
  context.setAiChatState(null);
  context.setShowTrainerMessaging(false);
  context.setShowConversationsList(false);
  context.rootGoBack();
  context.setShowMyDashboard(true);
  context.setShowTrainerSharedFilesPopup(true);
}

function openDashboardAfterRequestAccepted(context) {
  callIfFunction(context.onRefetchUserData);
  context.rootGoBack();
  context.rootGoBack();
  context.rootGoBack();
  context.setAiChatState(null);
  context.setShowTrainerMessaging(false);
  context.setShowConversationsList(false);
  context.setShowMyDashboard(true);
}

function openClientInboxFromAlert(context) {
  context.rootGoBack();
  context.setShowMyDashboard(false);
  context.rootGoBack();
  context.rootGoBack();
  context.setAiChatState(null);
  context.setShowTrainerMessaging(false);
  context.setShowConversationsList(true);
}

async function loadChatPartner(otherId) {
  if (!otherId) return null;
  const otherParticipant = { id: otherId };
  try {
    const userSnap = await getDoc(doc(db, 'users', otherId));
    if (!userSnap.exists()) return otherParticipant;
    return { id: userSnap.id, ...userSnap.data() };
  } catch (_) {
    return otherParticipant;
  }
}

function showClientMessageThread(context, conversationId, conversationData, otherParticipant) {
  context.rootGoBack();
  context.setShowMyDashboard(false);
  context.rootGoBack();
  context.rootGoBack();
  context.setAiChatState(null);
  context.setShowConversationsList(false);
  context.setSelectedConversation({ id: conversationId, ...conversationData });
  context.setSelectedTrainer(otherParticipant);
  context.setShowTrainerMessaging(true);
}

async function openClientMessageThread(conversationId, context) {
  const conversationSnap = await getDoc(doc(db, 'conversations', conversationId));
  if (!conversationSnap.exists()) {
    context.setShowConversationsList(true);
    return;
  }
  const conversationData = conversationSnap.data();
  const participants = (conversationData ? conversationData.participants : undefined) || [];
  const otherId = participants.find((participantId) => participantId !== context.user.uid);
  const otherParticipant = await loadChatPartner(otherId);
  showClientMessageThread(context, conversationId, conversationData, otherParticipant);
}

async function routeClientNotificationTap(data, context) {
  if (!context.uidFromUser(user) || !data || typeof data !== 'object') return;
  const type = data.type;
  if (type === 'session_scheduled') {
    openHomeFromScheduledSession(context);
    return;
  }
  if (type === 'session_reminder' || type === 'session_update') {
    openDashboardFromSessionAlert(context);
    return;
  }
  if (type === 'nutrition_reminder') {
    openNutritionFromAlert(context);
    return;
  }
  if (type === 'notes_shared') {
    openSharedFilesFromAlert(context);
    return;
  }
  if (type === 'client_request_accepted') {
    openDashboardAfterRequestAccepted(context);
    return;
  }
  if (type !== 'message') {
    openClientInboxFromAlert(context);
    return;
  }
  const conversationId = data.conversationId;
  if (!conversationId || typeof conversationId !== 'string') {
    openClientInboxFromAlert(context);
    return;
  }
  await openClientMessageThread(conversationId, context);
}

async function clientNameForSessionReply(clientUid, fallbackName) {
  try {
    const userSnap = await getDoc(doc(db, 'users', clientUid));
    if (!userSnap.exists()) return fallbackName;
    const clientProfile = userSnap.data();
    return (clientProfile ? clientProfile.firstName : undefined) || (clientProfile ? clientProfile.name : undefined) || (clientProfile ? clientProfile.displayName : undefined) || fallbackName;
  } catch (_) {
    return fallbackName;
  }
}

function sessionReplyVerb(status) {
  if (status === 'accepted') return 'accepted';
  if (status === 'declined') return 'declined';
  return 'updated';
}

async function tellTrainerAboutSessionReply({ trainerUid, clientUid, fallbackName, sessionId, status }) {
  if (!clientUid) return;
  const clientName = await clientNameForSessionReply(clientUid, fallbackName);
  const verb = sessionReplyVerb(status);
  void postRemotePushNotify({
    recipientId: trainerUid,
    senderName: clientName,
    messageText: `${clientName} ${verb} a session.`,
    senderId: clientUid,
    messageId: sessionId,
    notificationType: 'session_response',
  });
}

async function loadWorkoutPlanForViewer(uid, planId) {
  if (planId === 'current') {
    const current = await getCurrentWorkoutPlan(uid);
    if (!current) return null;
    return { id: 'current', ...current };
  }
  const planSnap = await getDoc(doc(db, 'users', uid, 'workoutPlans', planId));
  if (!planSnap.exists()) return null;
  return { id: planId, ...planSnap.data() };
}

function planHasViewableContent(planData) {
  if (!planData) return false;
  if (planData.rawPlan) return true;
  if (planData.planText) return true;
  if (planData.structuredPlan) return true;
  return false;
}
