// Trainer home — Design Law layout (docs/design/Design-Law/screens/trainer-home).
// Flow: greeting → motivation → needs you → client carousel → today tabs → tools → weekly report.
// Data/Firebase unchanged. Chrome lives in DesignLawTrainerHomeBlocks.jsx + trainerHomePieces.jsx.

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import HoldToConfirmPopup from '../../for-both/popups/HoldToConfirmPopup';
import SpreadsheetViewer from '../../for-both/files-and-notes/viewers/SpreadsheetViewer';
import ShareDocumentPopup from '../documents/ShareDocumentPopup';
import { useDailyQuote } from '../../for-both/home-cards/DailyQuoteCard';
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
  DesignLawTrainerClientCarousel,
  DesignLawTrainerClientTodayLabel,
  DesignLawTrainerHeader,
  DesignLawTrainerMotivationCard,
  DesignLawTrainerNeedsYou,
  DesignLawTrainerToolsGrid,
  trainerHomeThemeColors,
} from './DesignLawTrainerHomeBlocks';
import DesignLawTrainerCreateSheet, {
  buildCustomProgramStarterRows,
} from './DesignLawTrainerCreateSheet';
import { PayoutSetupReminderPopup } from '../../for-both/payments/PayoutSetupReminderPopup';
import { shouldShowPayoutSetupReminderPopup } from '../../for-both/payments/whenToAskForPayoutSetup';
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

/**
 * CRM-only dashboard shape when the client has no users/{id} row yet.
 * Same letters as TrainerAppStart's local helper of this name.
 * @param {object} currentClient
 * @param {Array} [notesAndFiles]
 * @returns {object}
 */
function buildTrainerDashboardClientDataFromCrm(currentClient, notesAndFiles = []) {
  return {
    beforeWeight: currentClient?.startingWeight ?? currentClient?.weight ?? null,
    currentWeight: currentClient?.weight ?? null,
    trainingDays: [],
    programName: currentClient?.programName || 'Custom Program',
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
      micros: currentClient?.micros || [],
      foods: [],
    },
    calendar: {
      completed: currentClient?.completedDays || [],
      upcoming: currentClient?.upcomingDays || [],
      missed: currentClient?.missedDays || [],
      upcomingSessions: currentClient?.upcomingSessions || [],
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
  } catch (_) {
    return [];
  }
}

