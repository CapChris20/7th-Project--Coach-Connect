/**
 * Trainer App
 *
 * Purpose: Trainer App — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/app
 * Key exports: getClient, createOrUpdateClient, syncClientDataFromUsers, removeClient, getTrainerClients, updateClient, addProgress, getProgressHistory
 *
 * @file-header
 */
/**
 * TrainerApp.jsx
 * Trainer CRM dashboard with full conditional rendering.
 * When client has data → Lovable-style populated UI.
 * When no data → clean empty states with CTAs.
 */

import React, { useState, useMemo, useCallback, createContext, useContext, useEffect, useRef } from "react";
import { NavigationContainer } from '@react-navigation/native';
import TrainerRootNavigator from '../trainer/navigation/TrainerRootNavigator';
import { TrainerAppShellProvider } from '../trainer/navigation/TrainerAppShellContext';
import { useTrainerScreenNavigation } from '../trainer/hooks/useTrainerScreenNavigation';
import { rootNavigationRef } from '../navigation/navigationRef';
import { trainerLinking } from '../navigation/linking';
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
import BlurBackdropPlate from '../shared/ui/BlurBackdropPlate';
import LottieView from 'lottie-react-native';
import DailyQuoteCard, { DailyQuotePill } from '../shared/components/DailyQuoteCard';
import HoldToConfirmModal from '../shared/components/HoldToConfirmModal';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Path, Polyline } from 'react-native-svg';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  onSnapshot,
  updateDoc,
  query,
  where,
  addDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import CoachConnectHeader from "../shared/components/CoachConnectHeader";
