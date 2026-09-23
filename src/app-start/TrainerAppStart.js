// Two things live in this file: the trainer's CRM data layer, and the trainer app shell.
// Flow (shell): LoginGate mounts TrainerAppStart → providers for theme/subscription/sessions → TrainerAppStartContent
//       loads roster + profile, wires notifications, bundles everything into `shell` → TrainerScreenList renders screens.
// Flow (CRM): the exported get/create/update/delete functions below are the only sanctioned way to read
//       and write trainer_clients data; screens and hooks import them (some via clientCRMService re-exports).
// Key exports: default TrainerAppStart, plus the CRM functions (getClient, getTrainerClients, addProgress, createTask, …).

import React, { useState, useMemo, useCallback, createContext, useContext, useEffect, useRef } from "react";
import { NavigationContainer } from '@react-navigation/native';
import TrainerScreenList from '../trainer-app/navigation/TrainerScreenList';
import { TrainerAppStartShellProvider } from '../trainer-app/navigation/TrainerOpenScreenTracker';
import { goToTrainerScreen } from '../trainer-app/navigation/goToTrainerScreen';
import { rootNavigationRef } from '../navigation/openScreenFromAnywhere';
import { trainerLinking } from '../navigation/webLinks';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from "react-native";
import * as Notifications from 'expo-notifications';


import {
  StatusBar,
  TextInput,
  Modal,
  Pressable,
  Image,
  Dimensions,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
  Alert,
  ActionSheetIOS,
  Share,
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import { ArrowRight, ChevronDown, Download, FileSpreadsheet, FileText, Folder, MessageSquare, Trash2 } from 'lucide-react-native';
import BlurredBackground from '../look-and-feel/BlurredBackground';
import LottieView from 'lottie-react-native';
import DailyQuoteCard, { DailyQuotePill } from '../for-both/home-cards/DailyQuoteCard';
import HoldToConfirmPopup from '../for-both/popups/HoldToConfirmPopup';
import Svg, { Path, Polyline } from 'react-native-svg';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  updateDoc,
  query,
  where,
  addDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import TopHeader from "../for-both/loading-and-header/TopHeader";
import BottomMenuBar from "../navigation/BottomMenuBar";
import { AppNavigationProvider } from "../navigation/whichScreenIsOpen";
import SearchTrainersScreen from '../client-app/find-a-trainer/SearchTrainersScreen';
import ChatWithTraineeScreen from "../messaging/ChatScreen";
import InboxScreen from "../messaging/InboxScreen";
import VoiceCoachScreen from "../ai-coach/home-screen/CoachHomeScreen";
import CoachConversationScreen from "../ai-coach/conversation/CoachConversationScreen";
import DailyLogContent from "../nutrition/daily-log/DailyLogContent";
import SettingsScreen from "../settings/SettingsScreen";
import HelpFAQScreen from "../settings/HelpFAQScreen";
import TermsOfServiceScreen from "../settings/TermsOfServiceScreen";
import PrivacyPolicyScreen from "../settings/PrivacyPolicyScreen";
import ContactSupportScreen from "../settings/ContactSupportScreen";
import BugReportScreen from "../settings/BugReportScreen";
import CreateWorkoutPlanScreen from "../workouts/create-plan/CreateWorkoutPlanScreen";
import NewTraineeRequestsScreen from "../trainer-app/new-requests/NewTraineeRequestsScreen";
import BookSessionScreen from "../trainer-app/scheduling/BookSessionScreen";
import ScheduleSessionScreen from "../trainer-app/scheduling/ScheduleSessionScreen";
import { pagedTraineeList } from "../trainer-app/my-trainees/pagedTraineeList";
import { resolveTrainerClientDisplayName, isGenericClientDisplayName } from "../trainer-app/trainee-records/getTraineeDisplayName";
import { combineTraineeProfile } from "../helpers/combineTraineeProfile";
import { pendingRequestCount } from "../trainer-app/new-requests/pendingRequestCount";
import {
  cloudConnectionureNotifications,
  persistPushTokensForUid,
  pendingPushTokenStorageKey,
  setNotificationTapHandler,
  flushInitialNotificationResponse,
  subscribePushTokenRefreshOnResume,
} from "../notifications/manageAlerts";
import { useTheme as useGlobalTheme } from "../look-and-feel/lightDarkMode";
import { auth, db } from "../app-start/cloudConnection";
import { fetchLatestLoggedWeight } from '../daily-stats/latestWeight';
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import { reportCrashAutomaticallySync } from "../crash-reports/reportCrashAutomatically";
import { getOrCreateConversation } from "../ai-coach/coach-actions/alertTrainer";
import { getDateKey } from "../helpers/dateStrings";
import { getLocalDateKey } from "../helpers/getLocalDay";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SessionsProvider } from "../trainer-app/scheduling/SharedSessionList";
import { unreadAlertCount } from "../notifications/unreadAlertCount";
import { CrashCatcher } from "../crash-reports/CrashCatcher";
import { getNotesAndFiles, getTrainerDocuments, deleteNotesAndFilesItem, filterTrainerDocumentsForClient } from "../for-both/files-and-notes/saveNotesAndFiles";
import { clearAllUserData } from "../logout-cleanup/clearDataOnLogout";
import AddFilePopup from "../for-both/files-and-notes/viewers/AddFilePopup";
import PhotoVideoViewer from "../for-both/files-and-notes/viewers/PhotoVideoViewer";
import WebPageViewer from "../for-both/files-and-notes/viewers/WebPageViewer";
import {
  isImageFile as isNotesImageFile,
  isVideoFile as isNotesVideoFile,
  isPdfFile as isNotesPdfFile,
  getEmbedViewerUri,
} from "../helpers/whichViewerForFile";
import PdfViewer from "../for-both/files-and-notes/viewers/PdfViewer";
import SpreadsheetViewer from "../for-both/files-and-notes/viewers/SpreadsheetViewer";
import DocumentEditor from "../trainer-app/documents/DocumentEditor";
import QuickActionCard from '../for-both/home-cards/QuickActionCard';
import ShareDocumentPopup from "../trainer-app/documents/ShareDocumentPopup";
import SpreadsheetEditor from "../trainer-app/documents/SpreadsheetEditor";
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'spreadsheetReader';
import RemoveTrainerPopup from "../for-both/popups/RemoveTrainerPopup";
import { getFoodLogsForDate, calculateMacroTotals, getDailyGoals } from "../nutrition/daily-log/saveLoggedFood";
import MyProgressPhotosScreen from "../for-both/photo-gallery/MyProgressPhotosScreen";
import SavedWorkoutsScreen from "../for-both/workout-plans/SavedWorkoutsScreen";
import ManualWorkoutPlanBuilderScreen from "../trainer-app/workout-plans/ManualWorkoutPlanBuilderScreen";
import ChatIcon from "../for-both/icons/ChatIcon";
import FileGrid from "../for-both/files-and-notes/viewers/FileGrid";
import TrainerWeeklyReportSection from "../trainer-app/weekly-report/TrainerWeeklyReportSection";
import TrainerWeeklyReportScreen from "../for-both/weekly-report/WeeklyReportScreen";
import FilesHeaderCard from "../for-both/home-cards/FilesHeaderCard";
import FilesSection from "../for-both/files-and-notes/viewers/FilesSection";
import ProgressTab from '../trainer-app/progress-tab/TrainerProgressTab';
import NutritionTab from '../trainer-app/nutrition-tab/TrainerNutritionTab';
import CalendarTab from '../trainer-app/scheduling/CalendarTab';
import ClientDetailScreen from '../trainer-app/trainee-detail/ManageTraineeScreen';
import ClientsListScreen from '../trainer-app/my-trainees/MyTraineesScreen';
import DashboardContent from '../trainer-app/home/TrainerHomeContent';
import {
  TrainerStylesProvider,
  useTrainerTheme,
  GlassCard,
  ColorText,
  HomeTopBanner,
  Icon,
  ICON_ACCENT,
  SCREEN_WIDTH,
  TrainerNotesFilesHeroAndWorkspace,
  TabPills,
  TABS,
} from '../trainer-app/home/trainerHomePieces';
import { isBenignTrainerClientFirestoreError } from '../trainer-app/trainee-records/calmDatabaseErrors';
import { ProPlanSetup } from '../trainer-pro-plan/ProPlanSetup';
import {
  fetchTrainerClientDoc,
  fetchTrainerClientRoster,
  fetchTrainerClientSubcollectionDocs,
  updateTrainerClientDoc,
  updateTrainerClientSubdoc,
  deleteTrainerClientSubdoc,
  progressCollectionRef,
  tasksCollectionRef,
  notesCollectionRef,
  trainerClientDocRef,
} from '../trainer-app/trainee-records/traineeDatabaseLocations';

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT CRM SERVICE
// Every function below reads/writes the trainer's client records. They share one shape:
//   guard the arguments → delegate to a path helper in traineeDatabaseLocations →
//   log via reportCrashAutomaticallySync on failure → READS return a safe empty value, WRITES re-throw.
// That read/write split is deliberate: a failed read should degrade the UI, not break it, but a
// failed write must reach the caller so it can tell the trainer their change didn't save.
// Screens/hooks may import these through clientCRMService.js, which just re-exports these bindings.
// ═══════════════════════════════════════════════════════════════════════════════

