// Trainer view of one linked trainee: profile card, Sessions calendar, Notes & Files workspace.
// Flow: live Firestore listeners fill clientData → tabs switch Sessions vs Notes → editors/modals open from the workspace.
// Used by: TrainerAppStart when the trainer taps a client on the roster.

import React, { useState, useMemo, useEffect } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, getDocs, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import { getProfileDateKey } from '../../helpers/dateStrings';
import { getFoodLogsForDate, calculateMacroTotals, getDailyGoals } from '../../nutrition/daily-log/saveLoggedFood';
import {
  getTrainerDocuments,
  filterTrainerDocumentsForClient,
  getNotesAndFiles,
} from '../../for-both/files-and-notes/saveNotesAndFiles';
import PdfViewer from '../../for-both/files-and-notes/viewers/PdfViewer';
import SpreadsheetViewer from '../../for-both/files-and-notes/viewers/SpreadsheetViewer';
import DocumentEditor from '../documents/DocumentEditor';
import SpreadsheetEditor from '../documents/SpreadsheetEditor';
import ShareDocumentPopup from '../documents/ShareDocumentPopup';
import RemoveTrainerPopup from '../../for-both/popups/RemoveTrainerPopup';
import CalendarTab from '../scheduling/CalendarTab';
import { isBenignTrainerClientFirestoreError } from '../trainee-records/calmDatabaseErrors';
import { FORM_SCROLL_PROPS, useEmbeddedScrollBottomPad } from '../../navigation/bottomMenuSpacing';
import {
  GlassCard,
  TabPills,
  Icon,
  ICON_ACCENT,
  TrainerNotesFilesHeroAndWorkspace,
  getClientInitials,
  getClientSubtext,
  useTrainerTheme,
  GRADIENT_AVATAR,
  CARD_BORDER_PINK_ORANGE,
} from '../home/trainerHomePieces';

// ===== NAMED CONSTANTS =====

const TAB_PROGRESS = 'Progress';
const TAB_SESSIONS = 'Sessions';
const TAB_NOTES_FILES = 'Notes & Files';

const SCROLL_BOTTOM_PAD = 48;
const DEFAULT_PROGRAM_NAME = 'Custom Program';
const DEFAULT_CLIENT_LABEL = 'Client';
const DEFAULT_TRAINER_LABEL = 'Trainer';
const NO_NAME_LABEL = 'No Name';

// Manipulate here: fallback macro goals when getDailyGoals fails or returns blanks.
const DEFAULT_PROTEIN_GOAL = 150;
const DEFAULT_CARBS_GOAL = 250;
const DEFAULT_FAT_GOAL = 70;
const DEFAULT_CALORIES_GOAL = 2000;

const MAX_LIKED_EXERCISES_SHOWN = 12;
const REMOVE_SHEET_TITLE = 'Remove client?';
const REMOVE_SHEET_MESSAGE =
  'They will be unlinked from you in Coach Connect. You can invite them again later if you change your mind.';
const REMOVE_OPTION_CANCEL = 'Cancel';
const REMOVE_OPTION_CONFIRM = 'Remove from my roster…';
const REMOVE_ALERT_CONFIRM = 'Remove from roster';
const PLATFORM_IOS = 'ios';
const HIT_SLOP_HEADER = { top: 12, bottom: 12, left: 12, right: 12 };
const HIT_SLOP_MENU = { top: 8, bottom: 8, left: 8, right: 8 };
const HIT_SLOP_REMOVE_LINK = { top: 6, bottom: 6 };
const DARK_SCREEN_BG = '#0c0c0e';
const LIGHT_SCREEN_BG = '#f5f5f7';
const DARK_TEXT = '#ffffff';
const LIGHT_TEXT = '#1a0a2e';
const DARK_MUTED = 'rgba(255,255,255,0.5)';
const LIGHT_MUTED = 'rgba(26,10,46,0.5)';
const DANGER_RED = '#ef4444';
const WHITE = '#FFFFFF';

// ===== HELPER FUNCTIONS =====

/**
 * Empty nutrition block used when CRM-only / fallback paths have no food logs yet.
 * @returns {object}
 */
function emptyNutritionBlock() {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    foods: [],
    micros: [],
  };
}

/**
 * Empty calendar shape matching trainer_clients/{trainer}/clients/{id}.calendar.
 * @returns {object}
 */