import BottomNavBar from "../navigation/BottomNavBar";
import { AppNavigationProvider } from "../navigation/AppNavigationContext";
import TrainerSearchScreen from '../marketplace/screens/TrainerSearchScreen';
import TrainerMessagingScreen from "../trainer/screens/TrainerMessagingScreen";
import ConversationsListScreen from "../trainer/screens/ConversationsListScreen";
import VoiceAIHomeScreen from "../aiChat/screens/VoiceAIHomeScreen";
import AIChatScreen from "../aiChat/screens/AIChatScreen";
import NutritionContainer from "../nutrition/screens/NutritionContainer";
import ProfileScreen from '../profile/screens/ProfileScreen';
import SettingsScreen from "../client/screens/SettingsScreen";
import HelpFAQScreen from "../settings/screens/HelpFAQScreen";
import TermsOfServiceScreen from "../settings/screens/TermsOfServiceScreen";
import PrivacyPolicyScreen from "../settings/screens/PrivacyPolicyScreen";
import ContactSupportScreen from "../settings/screens/ContactSupportScreen";
import BugReportScreen from "../settings/screens/BugReportScreen";
import WorkoutPlanGeneratorScreen from "../workouts/screens/workout";
import ClientRequestsScreen from "../trainer/screens/ClientRequestsScreen";
import SessionSchedulingScreen from "../trainer/screens/SessionSchedulingScreen";
import SessionFormScreen from "../trainer/screens/SessionFormScreen";
import { useTrainerClients } from "../trainer/hooks/useTrainerClients";
import { resolveTrainerClientDisplayName, isGenericClientDisplayName } from "../trainer/crm/formatClientName";
import { useTrainerPendingRequests } from "../trainer/hooks/useTrainerPendingRequests";
import {
  configureNotifications,
  persistPushTokensForUid,
  setNotificationTapHandler,
  flushInitialNotificationResponse,
  subscribePushTokenRefreshOnResume,
} from "../shared/notifications/manageNotifications";
import { useTheme as useGlobalTheme } from "../shared/ui/ThemeContext";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../app/config";
import { fetchLatestLoggedWeight } from '../shared/daily-metrics/getLatestWeight';
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import { autoLogErrorSync } from "../utils/autoLogError";
import { getOrCreateConversation } from "../ai/trainer-messaging/sendTrainerNotification";
import { getDateKey } from "../shared/utils/dateKeys";
import { getLocalDateKey } from "../shared/utils/getLocalDay";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { subscribeToUnreadCount } from "../ai/services/conversationService";
import { markAllMessagesReadForUser } from "../ai/services/markAllMessagesRead";
import { getNotesAndFiles, getTrainerDocuments, deleteNotesAndFilesItem, filterTrainerDocumentsForClient } from "../shared/notes-files/manageNotesAndFiles";
import { clearAllUserData } from "../utils/clearDataOnLogout";
import AddNotesFilesModal from "../shared/components/AddNotesFilesModal";
import MediaViewerModal from "../shared/components/MediaViewerModal";
import EmbedWebViewModal from "../shared/components/EmbedWebViewModal";
import {
  isImageFile as isNotesImageFile,
  isVideoFile as isNotesVideoFile,
  isPdfFile as isNotesPdfFile,
  getEmbedViewerUri,
} from "../shared/utils/getFileViewType";
import PdfViewerModal from "../shared/components/PdfViewerModal";
import SpreadsheetViewerModal from "../shared/components/SpreadsheetViewerModal";
import DocumentEditorModal from "../trainer/components/documents/DocumentEditorModal";
import QuickActionCard from '../shared/components/QuickActionCard';
import ShareDocumentModal from "../trainer/components/documents/ShareDocumentModal";
import SpreadsheetEditorModal from "../trainer/components/documents/SpreadsheetEditorModal";
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import RemoveTrainerSheet from "../shared/components/RemoveTrainerSheet";
import { getFoodLogsForDate, calculateMacroTotals, getDailyGoals } from "../nutrition/daily-log/logFoodToFirestore";
import PhotoGalleryScreen from "../trainer/screens/PhotoGalleryScreen";
import AIWorkoutPlansScreen from "../trainer/screens/AIWorkoutPlansScreen";
import ManualWorkoutPlanBuilderScreen from "../trainer/screens/ManualWorkoutPlanBuilderScreen";
import GradientChatBubblesIcon from "../shared/components/GradientChatBubblesIcon";
import FileGalleryGrid from "../shared/components/FileGalleryGrid";
import TrainerWeeklyReportSection from "../trainer/components/TrainerWeeklyReportSection";
import TrainerWeeklyReportScreen from "../trainer/screens/TrainerWeeklyReportScreen";
import FilesNotesHeroCard from "../client/components/FilesNotesHeroCard";
import FilesNotesSectionPremium from "../shared/components/FilesNotesSectionPremium";
import ProgressTab from '../trainer/screens/TrainerProgressTab';
import NutritionTab from '../trainer/screens/TrainerNutritionTab';
import CalendarTab from '../trainer/screens/TrainerCalendarTab';
import ClientDetailScreen from '../trainer/screens/TrainerClientDetailScreen';
import ClientsListScreen from '../trainer/screens/TrainerClientsListScreen';
import DashboardContent from '../trainer/screens/TrainerDashboardContent';
import {
  TrainerStylesProvider,
  useTrainerTheme,
  GlassCard,
  GradientText,
  AuroraHeroBanner,
  Icon,
  ICON_ACCENT,
  SCREEN_WIDTH,
  TrainerNotesFilesHeroAndWorkspace,
  TabPills,
  TABS,
} from '../trainer/components/dashboard/trainerDashboardUi';
import { isBenignTrainerClientFirestoreError } from '../trainer/lib/trainerFirestoreErrors';
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
} from '../trainer/lib/trainerClientFirestorePaths';

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT CRM SERVICE (merged from trainer/clients-list/loadTrainerClientRoster.js for review)
// Screens/hooks still import from clientCRMService.js → re-exports these bindings.
// ═══════════════════════════════════════════════════════════════════════════════

function hexToRgbTriple(hex) {
  const h = String(hex || "").replace("#", "").trim();
  if (h.length !== 6) return "255, 107, 157";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return "255, 107, 157";
  return `${r}, ${g}, ${b}`;
}

const CRM_CLIENTS_COLLECTION = "clients";
const CRM_PROGRESS_SUBCOLLECTION = "progress";
const CRM_TASKS_SUBCOLLECTION = "tasks";
const CRM_NOTES_SUBCOLLECTION = "notes";
const TRAINER_CLIENT_LINKS = "trainer_client_links";

/** Dashboard state when there is no Firestore user profile (or reads are blocked). */
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

export async function getClient(clientId, trainerId = null) {
  if (!clientId || !db) return null;

  try {
    const row = await fetchTrainerClientDoc(clientId, trainerId);
    if (row) {
      const { _source, ...data } = row;
      return data;
    }
    return null;
  } catch (error) {
    if (!isBenignTrainerClientFirestoreError(error)) {
      console.error("Error getting client:", error);
      autoLogErrorSync(error, "TrainerApp CRM - getClient");
    }
    return null;
  }
}