// Converts '#FF6B9D' into '255, 107, 157' so it can be dropped into an `rgba(…, 0.2)` string —
// React Native has no color-with-opacity helper, so the channels must be split out by hand.
// vocab: parseInt(x, 16) = read the two hex characters as a base-16 number.
// Manipulate here: '255, 107, 157' is the brand pink used as the fallback whenever the input isn't
// a clean 6-digit hex (both guards below return it rather than producing an invalid color string).
function hexToRgbTriple(hex) {
  const h = String(hex || "").replace("#", "").trim();
  if (h.length !== 6) return "255, 107, 157";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "255, 107, 157";
  return `${r}, ${g}, ${b}`;
}

// Collection names as constants so a typo fails loudly at import rather than silently reading an
// empty collection at runtime.
// `clients` is the LEGACY top-level collection; current data lives at trainer_clients/{trainerId}/clients.
// Writes still mirror into the legacy path for older installs — see createOrUpdateClient.
const CRM_CLIENTS_COLLECTION = "clients";
const CRM_PROGRESS_SUBCOLLECTION = "progress";
const CRM_TASKS_SUBCOLLECTION = "tasks";
const CRM_NOTES_SUBCOLLECTION = "notes";
const TRAINER_CLIENT_LINKS = "trainer_client_links";

// Fallback dashboard payload built purely from CRM data, used when the client's own user profile
// can't be read (they haven't finished signup, or rules block it). Every field gets a defined value
// so the dashboard renders a real empty state instead of crashing on undefined.
// Manipulate here: the *Goal numbers and 'Custom Program' are placeholder defaults shown until the
// trainer sets real ones.
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

// Read one client record.
export async function getClient(clientId, trainerId = null) {
  if (!clientId || !db) return null;

  try {
    const row = await fetchTrainerClientDoc(clientId, trainerId);
    if (row) {
      // `_source` is internal bookkeeping from the path helper (which collection it came from);
      // strip it so callers never persist it back into Firestore.
      const { _source, ...data } = row;
      return data;
    }
    return null;
  } catch (error) {
    // Some Firestore errors here are expected (permission-denied while a link is being torn down).
    // Filtering them keeps real bugs visible instead of buried in routine noise.
    if (!isBenignTrainerClientFirestoreError(error)) {
      console.error("Error getting client:", error);
      reportCrashAutomaticallySync(error, "TrainerAppStart CRM - getClient");
    }
    return null;
  }
}