function emptyCalendarBlock() {
  return { completed: [], upcoming: [], missed: [], upcomingSessions: [] };
}

/**
 * Safe notes list — getNotesAndFiles can throw on permission flicker.
 * @param {string} clientId
 * @returns {Promise<Array>}
 */
async function loadNotesAndFilesSafe(clientId) {
  try {
    return await getNotesAndFiles(clientId);
  } catch (_loadError) {
    return [];
  }
}

/**
 * Build the detail payload when we only have the trainer CRM doc (no users/{id} yet).
 * @param {object} trainerClientDoc
 * @param {object} client
 * @param {Array} notesAndFiles
 * @returns {object}
 */
function clientDataFromTrainerCrmOnly(trainerClientDoc, client, notesAndFiles) {
  // vocab/symbol: ?? = use right side only when left is null/undefined (keeps a real 0).
  return {
    beforeWeight:
      trainerClientDoc.startingWeight
      ?? trainerClientDoc.weight
      ?? client?.startingWeight
      ?? client?.weight
      ?? null,
    currentWeight: trainerClientDoc.weight ?? client?.weight ?? null,
    trainingDays: [],
    programName: trainerClientDoc.programName || DEFAULT_PROGRAM_NAME,
    nutrition: emptyNutritionBlock(),
    calendar: trainerClientDoc.calendar || emptyCalendarBlock(),
    notesAndFiles,
  };
}

/**
 * Food names for the nutrition summary list.
 * @param {Array} nutritionLogs
 * @returns {string[]}
 */
function foodNamesFromLogs(nutritionLogs) {
  const names = [];
  for (let i = 0; i < nutritionLogs.length; i += 1) {
    const logRow = nutritionLogs[i];
    const foodName = logRow.food_name || logRow.foodName || 'Food';
    if (foodName) names.push(foodName);
  }
  return names;
}

/**
 * Push truthy micros from one log row into the accumulator.
 * @param {Array} accumulator
 * @param {Array} rowMicros
 */
function appendTruthyMicros(accumulator, rowMicros) {
  for (let j = 0; j < rowMicros.length; j += 1) {
    const microEntry = rowMicros[j];
    if (!microEntry) continue;
    accumulator.push(microEntry);
  }
}

/**
 * Flatten micros arrays off each food log row.
 * @param {Array} nutritionLogs
 * @returns {Array}
 */
function microsFromLogs(nutritionLogs) {
  const micros = [];
  for (let i = 0; i < nutritionLogs.length; i += 1) {
    const logRow = nutritionLogs[i];
    if (!logRow.micros) continue;
    appendTruthyMicros(micros, logRow.micros || []);
  }
  return micros;
}

/**
 * Resolve macro goals from daily goals + user profile fields.
 * @param {object} userData
 * @param {object} nutritionGoals
 * @returns {object}
 */
function resolveNutritionGoals(userData, nutritionGoals) {
  return {
    proteinGoal: userData.proteinGoal ?? nutritionGoals.proteinTarget ?? DEFAULT_PROTEIN_GOAL,
    carbsGoal: userData.carbsGoal ?? nutritionGoals.carbsTarget ?? DEFAULT_CARBS_GOAL,
    fatGoal: userData.fatGoal ?? nutritionGoals.fatTarget ?? DEFAULT_FAT_GOAL,
    caloriesGoal:
      userData.calorieTarget
      ?? userData.calorie_target
      ?? nutritionGoals.calories
      ?? DEFAULT_CALORIES_GOAL,
  };
}

/**
 * Load daily goals with safe defaults when the call fails.
 * @param {string} clientId
 * @returns {Promise<object>}
 */
async function loadNutritionGoalsOrDefaults(clientId) {
  const nutritionGoals = {
    proteinTarget: DEFAULT_PROTEIN_GOAL,
    carbsTarget: DEFAULT_CARBS_GOAL,
    fatTarget: DEFAULT_FAT_GOAL,
    calories: DEFAULT_CALORIES_GOAL,
  };
  try {
    const goalsData = await getDailyGoals(clientId);
    if (goalsData?.proteinTarget != null) nutritionGoals.proteinTarget = goalsData.proteinTarget;
    if (goalsData?.carbsTarget != null) nutritionGoals.carbsTarget = goalsData.carbsTarget;
    if (goalsData?.fatTarget != null) nutritionGoals.fatTarget = goalsData.fatTarget;
    if (goalsData?.calories != null) nutritionGoals.calories = goalsData.calories;
  } catch (_goalsError) {
    // Keep defaults.
  }
  return nutritionGoals;
}