export async function createOrUpdateClient(clientId, trainerId, clientData) {
  if (!clientId || !trainerId || !db) {
    throw new Error("Missing required parameters: clientId or trainerId");
  }

  try {
    const clientRef = doc(db, `trainer_clients/${trainerId}/clients/${clientId}`);

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

    try {
      await getOrCreateConversation(clientId, trainerId);
    } catch (convError) {
      console.error("⚠️ Error creating auto-conversation:", convError);
    }

    const existingDoc = await getDoc(clientRef);
    if (existingDoc.exists()) {
      await setDoc(clientRef, payload, { merge: true });
    } else {
      await setDoc(clientRef, payload);
    }

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

    const verifyDoc = await getDoc(clientRef);
    if (!verifyDoc.exists()) {
      console.error("❌ ERROR: Client was not saved!");
    }

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
    autoLogErrorSync(error, "TrainerApp CRM - createOrUpdateClient");
    throw error;
  }
}

export async function syncClientDataFromUsers(clientId, trainerId) {
  if (!clientId || !trainerId || !db) {
    throw new Error("Missing required parameters");
  }

  try {
    const userDoc = await getDoc(doc(db, "users", clientId));
    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data();

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

export async function getTrainerClients(trainerId) {
  if (!trainerId || !db) return [];

  try {
    const clients = await fetchTrainerClientRoster(trainerId, { includeLegacy: true });

    const validClients = [];
    for (const client of clients) {
      const st = String(client.status || "active").toLowerCase();
      if (st === "inactive" || st === "removed" || st === "deleted" || client.archived === true) {
        continue;
      }
      try {
        const userDoc = await getDoc(doc(db, "users", client.id));
        if (userDoc.exists()) {
          const d = userDoc.data();
          const tid = d?.trainerId;
          if (tid == null || tid === "" || String(tid) !== String(trainerId)) {
            continue;
          }
          const crmNameRaw = String(client.name || '').trim();
          client.name = resolveTrainerClientDisplayName(client, d);
          client.photoURL = client.photoURL || d.photoURL || null;
          if (
            client.name &&
            !isGenericClientDisplayName(client.name) &&
            isGenericClientDisplayName(crmNameRaw)
          ) {
            try {
              await setDoc(
                doc(db, `trainer_clients/${trainerId}/clients/${client.id}`),
                { name: client.name, updatedAt: serverTimestamp() },
                { merge: true }
              );
            } catch (_) {
              /* ignore */
            }
          }
          validClients.push(client);
        }
      } catch (_) {
        /* skip */
      }
    }

    validClients.sort((a, b) => {
      const nameA = (a.name || "").toLowerCase();
      const nameB = (b.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return validClients;
  } catch (error) {
    console.error("Error getting trainer clients:", error);
    autoLogErrorSync(error, "TrainerApp CRM - getTrainerClients");
    return [];
  }
}

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
    autoLogErrorSync(error, "TrainerApp CRM - updateClient");
    throw error;
  }
}

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
    autoLogErrorSync(error, "TrainerApp CRM - addProgress");
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

    progressEntries.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || a.createdAt || 0;
      const timeB = b.createdAt?.toMillis?.() || b.createdAt || 0;
      return timeB - timeA;
    });

    return progressEntries;
  } catch (error) {
    const code = error?.code || error?.name;
    if (code !== "permission-denied") {
      console.error("Error getting progress history:", error);
    }
    autoLogErrorSync(error, "TrainerApp CRM - getProgressHistory");
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
    autoLogErrorSync(error, "TrainerApp CRM - deleteProgress");
    throw error;
  }
}

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
    autoLogErrorSync(error, "TrainerApp CRM - createTask");
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
    autoLogErrorSync(error, "TrainerApp CRM - getTasks");
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
    autoLogErrorSync(error, "TrainerApp CRM - updateTask");
    throw error;
  }
}

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
    autoLogErrorSync(error, "TrainerApp CRM - deleteTask");
    throw error;
  }
}

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
    autoLogErrorSync(error, "TrainerApp CRM - createNote");
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
    autoLogErrorSync(error, "TrainerApp CRM - getNotes");
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
    autoLogErrorSync(error, "TrainerApp CRM - updateNote");
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
    autoLogErrorSync(error, "TrainerApp CRM - deleteNote");
    throw error;
  }
}

