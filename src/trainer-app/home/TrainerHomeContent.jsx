// Trainer home — Design Law layout (docs/design/Design-Law/screens/trainer-home).
// Flow: greeting → motivation → needs you → client carousel → today tabs → tools → weekly report.
// Data/Firebase unchanged. Chrome lives in TrainerHomeBlocks.jsx + trainerHomePieces.jsx.
// Read order: constants → helpers → DashboardContent main → PLUMBING Firestore loaders.

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, onSnapshot, collection, getDocs, setDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../app-start/cloudConnection';
import { getProfileDateKey } from '../../helpers/dateStrings';
import { getLocalDateKey } from '../../helpers/getLocalDay';
import { fetchLatestLoggedWeight } from '../../daily-stats/latestWeight';
import { getFoodLogsForDate, calculateMacroTotals, getDailyGoals } from '../../nutrition/daily-log/saveLoggedFood';
import {
  filterTrainerDocumentsForClient,
  getTrainerDocuments,
  getNotesAndFiles,
} from '../../for-both/files-and-notes/saveNotesAndFiles';
import RemoveClientSheet from '../my-trainees/RemoveClientSheet';
import SpreadsheetViewer from '../../for-both/files-and-notes/viewers/SpreadsheetViewer';
import ShareDocumentPopup from '../documents/ShareDocumentPopup';
import TrainerWeeklyReportSection from '../weekly-report/TrainerWeeklyReportSection';
import ProgressTab from '../progress-tab/TrainerProgressTab';
import NutritionTab from '../nutrition-tab/TrainerNutritionTab';
import CalendarTab from '../scheduling/CalendarTab';
import { FORM_SCROLL_PROPS, useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import { normalizeClientProfileFields } from '../../helpers/fillTraineeProfile';
import { combineTraineeProfile } from '../../helpers/combineTraineeProfile';
import {
  resolveTrainerProgressBeforeWeight,
} from '../progress-tab/pickWeightToShow';
import { isBenignTrainerClientFirestoreError } from '../trainee-records/calmDatabaseErrors';
import {
  TabPills,
  TrainerNotesFilesHeroAndWorkspace,
} from './trainerHomePieces';
import {
  TrainerClientCarousel,
  TrainerWeeklyReportEmpty,
  TrainerClientTodayLabel,
  TrainerHeader,
  TrainerMotivationCard,
  TrainerNeedsYou,
  TrainerToolsGrid,
  trainerHomeThemeColors,
} from './TrainerHomeBlocks';
import TrainerCreateSheet from './TrainerCreateSheet';
import { PayoutSetupReminderPopup } from '../../for-both/payments/PayoutSetupReminderPopup';
import { shouldShowPayoutSetupReminderPopup } from '../../for-both/payments/whenToAskForPayoutSetup';
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';
import { lightColors, nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const PAYOUT_REMINDER_DELAY_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 30000;
const DEFAULT_CALORIE_GOAL = 2000;
const DEFAULT_PROTEIN_GOAL = 150;
const DEFAULT_CARBS_GOAL = 250;
const DEFAULT_FAT_GOAL = 70;
const MORNING_HOUR_END = 12;
const AFTERNOON_HOUR_END = 17;
// Brand pink used for loading spinners on this screen.
// Manipulate here: one hex changes every spinner accent here.
const ICON_ACCENT = lightColors.primary;

// ===== HELPER FUNCTIONS =====

// ----- optional-field readers (plain ifs — no optional chaining in callers) -----

function idFromClientRow(clientRow) {
  if (!clientRow) return null;
  return clientRow.id;
}

function nameFromClientRow(clientRow) {
  if (!clientRow) return null;
  return clientRow.name;
}

function displayNameFromClientRow(clientRow) {
  if (!clientRow) return null;
  return clientRow.displayName;
}

function weightFromClientRow(clientRow) {
  if (!clientRow) return null;
  return clientRow.weight;
}

function startingWeightFromClientRow(clientRow) {
  if (!clientRow) return null;
  return clientRow.startingWeight;
}

function programNameFromClientRow(clientRow) {
  if (!clientRow) return null;
  return clientRow.programName;
}

function microsFromClientRow(clientRow) {
  if (!clientRow) return [];
  return clientRow.micros || [];
}

function completedDaysFromClientRow(clientRow) {
  if (!clientRow) return [];
  return clientRow.completedDays || [];
}

function upcomingDaysFromClientRow(clientRow) {
  if (!clientRow) return [];
  return clientRow.upcomingDays || [];
}

function missedDaysFromClientRow(clientRow) {
  if (!clientRow) return [];
  return clientRow.missedDays || [];
}

function upcomingSessionsFromClientRow(clientRow) {
  if (!clientRow) return [];
  return clientRow.upcomingSessions || [];
}

function profileTimezoneFromClientData(clientData) {
  if (!clientData) return null;
  return clientData.profileTimezone;
}

function sleepFromClientNutrition(clientData) {
  if (!clientData) return null;
  if (!clientData.nutrition) return null;
  return clientData.nutrition.sleep;
}

function messageFromCaughtError(caughtError) {
  if (!caughtError) return '';
  if (caughtError.message) return caughtError.message;
  return String(caughtError);
}

function snapshotDataIfExists(snapshot) {
  if (!snapshot) return null;
  if (typeof snapshot.exists === 'function') {
    if (!snapshot.exists()) return null;
    return snapshot.data() || {};
  }
  if (!snapshot.exists) return null;
  return snapshot.data() || {};
}

function workoutReminderTimeZone(userData) {
  if (!userData) return null;
  if (!userData.workoutReminder) return null;
  return userData.workoutReminder.timeZone;
}

function foodRowsFromNutritionLogs(nutritionLogs) {
  const foodRows = [];
  if (!Array.isArray(nutritionLogs)) return foodRows;
  for (let index = 0; index < nutritionLogs.length; index += 1) {
    const logRow = nutritionLogs[index];
    const foodName = logRow.food_name || logRow.foodName || 'Food';
    if (!foodName) continue;
    foodRows.push({
      id: logRow.id || `food-${index}`,
      name: foodName,
      meal: logRow.meal_type || logRow.mealType || logRow.meal || 'Meal',
      calories: logRow.calories != null ? Number(logRow.calories) : null,
    });
  }
  return foodRows;
}

function progressDocsFromSnapshot(progressSnap) {
  const progressDocs = [];
  if (!progressSnap || !progressSnap.docs) return progressDocs;
  for (const progressDoc of progressSnap.docs) {
    progressDocs.push(progressDoc.data());
  }
  return progressDocs;
}

function countTruthyWeeklySummaryValues(weeklySummaryMap) {
  let count = 0;
  const values = Object.values(weeklySummaryMap || {});
  for (const value of values) {
    if (value) count += 1;
  }
  return count;
}



/**
 * AsyncStorage keys for the selected client's local-midnight day rollover.
 * @param {string} clientId
 * @returns {{ lastDateKeyStorageKey: string, pendingResetStorageKey: string }}
 */
function storageKeysForClientDayReset(clientId) {
  return {
    lastDateKeyStorageKey: `trainer_dashboard_last_dateKey_${clientId}`,
    pendingResetStorageKey: `trainer_dashboard_pending_reset_${clientId}`,
  };
}

/**
 * Copy yesterday's dailyLogs (+ legacy daily_tracking) into the daily_logs archive collection.
 * On failure, stash the prevKey so the next heartbeat can retry.
 * @param {string} clientId
 * @param {string} previousDateKey
 * @param {string} pendingResetStorageKey
 */
async function archivePreviousClientDay(clientId, previousDateKey, pendingResetStorageKey) {
  if (!previousDateKey) return;
  try {
    const [dailyLogsSnap, trackingSnap] = await Promise.all([
      getDoc(doc(db, 'users', clientId, 'dailyLogs', previousDateKey)).catch(() => null),
      // TODO(phase-5): remove legacy daily_tracking read after backfill
      getDoc(doc(db, 'users', clientId, 'daily_tracking', previousDateKey)).catch(() => null),
    ]);
    const dailyLogsData = snapshotDataIfExists(dailyLogsSnap);
    const trackingData = snapshotDataIfExists(trackingSnap);

    const archiveDocId = `${clientId}_${previousDateKey}`;
    await setDoc(
      doc(db, 'daily_logs', archiveDocId),
      {
        userId: clientId,
        date: previousDateKey,
        workouts: {
          workoutLog: (dailyLogsData ? dailyLogsData.workoutLog : null) || null,
          workoutSummary: (trackingData ? trackingData.workoutSummary : null) || (dailyLogsData ? dailyLogsData.dashboard_workouts : null) || null,
          workoutName: (trackingData ? trackingData.workoutName : null) || (dailyLogsData ? dailyLogsData.dashboard_workout_name : null) || null,
          workoutExercises: (trackingData ? trackingData.workoutExercises : null) || null,
        },
        nutrition: {
          caloriesConsumed: typeof (trackingData ? trackingData.caloriesConsumed : null) === 'number' ? trackingData.caloriesConsumed : null,
          macros: (trackingData ? trackingData.macroTotals : null) || null,
        },
        streak_count: typeof (dailyLogsData ? dailyLogsData.streak_count : null) === 'number' ? dailyLogsData.streak_count : null,
        timestamp: serverTimestamp(),
      },
      { merge: true },
    );
    await AsyncStorage.removeItem(pendingResetStorageKey);
  } catch (error) {
    await AsyncStorage.setItem(
      pendingResetStorageKey,
      JSON.stringify({ prevKey: previousDateKey, at: Date.now() }),
    );
  }
}

/**
 * Heartbeat tick: detect local dateKey change, archive the previous day, retry pending archives.
 * @param {string} clientId
 * @param {string} clientTodayKey
 */
async function runClientDashboardDayRolloverTick(clientId, clientTodayKey) {
  const { lastDateKeyStorageKey, pendingResetStorageKey } = storageKeysForClientDayReset(clientId);
  const nowKey = clientTodayKey;
  const lastKey = await AsyncStorage.getItem(lastDateKeyStorageKey);

  if (!lastKey) {
    await AsyncStorage.setItem(lastDateKeyStorageKey, nowKey);
  } else if (lastKey !== nowKey) {
    await AsyncStorage.setItem(lastDateKeyStorageKey, nowKey);
    await archivePreviousClientDay(clientId, lastKey, pendingResetStorageKey);
  }

  const pendingRaw = await AsyncStorage.getItem(pendingResetStorageKey);
  if (!pendingRaw) return;

  let pendingPayload = null;
  try {
    pendingPayload = JSON.parse(pendingRaw);
  } catch (ignoredError) {
    pendingPayload = null;
  }
  if (pendingPayload && pendingPayload.prevKey) {
    await archivePreviousClientDay(clientId, pendingPayload.prevKey, pendingResetStorageKey);
  }
}

/**
 * Greeting period from the wall clock (Morning / Afternoon / Evening).
 * @returns {'Morning'|'Afternoon'|'Evening'}
 */
function greetingPeriodFromHour() {
  const hour = new Date().getHours();
  if (hour < MORNING_HOUR_END) return 'Morning';
  if (hour < AFTERNOON_HOUR_END) return 'Afternoon';
  return 'Evening';
}

/**
 * Needs-you badge total: payout nudge + pending requests + unread messages.
 * @param {boolean} showPayoutNudge
 * @param {number} pendingRequestsCount
 * @param {number} unreadMessageCount
 * @returns {number}
 */
function countNeedsYouBadges(showPayoutNudge, pendingRequestsCount, unreadMessageCount) {
  let badgeTotal = 0;
  if (showPayoutNudge) badgeTotal += 1;
  if (pendingRequestsCount > 0) badgeTotal += 1;
  if (unreadMessageCount > 0) badgeTotal += 1;
  return badgeTotal;
}

/**
 * Subcopy under the payout needs-you row when requests are waiting.
 * @param {number} pendingRequestsCount
 * @returns {string|undefined}
 */
function payoutNeedsSubcopyFromRequests(pendingRequestsCount) {
  if (pendingRequestsCount <= 0) return undefined;
  const pluralSuffix = pendingRequestsCount === 1 ? '' : 's';
  const verb = pendingRequestsCount === 1 ? 'is' : 'are';
  return `${pendingRequestsCount} new request${pluralSuffix} ${verb} waiting on this.`;
}


/**
 * CRM-only dashboard shape when the client has no users/{id} row yet.
 * Same letters as TrainerAppStart's local helper of this name.
 * @param {object} currentClient
 * @param {Array} [notesAndFiles]
 * @returns {object}
 */
function buildTrainerDashboardClientDataFromCrm(currentClient, notesAndFiles = []) {
  return {
    beforeWeight: startingWeightFromClientRow(currentClient) ?? weightFromClientRow(currentClient) ?? null,
    currentWeight: weightFromClientRow(currentClient) ?? null,
    trainingDays: [],
    programName: programNameFromClientRow(currentClient) || 'Custom Program',
    nutrition: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      potassium: 0,
      proteinGoal: 200,
      carbsGoal: 300,
      fatGoal: 80,
      micros: microsFromClientRow(currentClient) || [],
      foods: [],
    },
    calendar: {
      completed: completedDaysFromClientRow(currentClient) || [],
      upcoming: upcomingDaysFromClientRow(currentClient) || [],
      missed: missedDaysFromClientRow(currentClient) || [],
      upcomingSessions: upcomingSessionsFromClientRow(currentClient) || [],
    },
    notesAndFiles,
  };
}

/**
 * Best-effort notes load — empty list on failure so the dashboard still paints.
 * @param {string} ownerUid
 * @returns {Promise<Array>}
 */
async function loadNotesAndFilesQuietly(ownerUid) {
  try {
    return await getNotesAndFiles(ownerUid);
  } catch (ignoredError) {
    return [];
  }
}

async function loadProgressSummary(trainerId, ownerUid) {
  try {
    const progressSnap = await getDocs(
      collection(db, `trainer_clients/${trainerId}/clients/${ownerUid}/progress`),
    );
    const progressDocs = progressDocsFromSnapshot(progressSnap);
    if (progressDocs.length === 0) return { trainingDays: [], programName: null };
    const latest = progressDocs[progressDocs.length - 1];
    return {
      trainingDays: latest.trainingDays || [],
      programName: latest.programName || null,
    };
  } catch (ignoredError) {
    return { trainingDays: [], programName: null };
  }
}

async function loadNutritionBundle(ownerUid, todayKey) {
  const defaults = {
    nutritionLogs: [],
    nutritionTotals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
    nutritionGoals: {
      proteinTarget: DEFAULT_PROTEIN_GOAL,
      carbsTarget: DEFAULT_CARBS_GOAL,
      fatTarget: DEFAULT_FAT_GOAL,
      calories: DEFAULT_CALORIE_GOAL,
    },
  };
  try {
    const nutritionLogs = await getFoodLogsForDate(ownerUid, todayKey);
    const nutritionTotals = calculateMacroTotals(nutritionLogs);
    const nutritionGoals = { ...defaults.nutritionGoals };
    const goalsData = await getDailyGoals(ownerUid);
    if (goalsData && goalsData.proteinTarget != null) nutritionGoals.proteinTarget = goalsData.proteinTarget;
    if (goalsData && goalsData.carbsTarget != null) nutritionGoals.carbsTarget = goalsData.carbsTarget;
    if (goalsData && goalsData.fatTarget != null) nutritionGoals.fatTarget = goalsData.fatTarget;
    if (goalsData && goalsData.calories != null) nutritionGoals.calories = goalsData.calories;
    return { nutritionLogs, nutritionTotals, nutritionGoals };
  } catch (ignoredError) {
    return defaults;
  }
}

function buildDashboardClientData({
  userData,
  currentClient,
  trainingDays,
  programName,
  nutritionLogs,
  nutritionTotals,
  nutritionGoals,
  notesAndFiles,
}) {
  // Design Law meal rows need name + meal slot + calories (not just chip strings).
  const foodNames = foodRowsFromNutritionLogs(nutritionLogs);
  const calorieGoal =
    userData.calorieTarget ??
    userData.calorie_target ??
    userData.dailyCalories ??
    nutritionGoals.calories ??
    DEFAULT_CALORIE_GOAL;
  const normalized = normalizeClientProfileFields(userData);
  const mergedProfile = combineTraineeProfile(currentClient, normalized);
  const profileWeight = mergedProfile.weight ?? normalized.weight ?? null;
  return {
    profileTimezone:
      userData.timezone || userData.timeZone || workoutReminderTimeZone(userData) || null,
    beforeWeight: resolveTrainerProgressBeforeWeight({
      startingWeight: mergedProfile.startingWeight ?? normalized.startingWeight,
      profileWeight,
      crmStartingWeight: currentClient.startingWeight,
      crmWeight: currentClient.weight,
    }),
    currentWeight: profileWeight,
    profileWeight,
    trainingDays,
    programName,
    nutrition: {
      calories: nutritionTotals.calories || 0,
      protein: nutritionTotals.protein || 0,
      carbs: nutritionTotals.carbs || 0,
      fat: nutritionTotals.fat || 0,
      fiber: nutritionTotals.fiber || 0,
      sugar: nutritionTotals.sugar || 0,
      sodium: nutritionTotals.sodium || 0,
      potassium: nutritionTotals.potassium || 0,
      proteinGoal: userData.proteinGoal ?? nutritionGoals.proteinTarget ?? DEFAULT_PROTEIN_GOAL,
      carbsGoal: userData.carbsGoal ?? nutritionGoals.carbsTarget ?? DEFAULT_CARBS_GOAL,
      fatGoal: userData.fatGoal ?? nutritionGoals.fatTarget ?? DEFAULT_FAT_GOAL,
      caloriesGoal: calorieGoal,
      micros: currentClient.micros || [],
      foods: foodNames,
    },
    calendar: {
      completed: currentClient.completedDays || [],
      upcoming: currentClient.upcomingDays || [],
      missed: currentClient.missedDays || [],
      upcomingSessions: currentClient.upcomingSessions || [],
    },
    notesAndFiles,
  };
}

async function applyMissingUserDocFallback(ownerUid, currentClient, effectCancelled, setClientData) {
  // Client may be in CRM (trainer_clients) but have no users/{id} row yet — still show notes & CRM fields.
  const notesAndFiles = await loadNotesAndFilesQuietly(ownerUid);
  if (effectCancelled) return;
  setClientData(buildTrainerDashboardClientDataFromCrm(currentClient, notesAndFiles));
}

async function applyExistingUserDocData({
  userData,
  ownerUid,
  trainerId,
  currentClient,
  clientTodayKey,
  effectCancelled,
  setClientData,
}) {
  const notesAndFiles = await loadNotesAndFilesQuietly(ownerUid);
  const { trainingDays, programName } = await loadProgressSummary(trainerId, ownerUid);
  const { nutritionLogs, nutritionTotals, nutritionGoals } = await loadNutritionBundle(
    ownerUid,
    clientTodayKey,
  );
  if (effectCancelled) return;
  setClientData(
    buildDashboardClientData({
      userData,
      currentClient,
      trainingDays,
      programName,
      nutritionLogs,
      nutritionTotals,
      nutritionGoals,
      notesAndFiles,
    }),
  );
}

function logNonBenignTrainerError(label, error) {
  if (isBenignTrainerClientFirestoreError(error)) return;
  console.error(label, error);
}

async function applyUserDocToClientData({
  userDoc,
  ownerUid,
  trainerId,
  currentClient,
  clientTodayKey,
  effectCancelled,
  setClientData,
}) {
  if (!userDoc.exists()) {
    try {
      await applyMissingUserDocFallback(ownerUid, currentClient, effectCancelled, setClientData);
      return;
    } catch (error) {
      logNonBenignTrainerError('Error building client data without user doc:', error);
    }
    if (effectCancelled) return;
    setClientData(buildTrainerDashboardClientDataFromCrm(currentClient, []));
    return;
  }

  try {
    await applyExistingUserDocData({
      userData: userDoc.data(),
      ownerUid,
      trainerId,
      currentClient,
      clientTodayKey,
      effectCancelled,
      setClientData,
    });
  } catch (error) {
    logNonBenignTrainerError('Error updating client data:', error);
  }
}



// ===== MAIN FUNCTION =====

/**
 * Trainer home dashboard for one trainer shell.
 * @param {object} props
 */
const DashboardContent = ({
  isDark,
  clients,
  clientsLoading,
  pendingRequestsCount = 0,
  unreadMessageCount = 0,
  onClientRequestsPress,
  onOpenNotifications,
  onClientsPress,
  onMessagesPress,
  onOpenPhotoGallery,
  onOpenAIWorkouts,
  onOpenDocumentEditor: openDocumentEditor,
  onRefreshClients,
  userName,
  trainerId,
  pdfViewer,
  setPdfViewer,
  defaultClientId,
  onSelectedClientChange,
  onOpenWeeklyReport,
  onTrainerClientRemoved,
  trainerDocsRefreshKey = 0,
  stripeConnectStatus = 'not_connected',
  onOpenPayments,
  appSessionId,
  userEmail = '',
  // empty-vs-data PNG 03: invite code + List me on the empty clients shell
  inviteCode = null,
  onListMe,
}) => {
  // 1. Shell spacing + theme tokens for every block below.
  const shellBottomPad = useShellBottomNavInset(28);
  const themeColors = trainerHomeThemeColors(isDark);
  const [activeTab, setActiveTab] = useState('Progress');
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [clientSelectOpen, setClientSelectOpen] = useState(false);
  const [clientData, setClientData] = useState(null);
  const [loadingClientData, setLoadingClientData] = useState(false);
  const [todayDailyLog, setTodayDailyLog] = useState(null);
  const [latestLoggedWeight, setLatestLoggedWeight] = useState(null);
  const [refreshNotesAndFilesTrigger, setRefreshNotesAndFilesTrigger] = useState(0);
  /** Whether `users/{id}/weeklySummaries` has any docs (green dot on client chip). */
  const [weeklySummaryMap, setWeeklySummaryMap] = useState({});
  const [spreadsheetViewer, setSpreadsheetViewer] = useState({ visible: false, url: null, name: null });
  const [trainerDocuments, setTrainerDocuments] = useState([]);
  const [shareModal, setShareModal] = useState({ visible: false, documentId: null, sharedWith: [] });
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const plusHandlerRef = useRef(() => {});
  const [clientUnreadCount, setClientUnreadCount] = useState(0);
  const [removeClientHold, setRemoveClientHold] = useState(null);
  const [removeClientBusy, setRemoveClientBusy] = useState(false);
  const [payoutNudgeDismissed, setPayoutNudgeDismissed] = useState(false);
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [paymentPopupStripeAccountId, setPaymentPopupStripeAccountId] = useState('');
  // vocab: notice = Design Law NbNoticeSheet payload ({ title, message }) — replaces Alert.alert
  const [notice, setNotice] = useState(null);
  const showNotice = useCallback((title, message) => {
    setNotice({ title, message });
  }, []);

  const PAYOUT_NUDGE_KEY = '@coachconnect_payout_nudge_dismissed_session';

  useEffect(() => {
    if (!trainerId) return undefined;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const snap = await getDoc(doc(db, 'users', trainerId));
        if (cancelled || !snap.exists()) return;
        const user = snap.data() || {};
        setPaymentPopupStripeAccountId(user.stripeAccountId || '');
        if (shouldShowPayoutSetupReminderPopup(user)) {
          setShowPaymentPopup(true);
        }
      } catch (loadError) {
        console.warn('PayoutSetupReminderPopup eligibility check failed:', messageFromCaughtError(loadError));
      }
    }, PAYOUT_REMINDER_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [trainerId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!appSessionId) return;
      try {
        const stored = await AsyncStorage.getItem(PAYOUT_NUDGE_KEY);
        if (!cancelled && stored === appSessionId) {
          setPayoutNudgeDismissed(true);
        }
      } catch (ignoredError) {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appSessionId]);

  const dismissPayoutNudge = useCallback(async () => {
    setPayoutNudgeDismissed(true);
    if (appSessionId) {
      try {
        await AsyncStorage.setItem(PAYOUT_NUDGE_KEY, appSessionId);
      } catch (ignoredError) {
        /* ignore */
      }
    }
  }, [appSessionId]);

  const showPayoutNudge =
    !payoutNudgeDismissed && stripeConnectStatus !== 'active' && !showPaymentPopup;

  const currentClient = clients.find((clientRow) => clientRow.id === selectedClientId) || clients[0];

  const needsYouCount = useMemo(
    () => countNeedsYouBadges(showPayoutNudge, pendingRequestsCount, unreadMessageCount),
    [showPayoutNudge, pendingRequestsCount, unreadMessageCount],
  );

  const clientsWithWeeklyReports = useMemo(
    () => countTruthyWeeklySummaryValues(weeklySummaryMap),
    [weeklySummaryMap],
  );

  const clientDailyHints = useMemo(() => {
    const id = idFromClientRow(currentClient);
    if (!id) return {};
    const sleep =
      (todayDailyLog ? todayDailyLog.sleep_hours : null) ??
      (todayDailyLog ? todayDailyLog.sleepHours : null) ??
      sleepFromClientNutrition(clientData) ??
      null;
    const steps =
      (todayDailyLog ? todayDailyLog.steps : null) ??
      (todayDailyLog ? todayDailyLog.dashboard_steps : null) ??
      (todayDailyLog ? todayDailyLog.step_count : null) ??
      null;
    const hasLog =
      !!todayDailyLog &&
      (sleep != null || steps != null || (todayDailyLog ? todayDailyLog.dashboard_weight : null) != null);
    return {
      [id]: {
        sleep: sleep != null ? sleep : null,
        steps: steps != null ? steps : null,
        loggedToday: hasLog,
      },
    };
  }, [idFromClientRow(currentClient), todayDailyLog, clientData]);

  const textColor = themeColors.text;
  const mutedColor = themeColors.textMuted;

  const clientTodayKey = useMemo(() => {
    if (!idFromClientRow(currentClient)) return getLocalDateKey();
    return getProfileDateKey({
      ...(currentClient || {}),
      timezone: profileTimezoneFromClientData(clientData),
      timeZone: profileTimezoneFromClientData(clientData),
    });
  }, [currentClient, profileTimezoneFromClientData(clientData)]);

  const trainerDocumentsForClient = useMemo(
    () => filterTrainerDocumentsForClient(trainerDocuments, idFromClientRow(currentClient)),
    [trainerDocuments, idFromClientRow(currentClient)],
  );

  const promptRemoveClientFromDashboard = useCallback((client) => {
    if (!client || !client.id || !trainerId) return;
    setRemoveClientHold(client);
  }, [trainerId]);

  // Most recent dailyLogs weight (for Progress when today is empty) — cleared on client switch.
  useEffect(() => {
    const clientId = idFromClientRow(currentClient);
    if (!clientId) {
      setLatestLoggedWeight(null);
      return undefined;
    }

    setLatestLoggedWeight(null);
    let cancelled = false;

    const run = async () => {
      const latestWeight = await fetchLatestLoggedWeight(clientId);
      if (!cancelled) setLatestLoggedWeight(latestWeight);
    };
    run();

    return () => {
      cancelled = true;
    };
  }, [idFromClientRow(currentClient), (todayDailyLog ? todayDailyLog.dashboard_weight : null)]);

  // Report selected client to parent so plus button / modals know which client is active
  useEffect(() => {
    if (idFromClientRow(currentClient) && onSelectedClientChange) {
      onSelectedClientChange(currentClient.id);
    }
  }, [idFromClientRow(currentClient), onSelectedClientChange]);

  // Per-client unread messages badge for the dashboard "Messages" quick action.
  // This watches the messages for the current client/trainer pair only.
  useEffect(() => {
    if (!idFromClientRow(currentClient) || !trainerId || !db) {
      setClientUnreadCount(0);
      return;
    }
    const conversationId = `conv_${currentClient.id}_${trainerId}`;
    const messagesRef = collection(db, 'messages');
    const messagesQuery = query(messagesRef, where('conversationId', '==', conversationId));
    const unsubscribe = onSnapshot(
      messagesQuery,
      (snap) => {
        let count = 0;
        snap.forEach((docSnap) => {
          const messageData = docSnap.data();
          if (messageData.senderId !== trainerId && messageData.read === false) {
            count += 1;
          }
        });
        setClientUnreadCount(count);
      },
      () => {
        setClientUnreadCount(0);
      }
    );
    return () => unsubscribe();
  }, [idFromClientRow(currentClient), trainerId]);

  // Sync client selection from Clients tab navigation
  useEffect(() => {
    if (defaultClientId && clients.some((clientRow) => clientRow.id === defaultClientId)) {
      setSelectedClientId(defaultClientId);
    }
  }, [defaultClientId]);

  // Real-time listener for selected client's today dailyLogs (check-in badges)
  useEffect(() => {
    if (!idFromClientRow(currentClient) || !db) {
      setTodayDailyLog(null);
      return undefined;
    }

    setTodayDailyLog(null);
    const dateKey = clientTodayKey;
    const dailyLogRef = doc(db, 'users', currentClient.id, 'dailyLogs', dateKey);
    const unsubscribe = onSnapshot(
      dailyLogRef,
      (snap) => {
        if (snap.exists()) {
          setTodayDailyLog(snap.data());
        } else {
          setTodayDailyLog(null);
        }
      },
      (error) => {
        if (!isBenignTrainerClientFirestoreError(error)) {
          console.error('Daily logs listener error:', error);
        }
        setTodayDailyLog(null);
      }
    );
    return () => unsubscribe();
  }, [idFromClientRow(currentClient), clientTodayKey]);

  // Local-midnight archive/reset for the selected client (trainer dashboard hides "today" after 12am local)
  useEffect(() => {
    if (!idFromClientRow(currentClient) || !db) return undefined;
    const clientId = currentClient.id;

    const tick = async () => {
      await runClientDashboardDayRolloverTick(clientId, clientTodayKey);
    };

    tick();
    const intervalId = setInterval(tick, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [idFromClientRow(currentClient), clientTodayKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!idFromClientRow(currentClient) || !db) return;
      try {
        const snap = await getDocs(collection(db, 'users', currentClient.id, 'weeklySummaries'));
        if (!cancelled) {
          setWeeklySummaryMap((prev) => ({
            ...prev,
            [currentClient.id]: snap.docs.length > 0,
          }));
        }
      } catch (loadError) {
        if (!isBenignTrainerClientFirestoreError(loadError)) {
          console.error('weeklySummaries presence (dashboard):', loadError);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [idFromClientRow(currentClient)]);

  useEffect(() => {
    if (clients.length === 0) {
      setSelectedClientId(null);
      return;
    }
    const selectedStillOnRoster =
      selectedClientId && clients.some((clientRow) => clientRow.id === selectedClientId);
    if (!selectedStillOnRoster) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients]);

  // Real-time listeners for client data updates
  useEffect(() => {
    if (!idFromClientRow(currentClient) || !trainerId || !db) {
      setClientData(null);
      return undefined;
    }

    setClientData(null);
    let effectCancelled = false;
    const ownerUid = String(currentClient.id);
    const unsubscribers = [];
    
    // Listen to user document changes (weight, profile updates)
    const userUnsub = onSnapshot(
      doc(db, 'users', ownerUid),
      (userDoc) => {
        applyUserDocToClientData({
          userDoc,
          ownerUid,
          trainerId,
          currentClient,
          clientTodayKey,
          effectCancelled,
          setClientData,
        });
      },
      (error) => {
        if (isBenignTrainerClientFirestoreError(error)) {
          loadNotesAndFilesQuietly(ownerUid).then((notesAndFiles) => {
            if (effectCancelled) return;
            setClientData(buildTrainerDashboardClientDataFromCrm(currentClient, notesAndFiles));
          });
          return;
        }
        console.error('User document listener error:', error);
        if (!effectCancelled) setClientData(null);
      },
    );
    
    unsubscribers.push(userUnsub);
    
    // Listen to nutrition changes (watching nutrition_logs collection where clients actually save food)
    const nutritionUnsub = onSnapshot(
      query(collection(db, 'nutrition_logs'), where('user_id', '==', ownerUid)),
      async (snapshot) => {
        // Re-fetch nutrition data when it changes
        try {
          const todayKey = clientTodayKey;
          const nutritionLogs = await getFoodLogsForDate(ownerUid, todayKey);
          const nutritionTotals = calculateMacroTotals(nutritionLogs);
          const foodNames = foodRowsFromNutritionLogs(nutritionLogs);

          if (effectCancelled) return;

          setClientData(prev => {
            if (!prev) return prev;
            
            return {
              ...prev,
              nutrition: {
                ...prev.nutrition,
                calories: nutritionTotals.calories || 0,
                protein: nutritionTotals.protein || 0,
                carbs: nutritionTotals.carbs || 0,
                fat: nutritionTotals.fat || 0,
                fiber: nutritionTotals.fiber || 0,
                sugar: nutritionTotals.sugar || 0,
                sodium: nutritionTotals.sodium || 0,
                potassium: nutritionTotals.potassium || 0,
                foods: foodNames,
              }
            };
          });
        } catch (loadError) {
          if (!isBenignTrainerClientFirestoreError(loadError)) {
            console.error('Error updating nutrition data:', loadError);
          }
        }
      },
      (error) => {
        if (!isBenignTrainerClientFirestoreError(error)) {
          console.error('Nutrition listener error:', error);
        }
      }
    );
    
    unsubscribers.push(nutritionUnsub);

    // Notes & files live in users/{clientId}/notes_and_files — user doc never updates on upload, so listen here.
    const notesColRef = collection(db, 'users', ownerUid, 'notes_and_files');
    const notesUnsub = onSnapshot(
      notesColRef,
      async () => {
        try {
          const notesAndFiles = await getNotesAndFiles(ownerUid);
          if (effectCancelled) return;
          setClientData((prev) => {
            if (prev) return { ...prev, notesAndFiles };
            const merged = combineTraineeProfile(currentClient, {});
            const profileWeight = merged.weight ?? weightFromClientRow(currentClient) ?? null;
            return {
              profileTimezone: null,
              beforeWeight: resolveTrainerProgressBeforeWeight({
                startingWeight: merged.startingWeight ?? startingWeightFromClientRow(currentClient),
                profileWeight,
                crmStartingWeight: startingWeightFromClientRow(currentClient),
                crmWeight: weightFromClientRow(currentClient),
              }),
              currentWeight: profileWeight,
              profileWeight,
              trainingDays: [],
              programName: programNameFromClientRow(currentClient) || 'Custom Program',
              nutrition: {
                calories: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
                fiber: 0,
                sugar: 0,
                sodium: 0,
                potassium: 0,
                proteinGoal: 150,
                carbsGoal: 250,
                fatGoal: 70,
                caloriesGoal: DEFAULT_CALORIE_GOAL,
                micros: microsFromClientRow(currentClient) || [],
                foods: [],
              },
              calendar: {
                completed: completedDaysFromClientRow(currentClient) || [],
                upcoming: upcomingDaysFromClientRow(currentClient) || [],
                missed: missedDaysFromClientRow(currentClient) || [],
                upcomingSessions: upcomingSessionsFromClientRow(currentClient) || [],
              },
              notesAndFiles,
            };
          });
        } catch (loadError) {
          if (!isBenignTrainerClientFirestoreError(loadError)) {
            console.error('Error syncing notes and files:', loadError);
          }
        }
      },
      (err) => {
        if (!isBenignTrainerClientFirestoreError(err)) {
          console.error('notes_and_files listener error:', err);
        }
      },
    );
    unsubscribers.push(notesUnsub);

    return () => {
      effectCancelled = true;
      unsubscribers.forEach(unsub => unsub());
    };
  }, [idFromClientRow(currentClient), trainerId, clientTodayKey]);

  // Refresh notes and files when trigger changes
  useEffect(() => {
    if (!idFromClientRow(currentClient)) return;
    const uid = String(currentClient.id);
    let cancelled = false;
    const refreshNotes = async () => {
      try {
        const notesAndFiles = await getNotesAndFiles(uid);
        if (cancelled) return;
        setClientData((prev) => {
          if (prev) return { ...prev, notesAndFiles };
          return {
            beforeWeight: startingWeightFromClientRow(currentClient) ?? weightFromClientRow(currentClient) ?? null,
            currentWeight: weightFromClientRow(currentClient) ?? null,
            trainingDays: [],
            programName: programNameFromClientRow(currentClient) || 'Custom Program',
            nutrition: {
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
              fiber: 0,
              sugar: 0,
              sodium: 0,
              potassium: 0,
              proteinGoal: 150,
              carbsGoal: 250,
              fatGoal: 70,
              caloriesGoal: DEFAULT_CALORIE_GOAL,
              micros: microsFromClientRow(currentClient) || [],
              foods: [],
            },
            calendar: {
              completed: completedDaysFromClientRow(currentClient) || [],
              upcoming: upcomingDaysFromClientRow(currentClient) || [],
              missed: missedDaysFromClientRow(currentClient) || [],
              upcomingSessions: upcomingSessionsFromClientRow(currentClient) || [],
            },
            notesAndFiles,
          };
        });
      } catch (loadError) {
        if (!isBenignTrainerClientFirestoreError(loadError)) {
          console.error('Error refreshing notes and files:', loadError);
        }
      }
    };
    refreshNotes();
    return () => {
      cancelled = true;
    };
  }, [refreshNotesAndFilesTrigger, idFromClientRow(currentClient)]);

  // Trainer documents (for Notes & Files tab)
  useEffect(() => {
    if (!trainerId) return;
    getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => setTrainerDocuments([]));
  }, [trainerId, trainerDocsRefreshKey]);


  const timeOfDay = useMemo(() => greetingPeriodFromHour(), []);

  const runTrainerTool = useCallback(
    (action) => {
      // 1. Messages jumps to the selected client's thread.
      if (action === 'messages') {
        onMessagesPress && onMessagesPress(idFromClientRow(currentClient));
        return;
      }
      // PNG 05: Document maker opens the “Create something” launcher (spreadsheet editor retired).
      if (action === 'document') {
        setShowCreateSheet(true);
        return;
      }
      if (action === 'notes') {
        setActiveTab('Notes & Files');
        return;
      }
      if (!idFromClientRow(currentClient)) return;
      const payload = {
        id: currentClient.id,
        name: currentClient.name || currentClient.displayName || currentClient.fullName || 'Client',
      };
      if (action === 'aiPlans') {
        onOpenAIWorkouts && onOpenAIWorkouts(payload);
        return;
      }
      if (action === 'photos') {
        onOpenPhotoGallery && onOpenPhotoGallery(payload);
      }
    },
    [
      currentClient,
      onMessagesPress,
      onOpenAIWorkouts,
      onOpenPhotoGallery,
    ],
  );

  // Test notification function for trainers
  const testTrainerNotification = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Please enable notifications in your iPhone settings');
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Coach Connect',
          body: 'New client message received! Check your messages.',
          data: { type: 'trainer_notification', logo: 'coachconnect' },
          sound: 'default',
          icon: require('../../assets/IMG_2562.png'),
        },
        trigger: null,
      });

      alert('✅ Trainer notification sent!');
    } catch (error) {
      console.error('❌ Error sending trainer notification:', error);
      alert('❌ Error sending notification: ' + error.message);
    }
  };

  // Test client message notification
  const testClientMessageNotification = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Please enable notifications in your iPhone settings');
        return;
      }

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'CoachConnect',
          body: 'A client needs your help! Check their workout progress.',
          data: { type: 'client_message', logo: 'coachconnect' },
          sound: 'default',
          icon: require('../../assets/IMG_2562.png'),
        },
        trigger: null,
      });

      alert('✅ Client message notification sent!');
    } catch (error) {
      console.error('❌ Error sending client message notification:', error);
      alert('❌ Error sending notification: ' + error.message);
    }
  };

  const payoutNeedsSubcopy = payoutNeedsSubcopyFromRequests(pendingRequestsCount);

  // Name layout decisions before JSX (no nested ternaries in the tree).
  const hasSelectedClient = clients.length > 0 && !!idFromClientRow(currentClient);
  const clientDisplayName =
    nameFromClientRow(currentClient) || displayNameFromClientRow(currentClient) || 'Client';

  const openDocFromNotesFile = (fileRow) => {
    if (!fileRow) {
      openDocumentEditor && openDocumentEditor({ documentId: null });
      return;
    }
    openDocumentEditor && openDocumentEditor({
      documentId: (fileRow && fileRow.documentId) || (fileRow && fileRow.id) || null,
    });
  };

  const remindClientToLogMeals = () => {
    const firstName = String(
      nameFromClientRow(currentClient) || displayNameFromClientRow(currentClient) || 'Client',
    ).split(/\s+/)[0];
    showNotice('Reminder sent', `${firstName} will get a nudge to log today’s meals.`);
  };

  let todayLabelAndPills = null;
  if (hasSelectedClient) {
    todayLabelAndPills = (
      <>
        <TrainerClientTodayLabel
          clientName={clientDisplayName}
          themeColors={themeColors}
        />
        <TabPills activeTab={activeTab} onTabChange={setActiveTab} isDark={isDark} />
      </>
    );
  }

  let clientTabPanel = null;
  if (hasSelectedClient && loadingClientData) {
    clientTabPanel = (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <ActivityIndicator color={ICON_ACCENT} />
        <Text style={{ color: mutedColor, fontSize: 13, marginTop: 12 }}>Loading client data...</Text>
      </View>
    );
  }
  if (hasSelectedClient && !loadingClientData) {
    clientTabPanel = (
      <View style={{ marginBottom: 8 }}>
        {activeTab === 'Progress' && (
          <ProgressTab
            key={idFromClientRow(currentClient) || 'progress'}
            isDark={isDark}
            clientData={clientData}
            todayDailyLog={todayDailyLog}
            latestLoggedWeight={latestLoggedWeight}
          />
        )}
        {activeTab === 'Nutrition' && (
          <NutritionTab
            key={idFromClientRow(currentClient) || 'nutrition'}
            isDark={isDark}
            clientData={clientData}
            clientName={nameFromClientRow(currentClient) || displayNameFromClientRow(currentClient)}
            onRemindLog={remindClientToLogMeals}
          />
        )}
        {activeTab === 'Sessions' && (
          <CalendarTab
            isDark={isDark}
            clientData={clientData}
            trainerId={trainerId}
            clientId={idFromClientRow(currentClient)}
            clientName={nameFromClientRow(currentClient) || 'Client'}
            trainerName={userName}
            onMessageClient={() => onMessagesPress && onMessagesPress(idFromClientRow(currentClient))}
          />
        )}
        {activeTab === 'Notes & Files' && (
          <TrainerNotesFilesHeroAndWorkspace
            isDark={isDark}
            clientName={nameFromClientRow(currentClient) || 'Client'}
            clientData={clientData}
            trainerDocuments={trainerDocumentsForClient}
            clientId={idFromClientRow(currentClient)}
            trainerId={trainerId}
            onRefetchNotesAndFiles={() => setRefreshNotesAndFilesTrigger((previous) => previous + 1)}
            pdfViewer={pdfViewer}
            setPdfViewer={setPdfViewer}
            spreadsheetViewer={spreadsheetViewer}
            setSpreadsheetViewer={setSpreadsheetViewer}
            onRefetchTrainerDocuments={() => getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => {})}
            onOpenDocumentEditor={openDocFromNotesFile}
            onOpenShareModal={({ documentId, initialSharedWith }) =>
              setShareModal({ visible: true, documentId, sharedWith: initialSharedWith || [] })
            }
          />
        )}
      </View>
    );
  }

  let weeklyReportBlock = (
    <TrainerWeeklyReportEmpty themeColors={themeColors} />
  );
  if (idFromClientRow(currentClient)) {
    weeklyReportBlock = (
      <TrainerWeeklyReportSection
        clientId={currentClient.id}
        clientName={currentClient.name || currentClient.displayName || ''}
        isDark={isDark}
        clientsLogged={clientsWithWeeklyReports}
        clientsTotal={clients.length}
        onOpenWeeklyReport={onOpenWeeklyReport}
      />
    );
  }

  return (
    <>
    <View style={{ flex: 1, minHeight: 0, backgroundColor: themeColors.solidBg }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingBottom: Math.max(shellBottomPad, nb.bottomNavClearance),
        paddingHorizontal: nb.screenGutter,
        paddingTop: 8,
      }}
      {...FORM_SCROLL_PROPS}
    >
      <TrainerHeader
        themeColors={themeColors}
        userName={userName}
        greetingPeriod={timeOfDay}
        onNotificationsPress={() => {
          if (typeof onOpenNotifications === 'function') onOpenNotifications();
          else onClientRequestsPress && onClientRequestsPress();
        }}
      />

      <TrainerMotivationCard themeColors={themeColors} />

      <TrainerNeedsYou
        themeColors={themeColors}
        needsCount={needsYouCount}
        showPayoutBlock={showPayoutNudge}
        stripeConnectStatus={stripeConnectStatus}
        pendingRequestsCount={pendingRequestsCount}
        unreadMessageCount={unreadMessageCount}
        payoutSubcopy={payoutNeedsSubcopy}
        onOpenPayments={() => {
          dismissPayoutNudge();
          if (typeof onOpenPayments === 'function') onOpenPayments();
          else setShowPaymentPopup(true);
        }}
        onClientRequestsPress={onClientRequestsPress}
        onMessagesPress={() => onMessagesPress && onMessagesPress(idFromClientRow(currentClient))}
      />

      <TrainerClientCarousel
        themeColors={themeColors}
        clients={clients}
        selectedClientId={idFromClientRow(currentClient)}
        weeklySummaryMap={weeklySummaryMap}
        dailyHints={clientDailyHints}
        onSelectClient={setSelectedClientId}
        onRemoveClient={promptRemoveClientFromDashboard}
        inviteCode={inviteCode}
        onCopyInvite={async (code) => {
          const raw = String(code || '').trim();
          if (!raw) {
            showNotice('Invite code', 'Your invite code is not ready yet.');
            return;
          }
          try {
            await Clipboard.setStringAsync(raw);
            showNotice('Copied', 'Invite code copied.');
          } catch (ignoredError) {
            showNotice('Copy failed', 'Could not copy the invite code.');
          }
        }}
        onListMe={() => {
          if (typeof onListMe === 'function') onListMe();
          else onClientsPress && onClientsPress();
        }}
      />

      {todayLabelAndPills}
      {clientTabPanel}

      <TrainerToolsGrid
        themeColors={themeColors}
        onToolPress={runTrainerTool}
        messageBadge={clientUnreadCount}
      />

      {weeklyReportBlock}

      <View style={{ height: 16 }} />
      <SpreadsheetViewer
        visible={spreadsheetViewer.visible}
        url={spreadsheetViewer.url}
        name={spreadsheetViewer.name}
        isDark={isDark}
        onClose={() => setSpreadsheetViewer({ visible: false, url: null, name: null })}
      />
      <ShareDocumentPopup
        visible={shareModal.visible}
        trainerId={trainerId}
        documentId={shareModal.documentId}
        initialSharedWith={shareModal.sharedWith}
        isDark={isDark}
        onClose={() => setShareModal({ visible: false, documentId: null, sharedWith: [] })}
        onSaved={() => {
          getTrainerDocuments(trainerId).then(setTrainerDocuments);
          setRefreshNotesAndFilesTrigger((previous) => previous + 1);
        }}
      />
    </ScrollView>
    </View>

    <RemoveClientSheet
      visible={!!removeClientHold}
      onClose={() => !removeClientBusy && setRemoveClientHold(null)}
      clientName={
        String((removeClientHold ? removeClientHold.name : null) || (removeClientHold ? removeClientHold.displayName : null) || 'Client').trim() || 'Client'
      }
      busy={removeClientBusy}
      onConfirm={async () => {
        const client = removeClientHold;
        if (!client || !client.id || !trainerId) return;
        if (!functions) {
          showNotice('Unavailable', 'Cloud Functions are not configured.');
          return;
        }
        setRemoveClientBusy(true);
        try {
          const displayName = String(client.name || client.displayName || 'Client').trim() || 'Client';
          const fn = httpsCallable(functions, 'removeTrainerClientLink');
          await fn({
            trainerId,
            clientId: client.id,
            reasons: [],
            otherText: null,
            removedBy: 'trainer',
          });
          const removedId = client.id;
          setRemoveClientHold(null);
          setSelectedClientId((sel) => {
            if (sel !== removedId) return sel;
            const remaining = clients.filter((clientRow) => clientRow.id !== removedId);
            return remaining[0] ? remaining[0].id : null;
          });
          onTrainerClientRemoved && onTrainerClientRemoved(removedId);
          showNotice('Client removed', `${displayName} is no longer on your roster.`);
        } catch (loadError) {
          showNotice('Remove failed', messageFromCaughtError(loadError) || 'Could not remove this client.');
        } finally {
          setRemoveClientBusy(false);
        }
      }}
    />
    {showPaymentPopup ? (
      <PayoutSetupReminderPopup
        visible={showPaymentPopup}
        onClose={() => setShowPaymentPopup(false)}
        userEmail={userEmail}
        stripeAccountId={paymentPopupStripeAccountId}
      />
    ) : null}
    <TrainerCreateSheet
      visible={showCreateSheet}
      onClose={() => setShowCreateSheet(false)}
      isDark={isDark}
      onRichText={() => openDocumentEditor && openDocumentEditor({ documentId: null })}
    />
    <NbNoticeSheet
      visible={!!notice}
      onClose={() => setNotice(null)}
      title={(notice ? notice.title : '') || ''}
      message={notice ? notice.message : undefined}
      confirmLabel="OK"
    />
    </>
  );
};

export default DashboardContent;

// ===== PLUMBING — skip unless debugging =====
// Firestore loaders and dashboard shape builders live under HELPER FUNCTIONS above.