async function loadProgressSummary(trainerId, ownerUid) {
  try {
    const progressSnap = await getDocs(
      collection(db, `trainer_clients/${trainerId}/clients/${ownerUid}/progress`),
    );
    const progressDocs = progressSnap.docs.map((progressDoc) => progressDoc.data());
    if (progressDocs.length === 0) return { trainingDays: [], programName: null };
    const latest = progressDocs[progressDocs.length - 1];
    return {
      trainingDays: latest.trainingDays || [],
      programName: latest.programName || null,
    };
  } catch (_) {
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
    if (goalsData?.proteinTarget != null) nutritionGoals.proteinTarget = goalsData.proteinTarget;
    if (goalsData?.carbsTarget != null) nutritionGoals.carbsTarget = goalsData.carbsTarget;
    if (goalsData?.fatTarget != null) nutritionGoals.fatTarget = goalsData.fatTarget;
    if (goalsData?.calories != null) nutritionGoals.calories = goalsData.calories;
    return { nutritionLogs, nutritionTotals, nutritionGoals };
  } catch (_) {
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
  const foodNames = nutritionLogs
    .map((logRow, index) => ({
      id: logRow.id || `food-${index}`,
      name: logRow.food_name || logRow.foodName || 'Food',
      meal: logRow.meal_type || logRow.mealType || logRow.meal || 'Meal',
      calories: logRow.calories != null ? Number(logRow.calories) : null,
    }))
    .filter((row) => row.name);
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
      userData.timezone || userData.timeZone || userData?.workoutReminder?.timeZone || null,
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
  onClientsPress,
  onMessagesPress,
  onOpenPhotoGallery,
  onOpenAIWorkouts,
  onOpenDocumentEditor: openDocumentEditor,
  onOpenSpreadsheetEditor: openSpreadsheetEditor,
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
}) => {
  const shellBottomPad = useShellBottomNavInset(28);
  const dailyQuote = useDailyQuote(trainerId);
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
  const [payoutNudgeDismissed, setPayoutNudgeDismissed] = useState(false);
  const [showPaymentPopup, setShowPaymentPopup] = useState(false);
  const [paymentPopupStripeAccountId, setPaymentPopupStripeAccountId] = useState('');

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
      } catch (e) {
        console.warn('PayoutSetupReminderPopup eligibility check failed:', e?.message || e);
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
      } catch (_) {
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
      } catch (_) {
        /* ignore */
      }
    }
  }, [appSessionId]);

  const showPayoutNudge =
    !payoutNudgeDismissed && stripeConnectStatus !== 'active' && !showPaymentPopup;

  const currentClient = clients.find((c) => c.id === selectedClientId) || clients[0];

  const needsYouCount = useMemo(() => {
    let n = 0;
    if (showPayoutNudge) n += 1;
    if (pendingRequestsCount > 0) n += 1;
    if (unreadMessageCount > 0) n += 1;
    return n;
  }, [showPayoutNudge, pendingRequestsCount, unreadMessageCount]);

  const clientsWithWeeklyReports = useMemo(
    () => Object.values(weeklySummaryMap).filter(Boolean).length,
    [weeklySummaryMap],
  );

  const clientDailyHints = useMemo(() => {
    const id = currentClient?.id;
    if (!id) return {};
    const sleep =
      todayDailyLog?.sleep_hours ??
      todayDailyLog?.sleepHours ??
      clientData?.nutrition?.sleep ??
      null;
    const steps =
      todayDailyLog?.steps ??
      todayDailyLog?.dashboard_steps ??
      todayDailyLog?.step_count ??
      null;
    const hasLog =
      !!todayDailyLog &&
      (sleep != null || steps != null || todayDailyLog?.dashboard_weight != null);
    return {
      [id]: {
        sleep: sleep != null ? sleep : null,
        steps: steps != null ? steps : null,
        loggedToday: hasLog,
      },
    };
  }, [currentClient?.id, todayDailyLog, clientData]);

  const textColor = themeColors.text;
  const mutedColor = themeColors.textMuted;

  const clientTodayKey = useMemo(() => {
    if (!currentClient?.id) return getLocalDateKey();
    return getProfileDateKey({
      ...(currentClient || {}),
      timezone: clientData?.profileTimezone,
      timeZone: clientData?.profileTimezone,
    });
  }, [currentClient, clientData?.profileTimezone]);

  const trainerDocumentsForClient = useMemo(
    () => filterTrainerDocumentsForClient(trainerDocuments, currentClient?.id),
    [trainerDocuments, currentClient?.id],
  );

  const promptRemoveClientFromDashboard = useCallback((client) => {
    if (!client?.id || !trainerId) return;
    setRemoveClientHold(client);
  }, [trainerId]);

  // Most recent dailyLogs weight (for Progress when today is empty) — cleared on client switch.
  useEffect(() => {
    const clientId = currentClient?.id;
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
  }, [currentClient?.id, todayDailyLog?.dashboard_weight]);

  // Report selected client to parent so plus button / modals know which client is active
  useEffect(() => {
    if (currentClient?.id && onSelectedClientChange) {
      onSelectedClientChange(currentClient.id);
    }
  }, [currentClient?.id, onSelectedClientChange]);

  // Per-client unread messages badge for the dashboard "Messages" quick action.
  // This watches the messages for the current client/trainer pair only.
  useEffect(() => {
    if (!currentClient?.id || !trainerId || !db) {
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
  }, [currentClient?.id, trainerId]);

  // Sync client selection from Clients tab navigation
  useEffect(() => {
    if (defaultClientId && clients.some((c) => c.id === defaultClientId)) {
      setSelectedClientId(defaultClientId);
    }
  }, [defaultClientId]);

  // Real-time listener for selected client's today dailyLogs (check-in badges)
  useEffect(() => {
    if (!currentClient?.id || !db) {
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
  }, [currentClient?.id, clientTodayKey]);

  // Local-midnight archive/reset for the selected client (trainer dashboard hides "today" after 12am local)
  useEffect(() => {
    if (!currentClient?.id || !db) return;
    const clientId = currentClient.id;
    const LAST_KEY = `trainer_dashboard_last_dateKey_${clientId}`;
    const PENDING_KEY = `trainer_dashboard_pending_reset_${clientId}`;

    const runArchive = async (prevKey) => {
      if (!prevKey) return;
      try {
        const [logsSnap, trackSnap] = await Promise.all([
          getDoc(doc(db, 'users', clientId, 'dailyLogs', prevKey)).catch(() => null),
          // TODO(phase-5): remove legacy daily_tracking read after backfill
          getDoc(doc(db, 'users', clientId, 'daily_tracking', prevKey)).catch(() => null),
        ]);
        const dailyLogsData = logsSnap?.exists?.() ? (logsSnap.data() || {}) : null;
        const trackingData = trackSnap?.exists?.() ? (trackSnap.data() || {}) : null;

        const archiveDocId = `${clientId}_${prevKey}`;
        await setDoc(
          doc(db, 'daily_logs', archiveDocId),
          {
            userId: clientId,
            date: prevKey,
            workouts: {
              workoutLog: dailyLogsData?.workoutLog || null,
              workoutSummary: trackingData?.workoutSummary || dailyLogsData?.dashboard_workouts || null,
              workoutName: trackingData?.workoutName || dailyLogsData?.dashboard_workout_name || null,
              workoutExercises: trackingData?.workoutExercises || null,
            },
            nutrition: {
              caloriesConsumed: typeof trackingData?.caloriesConsumed === 'number' ? trackingData.caloriesConsumed : null,
              macros: trackingData?.macroTotals || null,
            },
            streak_count: typeof dailyLogsData?.streak_count === 'number' ? dailyLogsData.streak_count : null,
            timestamp: serverTimestamp(),
          },
          { merge: true }
        );
        await AsyncStorage.removeItem(PENDING_KEY);
      } catch (e) {
        await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({ prevKey, at: Date.now() }));
      }
    };

    const tick = async () => {
      const nowKey = clientTodayKey;
      const lastKey = await AsyncStorage.getItem(LAST_KEY);
      if (!lastKey) {
        await AsyncStorage.setItem(LAST_KEY, nowKey);
      } else if (lastKey !== nowKey) {
        await AsyncStorage.setItem(LAST_KEY, nowKey);
        await runArchive(lastKey);
      }

      const pending = await AsyncStorage.getItem(PENDING_KEY);
      if (pending) {
        let parsed = null;
        try { parsed = JSON.parse(pending); } catch (_) {}
        if (parsed?.prevKey) await runArchive(parsed.prevKey);
      }
    };

    tick();
    const id = setInterval(tick, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [currentClient?.id, clientTodayKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentClient?.id || !db) return;
      try {
        const snap = await getDocs(collection(db, 'users', currentClient.id, 'weeklySummaries'));
        if (!cancelled) {
          setWeeklySummaryMap((prev) => ({
            ...prev,
            [currentClient.id]: snap.docs.length > 0,
          }));
        }
      } catch (e) {
        if (!isBenignTrainerClientFirestoreError(e)) {
          console.error('weeklySummaries presence (dashboard):', e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentClient?.id]);

  useEffect(() => {
    if (clients.length === 0) { setSelectedClientId(null); return; }
    if (!selectedClientId || !clients.some((c) => c.id === selectedClientId)) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients]);

  // Real-time listeners for client data updates
  useEffect(() => {
    if (!currentClient?.id || !trainerId || !db) {
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
          const foodNames = nutritionLogs
            .map((l, index) => ({
              id: l.id || `food-${index}`,
              name: l.food_name || l.foodName || 'Food',
              meal: l.meal_type || l.mealType || l.meal || 'Meal',
              calories: l.calories != null ? Number(l.calories) : null,
            }))
            .filter((row) => row.name);

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
        } catch (e) {
          if (!isBenignTrainerClientFirestoreError(e)) {
            console.error('Error updating nutrition data:', e);
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
            const profileWeight = merged.weight ?? currentClient?.weight ?? null;
            return {
              profileTimezone: null,
              beforeWeight: resolveTrainerProgressBeforeWeight({
                startingWeight: merged.startingWeight ?? currentClient?.startingWeight,
                profileWeight,
                crmStartingWeight: currentClient?.startingWeight,
                crmWeight: currentClient?.weight,
              }),
              currentWeight: profileWeight,
              profileWeight,
              trainingDays: [],
              programName: currentClient?.programName || 'Custom Program',
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
                micros: currentClient?.micros || [],
                foods: [],
              },
              calendar: {
                completed: currentClient?.completedDays || [],
                upcoming: currentClient?.upcomingDays || [],
                missed: currentClient?.missedDays || [],
                upcomingSessions: currentClient?.upcomingSessions || [],
              },
              notesAndFiles,
            };
          });
        } catch (e) {
          if (!isBenignTrainerClientFirestoreError(e)) {
            console.error('Error syncing notes and files:', e);
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
  }, [currentClient?.id, trainerId, clientTodayKey]);

  // Refresh notes and files when trigger changes
  useEffect(() => {
    if (!currentClient?.id) return;
    const uid = String(currentClient.id);
    let cancelled = false;
    const refreshNotes = async () => {
      try {
        const notesAndFiles = await getNotesAndFiles(uid);
        if (cancelled) return;
        setClientData((prev) => {
          if (prev) return { ...prev, notesAndFiles };
          return {
            beforeWeight: currentClient?.startingWeight ?? currentClient?.weight ?? null,
            currentWeight: currentClient?.weight ?? null,
            trainingDays: [],
            programName: currentClient?.programName || 'Custom Program',
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
              micros: currentClient?.micros || [],
              foods: [],
            },
            calendar: {
              completed: currentClient?.completedDays || [],
              upcoming: currentClient?.upcomingDays || [],
              missed: currentClient?.missedDays || [],
              upcomingSessions: currentClient?.upcomingSessions || [],
            },
            notesAndFiles,
          };
        });
      } catch (e) {
        if (!isBenignTrainerClientFirestoreError(e)) {
          console.error('Error refreshing notes and files:', e);
        }
      }
    };
    refreshNotes();
    return () => {
      cancelled = true;
    };
  }, [refreshNotesAndFilesTrigger, currentClient?.id]);

  // Trainer documents (for Notes & Files tab)
  useEffect(() => {
    if (!trainerId) return;
    getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => setTrainerDocuments([]));
  }, [trainerId, trainerDocsRefreshKey]);


  const timeOfDay = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < MORNING_HOUR_END) return 'Morning';
    if (hour < AFTERNOON_HOUR_END) return 'Afternoon';
    return 'Evening';
  }, []);

  const runTrainerTool = useCallback(
    (action) => {
      if (action === 'messages') {
        onMessagesPress?.(currentClient?.id);
        return;
      }
      // PNG 05: Document maker and Spreadsheet creator share one “Create something” launcher.
      if (action === 'document' || action === 'spreadsheet') {
        setShowCreateSheet(true);
        return;
      }
      if (action === 'notes') {
        setActiveTab('Notes & Files');
        return;
      }
      if (!currentClient?.id) return;
      const payload = {
        id: currentClient.id,
        name: currentClient.name || currentClient.displayName || currentClient.fullName || 'Client',
      };
      if (action === 'aiPlans') {
        onOpenAIWorkouts?.(payload);
        return;
      }
      if (action === 'photos') {
        onOpenPhotoGallery?.(payload);
      }
    },
    [
      currentClient,
      onMessagesPress,
      openDocumentEditor,
      openSpreadsheetEditor,
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

  const payoutNeedsSubcopy =
    pendingRequestsCount > 0
      ? `${pendingRequestsCount} new request${pendingRequestsCount === 1 ? '' : 's'} ${pendingRequestsCount === 1 ? 'is' : 'are'} waiting on this.`
      : undefined;

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
      <DesignLawTrainerHeader
        themeColors={themeColors}
        userName={userName}
        greetingPeriod={timeOfDay}
        onNotificationsPress={() => onClientRequestsPress?.()}
      />

      <DesignLawTrainerMotivationCard
        themeColors={themeColors}
        quoteText={dailyQuote?.q}
        quoteAuthor={dailyQuote?.a}
      />

      <DesignLawTrainerNeedsYou
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
        onMessagesPress={() => onMessagesPress?.(currentClient?.id)}
      />

      <DesignLawTrainerClientCarousel
        themeColors={themeColors}
        clients={clients}
        selectedClientId={currentClient?.id}
        weeklySummaryMap={weeklySummaryMap}
        dailyHints={clientDailyHints}
        onSelectClient={setSelectedClientId}
        onRemoveClient={promptRemoveClientFromDashboard}
      />

      {clients.length > 0 && currentClient?.id ? (
        <>
          <DesignLawTrainerClientTodayLabel
            clientName={currentClient.name || currentClient.displayName || 'Client'}
            themeColors={themeColors}
          />
          <TabPills activeTab={activeTab} onTabChange={setActiveTab} isDark={isDark} />
        </>
      ) : null}

      {clients.length > 0 && currentClient?.id ? (
        loadingClientData ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator color={ICON_ACCENT} />
          <Text style={{ color: mutedColor, fontSize: 13, marginTop: 12 }}>Loading client data...</Text>
        </View>
        ) : (
        <View style={{ marginBottom: 8 }}>
          {activeTab === 'Progress' && (
            <ProgressTab
              key={currentClient?.id || 'progress'}
              isDark={isDark}
              clientData={clientData}
              todayDailyLog={todayDailyLog}
              latestLoggedWeight={latestLoggedWeight}
            />
          )}
          {activeTab === 'Nutrition' && (
            <NutritionTab key={currentClient?.id || 'nutrition'} isDark={isDark} clientData={clientData} />
          )}
          {activeTab === 'Sessions' && (
            <CalendarTab
              isDark={isDark}
              clientData={clientData}
              trainerId={trainerId}
              clientId={currentClient?.id}
              clientName={currentClient?.name || 'Client'}
              trainerName={userName}
            />
          )}
          {activeTab === 'Notes & Files' && (
            <TrainerNotesFilesHeroAndWorkspace
              isDark={isDark}
              clientName={currentClient?.name || 'Client'}
              clientData={clientData}
              trainerDocuments={trainerDocumentsForClient}
              clientId={currentClient?.id}
              trainerId={trainerId}
              onRefetchNotesAndFiles={() => setRefreshNotesAndFilesTrigger((t) => t + 1)}
              pdfViewer={pdfViewer}
              setPdfViewer={setPdfViewer}
              spreadsheetViewer={spreadsheetViewer}
              setSpreadsheetViewer={setSpreadsheetViewer}
              onRefetchTrainerDocuments={() => getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => {})}
              onOpenDocumentEditor={(f) => {
                if (!f) {
                  openDocumentEditor?.({ documentId: null });
                  return;
                }
                openDocumentEditor?.({
                  documentId: f?.documentId || f?.id || null,
                });
              }}
              onOpenShareModal={({ documentId, initialSharedWith }) =>
                setShareModal({ visible: true, documentId, sharedWith: initialSharedWith || [] })
              }
              onOpenSpreadsheetEditor={(f) => {
                if (!f) {
                  openSpreadsheetEditor?.({ documentId: null, title: '', rows: null });
                  return;
                }
                openSpreadsheetEditor?.({
                  documentId: f?.documentId || f?.id || null,
                  title: f?.title || f?.name || '',
                  rows: null,
                });
              }}
              onImportSpreadsheet={(item) => {
                if (!item?.url) return;
                setSpreadsheetViewer({ visible: true, url: item.url, name: item?.name || 'Spreadsheet' });
              }}
            />
          )}
        </View>
        )
      ) : null}

      <DesignLawTrainerToolsGrid
        themeColors={themeColors}
        onToolPress={runTrainerTool}
        messageBadge={clientUnreadCount}
      />

      {currentClient?.id ? (
        <TrainerWeeklyReportSection
          clientId={currentClient.id}
          clientName={currentClient.name || currentClient.displayName || ''}
          isDark={isDark}
          clientsLogged={clientsWithWeeklyReports}
          clientsTotal={clients.length}
          onOpenWeeklyReport={onOpenWeeklyReport}
        />
      ) : null}

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
        onSaved={() => { getTrainerDocuments(trainerId).then(setTrainerDocuments); setRefreshNotesAndFilesTrigger((t) => t + 1); }}
      />
    </ScrollView>
    </View>

    <HoldToConfirmPopup
      visible={!!removeClientHold}
      onClose={() => setRemoveClientHold(null)}
      isDark={isDark}
      title="Remove from roster?"
      message={
        removeClientHold
          ? `${String(removeClientHold.name || removeClientHold.displayName || 'Client').trim() || 'Client'} will lose trainer access. They can send a new request if you work together again.`
          : ''
      }
      holdDurationMs={1200}
      pillLabel="Hold until bar fills to remove"
      barGradient={['#E25588', '#DB7093']}
      onHoldComplete={async () => {
        const client = removeClientHold;
        if (!client?.id || !trainerId) return;
        if (!functions) {
          throw new Error('Cloud Functions are not configured.');
        }
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
        setSelectedClientId((sel) => {
          if (sel !== removedId) return sel;
          const remaining = clients.filter((c) => c.id !== removedId);
          return remaining[0]?.id ?? null;
        });
        onTrainerClientRemoved?.(removedId);
        Alert.alert('Client removed', `${displayName} is no longer on your roster.`);
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
    <DesignLawTrainerCreateSheet
      visible={showCreateSheet}
      onClose={() => setShowCreateSheet(false)}
      isDark={isDark}
      onRichText={() => openDocumentEditor?.({ documentId: null })}
      onBlankGrid={() =>
        openSpreadsheetEditor?.({ documentId: null, title: '', rows: null })
      }
      onCustomProgram={() =>
        openSpreadsheetEditor?.({
          documentId: null,
          title: 'Custom program',
          rows: buildCustomProgramStarterRows(),
        })
      }
    />
    </>
  );
};

// ─────────────────────────────────────────────
// APP WITH THEME
// ─────────────────────────────────────────────

export default DashboardContent;