/**
 * Full client detail payload when users/{clientId} exists.
 * @param {object} args
 * @returns {Promise<object>}
 */
async function buildClientDataFromUserDoc({
  userData,
  trainerId,
  clientId,
  clientTodayKey,
}) {
  // Firestore paths (frozen): trainer_clients/{trainerId}/clients/{clientId}, users/{clientId}/trainingDays
  const clientDocSnap = await getDoc(doc(db, 'trainer_clients', trainerId, 'clients', clientId));
  const clientDocData = clientDocSnap.exists() ? clientDocSnap.data() : {};

  const notesAndFiles = await loadNotesAndFilesSafe(clientId);

  const trainingQuery = query(collection(db, 'users', clientId, 'trainingDays'));
  const trainingSnapshot = await getDocs(trainingQuery);
  const trainingDays = trainingSnapshot.docs.map((trainingDoc) => trainingDoc.data());

  const nutritionLogs = await getFoodLogsForDate(clientId, clientTodayKey);
  const macroTotals = calculateMacroTotals(nutritionLogs);
  const nutritionGoals = await loadNutritionGoalsOrDefaults(clientId);
  const goalFields = resolveNutritionGoals(userData, nutritionGoals);

  return {
    profileTimezone:
      userData.timezone
      || userData.timeZone
      || userData?.workoutReminder?.timeZone
      || null,
    beforeWeight:
      userData.startingWeight
      ?? userData.weight
      ?? clientDocData.startingWeight
      ?? clientDocData.weight
      ?? null,
    currentWeight: userData.weight ?? clientDocData.weight ?? null,
    trainingDays,
    programName: clientDocData.programName || DEFAULT_PROGRAM_NAME,
    nutrition: {
      calories: macroTotals.calories,
      protein: macroTotals.protein,
      carbs: macroTotals.carbs,
      fat: macroTotals.fat,
      foods: foodNamesFromLogs(nutritionLogs),
      micros: microsFromLogs(nutritionLogs),
      ...goalFields,
    },
    calendar: clientDocData.calendar || emptyCalendarBlock(),
    notesAndFiles,
    likedExercises: Array.isArray(userData.likedExercises) ? userData.likedExercises : [],
    exercisesPrefer: userData.exercisesPrefer || userData.exercisesDislike || '',
  };
}

/**
 * CRM-only fallback when the user doc is missing or the listener errors benignly.
 * @param {string} trainerId
 * @param {object} client
 * @returns {Promise<object>}
 */
async function buildClientDataFromCrmFallback(trainerId, client) {
  const trainerClientSnap = await getDoc(
    doc(db, 'trainer_clients', trainerId, 'clients', client.id),
  );
  const trainerClientDoc = trainerClientSnap.exists() ? trainerClientSnap.data() : {};
  const notesAndFiles = await loadNotesAndFilesSafe(client.id);
  return clientDataFromTrainerCrmOnly(trainerClientDoc, client, notesAndFiles);
}

/**
 * True when today's dailyLog has any non-empty dashboard_* field.
 * @param {object|null} todayDailyLog
 * @returns {boolean}
 */
function hasDashboardCheckInToday(todayDailyLog) {
  if (!todayDailyLog) return false;
  const fieldNames = Object.keys(todayDailyLog);
  for (let i = 0; i < fieldNames.length; i += 1) {
    const fieldName = fieldNames[i];
    if (!fieldName.startsWith('dashboard_')) continue;
    const fieldValue = todayDailyLog[fieldName];
    if (fieldValue != null && fieldValue !== '') return true;
  }
  return false;
}

/**
 * Liked-exercise names for the programming tip card (max 12).
 * @param {Array} likedExercises
 * @returns {string}
 */
function likedExercisesDisplayText(likedExercises) {
  const names = [];
  for (let i = 0; i < likedExercises.length; i += 1) {
    const entry = likedExercises[i];
    const name = typeof entry === 'string' ? entry : entry?.name || entry?.exerciseName || '';
    if (name) names.push(name);
  }
  return names.slice(0, MAX_LIKED_EXERCISES_SHOWN).join(' · ');
}