// Creates or updates a client and everything that hangs off that relationship.
// This one function touches FOUR places, in this order: a conversation, the canonical client doc,
// the flat link document the client app listens to, and the legacy collection. The order matters —
// the canonical doc is written before the link, so the client app never sees a link pointing at
// a record that doesn't exist yet.
export async function createOrUpdateClient(clientId, trainerId, clientData) {
  if (!clientId || !trainerId || !db) {
    throw new Error("Missing required parameters: clientId or trainerId");
  }

  try {
    const clientRef = doc(db, `trainer_clients/${trainerId}/clients/${clientId}`);

    // Every field is defaulted (|| "" / || null / || []) rather than left undefined, because
    // Firestore rejects undefined values outright and one stray field fails the whole write.
    const payload = {
      id: clientId,
      name: clientData.name || "",
      email: clientData.email || "",
      photoURL: clientData.photoURL || null,
      height: clientData.height || null,
      weight: clientData.weight || null,
      age: clientData.age || null,
      gender: clientData.gender || null,
      goals: clientData.goals || "",
      fitnessLevel: clientData.fitnessLevel || null,
      equipmentAccess: clientData.equipmentAccess || [],
      daysPerWeek: clientData.daysPerWeek || null,
      injuries: clientData.injuries || null,
      exercisesDislike: clientData.exercisesDislike || "",
      preferredWorkoutTime: clientData.preferredWorkoutTime || null,
      trainingEnvironment: clientData.trainingEnvironment || null,
      currentStressLevel: clientData.currentStressLevel || null,
      sleepQuality: clientData.sleepQuality || null,
      energyLevels: clientData.energyLevels || null,
      supplementsCurrentlyTaking: clientData.supplementsCurrentlyTaking || "",
      hydrationHabits: clientData.hydrationHabits || null,
      phone: clientData.phone || null,
      bio: clientData.bio || null,
      role: clientData.role || "client",
      createdAt: clientData.createdAt || serverTimestamp(),
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: "active",
    };

    // Open a message thread up front so a newly added client can be contacted immediately.
    // Non-fatal: failing to create the conversation must not stop the client being added.
    try {
      await getOrCreateConversation(clientId, trainerId);
    } catch (convError) {
      console.error("⚠️ Error creating auto-conversation:", convError);
    }

    // merge:true on an existing record so we only touch the fields in `payload` and leave anything
    // else (trainer-authored extras) intact; a full overwrite for a genuinely new record.
    const existingDoc = await getDoc(clientRef);
    if (existingDoc.exists()) {
      await setDoc(clientRef, payload, { merge: true });
    } else {
      await setDoc(clientRef, payload);
    }

    // The flat link document — this is what the CLIENT app can query (it can't read inside another
    // trainer's collection). Deterministic id `${trainerId}_${clientId}` means re-running this
    // updates the same link instead of creating duplicates.
    try {
      const linkId = `${trainerId}_${clientId}`;
      const linkRef = doc(db, TRAINER_CLIENT_LINKS, linkId);
      await setDoc(
        linkRef,
        {
          trainerId,
          clientId,
          name: payload.name,
          email: payload.email,
          goals: payload.goals,
          status: payload.status,
          joinedAt: payload.joinedAt,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (linkErr) {
      console.warn("⚠️ trainer_client_links write skipped:", linkErr?.message);
    }

    // Read-back check: setDoc can resolve while offline (Firestore queues the write), so this
    // confirms the record is really there and logs loudly if it silently vanished.
    const verifyDoc = await getDoc(clientRef);
    if (!verifyDoc.exists()) {
      console.error("❌ ERROR: Client was not saved!");
    }

    // Mirror into the legacy top-level collection for older app versions still reading from there.
    // Fully ignorable: modern clients don't need it, so a failure here isn't worth surfacing.
    try {
      const legacyClientRef = doc(db, CRM_CLIENTS_COLLECTION, clientId);
      await setDoc(
        legacyClientRef,
        {
          id: clientId,
          trainerId,
          ...payload,
        },
        { merge: true },
      );
    } catch (legacyError) {
      /* ignore */
    }

    return { success: true, id: clientId };
  } catch (error) {
    console.error("Error creating/updating client:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - createOrUpdateClient");
    throw error;
  }
}

// Copies the client's own profile (which THEY control) into the trainer's CRM record.
// Why a copy at all: the trainer's roster must render from one document, and reading every client's
// user doc on every list render would be far more expensive. This is the refresh for that snapshot.
export async function syncClientDataFromUsers(clientId, trainerId) {
  if (!clientId || !trainerId || !db) {
    throw new Error("Missing required parameters");
  }

  try {
    const userDoc = await getDoc(doc(db, "users", clientId));
    // No profile yet (invited but not signed up) — nothing to copy, and null tells the caller that.
    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data();

    // Name resolution is its own helper because profiles store names half a dozen ways; the empty
    // first argument means "no CRM record to prefer, use the user doc".
    const clientName = resolveTrainerClientDisplayName({}, userData);

    const syncPayload = {
      name: clientName,
      email: userData.email || "",
      photoURL: userData.photoURL || null,
      height: userData.height || null,
      weight: userData.weight || null,
      age: userData.age || null,
      gender: userData.gender || null,
      goals: userData.primaryGoal || userData.goals || "",
      fitnessLevel: userData.fitnessLevel || null,
      equipmentAccess: userData.equipmentAccess || [],
      daysPerWeek: userData.daysPerWeek || null,
      injuries: userData.injuries || null,
      exercisesDislike: userData.exercisesDislike || "",
      preferredWorkoutTime: userData.preferredWorkoutTime || null,
      trainingEnvironment: userData.trainingEnvironment || null,
      currentStressLevel: userData.currentStressLevel || null,
      sleepQuality: userData.sleepQuality || null,
      energyLevels: userData.energyLevels || null,
      supplementsCurrentlyTaking: userData.supplementsCurrentlyTaking || "",
      hydrationHabits: userData.hydrationHabits || null,
      phone: userData.phone || null,
      bio: userData.bio || null,
      role: userData.role || "client",
      updatedAt: serverTimestamp(),
    };

    const clientRef = doc(db, `trainer_clients/${trainerId}/clients/${clientId}`);
    await setDoc(clientRef, syncPayload, { merge: true });

    return { id: clientId, ...syncPayload };
  } catch (error) {
    console.error("Error syncing client data:", error);
    throw error;
  }
}

// Hard-deletes the CRM record (and its legacy mirror). Note it does NOT touch the client's own user
// document or their data — removing someone from your roster must never delete their account.
export async function removeClient(clientId, trainerId) {
  if (!clientId || !trainerId || !db) {
    throw new Error("Missing required parameters: clientId or trainerId");
  }

  try {
    const clientRef = doc(db, `trainer_clients/${trainerId}/clients/${clientId}`);
    await deleteDoc(clientRef);

    try {
      const legacyClientRef = doc(db, CRM_CLIENTS_COLLECTION, clientId);
      await deleteDoc(legacyClientRef);
    } catch (legacyError) {
      /* ignore */
    }

    return { success: true, id: clientId };
  } catch (error) {
    console.error("Error removing client:", error);
    throw error;
  }
}

// Builds the trainer's roster: fetch, filter out anyone who shouldn't appear, enrich each row with
// live profile data, opportunistically repair placeholder names, and sort alphabetically.
export async function getTrainerClients(trainerId) {
  if (!trainerId || !db) return [];

  try {
    // includeLegacy pulls rows from the old top-level collection too, so trainers from before the
    // schema change don't see an empty roster.
    const clients = await fetchTrainerClientRoster(trainerId, { includeLegacy: true });

    const validClients = [];
    for (const client of clients) {
      // Filter 1 — status. Defaulting to "active" keeps legacy rows (written before the field
      // existed) visible instead of silently hiding a trainer's whole roster.
      const st = String(client.status || "active").toLowerCase();
      if (st === "inactive" || st === "removed" || st === "deleted" || client.archived === true) {
        continue;
      }
      try {
        const userDoc = await getDoc(doc(db, "users", client.id));
        if (userDoc.exists()) {
          const d = userDoc.data();
          // Filter 2 — the client must still point back at THIS trainer. The CRM row is our copy;
          // the client's own doc is the source of truth. If they left or switched coaches, their doc
          // says so and we drop the stale row rather than showing a client who isn't ours.
          const tid = d?.trainerId;
          if (tid == null || tid === "" || String(tid) !== String(trainerId)) {
            continue;
          }
          const crmNameRaw = String(client.name || '').trim();
          const resolvedName = resolveTrainerClientDisplayName(client, d);
          // Merge CRM row + live profile. Passing the resolved name and a photo fallback in the
          // first argument means those win over whatever the merge helper would otherwise pick.
          const mergedClient = combineTraineeProfile(
            { ...client, name: resolvedName, photoURL: client.photoURL || d.photoURL || null },
            d,
          );
          // Self-healing write: if the stored CRM name is a placeholder ("Client", "New Client")
          // but we now know their real name, persist the upgrade. Guarded so it only fires on the
          // placeholder→real transition, not on every roster load.
          if (
            mergedClient.name &&
            !isGenericClientDisplayName(mergedClient.name) &&
            isGenericClientDisplayName(crmNameRaw)
          ) {
            try {
              await setDoc(
                doc(db, `trainer_clients/${trainerId}/clients/${client.id}`),
                { name: mergedClient.name, updatedAt: serverTimestamp() },
                { merge: true }
              );
            } catch (_) {
              /* ignore */
            }
          }
          validClients.push(mergedClient);
        } else {
          // No user doc (invited, never signed up). Keep them — the trainer added this person on
          // purpose — but with CRM data only.
          validClients.push(combineTraineeProfile(client, {}));
        }
      } catch (_) {
        // One unreadable client must not break the entire roster, so skip just this row.
      }
    }

    // vocab: localeCompare = string comparison that respects accents and locale rules, unlike `<`
    // which compares raw character codes and would sort "Émile" after "Zoe".
    validClients.sort((a, b) => {
      const nameA = (a.name || "").toLowerCase();
      const nameB = (b.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return validClients;
  } catch (error) {
    console.error("Error getting trainer clients:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - getTrainerClients");
    return [];
  }
}

// Partial update of a client record.
// The `trainerId` argument is optional across this whole service and falls back to the signed-in
// user — callers inside the trainer app are always the trainer, so passing it every time is noise.
// Here it's required after the fallback, because writing to the wrong trainer's path is worse than
// failing loudly.
export async function updateClient(clientId, updates, trainerId = null) {
  if (!clientId || !db) {
    throw new Error("Missing required parameter: clientId");
  }

  const tid = trainerId || auth?.currentUser?.uid;
  if (!tid) {
    throw new Error("Missing trainerId for canonical client update");
  }

  try {
    await updateTrainerClientDoc(tid, clientId, updates);
    return { success: true };
  } catch (error) {
    console.error("Error updating client:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - updateClient");
    throw error;
  }
}

// --- Progress entries: a client's check-in measurements over time ---------------------------
// Appends one check-in. addDoc (not setDoc) because each entry is a new record with a generated id —
// these accumulate into the history/weight trend rather than overwriting each other.
export async function addProgress(clientId, progressData, trainerId = null) {
  if (!clientId || !db) {
    throw new Error("Missing required parameter: clientId");
  }

  const tid = trainerId || auth?.currentUser?.uid;

  try {
    const progressRef = progressCollectionRef(tid, clientId);
    const payload = {
      weight: progressData.weight || null,
      bodyFat: progressData.bodyFat || null,
      chest: progressData.chest || null,
      arms: progressData.arms || null,
      waist: progressData.waist || null,
      photos: progressData.photos || [],
      note: progressData.note || "",
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(progressRef, payload);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error adding progress:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - addProgress");
    throw error;
  }
}

export async function getProgressHistory(clientId, trainerId = null) {
  if (!clientId || !db) return [];

  try {
    const tid = trainerId || auth?.currentUser?.uid;
    const progressEntries = await fetchTrainerClientSubcollectionDocs(
      clientId,
      CRM_PROGRESS_SUBCOLLECTION,
      tid,
    );

    // Newest first (timeB - timeA). Sorted in JS rather than with orderBy because that would need
    // a composite index alongside the path filtering, and these lists are small.
    // vocab: createdAt?.toMillis?.() = Firestore Timestamps need toMillis() to become numbers, but a
    // locally-written entry may still hold a raw value, and a pending serverTimestamp() is null —
    // hence the chain down to 0.
    progressEntries.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || a.createdAt || 0;
      const timeB = b.createdAt?.toMillis?.() || b.createdAt || 0;
      return timeB - timeA;
    });

    return progressEntries;
  } catch (error) {
    // permission-denied is routine here (the client revoked access), so stay quiet about it and
    // let anything else through to the console.
    const code = error?.code || error?.name;
    if (code !== "permission-denied") {
      console.error("Error getting progress history:", error);
    }
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - getProgressHistory");
    return [];
  }
}

export async function deleteProgress(clientId, progressId, trainerId = null) {
  if (!clientId || !progressId || !db) {
    throw new Error("Missing required parameters: clientId or progressId");
  }

  try {
    const tid = trainerId || auth?.currentUser?.uid;
    await deleteTrainerClientSubdoc(tid, clientId, CRM_PROGRESS_SUBCOLLECTION, progressId);
    return { success: true };
  } catch (error) {
    console.error("Error deleting progress:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - deleteProgress");
    throw error;
  }
}

// --- Tasks: to-dos the trainer assigns a client ----------------------------------------------
// Same CRUD shape as progress above (create / get sorted newest-first / update / delete).
export async function createTask(clientId, trainerId, taskData) {
  if (!clientId || !trainerId || !db) {
    throw new Error("Missing required parameters: clientId or trainerId");
  }

  try {
    const tasksRef = tasksCollectionRef(trainerId, clientId);
    const payload = {
      title: taskData.title || "",
      description: taskData.description || "",
      dueDate: taskData.dueDate || null,
      completed: false,
      trainerId,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(tasksRef, payload);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error creating task:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - createTask");
    throw error;
  }
}

export async function getTasks(clientId, trainerId = null) {
  if (!clientId || !db) return [];

  try {
    const tid = trainerId || auth?.currentUser?.uid;
    const tasks = await fetchTrainerClientSubcollectionDocs(clientId, CRM_TASKS_SUBCOLLECTION, tid);

    tasks.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || a.createdAt || 0;
      const timeB = b.createdAt?.toMillis?.() || b.createdAt || 0;
      return timeB - timeA;
    });

    return tasks;
  } catch (error) {
    const code = error?.code || error?.name;
    if (code !== "permission-denied") {
      console.error("Error getting tasks:", error);
    }
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - getTasks");
    return [];
  }
}

export async function updateTask(clientId, taskId, updates, trainerId = null) {
  if (!clientId || !taskId || !db) {
    throw new Error("Missing required parameters: clientId or taskId");
  }

  try {
    const tid = trainerId || auth?.currentUser?.uid;
    await updateTrainerClientSubdoc(tid, clientId, CRM_TASKS_SUBCOLLECTION, taskId, updates);
    return { success: true };
  } catch (error) {
    console.error("Error updating task:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - updateTask");
    throw error;
  }
}

// Convenience wrapper so checkbox UIs don't have to know the field name.
export async function toggleTaskComplete(clientId, taskId, completed) {
  return await updateTask(clientId, taskId, { completed });
}

export async function deleteTask(clientId, taskId, trainerId = null) {
  if (!clientId || !taskId || !db) {
    throw new Error("Missing required parameters: clientId or taskId");
  }

  try {
    const tid = trainerId || auth?.currentUser?.uid;
    await deleteTrainerClientSubdoc(tid, clientId, CRM_TASKS_SUBCOLLECTION, taskId);
    return { success: true };
  } catch (error) {
    console.error("Error deleting task:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - deleteTask");
    throw error;
  }
}

// --- Notes: the trainer's private write-ups about a client ------------------------------------
// Identical CRUD shape to tasks above.
export async function createNote(clientId, trainerId, noteData) {
  if (!clientId || !trainerId || !db) {
    throw new Error("Missing required parameters: clientId or trainerId");
  }

  try {
    const notesRef = notesCollectionRef(trainerId, clientId);
    const payload = {
      text: noteData.text || "",
      trainerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(notesRef, payload);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error("Error creating note:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - createNote");
    throw error;
  }
}

export async function getNotes(clientId, trainerId = null) {
  if (!clientId || !db) return [];

  try {
    const tid = trainerId || auth?.currentUser?.uid;
    const notes = await fetchTrainerClientSubcollectionDocs(clientId, CRM_NOTES_SUBCOLLECTION, tid);

    notes.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || a.createdAt || 0;
      const timeB = b.createdAt?.toMillis?.() || b.createdAt || 0;
      return timeB - timeA;
    });

    return notes;
  } catch (error) {
    console.error("Error getting notes:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - getNotes");
    return [];
  }
}

export async function updateNote(clientId, noteId, updates, trainerId = null) {
  if (!clientId || !noteId || !db) {
    throw new Error("Missing required parameters: clientId or noteId");
  }

  try {
    const tid = trainerId || auth?.currentUser?.uid;
    await updateTrainerClientSubdoc(tid, clientId, CRM_NOTES_SUBCOLLECTION, noteId, updates);
    return { success: true };
  } catch (error) {
    console.error("Error updating note:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - updateNote");
    throw error;
  }
}

export async function deleteNote(clientId, noteId, trainerId = null) {
  if (!clientId || !noteId || !db) {
    throw new Error("Missing required parameters: clientId or noteId");
  }

  try {
    const tid = trainerId || auth?.currentUser?.uid;
    await deleteTrainerClientSubdoc(tid, clientId, CRM_NOTES_SUBCOLLECTION, noteId);
    return { success: true };
  } catch (error) {
    console.error("Error deleting note:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - deleteNote");
    throw error;
  }
}

// --- Derived analytics: these compute from the data above, they don't read new collections -----

// Chart-ready weight points, newest first.
// Manipulate here: limitCount = 30 is how many points the chart shows.
export async function getWeightTrend(clientId, limitCount = 30) {
  if (!clientId || !db) return [];

  try {
    const progressEntries = await getProgressHistory(clientId);
    const weightData = progressEntries
      // Drop check-ins with no weight (measurements-only entries) and any zero, which is a data
      // error rather than a real reading — a 0 would wreck the chart's y-axis.
      .filter((entry) => entry.weight != null && entry.weight > 0)
      .map((entry) => ({
        // vocab: toDate() = convert a Firestore Timestamp to a JS Date; the fallbacks cover entries
        // written locally or still awaiting a server timestamp.
        date: entry.createdAt?.toDate?.() || entry.createdAt || new Date(),
        weight: Number(entry.weight),
      }))
      // slice AFTER filtering, so 30 usable points come back rather than 30 rows that might mostly
      // have no weight. Entries are already newest-first, so this is "the 30 most recent".
      .slice(0, limitCount);

    return weightData;
  } catch (error) {
    console.error("Error getting weight trend:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - getWeightTrend");
    return [];
  }
}

export async function getTaskStats(clientId) {
  if (!clientId || !db) {
    return { total: 0, completed: 0, pending: 0 };
  }

  try {
    const tasks = await getTasks(clientId);
    const total = tasks.length;
    // Strict === true: older task documents may have no `completed` field at all, and a loose truthy
    // check would count undefined inconsistently.
    const completed = tasks.filter((task) => task.completed === true).length;
    const pending = total - completed;

    return { total, completed, pending };
  } catch (error) {
    console.error("Error getting task stats:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - getTaskStats");
    return { total: 0, completed: 0, pending: 0 };
  }
}

export async function getClientAnalytics(clientId) {
  if (!clientId || !db) {
    return {
      weightTrend: [],
      taskStats: { total: 0, completed: 0, pending: 0 },
      lastProgressDate: null,
      daysSinceLastCheckIn: null,
      progressEntriesCount: 0,
    };
  }

  try {
    // All three in parallel — they're independent, so awaiting them in sequence would triple the wait.
    const [weightTrend, taskStats, progressEntries] = await Promise.all([
      getWeightTrend(clientId),
      getTaskStats(clientId),
      getProgressHistory(clientId),
    ]);

    let lastProgressDate = null;
    let daysSinceLastCheckIn = null;

    if (progressEntries.length > 0) {
      // [0] is the most recent because getProgressHistory sorts newest-first.
      const lastEntry = progressEntries[0];
      lastProgressDate = lastEntry.createdAt?.toDate?.() || lastEntry.createdAt || null;

      if (lastProgressDate) {
        const now = new Date();
        // Subtracting two Dates yields milliseconds; 1000*60*60*24 converts that to whole days.
        // This powers the "hasn't checked in for N days" nudge on the dashboard.
        const diffTime = now - lastProgressDate;
        daysSinceLastCheckIn = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    return {
      weightTrend,
      taskStats,
      lastProgressDate,
      daysSinceLastCheckIn,
      progressEntriesCount: progressEntries.length,
    };
  } catch (error) {
    console.error("Error getting client analytics:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - getClientAnalytics");
    return {
      weightTrend: [],
      taskStats: { total: 0, completed: 0, pending: 0 },
      lastProgressDate: null,
      daysSinceLastCheckIn: null,
      progressEntriesCount: 0,
    };
  }
}

// Answers "does this client have enough logged data for a weekly report?" by checking the last 7
// daily log documents.
export async function checkWeeklyDataAvailability(userId) {
  if (!userId || !db) {
    throw new Error("Missing userId or db");
  }

  try {
    const today = new Date();
    const daysWithData = [];
    const dateStrings = [];

    // Build the last 7 date keys, today backwards.
    // vocab: toLocaleDateString("en-CA") = the en-CA locale cellFormattings dates as YYYY-MM-DD, which is
    // exactly the document-id cellFormatting daily logs use — a shortcut instead of manual padding.
    // Manipulate here: the timezone is pinned to America/New_York so the report's "day" matches the
    // rest of the app's day boundary regardless of where the trainer's phone is.
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateKey = date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      dateStrings.push(dateKey);
    }

    const dailyLogsRef = collection(db, "users", userId, "dailyLogs");

    // Sequential reads: only 7 documents, and doing them one at a time keeps the error handling
    // simple (any failure drops into the permission fallback below).
    for (const dateKey of dateStrings) {
      const docRef = doc(dailyLogsRef, dateKey);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        daysWithData.push({
          date: dateKey,
          hasWorkout: !!data.workout,
          hasNutrition: !!data.nutrition,
          hasWeight: !!data.weight,
          hasMood: !!data.mood,
          data,
        });
      }
    }

    return {
      totalDays: 7,
      daysWithData: daysWithData.length,
      missingDays: 7 - daysWithData.length,
      details: daysWithData,
      // dateStrings was built newest-first, so the LAST entry is the oldest date — hence start/end
      // being reversed relative to array order.
      dateRange: {
        start: dateStrings[dateStrings.length - 1],
        end: dateStrings[0],
      },
    };
  } catch (error) {
    // Permission denied means the client hasn't granted access to their logs — a normal state, not a
    // crash. Firestore reports it as a code on some paths and only in the message on others, so we
    // check both, then return an honest "0 of 7 days" result instead of throwing.
    const code = error?.code;
    const msg = String(error?.message || error || "").toLowerCase();
    const permissionDenied = code === "permission-denied" || msg.includes("missing or insufficient permissions");

    if (permissionDenied) {
      const today = new Date();
      const dateStrings = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateKey = date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
        dateStrings.push(dateKey);
      }
      return {
        totalDays: 7,
        daysWithData: 0,
        missingDays: 7,
        details: [],
        dateRange: {
          start: dateStrings[dateStrings.length - 1],
          end: dateStrings[0],
        },
      };
    }

    console.error("Error checking weekly data availability:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - checkWeeklyDataAvailability");
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// END CLIENT CRM SERVICE
// ═══════════════════════════════════════════════════════════════════════════════


// Thin wrapper whose only job is stacking the providers the trainer UI depends on.
// Order matters outside-in: styles first (everything themes off it), then subscription (gates
// features), then sessions (needs to know the user). The real work lives in TrainerAppStartContent so
// that component can USE these contexts — a component can't consume a provider it renders itself.
export default function TrainerAppStart({ user }) {
  return (
    <TrainerStylesProvider>
      <ProPlanSetup userId={user?.uid}>
        <SessionsProvider>
          <TrainerAppStartContent user={user} />
        </SessionsProvider>
      </ProPlanSetup>
    </TrainerStylesProvider>
  );
}

// The actual trainer shell: owns roster data, panel state, notifications, and the shell context.
function TrainerAppStartContent({ user }) {
  const theme = useTrainerTheme();
  // vocab/symbol: ?? false = default only when theme.isDark is null/undefined, so a real `false`
  // from the theme is preserved.
  const isDark = theme?.isDark ?? false;

  // Sets up how notifications are displayed and (on Android) creates the notification channel —
  // required before any notification can appear. Empty deps: once per app launch.
  useEffect(() => {
    cloudConnectionureNotifications();
  }, []);

  // Same pattern as the client shell: one hook owns every "which panel is open" flag and all the
  // open*/handle* functions, and the big destructure below just unpacks it.
  const nav = goToTrainerScreen();
  const {
    showTrainerMessaging,
    setShowTrainerMessaging,
    showConversationsList,
    setShowConversationsList,
    showClientRequests,
    setShowClientRequests,
    showClientsList,
    setShowClientsList,
    showPhotoGallery,
    setShowPhotoGallery,
    showAIWorkouts,
    setShowAIWorkouts,
    showWorkoutGenerator,
    setShowWorkoutGenerator,
    showPlanViewer,
    setShowPlanViewer,
    showAddFilePopup,
    setShowAddFilePopup,
    addNotesFilesClientId,
    setAddNotesFilesClientId,
    weeklyReportScreen,
    setWeeklyReportScreen,
    aiChatState,
    setAiChatState,
    selectedTrainer,
    setSelectedTrainer,
    selectedConversation,
    setSelectedConversation,
    openProfile,
    openSettings,
    openHelpFAQ,
    openTerms,
    openPrivacy,
    openContactSupport,
    openBugReport,
    openNutrition,
    openWorkoutPlan,
    openVoiceAI,
    openAIChatSession,
    openWeeklyReport,
    openManualPlanBuilder,
    openPayments,
    handleHomePress: navHandleHomePress,
    onNavigate,
    navProviderProps,
    rootGoBack,
  } = nav;
  // Several separate "selected client" slots rather than one shared value. That's intentional: the
  // client you're viewing in the dashboard, the one you're messaging, and the one highlighted in nav
  // are different questions, and collapsing them into one would make opening a chat also change the
  // dashboard behind it.
  const [navSelectedClientId, setNavSelectedClientId] = useState(null);
  const [selectedClientIdForMessages, setSelectedClientIdForMessages] = useState(null);
  const [userName, setUserName] = useState(null);
  const unreadMessageCount = unreadAlertCount(user?.uid);
  // Viewer/editor modals: objects rather than booleans so one setState both opens the modal and
  // supplies what it should show.
  const [pdfViewer, setPdfViewer] = useState({ visible: false, url: null, name: null });
  const [documentEditor, setDocumentEditor] = useState({ visible: false, documentId: null });
  const [spreadsheetEditor, setSpreadsheetEditor] = useState({ visible: false, documentId: null, title: '', rows: null });
  // A counter used as a manual cache-buster: bumping it makes the documents list re-fetch. Simpler
  // than threading a refresh callback through every editor that might save a document.
  const [trainerDocsRefreshKey, setTrainerDocsRefreshKey] = useState(0);
  // A unique id for this app run (timestamp + random suffix), created once via useRef so it stays
  // stable across re-renders. Used to tell one session's activity apart from another's.
  // vocab: Math.random().toString(36).slice(2) = random number in base-36 (digits + letters), with
  // the leading "0." trimmed off — a quick random string.
  const appSessionIdRef = useRef(`${Date.now()}_${Math.random().toString(36).slice(2)}`);
  const [selectedClientIdFromDashboard, setSelectedClientIdFromDashboard] = useState(null);
  const [day6Client, setDay6Client] = useState(null); // { id, name }
  const [generatorClient, setGeneratorClient] = useState(null); // { id, name }
  const [viewingPlan, setViewingPlan] = useState(null);
  const [showManualPlanBuilder, setShowManualPlanBuilder] = useState(false);
  const [manualPlanEditId, setManualPlanEditId] = useState(null);
  const [manualPlanBuilderClientIds, setManualPlanBuilderClientIds] = useState([]);
  const [manualBuilderReturnToAI, setManualBuilderReturnToAI] = useState(false);
  const [aiWorkoutsListKey, setAiWorkoutsListKey] = useState(0);
  const [trainerProfileDoc, setTrainerProfileDoc] = useState(null);

  // Re-reads the trainer's own profile. Exposed on the shell so screens can refresh it after
  // editing the profile without a full app reload.
  // Note both fallbacks set {} rather than leaving null: null means "still loading" to consumers,
  // so an empty object is how we say "loaded, just nothing there".
  const refreshTrainerUserDoc = useCallback(async () => {
    if (!user?.uid || !db) return;
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      setTrainerProfileDoc(snap.exists() ? snap.data() : {});
    } catch {
      setTrainerProfileDoc({});
    }
  }, [user?.uid]);

  useEffect(() => {
    refreshTrainerUserDoc();
  }, [refreshTrainerUserDoc]);

  // The roster, paginated: `clients` is what's loaded so far, hasMore/loadMore drive infinite scroll.
  // Renamed on destructure (loading → clientsLoading) so these don't collide with other loading
  // flags once they're spread into the shell object.
  const {
    clients,
    loading: clientsLoading,
    loadingMore: clientsLoadingMore,
    hasMore: clientsHasMore,
    loadMore: loadMoreClients,
    error: clientsError,
    refresh: refreshClients,
  } = pagedTraineeList(user?.uid);
  // Incoming "please coach me" requests — the badge on the requests screen.
  const { requests: pendingRequests } = pendingRequestCount(user?.uid);

  // After a client is removed, refresh the list AND clear them from any selection that points at
  // them — otherwise the dashboard keeps rendering a client that no longer exists.
  // The `prev === clientId ? null : prev` form only clears when it's actually the removed client,
  // leaving an unrelated selection untouched.
  const handleTrainerClientRemovedFromRoster = useCallback((clientId) => {
    refreshClients();
    setNavSelectedClientId((prev) => (prev === clientId ? null : prev));
    setSelectedClientIdFromDashboard((prev) => (prev === clientId ? null : prev));
  }, [refreshClients]);

  // Account-switch reset, same reasoning as the client shell: this component can survive a user
  // change, so anything user-specific is cleared or the next trainer briefly sees the last one's
  // name, selections, and cached data.
  useEffect(() => {
    if (!user?.uid) return;
    
    console.log(`🔄 TrainerAppStart: User changed to ${user.uid} - resetting state`);
    
    // Reset all user-specific state
    setUserName(null);
    setTrainerProfileDoc(null);
    setSelectedTrainer(null);
    setSelectedConversation(null);
    setNavSelectedClientId(null);
    setSelectedClientIdForMessages(null);
    
    // Clear any cached data
    clearAllUserData().catch(e => {
      console.log('⚠️ Failed to clear cache in TrainerAppStart:', e.message);
    });
  }, [user?.uid]);

  // Push-token upkeep — identical to the client shell's version: claim any token issued before
  // sign-in, refresh the current one (respecting the user's notification setting), and re-check
  // whenever the app returns from the background, since reportColors can rotate while it's closed.
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

  // "What happens when the trainer taps a notification."
  // Kept in a ref so the handler registered once below always calls the LATEST closure — registering
  // the function directly would freeze today's state and navigation setters inside it forever.
  const trainerNotifTapRef = useRef(() => {});

  useEffect(() => {
    trainerNotifTapRef.current = async (data) => {
      try {
        if (!user?.uid || !data || typeof data !== 'object') return;
        // Each branch closes the panels that shouldn't be showing, then opens the destination.
        // The explicit "close everything else" calls matter because these panels are independent
        // booleans, not a stack — leaving one true would layer it over the destination.
        const type = data.type;
        if (type === 'client_request') {
          setShowConversationsList(false);
          setShowTrainerMessaging(false);
          setShowClientRequests(true);
          return;
        }
        if ((type === 'session_response' || type === 'notes_shared') && data.senderId) {
          setShowTrainerMessaging(false);
          setShowConversationsList(false);
          setShowClientRequests(false);
          setSelectedClientIdFromDashboard(String(data.senderId));
          return;
        }
        if (type === 'session_reminder' || type === 'session_update') {
          setShowConversationsList(false);
          setShowTrainerMessaging(false);
          return;
        }
        if (type === 'session_scheduled') {
          setShowConversationsList(false);
          setShowTrainerMessaging(false);
          return;
        }
        // Selecting the client BEFORE showing the list is what makes the list open scrolled to (and
        // highlighting) the person who messaged.
        if (type === 'message' && data.senderId) {
          setShowTrainerMessaging(false);
          setShowClientRequests(false);
          setSelectedClientIdForMessages(String(data.senderId));
          setShowConversationsList(true);
          return;
        }
        // Unknown type, or anything that threw: fall back to the conversations list so a tap always
        // lands somewhere useful.
        setShowConversationsList(true);
      } catch {
        setShowConversationsList(true);
      }
    };
  }, [user?.uid]);

  // Register once; the arrow reads through the ref each time so it's never stale.
  useEffect(() => {
    setNotificationTapHandler((d) => trainerNotifTapRef.current?.(d));
    return () => setNotificationTapHandler(null);
  }, []);

  // Replays the notification that launched the app from cold — that tap happened before any handler
  // existed. Manipulate here: 650ms gives the navigator time to mount before we act on it.
  useEffect(() => {
    if (!user?.uid) return undefined;
    return flushInitialNotificationResponse(650);
  }, [user?.uid]);

  // The greeting name. Read from BOTH the users and trainers documents because trainer profiles were
  // historically split across the two; the || chain picks the first that has a name and ends at
  // 'Coach' so the header is never blank or "undefined".
  useEffect(() => {
    if (!user?.uid || !db) return;
    const load = async () => {
      try {
        const [userDoc, trainerDoc] = await Promise.all([
          getDoc(doc(db, 'users', user.uid)),
          getDoc(doc(db, 'trainers', user.uid)),
        ]);
        const u = userDoc.exists() ? userDoc.data() : null;
        const t = trainerDoc.exists() ? trainerDoc.data() : null;
        setUserName(u?.firstName || u?.name || t?.name || user?.displayName || 'Coach');
      } catch {
        setUserName(user?.displayName || 'Coach');
      }
    };
    load();
  }, [user?.uid, user?.displayName]);

  // Edge-detector: refresh the roster when the requests screen CLOSES (was true, now false).
  // Accepting a request adds a client, so the list behind it is stale the moment you back out.
  // The ref holds the previous value, since an effect only sees the current one.
  const prevShowClientRequests = useRef(false);
  useEffect(() => {
    if (prevShowClientRequests.current && !showClientRequests) refreshClients();
    prevShowClientRequests.current = showClientRequests;
  }, [showClientRequests, refreshClients]);

  // Home means "close everything". The manual plan builder isn't owned by the nav hook (it has its
  // own multi-part state here), so it has to be torn down explicitly before delegating.
  const handleHomePress = useCallback(() => {
    setShowManualPlanBuilder(false);
    setManualPlanEditId(null);
    setManualPlanBuilderClientIds([]);
    setManualBuilderReturnToAI(false);
    navHandleHomePress();
  }, [navHandleHomePress]);

  // The bottom nav "+" for trainers. Unlike the client's version, notes/files always belong to a
  // specific client, so this has to answer "which one?" before opening the modal.
  const handlePlusPress = () => {
    // Manipulate here: user-facing copy for the no-clients case.
    if (!clients?.length) {
      Alert.alert('No clients', 'Add a client first to add notes or files for them.');
      return;
    }
    // Skip the prompt when the answer is obvious: the client currently open on the dashboard (if
    // they're still on the roster), or the only client they have. The `clients.some(...)` check
    // guards against a stale selection pointing at a removed client.
    const preferredId = selectedClientIdFromDashboard && clients.some((c) => c.id === selectedClientIdFromDashboard)
      ? selectedClientIdFromDashboard
      : clients.length === 1
        ? clients[0].id
        : null;
    if (preferredId) {
      setAddNotesFilesClientId(preferredId);
      setShowAddFilePopup(true);
      return;
    }
    // Otherwise build a picker: one alert button per client, plus Cancel.
    // Note this is a native Alert, so on a large roster it becomes a very long list — worth
    // replacing with a searchable sheet if trainers grow past a handful of clients.
    Alert.alert(
      'Add to Notes & Files',
      'Select a client',
      [
        ...clients.map((c) => ({
          text: c.name || c.displayName || 'Client',
          onPress: () => {
            setAddNotesFilesClientId(c.id);
            setShowAddFilePopup(true);
          },
        })),
        // style: 'cancel' makes the OS render this as the dismissive option.
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // Builds the nav-bar handlers used WHILE a document/spreadsheet editor is open.
  // The problem it solves: editors are full-screen modals over the shell, so tapping a nav icon
  // would navigate underneath one and leave the editor floating on top. Every handler here closes
  // the editors first, then performs the normal action.
  const getTrainerEditorNavChrome = useCallback((closeDashboardEditors) => {
    const closeEditors = () => {
      // The caller passes its own closer for dashboard-level editors; these two clear the ones this
      // component owns. Both are needed — neither knows about the other's editors.
      closeDashboardEditors?.();
      setDocumentEditor({ visible: false, documentId: null });
      setSpreadsheetEditor({ visible: false, documentId: null, title: '', rows: null });
    };
    return {
      // Forces the nav highlight onto Files while an editor is open — editors are reached from the
      // files area, so the pill should stay there rather than wherever the user was before.
      activeTabKey: 'files',
      onProfilePress: () => {
        closeEditors();
        openProfile();
      },
      onSettingsPress: () => {
        closeEditors();
        openSettings();
      },
      onHomePress: () => {
        closeEditors();
        handleHomePress();
      },
      onPlusPress: () => {
        closeEditors();
        handlePlusPress();
      },
      onVoicePress: () => {
        closeEditors();
        openVoiceAI();
      },
      onNutritionPress: () => {
        closeEditors();
        openNutrition();
      },
      onWorkoutPress: () => {
        closeEditors();
        openWorkoutPlan();
      },
      onMessagesPress: (clientId) => {
        closeEditors();
        setSelectedClientIdForMessages(clientId);
        setShowTrainerMessaging(false);
        setShowConversationsList(true);
      },
    };
  }, [handleHomePress, handlePlusPress, openProfile, openSettings, openVoiceAI, openNutrition, openWorkoutPlan]);

  // THE handoff, same as the client shell: bundle data, panel flags, and every open*/handle*
  // function into one object published through TrainerAppStartShellProvider, so screens read it from
  // context instead of having props threaded through the navigator.
  // useMemo because a fresh object identity each render would re-render every consumer, i.e. the
  // whole trainer app. The dependency list is shorter than the object on purpose — setters and
  // useCallback'd handlers are already stable, so listing them would add noise without changing
  // when this recomputes.
  const shell = useMemo(() => ({
    user,
    isDark,
    clients,
    clientsLoading,
    clientsLoadingMore,
    clientsHasMore,
    loadMoreClients,
    pendingRequests,
    unreadMessageCount,
    userName,
    trainerProfileDoc,
    refreshTrainerUserDoc,
    refreshClients,
    navProviderProps,
    onNavigate,
    handleHomePress,
    handlePlusPress,
    rootGoBack,
    openProfile,
    openSettings,
    openHelpFAQ,
    openTerms,
    openPrivacy,
    openContactSupport,
    openBugReport,
    openNutrition,
    openWorkoutPlan,
    openVoiceAI,
    openAIChatSession,
    openWeeklyReport,
    openManualPlanBuilder,
    openPayments,
    showTrainerMessaging,
    setShowTrainerMessaging,
    showConversationsList,
    setShowConversationsList,
    showClientRequests,
    setShowClientRequests,
    showClientsList,
    setShowClientsList,
    showPhotoGallery,
    setShowPhotoGallery,
    showAIWorkouts,
    setShowAIWorkouts,
    showWorkoutGenerator,
    setShowWorkoutGenerator,
    showPlanViewer,
    setShowPlanViewer,
    showAddFilePopup,
    setShowAddFilePopup,
    addNotesFilesClientId,
    setAddNotesFilesClientId,
    weeklyReportScreen,
    setWeeklyReportScreen,
    aiChatState,
    setAiChatState,
    selectedTrainer,
    setSelectedTrainer,
    selectedConversation,
    setSelectedConversation,
    selectedClientIdFromDashboard,
    setSelectedClientIdFromDashboard,
    selectedClientIdForMessages,
    setSelectedClientIdForMessages,
    navSelectedClientId,
    setNavSelectedClientId,
    day6Client,
    setDay6Client,
    generatorClient,
    setGeneratorClient,
    viewingPlan,
    setViewingPlan,
    showManualPlanBuilder,
    setShowManualPlanBuilder,
    manualPlanEditId,
    setManualPlanEditId,
    manualPlanBuilderClientIds,
    setManualPlanBuilderClientIds,
    manualBuilderReturnToAI,
    setManualBuilderReturnToAI,
    aiWorkoutsListKey,
    setAiWorkoutsListKey,
    pdfViewer,
    setPdfViewer,
    documentEditor,
    setDocumentEditor,
    spreadsheetEditor,
    setSpreadsheetEditor,
    trainerDocsRefreshKey,
    setTrainerDocsRefreshKey,
    getTrainerEditorNavChrome,
    handleTrainerClientRemovedFromRoster,
    appSessionId: appSessionIdRef.current,
  }), [
    user,
    isDark,
    clients,
    clientsLoading,
    clientsLoadingMore,
    clientsHasMore,
    pendingRequests,
    unreadMessageCount,
    userName,
    trainerProfileDoc,
    navProviderProps,
    showTrainerMessaging,
    showConversationsList,
    showClientRequests,
    showClientsList,
    selectedClientIdFromDashboard,
    selectedClientIdForMessages,
    navSelectedClientId,
    aiChatState,
    weeklyReportScreen,
    pdfViewer,
    documentEditor,
    spreadsheetEditor,
    trainerDocsRefreshKey,
  ]);

  // Almost no UI here by design — the navigator renders every trainer screen, and they pull what
  // they need out of the shell context.
  return (
    <TrainerAppStartShellProvider value={shell}>
      {/* Catches a render crash anywhere below and shows a fallback instead of a white screen. */}
      <CrashCatcher>
        {/* rootNavigationRef lets non-React code (notification taps, auth changes) navigate;
            trainerLinking maps coachconnect://trainer/... deep links onto these screens. */}
        <NavigationContainer ref={rootNavigationRef} webLinks={trainerLinking}>
          <TrainerScreenList />
        </NavigationContainer>
      </CrashCatcher>
    </TrainerAppStartShellProvider>
  );
}

