/**
 * Trainer Dashboard Content
 *
 * Purpose: UI screen or component: Trainer Dashboard Content. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: (see file)
 *
 * @file-header
 */
/** Trainer home dashboard (client roster + tabs) */
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
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, onSnapshot, collection, getDocs, setDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../app-start/config';
import { getProfileDateKey } from '../../shared-utils/dateKeys';
import { getLocalDateKey } from '../../shared-utils/getLocalDay';
import { fetchLatestLoggedWeight } from '../../metrics/daily-metrics/getRecentWeight';
import { getFoodLogsForDate, calculateMacroTotals, getDailyGoals } from '../../nutrition/daily-log/logFoodToFirestore';
import {
  filterTrainerDocumentsForClient,
  getTrainerDocuments,
  getNotesAndFiles,
} from '../../shared/notes-files/manageNotesAndFiles';
import HoldToConfirmModal from '../../shared/components/modals/HoldToConfirmModal';
import SpreadsheetViewerModal from '../../shared/components/notes-files/SpreadsheetViewerModal';
import ShareDocumentModal from '../documents/ShareDocumentModal';
import QuickActionCard from '../../shared/components/home/QuickActionCard';
import TrainerWeeklyReportSection from '../weekly-report/TrainerWeeklyReportSection';
import ProgressTab from '../progress-tab/TrainerProgressTab';
import NutritionTab from '../nutrition-tab/TrainerNutritionTab';
import CalendarTab from '../calendar-tab/TrainerCalendarTab';
import { FORM_SCROLL_PROPS, useShellBottomNavInset } from '../../navigation/bottomNavMetrics';
import { normalizeClientProfileFields } from '../../shared-utils/resolveClientProfileFields';
import { mergeTrainerClientProfile } from '../../shared-utils/mergeTrainerClientProfile';
import {
  resolveTrainerProgressBeforeWeight,
} from '../progress-tab/resolveTrainerProgressWeight';
import { isBenignTrainerClientFirestoreError } from '../crm/trainerFirestoreErrors';
import {
  AuroraHeroBanner,
  Icon,
  TabPills,
  TrainerNotesFilesHeroAndWorkspace,
  getClientInitials,
  getClientRosterStats,
} from './trainerDashboardUi';
import { PaymentSetupPopup } from '../../components/PaymentSetupPopup';
import { shouldShowPaymentSetupPopup } from '../../shared/payments/paymentSetupPrompt';

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
  const { width: screenW } = useWindowDimensions();
  const shellBottomPad = useShellBottomNavInset(28);
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
        if (shouldShowPaymentSetupPopup(user)) {
          setShowPaymentPopup(true);
        }
      } catch (e) {
        console.warn('PaymentSetupPopup eligibility check failed:', e?.message || e);
      }
    }, 2000);

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

  const textColor = isDark ? '#ffffff' : '#1a0a2e';
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.5)';
  /** Wide “profile” cards (~one per viewport + peek of next), not narrow chips. */
  const rosterCardWidth = Math.max(268, Math.min(340, Math.round((screenW - 40) * 0.9)));
  /** Quick actions: ~2 cards visible + peek (between old 168px and full-width roster). */
  const quickActionCardWidth = Math.max(200, Math.min(216, Math.round((screenW - 56) * 0.5)));

  const currentClient = clients.find((c) => c.id === selectedClientId) || clients[0];

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
      const w = await fetchLatestLoggedWeight(clientId);
      if (!cancelled) setLatestLoggedWeight(w);
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
    const q = query(messagesRef, where('conversationId', '==', conversationId));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        let count = 0;
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.senderId !== trainerId && d.read === false) {
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
    const id = setInterval(tick, 30000);
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
      async (userDoc) => {
        // Client may be in CRM (trainer_clients) but have no users/{id} row yet — still show notes & CRM fields.
        if (!userDoc.exists()) {
          try {
            let notesAndFiles = [];
            try {
              notesAndFiles = await getNotesAndFiles(ownerUid);
            } catch (_) {}
            if (effectCancelled) return;
            setClientData(buildTrainerDashboardClientDataFromCrm(currentClient, notesAndFiles));
          } catch (e) {
            if (!isBenignTrainerClientFirestoreError(e)) {
              console.error('Error building client data without user doc:', e);
            }
            if (!effectCancelled) setClientData(buildTrainerDashboardClientDataFromCrm(currentClient, []));
          }
          return;
        }

        const userData = userDoc.data();
        
        // Fetch other related data
        try {
          let notesAndFiles = [];
          try { notesAndFiles = await getNotesAndFiles(ownerUid); } catch (_) {}
          
          let trainingDays = [], programName = null;
          try {
            const progressSnap = await getDocs(collection(db, `trainer_clients/${trainerId}/clients/${ownerUid}/progress`));
            const progressDocs = progressSnap.docs.map((d) => d.data());
            if (progressDocs.length > 0) {
              const latest = progressDocs[progressDocs.length - 1];
              trainingDays = latest.trainingDays || [];
              programName = latest.programName || null;
            }
          } catch (_) {}
          
          const todayKey = clientTodayKey;
          let nutritionLogs = [], nutritionTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
          let nutritionGoals = { proteinTarget: 150, carbsTarget: 250, fatTarget: 70, calories: 2000 };
          try {
            nutritionLogs = await getFoodLogsForDate(ownerUid, todayKey);
            nutritionTotals = calculateMacroTotals(nutritionLogs);
            const goalsData = await getDailyGoals(ownerUid);
            if (goalsData?.proteinTarget != null) nutritionGoals.proteinTarget = goalsData.proteinTarget;
            if (goalsData?.carbsTarget != null) nutritionGoals.carbsTarget = goalsData.carbsTarget;
            if (goalsData?.fatTarget != null) nutritionGoals.fatTarget = goalsData.fatTarget;
            if (goalsData?.calories != null) nutritionGoals.calories = goalsData.calories;
          } catch (_) {}
          
          if (effectCancelled) return;

          const foodNames = nutritionLogs.map((l) => l.food_name || l.foodName || 'Food').filter(Boolean);
          const calorieGoal =
            userData.calorieTarget ??
            userData.calorie_target ??
            userData.dailyCalories ??
            nutritionGoals.calories ??
            2000;
          
          const normalized = normalizeClientProfileFields(userData);
          const mergedProfile = mergeTrainerClientProfile(currentClient, normalized);
          const profileWeight = mergedProfile.weight ?? normalized.weight ?? null;

          setClientData({
            profileTimezone: userData.timezone || userData.timeZone || userData?.workoutReminder?.timeZone || null,
            beforeWeight: resolveTrainerProgressBeforeWeight({
              startingWeight: mergedProfile.startingWeight ?? normalized.startingWeight,
              profileWeight,
              crmStartingWeight: currentClient.startingWeight,
              crmWeight: currentClient.weight,
            }),
            currentWeight: profileWeight,
            profileWeight,
            trainingDays, programName,
            nutrition: {
              calories: nutritionTotals.calories || 0, protein: nutritionTotals.protein || 0,
              carbs: nutritionTotals.carbs || 0, fat: nutritionTotals.fat || 0,
              fiber: nutritionTotals.fiber || 0, sugar: nutritionTotals.sugar || 0,
              sodium: nutritionTotals.sodium || 0, potassium: nutritionTotals.potassium || 0,
              proteinGoal: userData.proteinGoal ?? nutritionGoals.proteinTarget ?? 150,
              carbsGoal: userData.carbsGoal ?? nutritionGoals.carbsTarget ?? 250,
              fatGoal: userData.fatGoal ?? nutritionGoals.fatTarget ?? 70,
              caloriesGoal: calorieGoal,
              micros: currentClient.micros || [], foods: foodNames,
            },
            calendar: {
              completed: currentClient.completedDays || [], upcoming: currentClient.upcomingDays || [],
              missed: currentClient.missedDays || [], upcomingSessions: currentClient.upcomingSessions || [],
            },
            notesAndFiles,
          });
        } catch (e) {
          if (!isBenignTrainerClientFirestoreError(e)) {
            console.error('Error updating client data:', e);
          }
        }
      },
      (error) => {
        if (isBenignTrainerClientFirestoreError(error)) {
          (async () => {
            let notesAndFiles = [];
            try {
              notesAndFiles = await getNotesAndFiles(ownerUid);
            } catch (_) {}
            if (effectCancelled) return;
            setClientData(buildTrainerDashboardClientDataFromCrm(currentClient, notesAndFiles));
          })();
          return;
        }
        console.error('User document listener error:', error);
        if (!effectCancelled) setClientData(null);
      }
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
          const foodNames = nutritionLogs.map((l) => l.food_name || l.foodName || 'Food').filter(Boolean);

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
            const merged = mergeTrainerClientProfile(currentClient, {});
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
                caloriesGoal: 2000,
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
              caloriesGoal: 2000,
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
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  }, []);

  const actions = [
    { label: 'Messages', icon: 'MessageSquare', action: 'messages' },
    { label: 'Photo Gallery', imageSource: require('../../assets/icons/picture.png'), action: 'photos' },
    { label: 'Workout Plans', imageSource: require('../../assets/ai_workouts.png'), action: 'aiPlans' },
    { label: 'Document Maker', action: 'document' },
    { label: 'Spreadsheet Creator', action: 'spreadsheet' },
  ];

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
          title: 'CoachConnect',
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

  const sectionLabelStyle = {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: mutedColor,
    textTransform: 'uppercase',
    marginBottom: 6,
    paddingHorizontal: 2, // remove hardcoded large padding if needed, but keeping it small
  };

  return (
    <>
    <View style={{ flex: 1, minHeight: 0 }}>
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: shellBottomPad, paddingHorizontal: 20, paddingTop: 4 }} {...FORM_SCROLL_PROPS}>
      <AuroraHeroBanner isDark={isDark} timeOfDay={timeOfDay} userName={userName} textColor={textColor} userId={trainerId} />

      {showPayoutNudge ? (
        <LinearGradient
          colors={['#7C2D12', '#C2410C', '#9A3412']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            marginTop: 8,
            marginBottom: 4,
            borderRadius: 12,
            maxHeight: 80,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 14,
              paddingVertical: 10,
              gap: 10,
              minHeight: 56,
              maxHeight: 80,
            }}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '700',
                  letterSpacing: 1.1,
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.55)',
                }}
              >
                Payments
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 13,
                  fontWeight: '700',
                  color: '#FED7AA',
                }}
                numberOfLines={2}
              >
                {stripeConnectStatus === 'pending'
                  ? 'Payout verification in progress'
                  : 'Complete payout setup to accept clients'}
              </Text>
            </View>
            {typeof onOpenPayments === 'function' ? (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={onOpenPayments}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: 'rgba(255,255,255,0.16)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.22)',
                }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '800' }}>
                  {stripeConnectStatus === 'pending' ? 'Manage' : 'Set Up'}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              accessibilityLabel="Dismiss payment setup reminder"
              onPress={dismissPayoutNudge}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.12)',
              }}
            >
              <Ionicons name="close" size={15} color="rgba(255,255,255,0.42)" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      ) : null}

      {/* Quote pill is now inside the hero banner */}

      {/* Hero stats strip */}
      <LinearGradient
        colors={['rgba(124,58,237,0.2)', 'rgba(236,72,153,0.1)']}
        style={{
          borderRadius: 20,
          borderWidth: 1,
          borderColor: 'rgba(167,139,250,0.35)',
          padding: 12,
          marginHorizontal: 0,
          marginTop: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 32, fontWeight: '900', color: isDark ? '#fff' : '#1a0a2e' }}>{clients.length}</Text>
            <Text style={{ fontSize: 11, color: mutedColor }}>Active Clients</Text>
          </View>
          <View style={{ width: 1, height: 40, backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 32, fontWeight: '900', color: '#C084FC' }}>{pendingRequestsCount}</Text>
            <Text style={{ fontSize: 11, color: mutedColor }}>Pending Requests</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <TouchableOpacity activeOpacity={0.8} onPress={onClientsPress} style={{ flex: 1 }}>
            <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 12, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: textColor }}>All Clients</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.8} onPress={onClientRequestsPress} style={{ flex: 1 }}>
            <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 12, height: 40, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: textColor }}>Client Requests</Text>
            </View>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Client roster — wide profile cards (avatar, goal, stat tiles); scrolls horizontally */}
      <View style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <Text style={[sectionLabelStyle, { marginBottom: 0 }]}>Clients</Text>
          {clients.length > 0 ? (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)',
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: mutedColor }}>{clients.length} active</Text>
            </View>
          ) : null}
        </View>

        {clients.length === 0 ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 14,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
            }}
          >
            <LinearGradient
              colors={['#9F1239', '#C2410C']}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon name="UserPlus" size={20} color="#FFFFFF" />
            </LinearGradient>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: textColor, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 }}>No clients yet</Text>
              <Text style={{ color: mutedColor, fontSize: 12, marginTop: 2, lineHeight: 16 }}>
                Approve requests from Client Requests — each client appears here.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6, paddingRight: 4 }}>
              {(clients || []).map((client) => {
                const selected = client.id === currentClient?.id;
                const stats = getClientRosterStats(client);
                const displayName = client.name || client.displayName || 'Client';
                const initials = getClientInitials(displayName);
                const hasWeekly = !!weeklySummaryMap[client.id];

                const innerCardBg = isDark ? '#0f0f16' : '#FAFAFC';
                const innerPressableStyle = {
                  width: '100%',
                  borderRadius: 18,
                  backgroundColor: innerCardBg,
                  paddingHorizontal: 16,
                  paddingTop: 16,
                  paddingBottom: 16,
                  minHeight: 158,
                };

                const cardBody = (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => setSelectedClientId(client.id)}
                    style={innerPressableStyle}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <LinearGradient
                        colors={['#9F1239', '#C2410C']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          width: 52,
                          height: 52,
                          borderRadius: 18,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }}>
                          {initials}
                        </Text>
                      </LinearGradient>
                      <View style={{ flex: 1, marginLeft: 14, minWidth: 0, paddingRight: 36 }}>
                        <Text style={{ color: textColor, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }} numberOfLines={1}>
                          {displayName}
                        </Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                          {stats.goal ? (
                            <View
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 999,
                                backgroundColor: isDark ? 'rgba(157, 23, 57, 0.22)' : 'rgba(190, 24, 93, 0.1)',
                                borderWidth: 1,
                                borderColor: isDark ? 'rgba(234, 88, 12, 0.28)' : 'rgba(194, 65, 12, 0.22)',
                                marginRight: 8,
                                marginBottom: 4,
                              }}
                            >
                              <Text style={{ color: isDark ? 'rgba(254, 205, 211, 0.92)' : '#9F1239', fontSize: 11, fontWeight: '800' }} numberOfLines={1}>
                                {stats.goal}
                              </Text>
                            </View>
                          ) : null}
                          {hasWeekly ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' }} />
                              <Text style={{ color: mutedColor, fontSize: 11, fontWeight: '700', marginLeft: 5 }}>Weekly ready</Text>
                            </View>
                          ) : (
                            <Text style={{ color: mutedColor, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>No weekly yet</Text>
                          )}
                        </View>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', marginTop: 14 }}>
                      {[
                        { key: 'age', cap: 'Age', val: stats.age ? `${stats.age} yrs` : '—' },
                        { key: 'wt', cap: 'Weight', val: stats.weight ? `${stats.weight} lbs` : '—' },
                        { key: 'ht', cap: 'Height', val: stats.height || '—' },
                      ].map((cell, idx) => (
                        <View
                          key={cell.key}
                          style={{
                            flex: 1,
                            borderRadius: 14,
                            paddingVertical: 12,
                            paddingHorizontal: 8,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
                            borderWidth: 1,
                            borderColor: isDark ? 'rgba(244, 114, 182, 0.12)' : 'rgba(194, 65, 12, 0.1)',
                            alignItems: 'center',
                            marginRight: idx < 2 ? 10 : 0,
                          }}
                        >
                          <Text
                            style={{
                              color: isDark ? 'rgba(244, 182, 196, 0.88)' : 'rgba(136, 19, 55, 0.78)',
                              fontSize: 12,
                              fontWeight: '800',
                              letterSpacing: 1,
                              marginTop: 0,
                              textTransform: 'uppercase',
                            }}
                          >
                            {cell.cap}
                          </Text>
                          <Text
                            style={{
                              color: isDark ? 'rgba(255, 247, 247, 0.96)' : '#0f172a',
                              fontSize: 17,
                              fontWeight: '800',
                              marginTop: 6,
                              letterSpacing: -0.2,
                            }}
                            numberOfLines={1}
                          >
                            {cell.val}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                );

                return (
                  <View key={client.id} style={{ width: rosterCardWidth, marginRight: 12, position: 'relative' }}>
                    {selected ? (
                      <LinearGradient
                        colors={['#9F1239', '#C2410C', '#B45309']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ borderRadius: 20, padding: 2.5 }}
                      >
                        {cardBody}
                      </LinearGradient>
                    ) : (
                      <View
                        style={{
                          borderRadius: 20,
                          borderWidth: 1.5,
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)',
                          overflow: 'hidden',
                          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.92)',
                        }}
                      >
                        {cardBody}
                      </View>
                    )}
                    <TouchableOpacity
                      accessibilityLabel={`Remove ${client.name || 'client'} from roster`}
                      accessibilityHint="Opens a confirmation step"
                      onPress={() => promptRemoveClientFromDashboard(client)}
                      style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        zIndex: 4,
                        padding: 8,
                        borderRadius: 14,
                        backgroundColor: isDark ? 'rgba(15,15,22,0.92)' : 'rgba(255,255,255,0.95)',
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)',
                      }}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={18}
                        color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.5)'}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>

            {currentClient?.id ? (
              <View style={{ marginTop: 8 }}>
                <TrainerWeeklyReportSection
                  clientId={currentClient.id}
                  clientName={currentClient.name || currentClient.displayName || ''}
                  isDark={isDark}
                  onOpenWeeklyReport={onOpenWeeklyReport}
                />
              </View>
            ) : null}
          </>
        )}
      </View>

      {/* Quick Actions */}
      <View style={{ marginTop: 10, marginBottom: 8 }}>
        <Text style={sectionLabelStyle}>Quick Actions</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 4, paddingRight: 16 }}
        >
        {actions.map(({ label, action }) => {
          const iconName =
            action === 'messages'
              ? 'chatbubbles-outline'
              : action === 'photos'
                ? 'images-outline'
                : action === 'document'
                  ? 'document-text-outline'
                  : action === 'spreadsheet'
                    ? 'grid-outline'
                    : 'barbell-outline';

          const count =
            action === 'messages'
              ? (typeof clientUnreadCount === 'number' ? clientUnreadCount : 0)
              : null;

          const subtitle =
            action === 'messages'
              ? (count > 0 ? `${count > 99 ? '99+' : count} unread` : 'No unread')
              : action === 'photos'
                ? 'Client photos'
                : action === 'document'
                  ? 'Rich-text editor'
                  : action === 'spreadsheet'
                    ? 'Blank grid'
                    : 'Plans & sessions';

          const ctaLabel =
            action === 'document' || action === 'spreadsheet' ? 'Open editor' : 'View all';

          return (
            <QuickActionCard
              key={label}
              isDark={isDark}
              width={quickActionCardWidth}
              label={label}
              subtitle={subtitle}
              icon={iconName}
              ctaLabel={ctaLabel}
              badgeCount={action === 'messages' ? count : undefined}
              onPress={() => {
                if (action === 'messages') {
                  onMessagesPress(currentClient?.id);
                  return;
                }
                if (action === 'document') {
                  openDocumentEditor?.({ documentId: null });
                  return;
                }
                if (action === 'spreadsheet') {
                  openSpreadsheetEditor?.({ documentId: null, title: '', rows: null });
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
              }}
            />
          );
        })}
        </ScrollView>
      </View>

      {/* Client Management Row */}
      {/* Tab Pills */}
      <TabPills activeTab={activeTab} onTabChange={setActiveTab} isDark={isDark} />

      {/* Tab Content */}
      {loadingClientData ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator color={ICON_ACCENT} />
          <Text style={{ color: mutedColor, fontSize: 13, marginTop: 12 }}>Loading client data...</Text>
        </View>
      ) : (
        <View>
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
      )}

      <View style={{ height: 100 }} />
      <SpreadsheetViewerModal
        visible={spreadsheetViewer.visible}
        url={spreadsheetViewer.url}
        name={spreadsheetViewer.name}
        isDark={isDark}
        onClose={() => setSpreadsheetViewer({ visible: false, url: null, name: null })}
      />
      <ShareDocumentModal
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

    <HoldToConfirmModal
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
      barGradient={['#8B5CF6', '#DB7093']}
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
      <PaymentSetupPopup
        visible={showPaymentPopup}
        onClose={() => setShowPaymentPopup(false)}
        userEmail={userEmail}
        stripeAccountId={paymentPopupStripeAccountId}
      />
    ) : null}
    </>
  );
};

// ─────────────────────────────────────────────
// APP WITH THEME
// ─────────────────────────────────────────────

export default DashboardContent;