/**
 * Theme-aware surface colors for this screen.
 * @param {boolean} isDark
 * @returns {{ textColor: string, mutedColor: string, screenBg: string }}
 */
function screenColorsForTheme(isDark) {
  if (isDark) {
    return { textColor: DARK_TEXT, mutedColor: DARK_MUTED, screenBg: DARK_SCREEN_BG };
  }
  return { textColor: LIGHT_TEXT, mutedColor: LIGHT_MUTED, screenBg: LIGHT_SCREEN_BG };
}

/**
 * Show the remove confirmation sheet (iOS action sheet or Android alert).
 * @param {Function} openRemoveSheet
 */
function presentRemoveClientMenu(openRemoveSheet) {
  if (Platform.OS === PLATFORM_IOS) {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [REMOVE_OPTION_CANCEL, REMOVE_OPTION_CONFIRM],
        cancelButtonIndex: 0,
        destructiveButtonIndex: 1,
        title: REMOVE_SHEET_TITLE,
        message: REMOVE_SHEET_MESSAGE,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) openRemoveSheet();
      },
    );
    return;
  }

  Alert.alert(REMOVE_SHEET_TITLE, REMOVE_SHEET_MESSAGE, [
    { text: REMOVE_OPTION_CANCEL, style: 'cancel' },
    { text: REMOVE_ALERT_CONFIRM, style: 'destructive', onPress: openRemoveSheet },
  ]);
}

// ===== MAIN FUNCTION =====

/**
 * Trainer — single-client detail (sessions + notes/files).
 * @param {{ client: object, trainerId: string, onBack: Function, onRemoveClient?: Function, trainerName?: string, getTrainerEditorNavChrome?: Function }} props
 */