export async function getWeightTrend(clientId, limitCount = 30) {
  if (!clientId || !db) return [];

  try {
    const progressEntries = await getProgressHistory(clientId);
    const weightData = progressEntries
      .filter((entry) => entry.weight != null && entry.weight > 0)
      .map((entry) => ({
        date: entry.createdAt?.toDate?.() || entry.createdAt || new Date(),
        weight: Number(entry.weight),
      }))
      .slice(0, limitCount);

    return weightData;
  } catch (error) {
    console.error("Error getting weight trend:", error);
    autoLogErrorSync(error, "TrainerApp CRM - getWeightTrend");
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
    const completed = tasks.filter((task) => task.completed === true).length;
    const pending = total - completed;

    return { total, completed, pending };
  } catch (error) {
    console.error("Error getting task stats:", error);
    autoLogErrorSync(error, "TrainerApp CRM - getTaskStats");
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
    const [weightTrend, taskStats, progressEntries] = await Promise.all([
      getWeightTrend(clientId),
      getTaskStats(clientId),
      getProgressHistory(clientId),
    ]);

    let lastProgressDate = null;
    let daysSinceLastCheckIn = null;

    if (progressEntries.length > 0) {
      const lastEntry = progressEntries[0];
      lastProgressDate = lastEntry.createdAt?.toDate?.() || lastEntry.createdAt || null;

      if (lastProgressDate) {
        const now = new Date();
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
    autoLogErrorSync(error, "TrainerApp CRM - getClientAnalytics");
    return {
      weightTrend: [],
      taskStats: { total: 0, completed: 0, pending: 0 },
      lastProgressDate: null,
      daysSinceLastCheckIn: null,
      progressEntriesCount: 0,
    };
  }
}

export async function checkWeeklyDataAvailability(userId) {
  if (!userId || !db) {
    throw new Error("Missing userId or db");
  }

  try {
    const today = new Date();
    const daysWithData = [];
    const dateKeys = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateKey = date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      dateKeys.push(dateKey);
    }

    const dailyLogsRef = collection(db, "users", userId, "dailyLogs");

    for (const dateKey of dateKeys) {
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
      dateRange: {
        start: dateKeys[dateKeys.length - 1],
        end: dateKeys[0],
      },
    };
  } catch (error) {
    const code = error?.code;
    const msg = String(error?.message || error || "").toLowerCase();
    const permissionDenied = code === "permission-denied" || msg.includes("missing or insufficient permissions");

    if (permissionDenied) {
      const today = new Date();
      const dateKeys = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateKey = date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
        dateKeys.push(dateKey);
      }
      return {
        totalDays: 7,
        daysWithData: 0,
        missingDays: 7,
        details: [],
        dateRange: {
          start: dateKeys[dateKeys.length - 1],
          end: dateKeys[0],
        },
      };
    }

    console.error("Error checking weekly data availability:", error);
    autoLogErrorSync(error, "TrainerApp CRM - checkWeeklyDataAvailability");
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// END CLIENT CRM SERVICE
// ═══════════════════════════════════════════════════════════════════════════════


export default function TrainerApp({ user }) {
  return (
    <TrainerStylesProvider>
      <TrainerAppContent user={user} />
    </TrainerStylesProvider>
  );
}

function TrainerAppContent({ user }) {
  const theme = useTrainerTheme();
  const isDark = theme?.isDark ?? false;

  // Ensure notification handler + (Android) channel are configured on app startup.
  useEffect(() => {
    configureNotifications();
  }, []);

  const nav = useTrainerScreenNavigation();
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
    showAddNotesFilesModal,
    setShowAddNotesFilesModal,
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
  const [navSelectedClientId, setNavSelectedClientId] = useState(null);
  const [selectedClientIdForMessages, setSelectedClientIdForMessages] = useState(null);
  const [userName, setUserName] = useState(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [pdfViewer, setPdfViewer] = useState({ visible: false, url: null, name: null });
  const [documentEditor, setDocumentEditor] = useState({ visible: false, documentId: null });
  const [spreadsheetEditor, setSpreadsheetEditor] = useState({ visible: false, documentId: null, title: '', rows: null });
  const [trainerDocsRefreshKey, setTrainerDocsRefreshKey] = useState(0);
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

  const {
    clients,
    loading: clientsLoading,
    loadingMore: clientsLoadingMore,
    hasMore: clientsHasMore,
    loadMore: loadMoreClients,
    error: clientsError,
    refresh: refreshClients,
  } = useTrainerClients(user?.uid);
  const { requests: pendingRequests } = useTrainerPendingRequests(user?.uid);

  const handleTrainerClientRemovedFromRoster = useCallback((clientId) => {
    refreshClients();
    setNavSelectedClientId((prev) => (prev === clientId ? null : prev));
    setSelectedClientIdFromDashboard((prev) => (prev === clientId ? null : prev));
  }, [refreshClients]);

  // Clear cache and reset state when user changes
  useEffect(() => {
    if (!user?.uid) return;
    
    console.log(`🔄 TrainerApp: User changed to ${user.uid} - resetting state`);
    
    // Reset all user-specific state
    setUserName(null);
    setTrainerProfileDoc(null);
    setUnreadMessageCount(0);
    setSelectedTrainer(null);
    setSelectedConversation(null);
    setNavSelectedClientId(null);
    setSelectedClientIdForMessages(null);
    
    // Clear any cached data
    clearAllUserData().catch(e => {
      console.log('⚠️ Failed to clear cache in TrainerApp:', e.message);
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return undefined;
    persistPushTokensForUid(user.uid, { skipIfDisabled: true });
    return subscribePushTokenRefreshOnResume(user.uid, () => true);
  }, [user?.uid]);

  const trainerNotifTapRef = useRef(() => {});

  useEffect(() => {
    trainerNotifTapRef.current = async (data) => {
      try {
        if (!user?.uid || !data || typeof data !== 'object') return;
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
        if (type === 'message' && data.senderId) {
          setShowTrainerMessaging(false);
          setShowClientRequests(false);
          setSelectedClientIdForMessages(String(data.senderId));
          setShowConversationsList(true);
          return;
        }
        setShowConversationsList(true);
      } catch {
        setShowConversationsList(true);
      }
    };
  }, [user?.uid]);

  useEffect(() => {
    setNotificationTapHandler((d) => trainerNotifTapRef.current?.(d));
    return () => setNotificationTapHandler(null);
  }, []);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return flushInitialNotificationResponse(650);
  }, [user?.uid]);

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

  const prevShowClientRequests = useRef(false);
  useEffect(() => {
    if (prevShowClientRequests.current && !showClientRequests) refreshClients();
    prevShowClientRequests.current = showClientRequests;
  }, [showClientRequests, refreshClients]);

  const handleHomePress = useCallback(() => {
    setShowManualPlanBuilder(false);
    setManualPlanEditId(null);
    setManualPlanBuilderClientIds([]);
    setManualBuilderReturnToAI(false);
    navHandleHomePress();
  }, [navHandleHomePress]);

  const handlePlusPress = () => {
    if (!clients?.length) {
      Alert.alert('No clients', 'Add a client first to add notes or files for them.');
      return;
    }
    const preferredId = selectedClientIdFromDashboard && clients.some((c) => c.id === selectedClientIdFromDashboard)
      ? selectedClientIdFromDashboard
      : clients.length === 1
        ? clients[0].id
        : null;
    if (preferredId) {
      setAddNotesFilesClientId(preferredId);
      setShowAddNotesFilesModal(true);
      return;
    }
    Alert.alert(
      'Add to Notes & Files',
      'Select a client',
      [
        ...clients.map((c) => ({
          text: c.name || c.displayName || 'Client',
          onPress: () => {
            setAddNotesFilesClientId(c.id);
            setShowAddNotesFilesModal(true);
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const getTrainerEditorNavChrome = useCallback((closeDashboardEditors) => {
    const closeEditors = () => {
      closeDashboardEditors?.();
      setDocumentEditor({ visible: false, documentId: null });
      setSpreadsheetEditor({ visible: false, documentId: null, title: '', rows: null });
    };
    return {
      activeTabKey: 'files',
      onProfilePress: () => {
        closeEditors();
        setShowProfile(true);
      },
      onSettingsPress: () => {
        closeEditors();
        setShowSettings(true);
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

  const shell = {
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
    showAddNotesFilesModal,
    setShowAddNotesFilesModal,
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
  };

  return (
    <TrainerAppShellProvider value={shell}>
      <NavigationContainer ref={rootNavigationRef} linking={trainerLinking}>
        <TrainerRootNavigator />
      </NavigationContainer>
    </TrainerAppShellProvider>
  );
}