const ClientDetailScreen = ({
  client,
  trainerId,
  onBack,
  onRemoveClient,
  trainerName,
  getTrainerEditorNavChrome,
}) => {
  const { isDark } = useTrainerTheme();
  const scrollBottomPad = useEmbeddedScrollBottomPad(SCROLL_BOTTOM_PAD);
  const { textColor, mutedColor, screenBg } = screenColorsForTheme(isDark);

  const [activeTab, setActiveTab] = useState(TAB_PROGRESS);
  const [showRemoveSheet, setShowRemoveSheet] = useState(false);
  const [clientData, setClientData] = useState(null);
  const [loadingClientData, setLoadingClientData] = useState(false);
  const [todayDailyLog, setTodayDailyLog] = useState(null);
  const [refreshNotesAndFilesTrigger, setRefreshNotesAndFilesTrigger] = useState(0);
  const [pdfViewer, setPdfViewer] = useState({ visible: false, url: null, name: null });
  const [spreadsheetViewer, setSpreadsheetViewer] = useState({ visible: false, url: null, name: null });
  const [spreadsheetEditor, setSpreadsheetEditor] = useState({
    visible: false,
    documentId: null,
    title: '',
    rows: null,
  });
  const [trainerDocuments, setTrainerDocuments] = useState([]);
  const [documentEditor, setDocumentEditor] = useState({ visible: false, documentId: null });
  const [shareModal, setShareModal] = useState({ visible: false, documentId: null, sharedWith: [] });

  const trainerEditorNav = useMemo(
    () =>
      typeof getTrainerEditorNavChrome === 'function'
        ? getTrainerEditorNavChrome(() => {
            setDocumentEditor({ visible: false, documentId: null });
            setSpreadsheetEditor({ visible: false, documentId: null, title: '', rows: null });
          })
        : null,
    [getTrainerEditorNavChrome],
  );

  const trainerDocumentsForClient = useMemo(
    () => filterTrainerDocumentsForClient(trainerDocuments, client?.id),
    [trainerDocuments, client?.id],
  );

  useEffect(() => {
    if (!trainerId) return;
    getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => setTrainerDocuments([]));
  }, [trainerId]);

  // Client's "today" key — timezone can come from the live user doc once it loads.
  const clientTodayKey = useMemo(
    () =>
      getProfileDateKey({
        ...(client || {}),
        timezone: clientData?.profileTimezone,
        timeZone: clientData?.profileTimezone,
      }),
    [client, clientData?.profileTimezone],
  );

  // Live dailyLog for "check-in logged today" on the profile card.
  useEffect(() => {
    if (!client?.id || !db) {
      setTodayDailyLog(null);
      return;
    }
    const dateKey = clientTodayKey;
    const unsubscribe = onSnapshot(
      doc(db, 'users', client.id, 'dailyLogs', dateKey),
      (snap) => setTodayDailyLog(snap.exists() ? snap.data() : null),
      () => setTodayDailyLog(null),
    );
    return () => unsubscribe();
  }, [client?.id, clientTodayKey]);

  // Main data: user doc + CRM + nutrition + notes listeners.
  useEffect(() => {
    if (!client?.id || !trainerId || !db) {
      setClientData(null);
      return;
    }

    let effectCancelled = false;
    const unsubscribers = [];

    const applyLoadedClientData = (nextClientData) => {
      if (effectCancelled) return;
      setClientData(nextClientData);
    };

    const applyCrmFallback = async (logLabel) => {
      try {
        const fallbackData = await buildClientDataFromCrmFallback(trainerId, client);
        applyLoadedClientData(fallbackData);
      } catch (fallbackError) {
        if (!isBenignTrainerClientFirestoreError(fallbackError)) {
          console.error(logLabel, fallbackError);
        }
        if (!effectCancelled) setClientData(null);
      }
    };

    const onUserDocSnapshot = async (userDoc) => {
      if (!userDoc.exists()) {
        await applyCrmFallback('Error building client detail without user doc:');
        return;
      }

      const userData = userDoc.data();
      try {
        const nextClientData = await buildClientDataFromUserDoc({
          userData,
          trainerId,
          clientId: client.id,
          clientTodayKey,
        });
        applyLoadedClientData(nextClientData);
      } catch (updateError) {
        console.error('Error updating client data:', updateError);
      }
    };

    const onUserDocError = (error) => {
      if (isBenignTrainerClientFirestoreError(error)) {
        applyCrmFallback('Error building client detail (listener fallback):');
        return;
      }
      console.error('User document listener error:', error);
      if (!effectCancelled) setClientData(null);
    };

    const userUnsub = onSnapshot(
      doc(db, 'users', client.id),
      onUserDocSnapshot,
      onUserDocError,
    );
    unsubscribers.push(userUnsub);

    // Nutrition logs collection — same path clients use when logging food.
    const nutritionUnsub = onSnapshot(
      query(collection(db, 'nutrition_logs'), where('user_id', '==', client.id)),
      async () => {
        try {
          const nutritionLogs = await getFoodLogsForDate(client.id, clientTodayKey);
          const macroTotals = calculateMacroTotals(nutritionLogs);
          if (effectCancelled) return;

          setClientData((previousData) => {
            if (!previousData) return previousData;
            return {
              ...previousData,
              nutrition: {
                ...previousData.nutrition,
                calories: macroTotals.calories,
                protein: macroTotals.protein,
                carbs: macroTotals.carbs,
                fat: macroTotals.fat,
                foods: foodNamesFromLogs(nutritionLogs),
                micros: microsFromLogs(nutritionLogs),
              },
            };
          });
        } catch (nutritionError) {
          if (!isBenignTrainerClientFirestoreError(nutritionError)) {
            console.error('Error updating nutrition data:', nutritionError);
          }
        }
      },
    );
    unsubscribers.push(nutritionUnsub);

    const notesColRef = collection(db, 'users', client.id, 'notes_and_files');
    const notesUnsub = onSnapshot(
      notesColRef,
      async () => {
        try {
          const notesAndFiles = await getNotesAndFiles(client.id);
          if (effectCancelled) return;
          setClientData((previousData) => {
            if (previousData) return { ...previousData, notesAndFiles };
            return {
              beforeWeight: client?.startingWeight ?? client?.weight ?? null,
              currentWeight: client?.weight ?? null,
              trainingDays: [],
              programName: DEFAULT_PROGRAM_NAME,
              nutrition: emptyNutritionBlock(),
              calendar: emptyCalendarBlock(),
              notesAndFiles,
            };
          });
        } catch (notesError) {
          console.error('Error syncing notes and files (detail):', notesError);
        }
      },
      (notesListenerError) => console.error('notes_and_files listener error (detail):', notesListenerError),
    );
    unsubscribers.push(notesUnsub);

    // CRM client doc (calendar, program name — notes live in notes_and_files).
    const clientDocUnsub = onSnapshot(
      doc(db, 'trainer_clients', trainerId, 'clients', client.id),
      (clientDoc) => {
        if (!clientDoc.exists()) return;
        const clientDocData = clientDoc.data();
        setClientData((previousData) => {
          if (!previousData) return previousData;
          return {
            ...previousData,
            calendar: clientDocData.calendar || previousData.calendar,
            programName: clientDocData.programName || previousData.programName,
          };
        });
      },
    );
    unsubscribers.push(clientDocUnsub);

    return () => {
      effectCancelled = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [client?.id, trainerId, clientTodayKey]);

  const openRemoveClientMenu = () => {
    presentRemoveClientMenu(() => setShowRemoveSheet(true));
  };

  const clientDisplayName = client?.name || DEFAULT_CLIENT_LABEL;
  const checkInLabel = hasDashboardCheckInToday(todayDailyLog)
    ? '✓ Check-in logged today'
    : 'No check-in yet today';
  const showLikedExercises =
    Array.isArray(clientData?.likedExercises) && clientData.likedExercises.length > 0;
  const statusBarStyle = isDark ? 'light-content' : 'dark-content';
  const headerBorderColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const cardDividerColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
  const androidHeaderPad = Platform.OS === 'android' ? 16 : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }}>
      <StatusBar barStyle={statusBarStyle} />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: androidHeaderPad,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: headerBorderColor,
        }}
      >
        <TouchableOpacity
          onPress={onBack}
          hitSlop={HIT_SLOP_HEADER}
          style={{ width: 36, alignItems: 'flex-start' }}
        >
          <Icon name="ChevronLeft" size={26} color={textColor} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text
            style={{ color: textColor, fontSize: 17, fontWeight: '700', textAlign: 'center' }}
            numberOfLines={1}
          >
            {clientDisplayName}
          </Text>
          <Text
            style={{ color: mutedColor, fontSize: 11, marginTop: 2, textAlign: 'center' }}
            numberOfLines={1}
          >
            Tap ⋮ for remove options
          </Text>
        </View>
        <TouchableOpacity
          onPress={openRemoveClientMenu}
          accessibilityLabel="Client options: remove from roster"
          accessibilityRole="button"
          hitSlop={HIT_SLOP_MENU}
          style={{ width: 36, alignItems: 'flex-end' }}
        >
          <Ionicons name="ellipsis-vertical" size={22} color={textColor} />
        </TouchableOpacity>
      </View>

      <RemoveTrainerPopup
        visible={showRemoveSheet}
        onClose={() => setShowRemoveSheet(false)}
        onRemovalComplete={() => {
          setShowRemoveSheet(false);
          onRemoveClient?.();
        }}
        trainerName={trainerName || DEFAULT_TRAINER_LABEL}
        clientName={clientDisplayName}
        removedBy="trainer"
        trainerId={trainerId}
        clientId={client?.id}
      />

      <View style={{ flex: 1, minHeight: 0 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: scrollBottomPad,
            gap: 16,
            paddingHorizontal: 16,
            paddingTop: 16,
          }}
          {...FORM_SCROLL_PROPS}
        >
          <GlassCard
            isDark={isDark}
            style={{ padding: 16, borderRadius: 16, borderColor: CARD_BORDER_PINK_ORANGE }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  overflow: 'hidden',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {client?.photoURL ? (
                  <Image source={{ uri: client.photoURL }} style={{ width: 48, height: 48 }} />
                ) : (
                  <LinearGradient
                    colors={GRADIENT_AVATAR}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: WHITE, fontWeight: 'bold', fontSize: 16 }}>
                      {getClientInitials(client?.name)}
                    </Text>
                  </LinearGradient>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 17 }}>
                  {client?.name || NO_NAME_LABEL}
                </Text>
                <Text style={{ color: mutedColor, fontSize: 12, marginTop: 2 }}>
                  {getClientSubtext(client)}
                </Text>
                <Text style={{ color: mutedColor, fontSize: 11, marginTop: 4 }}>
                  {checkInLabel}
                </Text>
              </View>
            </View>
            <View
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTopWidth: 1,
                borderTopColor: cardDividerColor,
              }}
            >
              <TouchableOpacity onPress={openRemoveClientMenu} hitSlop={HIT_SLOP_REMOVE_LINK}>
                <Text style={{ color: DANGER_RED, fontSize: 14, fontWeight: '600' }}>
                  Remove from my roster
                </Text>
                <Text style={{ color: mutedColor, fontSize: 12, marginTop: 4, lineHeight: 16 }}>
                  Unlinks this client from you (same as the ⋮ menu). They keep their account and can work with another coach.
                </Text>
              </TouchableOpacity>
            </View>
          </GlassCard>

          {showLikedExercises ? (
            <GlassCard
              isDark={isDark}
              style={{
                padding: 14,
                borderRadius: 16,
                marginTop: 12,
                borderColor: CARD_BORDER_PINK_ORANGE,
              }}
            >
              <Text style={{ color: textColor, fontWeight: '800', fontSize: 13, marginBottom: 8 }}>
                Liked exercises (prioritize when programming)
              </Text>
              <Text style={{ color: mutedColor, fontSize: 13, lineHeight: 18 }}>
                {likedExercisesDisplayText(clientData.likedExercises)}
              </Text>
            </GlassCard>
          ) : null}

          <TabPills activeTab={activeTab} onTabChange={setActiveTab} isDark={isDark} />

          {loadingClientData ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator color={ICON_ACCENT} />
              <Text style={{ color: mutedColor, fontSize: 13, marginTop: 12 }}>
                Loading client data...
              </Text>
            </View>
          ) : (
            <View>
              {activeTab === TAB_SESSIONS ? (
                <CalendarTab
                  clientId={client?.id}
                  clientName={client?.name || DEFAULT_CLIENT_LABEL}
                />
              ) : null}
              {activeTab === TAB_NOTES_FILES ? (
                <TrainerNotesFilesHeroAndWorkspace
                  isDark={isDark}
                  clientName={client?.name || DEFAULT_CLIENT_LABEL}
                  clientData={clientData}
                  trainerDocuments={trainerDocumentsForClient}
                  clientId={client?.id}
                  trainerId={trainerId}
                  onRefetchNotesAndFiles={() =>
                    setRefreshNotesAndFilesTrigger((previous) => previous + 1)
                  }
                  pdfViewer={pdfViewer}
                  setPdfViewer={setPdfViewer}
                  spreadsheetViewer={spreadsheetViewer}
                  setSpreadsheetViewer={setSpreadsheetViewer}
                  onRefetchTrainerDocuments={() =>
                    getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => {})
                  }
                  onOpenDocumentEditor={(fileItem) => {
                    if (!fileItem) return;
                    const documentId = fileItem?.documentId || fileItem?.id || null;
                    setDocumentEditor({ visible: true, documentId });
                  }}
                  onOpenShareModal={({ documentId, initialSharedWith }) =>
                    setShareModal({
                      visible: true,
                      documentId,
                      sharedWith: initialSharedWith || [],
                    })
                  }
                  onOpenSpreadsheetEditor={(fileItem) => {
                    if (!fileItem) return;
                    const documentId = fileItem?.documentId || fileItem?.id || null;
                    setSpreadsheetEditor({
                      visible: true,
                      documentId,
                      title: fileItem?.title || fileItem?.name || '',
                      rows: null,
                    });
                  }}
                  onImportSpreadsheet={(item) => {
                    if (!item?.url) return;
                    setSpreadsheetViewer({
                      visible: true,
                      url: item.url,
                      name: item?.name || 'Spreadsheet',
                    });
                  }}
                />
              ) : null}
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>

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
        name={spreadsheetViewer.name}
        isDark={isDark}
        onClose={() => setSpreadsheetViewer({ visible: false, url: null, name: null })}
      />
      <SpreadsheetEditor
        visible={spreadsheetEditor.visible}
        trainerId={trainerId}
        documentId={spreadsheetEditor.documentId}
        isDark={isDark}
        initialTitle={spreadsheetEditor.title}
        initialRows={spreadsheetEditor.rows}
        onClose={() =>
          setSpreadsheetEditor({ visible: false, documentId: null, title: '', rows: null })
        }
        onSaved={() => getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => {})}
        trainerNavChrome={trainerEditorNav}
      />
      <DocumentEditor
        visible={documentEditor.visible}
        trainerId={trainerId}
        documentId={documentEditor.documentId}
        isDark={isDark}
        onClose={() => setDocumentEditor({ visible: false, documentId: null })}
        onSaved={() => getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => {})}
        trainerNavChrome={trainerEditorNav}
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
    </SafeAreaView>
  );
};

export default ClientDetailScreen;
