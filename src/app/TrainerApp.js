/**
 * TrainerApp.jsx
 * Trainer CRM dashboard with full conditional rendering.
 * When client has data → Lovable-style populated UI.
 * When no data → clean empty states with CTAs.
 */

import React, { useState, useMemo, useCallback, createContext, useContext, useEffect, useRef } from "react";
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
} from "react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
import TrainerSearchScreen from "../trainer/screens/TrainerSearchScreen";
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
import { resolveTrainerClientDisplayName, isGenericClientDisplayName } from "../trainer/lib/trainerClientDisplayName";
import { useTrainerPendingRequests } from "../trainer/hooks/useTrainerPendingRequests";
import {
  configureNotifications,
  persistPushTokensForUid,
  setNotificationTapHandler,
  flushInitialNotificationResponse,
  subscribePushTokenRefreshOnResume,
} from "../shared/services/notificationsService";
import { useTheme as useGlobalTheme } from "../shared/ui/ThemeContext";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../app/config";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import { autoLogErrorSync } from "../utils/autoLogError";
import { getOrCreateConversation } from "../ai/services/trainerMessaging";
import { getDateKey } from "../app/dateKey";
import { getLocalDateKey } from "../shared/utils/localDay";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { subscribeToUnreadCount } from "../ai/services/conversationService";
import { markAllMessagesReadForUser } from "../ai/services/markAllMessagesRead";
import { getNotesAndFiles, getTrainerDocuments, deleteNotesAndFilesItem } from "../shared/services/notesAndFilesService";
import { clearAllUserData } from "../utils/dataCacheCleanup";
import AddNotesFilesModal from "../shared/components/AddNotesFilesModal";
import MediaViewerModal from "../shared/components/MediaViewerModal";
import EmbedWebViewModal from "../shared/components/EmbedWebViewModal";
import {
  isImageFile as isNotesImageFile,
  isVideoFile as isNotesVideoFile,
  isPdfFile as isNotesPdfFile,
  getEmbedViewerUri,
  notesFileDedupeKey,
} from "../shared/utils/notesFileView";
import PdfViewerModal from "../shared/components/PdfViewerModal";
import SpreadsheetViewerModal from "../shared/components/SpreadsheetViewerModal";
import DocumentEditorModal from "../shared/components/DocumentEditorModal";
import ShareDocumentModal from "../shared/components/ShareDocumentModal";
import SpreadsheetEditorModal from "../shared/components/SpreadsheetEditorModal";
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import RemoveTrainerSheet from "../shared/components/RemoveTrainerSheet";
import { getFoodLogsForDate, calculateMacroTotals, getDailyGoals } from "../nutrition/services/nutritionService";
import PhotoGalleryScreen from "../trainer/screens/PhotoGalleryScreen";
import AIWorkoutPlansScreen from "../trainer/screens/AIWorkoutPlansScreen";
import ManualWorkoutPlanBuilderScreen from "../trainer/screens/ManualWorkoutPlanBuilderScreen";
import GradientChatBubblesIcon from "../shared/components/GradientChatBubblesIcon";
import FileGalleryGrid from "../shared/components/FileGalleryGrid";
import TrainerWeeklyReportSection from "../trainer/components/TrainerWeeklyReportSection";
import TrainerWeeklyReportScreen from "../trainer/screens/TrainerWeeklyReportScreen";

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT CRM SERVICE (merged from trainer/services/clientCRMService.js for review)
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

// Wellness empty Lotties — same assets as ClientApp `WellnessStatsRow` (soreness / energy / stress).
// Mood empty state uses Happy SUN (aligned with client dashboard mood card).
const LOTTIE_WELLNESS_SORENESS_EMPTY = require('../assets/sad reaction.json');
const LOTTIE_WELLNESS_ENERGY_EMPTY = require('../assets/Run Hamster... run.json');
const LOTTIE_WELLNESS_STRESS_EMPTY = require('../assets/Stressed Employee At Work.json');
const LOTTIE_STEPS_EMPTY = require('../shared/assets/Walking steps.json');
const LOTTIE_MOOD_EMPTY = require('../shared/assets/Happy SUN.json');

function getTrainerDashboardLottieSource(lottieType) {
  switch (lottieType) {
    case 'steps':
      return LOTTIE_STEPS_EMPTY;
    case 'water':
      return require('../assets/Lotties for Anatrox/glass water.json');
    case 'sleep':
      return require('../assets/Lotties for Anatrox/sleep.json');
    case 'boxer':
      return require('../assets/Lotties for Anatrox/boxer lottie.json');
    case 'nutrition_empty':
    case 'food':
      return require('../assets/Lotties for Anatrox/Food squeeze_With Burger and hot dog.json');
    case 'soreness':
      return LOTTIE_WELLNESS_SORENESS_EMPTY;
    case 'energy':
      return LOTTIE_WELLNESS_ENERGY_EMPTY;
    case 'stress':
      return LOTTIE_WELLNESS_STRESS_EMPTY;
    case 'mood':
      return LOTTIE_MOOD_EMPTY;
    default:
      return null;
  }
}

function getTrainerDashboardLottieCaption(lottieType) {
  switch (lottieType) {
    case 'steps':
      return 'Steps not logged yet';
    case 'water':
      return 'Water not logged yet';
    case 'sleep':
      return 'Sleep not logged yet';
    case 'boxer':
      return 'No workout logged yet';
    case 'nutrition_empty':
      return 'No nutrition data for this client yet';
    case 'food':
      return 'No meals logged yet';
    case 'soreness':
      return 'Soreness not logged yet';
    case 'energy':
      return 'Energy not logged yet';
    case 'stress':
      return 'Stress not logged yet';
    case 'mood':
      return 'Mood not logged yet';
    default:
      return null;
  }
}

/** Trainer may see CRM clients with no `users/{id}` row yet — rules/empty reads are expected. */
function isBenignTrainerClientFirestoreError(err) {
  if (!err) return false;
  const code = err.code;
  const msg = String(err.message || err || '').toLowerCase();
  return code === 'permission-denied' || msg.includes('missing or insufficient permissions');
}

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
    if (trainerId) {
      const trainerClientRef = doc(db, `trainer_clients/${trainerId}/clients/${clientId}`);
      const trainerClientSnap = await getDoc(trainerClientRef);
      if (trainerClientSnap.exists()) {
        return { id: trainerClientSnap.id, ...trainerClientSnap.data() };
      }
    }

    const clientRef = doc(db, CRM_CLIENTS_COLLECTION, clientId);
    const clientSnap = await getDoc(clientRef);
    if (!clientSnap.exists()) return null;

    return { id: clientSnap.id, ...clientSnap.data() };
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
    const seen = new Set();
    const clients = [];

    const clientsRef = collection(db, `trainer_clients/${trainerId}/clients`);
    const querySnapshot = await getDocs(clientsRef);
    querySnapshot.forEach((docSnap) => {
      const clientId = docSnap.id;
      if (!seen.has(clientId)) {
        seen.add(clientId);
        clients.push({ id: clientId, ...docSnap.data() });
      }
    });

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

export async function updateClient(clientId, updates) {
  if (!clientId || !db) {
    throw new Error("Missing required parameter: clientId");
  }

  try {
    const clientRef = doc(db, CRM_CLIENTS_COLLECTION, clientId);
    await updateDoc(clientRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating client:", error);
    autoLogErrorSync(error, "TrainerApp CRM - updateClient");
    throw error;
  }
}

export async function addProgress(clientId, progressData) {
  if (!clientId || !db) {
    throw new Error("Missing required parameter: clientId");
  }

  try {
    const progressRef = collection(db, CRM_CLIENTS_COLLECTION, clientId, CRM_PROGRESS_SUBCOLLECTION);
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

export async function getProgressHistory(clientId) {
  if (!clientId || !db) return [];

  try {
    const trainerId = auth?.currentUser?.uid;
    let querySnapshot;
    if (trainerId) {
      try {
        const newProgressRef = collection(
          db,
          `trainer_clients/${trainerId}/clients/${clientId}/${CRM_PROGRESS_SUBCOLLECTION}`,
        );
        querySnapshot = await getDocs(newProgressRef);
      } catch (newPathError) {
        const legacyProgressRef = collection(
          db,
          CRM_CLIENTS_COLLECTION,
          clientId,
          CRM_PROGRESS_SUBCOLLECTION,
        );
        querySnapshot = await getDocs(legacyProgressRef);
      }
    } else {
      const legacyProgressRef = collection(db, CRM_CLIENTS_COLLECTION, clientId, CRM_PROGRESS_SUBCOLLECTION);
      querySnapshot = await getDocs(legacyProgressRef);
    }
    const progressEntries = [];

    querySnapshot.forEach((docSnap) => {
      progressEntries.push({
        id: docSnap.id,
        ...docSnap.data(),
      });
    });

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

export async function deleteProgress(clientId, progressId) {
  if (!clientId || !progressId || !db) {
    throw new Error("Missing required parameters: clientId or progressId");
  }

  try {
    const progressRef = doc(db, CRM_CLIENTS_COLLECTION, clientId, CRM_PROGRESS_SUBCOLLECTION, progressId);
    await deleteDoc(progressRef);
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
    const tasksRef = collection(db, CRM_CLIENTS_COLLECTION, clientId, CRM_TASKS_SUBCOLLECTION);
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

export async function getTasks(clientId) {
  if (!clientId || !db) return [];

  try {
    const trainerId = auth?.currentUser?.uid;
    let querySnapshot;
    if (trainerId) {
      try {
        const newTasksRef = collection(
          db,
          `trainer_clients/${trainerId}/clients/${clientId}/${CRM_TASKS_SUBCOLLECTION}`,
        );
        querySnapshot = await getDocs(newTasksRef);
      } catch (newPathError) {
        const legacyTasksRef = collection(db, CRM_CLIENTS_COLLECTION, clientId, CRM_TASKS_SUBCOLLECTION);
        querySnapshot = await getDocs(legacyTasksRef);
      }
    } else {
      const legacyTasksRef = collection(db, CRM_CLIENTS_COLLECTION, clientId, CRM_TASKS_SUBCOLLECTION);
      querySnapshot = await getDocs(legacyTasksRef);
    }
    const tasks = [];

    querySnapshot.forEach((docSnap) => {
      tasks.push({
        id: docSnap.id,
        ...docSnap.data(),
      });
    });

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

export async function updateTask(clientId, taskId, updates) {
  if (!clientId || !taskId || !db) {
    throw new Error("Missing required parameters: clientId or taskId");
  }

  try {
    const taskRef = doc(db, CRM_CLIENTS_COLLECTION, clientId, CRM_TASKS_SUBCOLLECTION, taskId);
    await updateDoc(taskRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
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

export async function deleteTask(clientId, taskId) {
  if (!clientId || !taskId || !db) {
    throw new Error("Missing required parameters: clientId or taskId");
  }

  try {
    const taskRef = doc(db, CRM_CLIENTS_COLLECTION, clientId, CRM_TASKS_SUBCOLLECTION, taskId);
    await deleteDoc(taskRef);
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
    const notesRef = collection(db, CRM_CLIENTS_COLLECTION, clientId, CRM_NOTES_SUBCOLLECTION);
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

export async function getNotes(clientId) {
  if (!clientId || !db) return [];

  try {
    const notesRef = collection(db, CRM_CLIENTS_COLLECTION, clientId, CRM_NOTES_SUBCOLLECTION);
    const querySnapshot = await getDocs(notesRef);
    const notes = [];

    querySnapshot.forEach((docSnap) => {
      notes.push({
        id: docSnap.id,
        ...docSnap.data(),
      });
    });

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

export async function updateNote(clientId, noteId, updates) {
  if (!clientId || !noteId || !db) {
    throw new Error("Missing required parameters: clientId or noteId");
  }

  try {
    const noteRef = doc(db, CRM_CLIENTS_COLLECTION, clientId, CRM_NOTES_SUBCOLLECTION, noteId);
    await updateDoc(noteRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error updating note:", error);
    autoLogErrorSync(error, "TrainerApp CRM - updateNote");
    throw error;
  }
}

export async function deleteNote(clientId, noteId) {
  if (!clientId || !noteId || !db) {
    throw new Error("Missing required parameters: clientId or noteId");
  }

  try {
    const noteRef = doc(db, CRM_CLIENTS_COLLECTION, clientId, CRM_NOTES_SUBCOLLECTION, noteId);
    await deleteDoc(noteRef);
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─────────────────────────────────────────────
// YOUR COLOR SYSTEM: #C084FC #FF6B9D #F97316 #06B6D4 — different combo per section
// ─────────────────────────────────────────────
const PURPLE = '#C084FC';
const PINK = '#FF6B9D';
const ORANGE = '#F97316';
const CYAN = '#06B6D4';

const GRADIENT_BG_DARK = ['#0c0c0e', '#0f0f12', '#0c0c0e'];
const GRADIENT_BG_LIGHT = ['#f5f5f7', '#f0f0f2', '#ebebed'];

// Each section gets its own 2-color combo from your palette
const GRADIENT_HERO = [PURPLE, PINK];
const GRADIENT_AVATAR = [PURPLE, CYAN];
const GRADIENT_USERNAME = [PURPLE, PINK];
const GRADIENT_TABS = [S_P, S_K];
const GRADIENT_BORDER_CARD = [PINK, ORANGE];   // hot pink + orange border
const GRADIENT_WEIGHT = [PURPLE, PINK];
const GRADIENT_SLEEP = [CYAN, PURPLE];
const GRADIENT_WATER = [CYAN, ORANGE];
const GRADIENT_WORKOUT = [ORANGE, PINK];
const GRADIENT_CTA = [PURPLE, PINK];           // buttons, Client Requests badge
const GRADIENT_CALENDAR = [PURPLE, CYAN];
const GRADIENT_NOTES = [PINK, ORANGE];

const ACCENT = GRADIENT_CTA;                    // default where no specific combo
const BORDER_GRADIENT = GRADIENT_BORDER_CARD;

// Single colors for arcs / icons / badge
const GRADIENT_NUTRITION_PROTEIN = PURPLE;
const GRADIENT_NUTRITION_CARBS = CYAN;
const GRADIENT_NUTRITION_FAT = PINK;
const BADGE_COLOR = PINK;
const ICON_ACCENT = PURPLE;

// Progress tab VALUE text only — soft combos (not neon), one per card
const S_P = '#A78BFA';   // soft purple
const S_K = '#E8799A';   // soft pink
const S_O = '#FB923C';   // soft orange
const S_C = '#0D9488';   // soft teal
// Daily metric big numbers — distinct combos (dark pink / dark orange / gray); avoid one hue for all
const D_PINK_DEEP = '#9F1239';
const D_PINK_MID = '#BE185D';
const D_ORANGE_DEEP = '#9A3412';
const D_ORANGE_SOFT = '#FB923C';
const D_GRAY_DEEP = '#1F2937';
const D_GRAY_MID = '#6B7280';
const PROGRESS_VALUE_WEIGHT = [S_P, S_K];
const PROGRESS_VALUE_SLEEP = [S_C, S_P];
const PROGRESS_VALUE_WATER = [S_C, S_O];
const PROGRESS_VALUE_WORKOUT = [S_O, S_K];
const PROGRESS_VALUE_ENERGY = [D_PINK_DEEP, D_PINK_MID];
const PROGRESS_VALUE_STRESS = [D_GRAY_DEEP, D_GRAY_MID];
const PROGRESS_VALUE_MOOD = [D_ORANGE_DEEP, D_ORANGE_SOFT];
const PROGRESS_VALUE_SORENESS = [D_PINK_MID, D_ORANGE_DEEP];
const PROGRESS_VALUE_STEPS = [D_GRAY_MID, S_P];
const PROGRESS_VALUE_BODYFAT = [S_P, S_K];
const PROGRESS_VALUE_DAY = [S_P, S_C];

// Card borders — different combo per section (not one neon purple everywhere)
const CARD_BORDER_PINK_ORANGE = 'rgba(255,107,157,0.32)';   // client selector
const CARD_BORDER_PURPLE_CYAN = 'rgba(6,182,212,0.28)';    // tab pills inactive
const CARD_BORDER_PROGRESS = 'rgba(192,132,252,0.22)';     // Progress tab cards
const CARD_BORDER_NUTRITION = 'rgba(6,182,212,0.24)';      // Nutrition tab cards
const CARD_BORDER_CALENDAR = 'rgba(249,115,22,0.22)';      // Calendar tab cards
const CARD_BORDER_NOTES = 'rgba(255,107,157,0.26)';        // Notes & Files tab cards
const CARD_BORDER_DEFAULT = 'rgba(255,255,255,0.1)';       // neutral, not neon
const CARD_SHADOW_NEUTRAL = 'rgba(0,0,0,0.22)';            // neutral shadow, not purple

// ─────────────────────────────────────────────
// ICON PATHS
// ─────────────────────────────────────────────
const ICON_PATHS = {
  Sun: ["M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"],
  Moon: ["M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"],
  User: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  ChevronDown: ["m6 9 6 6 6-6"],
  ChevronLeft: ["m15 18-6-6 6-6"],
  ChevronRight: ["m9 18 6-6-6-6"],
  UserPlus: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M16 11h6m-3-3v6"],
  MessageSquare: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  Dumbbell: ["M6.5 6.5h11", "M6.5 17.5h11", "M6.5 6.5v11", "M17.5 6.5v11"],
  Utensils: ["M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2", "M7 2v20", "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3"],
  CalendarPlus: ["M21 13V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8", "M16 19v6", "M19 22v-6"],
  FolderOpen: ["m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.93 6A2 2 0 0 1 18 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9L9.6 12a2 2 0 0 0 1.69.9H18"],
  Upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"],
  PenSquare: ["M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7", "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"],
  Flame: ["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"],
  Pill: ["m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"],
  Wheat: ["M2 22 16 8", "M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"],
  Beef: ["M18.372 5.272c.35 0 .628.279.628.628v.628c0 .35-.279.628-.628.628H5.628A.628.628 0 0 1 5 6.528v-.628c0-.35.279-.628.628-.628h12.744Z"],
  Droplets: ["M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"],
  Home: ["m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"],
  Plus: ["M5 12h14", "M12 5v14"],
  Image: ["M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"],
  FileText: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"],
  Download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
  Bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  Sparkles: [
    "M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z",
    "M5 14l0.8 2.2L8 17l-2.2 0.8L5 20l-0.8-2.2L2 17l2.2-0.8L5 14z",
    "M19 13l0.9 2.4L22 16l-2.1 0.6L19 19l-0.9-2.4L16 16l2.1-0.6L19 13z",
  ],
  MoonAlt: ["M21 12.79A9 9 0 0 1 11.21 3 7 7 0 0 0 21 12.79z"],
  Droplet: ["M12 2C9 6 6 9.5 6 13a6 6 0 0 0 12 0c0-3.5-3-7-6-11z"],
  Zap: ["M13 2L3 14h7l-1 8 10-12h-7l1-8z"],
  Footsteps: [
    "M8.5 3.5c-1.5 0-2.5 1.2-2.5 2.7 0 1.3 0.7 2.3 1.6 3.7 0.3 0.5 0.6 1 0.9 1.6",
    "M9 13a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
    "M15.5 7.5c-1.5 0-2.5 1.2-2.5 2.7 0 1.3 0.7 2.3 1.6 3.7 0.3 0.5 0.6 1 0.9 1.6",
    "M16 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
  ],
};

// Icon component: Renders SVG icons from ICON_PATHS.
const Icon = ({ name, size = 18, color = "#fff" }) => {
  const paths = ICON_PATHS[name];
  if (!paths) return <Text style={{ fontSize: size, color }}>{name?.charAt(0) || "?"}</Text>;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {(Array.isArray(paths) ? paths : [paths]).map((d, i) => <Path key={i} d={d} />)}
    </Svg>
  );
};

// ─────────────────────────────────────────────
// THEME CONTEXT
// ─────────────────────────────────────────────
const TrainerStylesContext = createContext();
const TrainerStylesProvider = ({ children }) => {
  const { isDark } = useGlobalTheme();
  return (
    <TrainerStylesContext.Provider value={{ isDark }}>
      {children}
    </TrainerStylesContext.Provider>
  );
};
const useTrainerTheme = () => useContext(TrainerStylesContext);

// ─────────────────────────────────────────────
// GLASS CARD — optional borderVariant: 'progress' | 'nutrition' | 'calendar' | 'notes' (different combo per section)
// ─────────────────────────────────────────────
const CARD_BORDER_BY_VARIANT = {
  progress: CARD_BORDER_PROGRESS,
  nutrition: CARD_BORDER_NUTRITION,
  calendar: CARD_BORDER_CALENDAR,
  notes: CARD_BORDER_NOTES,
};
const GlassCard = ({ children, style, isDark, borderVariant }) => {
  const borderColor = borderVariant ? CARD_BORDER_BY_VARIANT[borderVariant] : CARD_BORDER_DEFAULT;
  const cardStyle = [
    {
      borderRadius: 20,
      borderWidth: 1,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)',
      borderColor: style?.borderColor ?? borderColor,
      ...(Platform.OS === 'ios' && {
        shadowColor: CARD_SHADOW_NEUTRAL,
        shadowRadius: 12,
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 4 },
      }),
    },
    style,
  ];
  if (Platform.OS === 'ios') {
    return (
      <BlurBackdropPlate intensity={20} tint={isDark ? 'dark' : 'light'} style={cardStyle}>
        {children}
      </BlurBackdropPlate>
    );
  }
  return <View style={cardStyle}>{children}</View>;
};

// ─────────────────────────────────────────────
// GRADIENT TEXT
// ─────────────────────────────────────────────
const GradientText = ({ children, style, colors = ACCENT }) => (
  <MaskedView maskElement={<Text style={[style, { backgroundColor: 'transparent' }]}>{children}</Text>}>
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
      <Text style={[style, { opacity: 0 }]}>{children}</Text>
    </LinearGradient>
  </MaskedView>
);

// Hero banner: Welcome message + logo gradient + daily quote pill.
const AuroraHeroBanner = ({ isDark, timeOfDay, userName, textColor }) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 600;
  // Slightly smaller so the quote + next content is visible on first load
  const titleSize = isWide ? 38 : 34;
  // Inline layout: keep Lottie "normal", but ensure it fits the right column.
  const lottieSize = Math.min(isWide ? 150 : 130, Math.max(96, Math.round((width - 32) * 0.36)));
  const bg = isDark ? 'rgba(11,11,18,0.92)' : 'rgba(255,255,255,0.70)';
  const borderGradient = isDark
    ? ['rgba(190,24,93,0.72)', 'rgba(194,65,12,0.58)']
    : ['#BE185D', '#C2410C'];
  const cardShadow = isDark ? '#000000' : '#C2410C';
  const firstName = String(userName || 'Coach').trim().split(/\s+/)[0] || 'Coach';

  return (
    <View
      style={[
        heroStyles.outer,
        {
          shadowColor: cardShadow,
          borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(194,65,12,0.22)',
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'transparent',
        },
      ]}
    >
      <LinearGradient
        colors={borderGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={heroStyles.borderGradient}
      >
        <View style={[heroStyles.inner, { backgroundColor: bg }]}>
          {/* Greeting inside hero card */}
          <View style={{ marginBottom: 6, alignItems: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: textColor, textAlign: 'center' }}>
              Good {timeOfDay},{' '}
              <Text style={{ color: '#FF6B9D', fontWeight: '900' }}>{firstName}</Text>
              !
            </Text>
          </View>

          <View style={[heroStyles.row, { flexDirection: isWide ? 'row' : 'column', gap: isWide ? 28 : 18 }]}>
          <View style={[heroStyles.left, { flex: isWide ? 0.6 : 1 }]}>
            <View style={heroStyles.welcomeWrap}>
              <Text style={[heroStyles.welcomeKicker, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(10,10,15,0.65)' }]}>
                WELCOME TO
              </Text>
              <LinearGradient
                colors={['#FF6B9D', '#C084FC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={heroStyles.welcomeUnderline}
              />
            </View>

            <Text style={[heroStyles.title, { fontSize: titleSize, color: '#FF6B9D' }]}>Coach Connect</Text>
            <Text style={[heroStyles.tagline, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' }]}>
              YOUR TRAINER-CLIENT RELATIONSHIP GETS BETTER WITH CC
            </Text>
          </View>

          <View style={[heroStyles.right, { flex: isWide ? 0.4 : 1 }]}>
            {/* Inline: Lottie (left) + Daily Quote pill (right) */}
            <View style={heroStyles.heroRightInlineRow}>
              <LottieView
                source={require('../assets/icons/weightlifting-competition.json')}
                autoPlay
                loop
                style={{ width: lottieSize, height: lottieSize }}
              />

              <View style={heroStyles.heroInlineQuoteWrap}>
                <LinearGradient
                  colors={['#FF6B9D', '#C084FC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={heroStyles.heroInlineQuoteBorder}
                >
                  <DailyQuotePill userId={auth?.currentUser?.uid} isDarkOverride={isDark} />
                </LinearGradient>
              </View>
            </View>
          </View>
          </View>

          {/* DailyQuote pill moved inline next to the Lottie */}
        </View>
      </LinearGradient>
    </View>
  );
};

const heroStyles = StyleSheet.create({
  outer: {
    marginTop: 4,
    marginBottom: 0,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: 'transparent',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 10,
    overflow: 'visible',
  },
  borderGradient: {
    borderRadius: 24,
    padding: 2,
  },
  inner: {
    borderRadius: 23,
    overflow: 'hidden',
    paddingVertical: 18,
    paddingHorizontal: 14,
  },
  row: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    alignItems: 'center',
  },
  welcomeWrap: {
    alignItems: 'center',
    marginBottom: 6,
  },
  welcomeKicker: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  welcomeUnderline: {
    marginTop: 6,
    width: 72,
    height: 3,
    borderRadius: 99,
    opacity: 0.9,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  tagline: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  right: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRightInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  heroInlineQuoteWrap: {
    flex: 1,
    marginLeft: 12,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  heroInlineQuoteBorder: {
    borderRadius: 28,
    padding: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  quotePillWrap: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotePillBorder: {
    borderRadius: 28,
    padding: 1,
    alignSelf: 'center',
    width: '92%',
    maxWidth: 360,
  },
});

// ─────────────────────────────────────────────
// ARC PROGRESS SVG
// ─────────────────────────────────────────────
const ArcProgress = ({ value, goal, label, color, isDark, unit = "g" }) => {
  const pct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
  const radius = 36;
  const circumference = Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const textColor = isDark ? '#ffffff' : '#1a0a2e';
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.5)';
  return (
    <GlassCard isDark={isDark} style={{ alignItems: 'center', padding: 12 }}>
      <Svg width={90} height={55} viewBox="0 0 90 55">
        <Path d="M 9 50 A 36 36 0 0 1 81 50" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={6} strokeLinecap="round" />
        <Path
          d="M 9 50 A 36 36 0 0 1 81 50"
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </Svg>
      <Text style={{ color: textColor, fontSize: 18, fontWeight: '700', marginTop: -6 }}>{value}{unit}</Text>
      <Text style={{ color: mutedColor, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </GlassCard>
  );
};

// ─────────────────────────────────────────────
// BORDERED CARD (gradient border)
// ─────────────────────────────────────────────
const BorderedCard = ({ children, style, borderRadius = 20, bordered = false, isDark }) => {
  const innerBg = isDark ? '#0d1117' : '#f1f5f9';
  if (!bordered) {
    return (
      <GlassCard isDark={isDark} style={[style, { borderRadius }]}>
        {children}
      </GlassCard>
    );
  }
  return (
    <View style={[style, { borderRadius, padding: 2, overflow: 'hidden' }]}>
      <LinearGradient colors={BORDER_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, borderRadius: borderRadius - 2, backgroundColor: innerBg, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const getClientInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2) || '?';
};

/** Roster / cards: show feet/inches; treat plain numbers as total inches (legacy onboarding). */
const formatClientHeightDisplay = (h) => {
  if (h == null || h === '') return null;
  if (typeof h === 'object' && h?.feet != null) {
    const inch = Number(h.inches) || 0;
    return `${h.feet}'${inch}"`;
  }
  const n = typeof h === 'number' ? h : Number(String(h).replace(/[^0-9.]/g, ''));
  if (Number.isFinite(n) && n >= 36 && n <= 96) {
    const total = Math.round(n);
    return `${Math.floor(total / 12)}'${total % 12}"`;
  }
  return typeof h === 'string' && h.trim() ? h.trim() : null;
};

const getClientSubtext = (client) => {
  const parts = [];
  if (client.goals || client.primaryGoal) parts.push((client.goals || client.primaryGoal || '').replace(/_/g, ' '));
  if (client.age) parts.push(`${client.age}y`);
  if (client.weight) parts.push(`${client.weight} lbs`);
  const heightLabel = formatClientHeightDisplay(client.height);
  if (heightLabel) parts.push(heightLabel);
  return parts.length ? parts.join(' · ') : '—';
};

/** Structured fields for roster “profile” cards (not the old one-line chip). */
const getClientRosterStats = (client) => {
  const rawGoal = (client.goals || client.primaryGoal || '').replace(/_/g, ' ').trim();
  const goal =
    rawGoal.length > 0
      ? rawGoal.replace(/\b\w/g, (c) => c.toUpperCase())
      : null;
  return {
    goal,
    age: client.age != null && client.age !== '' ? String(client.age) : null,
    weight: client.weight != null && client.weight !== '' ? String(client.weight) : null,
    height: formatClientHeightDisplay(client.height),
  };
};

// ─────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────
const EmptyState = ({ icon, message, ctaLabel, onCta, isDark, lottieType, compact }) => {
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.5)';
  const lottieSource = lottieType ? getTrainerDashboardLottieSource(lottieType) : null;
  const lottieCaption = lottieType ? getTrainerDashboardLottieCaption(lottieType) : null;
  const pad = compact ? 20 : 32;
  const gap = compact ? 8 : 12;
  const iconWrap = compact ? 44 : 52;

  return (
    <GlassCard isDark={isDark} style={{ padding: pad, alignItems: 'center', gap }}>
      {lottieType && lottieSource ? (
        <>
          <LottieView
            source={lottieSource}
            autoPlay
            loop
            style={{ width: 160, height: 160 }}
          />
          <Text style={{ color: mutedColor, fontSize: 14, textAlign: 'center' }}>
            {lottieCaption ?? message}
          </Text>
        </>
      ) : (
        <View style={{
          width: iconWrap, height: iconWrap, borderRadius: iconWrap / 2,
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(124,58,237,0.08)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={icon} size={compact ? 20 : 24} color={mutedColor} />
        </View>
      )}
      {(!lottieType || message) && (
        <Text style={{ color: mutedColor, fontSize: compact ? 13 : 14, textAlign: 'center', lineHeight: compact ? 19 : 20 }}>{message}</Text>
      )}
      {ctaLabel && onCta && (
        <TouchableOpacity onPress={onCta} activeOpacity={0.8}>
          <LinearGradient colors={GRADIENT_CTA} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 }}>
            <Icon name={icon} size={15} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{ctaLabel}</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </GlassCard>
  );
};

// ─────────────────────────────────────────────
// CATEGORY CARD — single metric, optional (only render if has value or show —)
// ─────────────────────────────────────────────
const CategoryCard = ({ title, value, unit, isDark, emptyLabel, gradient }) => {
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.5)';
  const hasVal = value != null && value !== '';
  
  const getLottieForCategory = (title) => {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('soreness')) return 'soreness';
    if (titleLower.includes('energy')) return 'energy';
    if (titleLower.includes('stress')) return 'stress';
    if (titleLower.includes('mood')) return 'mood';
    if (titleLower.includes('steps')) return 'steps';
    if (titleLower.includes('sleep')) return 'sleep';
    if (titleLower.includes('water')) return 'water';
    if (titleLower.includes('workout') || titleLower.includes('training')) return 'boxer';
    return null;
  };
  
  const lottieType = getLottieForCategory(title);
  const lottieSource = lottieType ? getTrainerDashboardLottieSource(lottieType) : null;
  
  // Always show descriptive label when there's a value
  const getDisplayLabel = () => {
    if (!hasVal) return null;
    const titleLower = title.toLowerCase();
    if (titleLower.includes('energy')) return 'Energy level';
    if (titleLower.includes('steps')) return 'Steps today';
    if (titleLower.includes('body fat')) return 'Body fat';
    if (titleLower.includes('soreness')) return 'Soreness level';
    if (titleLower.includes('stress')) return 'Stress level';
    if (titleLower.includes('mood')) return 'Mood';
    if (titleLower.includes('sleep')) return 'Sleep hours';
    if (titleLower.includes('water')) return 'Water intake';
    if (titleLower.includes('workout') || titleLower.includes('training')) return 'Workout';
    return title;
  };
  
  return (
    <GlassCard isDark={isDark} style={{ padding: 16, alignItems: 'center' }}>
      {hasVal ? (
        <>
          <GradientText colors={gradient} style={{ fontSize: 28, fontWeight: '800' }}>{value}</GradientText>
          {unit ? <Text style={{ color: mutedColor, fontSize: 11, marginTop: 2 }}>{unit}</Text> : null}
          <Text style={{ color: mutedColor, fontSize: 10, marginTop: 2, fontStyle: 'italic' }}>{getDisplayLabel()}</Text>
        </>
      ) : (
        <View style={{ alignItems: 'center' }}>
          {lottieType && lottieSource ? (
            <>
              <LottieView
                source={lottieSource}
                autoPlay
                loop
                style={{ width: 120, height: 120 }}
              />
              <Text style={{ color: mutedColor, fontSize: 13, fontStyle: 'italic', marginTop: 8 }}>
                {getTrainerDashboardLottieCaption(lottieType) ?? emptyLabel ?? 'No data'}
              </Text>
            </>
          ) : (
            <Text style={{ color: mutedColor, fontSize: 13, fontStyle: 'italic' }}>{emptyLabel || 'No data'}</Text>
          )}
        </View>
      )}
    </GlassCard>
  );
};

// ─────────────────────────────────────────────
// PROGRESS TAB — by category (data is per-day in dailyLogs, resets each day)
// ─────────────────────────────────────────────
const ProgressTab = ({ isDark, clientData, todayDailyLog, weightTrend7 = [] }) => {
  const textColor = isDark ? '#FFFFFF' : '#020617';
  const mutedColor = isDark ? 'rgba(255,255,255,0.56)' : 'rgba(15,23,42,0.72)';
  const subtleLabelColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.55)';

  const { width: windowWidth } = useWindowDimensions();
  const [metricsGridWidth, setMetricsGridWidth] = useState(() => Math.max(0, (windowWidth || SCREEN_WIDTH) - 32));

  const beforeWeight = clientData?.beforeWeight ?? null;
  const log = todayDailyLog || {};
  const currentWeight =
    log.dashboard_weight != null && log.dashboard_weight !== '' ? Number(log.dashboard_weight) : (clientData?.currentWeight != null ? Number(clientData.currentWeight) : null);

  const parsedBefore = beforeWeight != null && beforeWeight !== '' ? Number(beforeWeight) : null;
  const hasBefore = Number.isFinite(parsedBefore);
  const hasCurrent = Number.isFinite(currentWeight);
  const diff = hasBefore && hasCurrent ? Number((currentWeight - parsedBefore).toFixed(1)) : null;
  const diffDir = diff == null ? '→' : diff < 0 ? '↓' : diff > 0 ? '↑' : '→';
  const diffColor = diff == null ? 'rgba(148,163,184,0.9)' : diff < 0 ? '#10B981' : diff > 0 ? '#EF4444' : 'rgba(148,163,184,0.9)';

  const bodyFat = log.dashboard_bodyfat != null && log.dashboard_bodyfat !== '' ? String(log.dashboard_bodyfat) : null;

  // Normalize today's workout so structured logs + legacy strings all populate the rich card.
  const structuredWorkoutLog = Array.isArray(log.workoutLog)
    ? log.workoutLog.map((item) => ({
        name: item?.exerciseName || item?.name || item?.label || '',
        sets: Array.isArray(item?.sets) ? item.sets : [],
      }))
    : null;
  const workoutNameRaw = log.dashboard_workout_name != null ? String(log.dashboard_workout_name).trim() : '';
  const legacyWorkoutStr =
    log.dashboard_workouts != null && log.dashboard_workouts !== '' ? String(log.dashboard_workouts).trim() : '';

  // If we only have the legacy multiline string, split it into individual exercise lines.
  const legacyLines = legacyWorkoutStr
    ? legacyWorkoutStr
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    : [];
  const legacyFirstLine = legacyLines[0] || '';
  const legacyExerciseLines = legacyLines.length > 1 ? legacyLines.slice(1) : [];

  const workoutExercises =
    structuredWorkoutLog && structuredWorkoutLog.length > 0
      ? structuredWorkoutLog
      : Array.isArray(log.dashboard_workout_exercises) && log.dashboard_workout_exercises.length > 0
      ? log.dashboard_workout_exercises.map((name) => ({
          name: String(name),
          sets: [],
        }))
      : legacyExerciseLines.length > 0
      ? legacyExerciseLines.map((line) => ({ name: line, sets: [] }))
      : legacyLines.map((line) => ({ name: line, sets: [] }));

  const resolvedWorkoutTitle =
    workoutNameRaw ||
    legacyFirstLine ||
    (workoutExercises.length ? `${workoutExercises.length} exercise${workoutExercises.length === 1 ? '' : 's'}` : '');
  const hasWorkoutToday = !!resolvedWorkoutTitle;

  const sleepVal = log.dashboard_sleep != null && log.dashboard_sleep !== '' ? Number(log.dashboard_sleep) : null;
  const waterVal = log.dashboard_water != null && log.dashboard_water !== '' ? Number(log.dashboard_water) : null;

  const sectionHeaderStyle = {
    color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.55)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 18,
  };

  const gridGap = 12;
  const isTablet = (windowWidth || SCREEN_WIDTH) > 768;
  const cols = isTablet ? 3 : 2;
  const cardWidth = (metricsGridWidth - gridGap * (cols - 1)) / cols;

  const clampPct = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

  const Sparkline = ({ data = [] }) => {
    const pts = Array.isArray(data) ? data.filter((v) => Number.isFinite(v)) : [];
    if (pts.length < 2) {
      return (
        <View
          style={{
            height: 56,
            borderRadius: 12,
            backgroundColor: isDark ? 'rgba(15,23,42,0.9)' : '#F3F4F6',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(55,65,81,0.9)' : 'rgba(209,213,219,1)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(75,85,99,1)', fontSize: 11 }}>No trend yet</Text>
        </View>
      );
    }

    const w = 260;
    const h = 56;
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const span = Math.max(0.0001, max - min);

    const points = pts
      .map((v, i) => {
        const x = (i / (pts.length - 1)) * (w - 2) + 1;
        const y = (1 - (v - min) / span) * (h - 10) + 5;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <View
        style={{
          height: h,
          borderRadius: 12,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(55,65,81,0.9)' : 'rgba(209,213,219,1)',
          backgroundColor: isDark ? 'rgba(15,23,42,0.9)' : '#F9FAFB',
        }}
      >
        <Svg width={w} height={h}>
          <Polyline points={points} fill="none" stroke="#06B6D4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
    );
  };

  const MetricMini = ({ label, value, scale, valueGradient, emptyType, style }) => {
    const hasVal = value != null && value !== '' && Number.isFinite(Number(value));
    const n = hasVal ? Number(value) : null;
    const pct = hasVal ? clampPct(n / scale) : 0;
    const valueColors = Array.isArray(valueGradient) && valueGradient.length >= 2 ? valueGradient : [S_P, S_K];
    const borderStartRgb = hexToRgbTriple(valueColors[0]);
    const todayTint = isDark ? 'rgba(148,163,184,0.9)' : `rgba(${borderStartRgb},0.78)`;
    const emptyLottieSource = emptyType ? getTrainerDashboardLottieSource(emptyType) : null;

    return (
      <View style={[{ width: cardWidth }, style]}>
        <View
          style={{
            borderRadius: 18,
            padding: 1,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(55,65,81,0.9)' : 'rgba(209,213,219,1)',
          }}
        >
          <View
            style={{
              borderRadius: 16,
              padding: 14,
              minHeight: 138,
              backgroundColor: isDark ? '#020617' : '#FFFFFF',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text
                style={{
                  flex: 1,
                  fontSize: 10,
                  fontWeight: '800',
                  letterSpacing: 1.4,
                  color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(75,85,99,1)',
                  paddingRight: 6,
                }}
                numberOfLines={1}
              >
                {label}
              </Text>
              {hasVal && emptyLottieSource ? (
                <View pointerEvents="none" style={{ opacity: 0.52 }}>
                  <LottieView source={emptyLottieSource} autoPlay loop style={{ width: 36, height: 36 }} />
                </View>
              ) : null}
            </View>

            {hasVal ? (
              <>
                <GradientText
                  colors={valueColors}
                  style={{
                    fontSize: 44,
                    fontWeight: '900',
                    letterSpacing: -1,
                    color: isDark ? '#F9FAFB' : '#111827',
                  }}
                >
                  {String(value)}
                </GradientText>
                <View
                  style={{
                    height: 3,
                    borderRadius: 999,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(17,24,39,0.08)',
                    marginTop: 10,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      width: `${Math.round(pct * 100)}%`,
                      height: 3,
                      borderRadius: 999,
                      backgroundColor: '#06B6D4',
                    }}
                  />
                </View>
                <Text style={{ color: todayTint, fontSize: 11, marginTop: 8 }}>Today</Text>
              </>
            ) : emptyLottieSource ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 2, minHeight: 112 }}>
                <LottieView
                  source={emptyLottieSource}
                  autoPlay
                  loop
                  style={{ width: 108, height: 108 }}
                />
                <Text
                  style={{
                    color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(107,114,128,1)',
                    fontSize: 12,
                    marginTop: 6,
                  }}
                >
                  Not logged
                </Text>
              </View>
            ) : emptyType ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text
                  style={{
                    color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(107,114,128,1)',
                    fontSize: 13,
                    fontStyle: 'italic',
                  }}
                >
                  No data
                </Text>
              </View>
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text
                  style={{
                    color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(107,114,128,1)',
                    fontSize: 13,
                    fontStyle: 'italic',
                  }}
                >
                  No data
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={{ paddingTop: 4 }}>
      {/* WEIGHT — hero */}
      <View style={{ marginTop: 10 }}>
        <LinearGradient colors={['#FF6B9D', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 2 }}>
          <LinearGradient
            colors={isDark ? ['#1a1a24', '#0f0f14'] : ['#FFFFFF', '#F9FAFB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 20, padding: 18 }}
          >
            <Text style={{ color: mutedColor, fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>WEIGHT</Text>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: subtleLabelColor, fontSize: 12, marginBottom: 6 }}>Before</Text>
                <Text style={{ fontSize: 40, fontWeight: '900', color: 'rgba(192,132,252,0.95)', letterSpacing: -1 }}>
                  {hasBefore ? parsedBefore : '—'}
                </Text>
              </View>

              <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingBottom: 6 }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: diffColor }}>{diffDir}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: diffColor, marginTop: 4 }}>
                  {diff == null ? '—' : `${Math.abs(diff)} lbs`}
                </Text>
              </View>

              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={{ color: subtleLabelColor, fontSize: 12, marginBottom: 6 }}>Current</Text>
                <Text style={{ fontSize: 40, fontWeight: '900', color: '#06B6D4', letterSpacing: -1 }}>
                  {hasCurrent ? currentWeight : '—'}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.10)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(75,85,99,1)', fontSize: 11 }}>Last 7 days</Text>
                {bodyFat ? (
                  <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,107,157,0.35)', backgroundColor: 'rgba(255,107,157,0.10)' }}>
                    <Text style={{ color: isDark ? 'rgba(255,255,255,0.7)' : '#0B1220', fontSize: 11, fontWeight: '700' }}>Body Fat: {bodyFat}%</Text>
                  </View>
                ) : null}
              </View>
              <Sparkline data={weightTrend7} />
            </View>
          </LinearGradient>
        </LinearGradient>
      </View>

      {/* TODAY'S WORKOUT — hero (read-only) */}
      <View style={{ marginTop: 16 }}>
        <LinearGradient
          colors={['#E91E63', '#FF6B9D', '#C084FC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: 22,
            padding: 2,
            overflow: 'hidden',
            ...(Platform.OS === 'ios' && {
              shadowColor: '#a855f7',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 12,
            }),
            elevation: 4,
          }}
        >
          <View style={{ borderRadius: 20, overflow: 'hidden' }}>
            {/* Left accent rail */}
            <LinearGradient
              colors={['#E91E63', '#FF6B9D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, zIndex: 4 }}
            />

            {/* Rich background */}
            <LinearGradient
              colors={isDark ? ['#1A1F2E', '#0F1419'] : ['#FFFFFF', '#F9FAFB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 20, overflow: 'hidden', minHeight: 132 }}
            >
              {/* Subtle texture */}
              <LinearGradient
                colors={['rgba(255,255,255,0.07)', 'rgba(255,255,255,0)', 'rgba(192,132,252,0.08)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ ...StyleSheet.absoluteFillObject, opacity: 0.55 }}
              />

              <View style={{ padding: 20 }}>
                <Text style={{ color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(75,85,99,1)', fontSize: 11, fontWeight: '800', letterSpacing: 2 }}>
                  TODAY&apos;S WORKOUT
                </Text>

                {hasWorkoutToday ? (
                  <>
                    <Text style={{ fontSize: 26, fontWeight: '900', color: isDark ? '#FFFFFF' : '#020617', marginTop: 10 }} numberOfLines={2}>
                      {resolvedWorkoutTitle}
                    </Text>
                    {workoutExercises.length > 0 ? (
                      <>
                        <View
                          style={{
                            alignSelf: 'flex-start',
                            marginTop: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 999,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                            borderWidth: 1,
                            borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(209,213,219,1)',
                          }}
                        >
                          <Text style={{ color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(55,65,81,1)', fontSize: 12, fontWeight: '700' }}>
                            {workoutExercises.length} exercise{workoutExercises.length === 1 ? '' : 's'}
                          </Text>
                        </View>

                        {/* Preview first few exercises with sets × reps */}
                        <View style={{ marginTop: 10, gap: 6 }}>
                          {workoutExercises.slice(0, 3).map((ex, idx) => {
                            const name = ex && (ex.exerciseName || ex.name || ex.label || '');
                            const setsArr = Array.isArray(ex?.sets) ? ex.sets : [];
                            const setsCount = setsArr.length;
                            const firstSet = setsArr[0] || {};
                            const repsVal =
                              firstSet.reps != null && String(firstSet.reps).trim() !== ''
                                ? String(firstSet.reps).trim()
                                : null;
                            let meta = '';
                            if (setsCount && repsVal) {
                              meta = `${setsCount}×${repsVal}`;
                            } else if (setsCount) {
                              meta = `${setsCount} set${setsCount === 1 ? '' : 's'}`;
                            }

                            return (
                              <View key={`${name || 'exercise'}_${idx}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                                <LinearGradient
                                  colors={['rgba(233,30,99,0.9)', 'rgba(255,107,157,0.85)', 'rgba(192,132,252,0.85)']}
                                  start={{ x: 0, y: 0 }}
                                  end={{ x: 1, y: 1 }}
                                  style={{ width: 6, height: 6, borderRadius: 3, marginTop: 6 }}
                                />
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={{
                                      color: isDark ? 'rgba(249,250,251,0.96)' : 'rgba(17,24,39,0.95)',
                                      fontSize: 15,
                                      fontWeight: '700',
                                    }}
                                    numberOfLines={1}
                                  >
                                    {name || 'Exercise'}
                                  </Text>
                                  {!!meta && (
                                    <Text
                                      style={{
                                        color: isDark ? 'rgba(156,163,175,0.95)' : 'rgba(75,85,99,1)',
                                        fontSize: 11,
                                        marginTop: 1,
                                      }}
                                      numberOfLines={1}
                                    >
                                      {meta}
                                    </Text>
                                  )}
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </>
                    ) : (
                      <Text
                        style={{
                          color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(107,114,128,1)',
                          fontSize: 13,
                          marginTop: 10,
                        }}
                      >
                        Logged today
                      </Text>
                    )}
                  </>
                ) : (
                  <View style={{ alignItems: 'center', justifyContent: 'center', height: 120, marginTop: 6 }}>
                    <LottieView source={require('../assets/Lotties for Anatrox/boxer lottie.json')} autoPlay loop style={{ width: 90, height: 90 }} />
                    <Text
                      style={{
                        color: isDark ? 'rgba(255,255,255,0.68)' : 'rgba(107,114,128,1)',
                        fontSize: 14,
                        marginTop: 8,
                      }}
                    >
                      No workout logged
                    </Text>
                  </View>
                )}

                {/* Subtle right-side lottie accent (even when data exists) */}
                <View pointerEvents="none" style={{ position: 'absolute', right: 10, top: 14, opacity: 0.6 }}>
                  <LottieView
                    source={require('../assets/Lotties for Anatrox/boxer lottie.json')}
                    autoPlay
                    loop
                    style={{ width: 52, height: 52 }}
                  />
                </View>
              </View>
            </LinearGradient>
          </View>
        </LinearGradient>
      </View>

      {/* SLEEP & WATER — 2-col with bars */}
      <View style={{ marginTop: 16 }}>
        <Text style={sectionHeaderStyle}>Sleep & Water</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <LinearGradient
              colors={isDark ? ['#020617', '#020617'] : ['#FFFFFF', '#F9FAFB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 18,
                padding: 16,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(148,163,184,0.45)' : 'rgba(209,213,219,1)',
              }}
            >
              <Text
                style={{
                  color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(75,85,99,1)',
                  fontSize: 10,
                  fontWeight: '800',
                  letterSpacing: 1.4,
                }}
              >
                SLEEP
              </Text>
              {Number.isFinite(sleepVal) ? (
                <>
                  <Text
                    style={{
                      color: isDark ? '#F9FAFB' : '#020617',
                      fontSize: 34,
                      fontWeight: '900',
                      marginTop: 10,
                    }}
                  >
                    {sleepVal}
                  </Text>
                  <View style={{ height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden', marginTop: 10 }}>
                    <View style={{ height: 4, width: `${Math.round(clampPct(sleepVal / 8) * 100)}%`, borderRadius: 999, backgroundColor: '#06B6D4' }} />
                  </View>
                  <Text
                    style={{
                      color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(107,114,128,1)',
                      fontSize: 11,
                      marginTop: 8,
                    }}
                  >
                    hrs
                  </Text>

                  {/* Subtle right-side lottie accent (even when data exists) */}
                  <View pointerEvents="none" style={{ position: 'absolute', right: 10, top: 10, opacity: 0.6 }}>
                    <LottieView source={require('../assets/Lotties for Anatrox/sleep.json')} autoPlay loop style={{ width: 40, height: 40 }} />
                  </View>
                </>
              ) : (
                <View style={{ alignItems: 'center', justifyContent: 'center', height: 96 }}>
                  <LottieView source={require('../assets/Lotties for Anatrox/sleep.json')} autoPlay loop style={{ width: 70, height: 70 }} />
                  <Text
                    style={{
                      color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(107,114,128,1)',
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    Not logged
                  </Text>
                </View>
              )}
            </LinearGradient>
          </View>

          <View style={{ flex: 1 }}>
            <LinearGradient
              colors={isDark ? ['#020617', '#020617'] : ['#FFFFFF', '#F9FAFB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 18,
                padding: 16,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(148,163,184,0.45)' : 'rgba(209,213,219,1)',
              }}
            >
              <Text
                style={{
                  color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(75,85,99,1)',
                  fontSize: 10,
                  fontWeight: '800',
                  letterSpacing: 1.4,
                }}
              >
                WATER
              </Text>
              {Number.isFinite(waterVal) ? (
                <>
                  <Text
                    style={{
                      color: isDark ? '#F9FAFB' : '#020617',
                      fontSize: 34,
                      fontWeight: '900',
                      marginTop: 10,
                    }}
                  >
                    {waterVal}
                  </Text>
                  <View style={{ height: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.10)', overflow: 'hidden', marginTop: 10 }}>
                    <View style={{ height: 4, width: `${Math.round(clampPct(waterVal / 100) * 100)}%`, borderRadius: 999, backgroundColor: '#06B6D4' }} />
                  </View>
                  <Text
                    style={{
                      color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(107,114,128,1)',
                      fontSize: 11,
                      marginTop: 8,
                    }}
                  >
                    oz
                  </Text>

                  {/* Subtle right-side lottie accent (even when data exists) */}
                  <View pointerEvents="none" style={{ position: 'absolute', right: 10, top: 10, opacity: 0.6 }}>
                    <LottieView source={require('../assets/Lotties for Anatrox/glass water.json')} autoPlay loop style={{ width: 40, height: 40 }} />
                  </View>
                </>
              ) : (
                <View style={{ alignItems: 'center', justifyContent: 'center', height: 96 }}>
                  <LottieView source={require('../assets/Lotties for Anatrox/glass water.json')} autoPlay loop style={{ width: 70, height: 70 }} />
                  <Text
                    style={{
                      color: isDark ? 'rgba(148,163,184,0.95)' : 'rgba(107,114,128,1)',
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    Not logged
                  </Text>
                </View>
              )}
            </LinearGradient>
          </View>
        </View>
      </View>

      {/* DAILY METRICS — smart grid (body fat removed from main grid) */}
      <View style={{ marginTop: 16 }}>
        <Text style={sectionHeaderStyle}>Daily Metrics</Text>
        <View
          style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap' }}
          onLayout={(e) => {
            const w = e?.nativeEvent?.layout?.width;
            if (typeof w === 'number' && w > 0) setMetricsGridWidth(w);
          }}
        >
          {[
            { key: 'energy', label: 'ENERGY / 5', value: log.dashboard_energy, scale: 5, valueGradient: PROGRESS_VALUE_ENERGY, emptyType: 'energy' },
            { key: 'stress', label: 'STRESS / 10', value: log.dashboard_stress, scale: 10, valueGradient: PROGRESS_VALUE_STRESS, emptyType: 'stress' },
            { key: 'mood', label: 'MOOD / 10', value: log.dashboard_mood, scale: 10, valueGradient: PROGRESS_VALUE_MOOD, emptyType: 'mood' },
            { key: 'soreness', label: 'SORENESS / 10', value: log.dashboard_soreness, scale: 10, valueGradient: PROGRESS_VALUE_SORENESS, emptyType: 'soreness' },
            { key: 'steps', label: 'STEPS', value: log.dashboard_steps, scale: 15000, valueGradient: PROGRESS_VALUE_STEPS, emptyType: 'steps' },
          ].map((m, idx, arr) => {
            const isEndOfRow = (idx + 1) % cols === 0;
            const isLast = idx === arr.length - 1;
            const hasSingleLastRow = cols === 2 && arr.length % cols === 1;
            const shouldCenter = hasSingleLastRow && isLast && !isEndOfRow;
            return (
              <MetricMini
                key={m.key}
                label={m.label}
                value={m.value}
                scale={m.scale}
                valueGradient={m.valueGradient}
                emptyType={m.emptyType}
                style={{
                  marginLeft: shouldCenter ? (metricsGridWidth - cardWidth) / 2 : 0,
                  marginRight: shouldCenter ? 0 : isEndOfRow ? 0 : gridGap,
                  marginBottom: isLast ? 0 : gridGap,
                }}
              />
            );
          })}
        </View>
      </View>

      {/* TRAINER NOTES — secondary bottom section */}
      {(Array.isArray(log.trainerNotes) && log.trainerNotes.length > 0) ? (
        <View style={{ marginTop: 18 }}>
          <Text style={sectionHeaderStyle}>Trainer Notes</Text>
          {log.trainerNotes.map((note, idx) => (
            <View
              key={note?.id || idx}
              style={{
                backgroundColor: 'rgba(255, 107, 157, 0.10)',
                borderWidth: 1,
                borderColor: 'rgba(255, 107, 157, 0.28)',
                borderRadius: 16,
                padding: 14,
                marginBottom: 10,
                flexDirection: 'row',
                gap: 12,
              }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF6B9D', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="MessageSquare" size={16} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', marginBottom: 4 }}>From Coach</Text>
                <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 19, marginBottom: 6 }}>
                  {note?.content || ''}
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                  {note?.createdAt?.toDate ? note.createdAt.toDate().toLocaleDateString() : (note?.createdAt ? new Date(note.createdAt).toLocaleDateString() : '—')}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* keep client note (if present) but visually secondary */}
      {log.dashboard_notes != null && log.dashboard_notes !== '' && (
        <View style={{ marginTop: 22 }}>
          <Text style={[sectionHeaderStyle, { marginTop: 0 }]}>Client note</Text>
          <LinearGradient
            colors={isDark ? ['rgba(255,107,157,0.35)', 'rgba(139,92,246,0.28)'] : ['rgba(236,72,153,0.45)', 'rgba(139,92,246,0.35)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              borderRadius: 18,
              padding: 1,
              marginTop: 4,
            }}
          >
            <View
              style={{
                borderRadius: 17,
                overflow: 'hidden',
                backgroundColor: isDark ? 'rgba(18,18,24,0.96)' : '#FFFFFF',
                flexDirection: 'row',
                alignItems: 'stretch',
              }}
            >
              <View
                style={{
                  width: 4,
                  backgroundColor: PINK,
                  opacity: isDark ? 0.95 : 1,
                }}
              />
              <View style={{ flex: 1, flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 16, gap: 14 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: isDark ? 'rgba(255,107,157,0.14)' : 'rgba(236,72,153,0.12)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255,107,157,0.28)' : 'rgba(236,72,153,0.22)',
                  }}
                >
                  <Icon name="MessageSquare" size={18} color={PINK} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{
                      color: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(15,23,42,0.5)',
                      fontSize: 11,
                      fontWeight: '700',
                      letterSpacing: 1.2,
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    From client (today)
                  </Text>
                  <Text
                    style={{
                      color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.88)',
                      fontSize: 15,
                      lineHeight: 24,
                      fontWeight: '500',
                    }}
                  >
                    {log.dashboard_notes}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────
// NUTRITION TAB
// ─────────────────────────────────────────────
const NutritionTab = ({ isDark, clientData }) => {
  const textColor = isDark ? '#ffffff' : '#1a0a2e';
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.5)';
  const chipBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(124,58,237,0.1)';

  const hasCalories = clientData?.nutrition?.calories > 0;
  const hasMacros = clientData?.nutrition?.protein > 0 || clientData?.nutrition?.carbs > 0 || clientData?.nutrition?.fat > 0;
  const hasAdditionalNutrients = (clientData?.nutrition?.fiber > 0 || clientData?.nutrition?.sugar > 0 || 
                                 clientData?.nutrition?.sodium > 0 || clientData?.nutrition?.potassium > 0);
  const hasMicros = clientData?.nutrition?.micros?.length > 0;
  const hasFoods = clientData?.nutrition?.foods?.length > 0;
  const hasAnyNutrition = hasCalories || hasMacros || hasAdditionalNutrients;

  if (!hasAnyNutrition) {
    return (
      <EmptyState
        isDark={isDark}
        icon="Utensils"
        lottieType="nutrition_empty"
        message="When they log meals in the app, calories and macros show up here."
      />
    );
  }

  // Prepare all nutrients for arc progress display
  const allNutrients = [];
  
  // Main macros
  if (clientData?.nutrition?.protein > 0) {
    allNutrients.push({
      value: clientData.nutrition.protein,
      goal: clientData.nutrition.proteinGoal || 200,
      label: "Protein",
      color: GRADIENT_NUTRITION_PROTEIN,
      unit: "g"
    });
  }
  if (clientData?.nutrition?.carbs > 0) {
    allNutrients.push({
      value: clientData.nutrition.carbs,
      goal: clientData.nutrition.carbsGoal || 300,
      label: "Carbs", 
      color: GRADIENT_NUTRITION_CARBS,
      unit: "g"
    });
  }
  if (clientData?.nutrition?.fat > 0) {
    allNutrients.push({
      value: clientData.nutrition.fat,
      goal: clientData.nutrition.fatGoal || 80,
      label: "Fat",
      color: GRADIENT_NUTRITION_FAT,
      unit: "g"
    });
  }
  
  // Additional nutrients with default goals
  if (clientData?.nutrition?.fiber > 0) {
    allNutrients.push({
      value: clientData.nutrition.fiber,
      goal: 25, // Daily fiber goal
      label: "Fiber",
      color: '#22C55E', // Green
      unit: "g"
    });
  }
  if (clientData?.nutrition?.sugar > 0) {
    allNutrients.push({
      value: clientData.nutrition.sugar,
      goal: 50, // Daily sugar limit
      label: "Sugar",
      color: '#F97316', // Orange
      unit: "g"
    });
  }
  if (clientData?.nutrition?.sodium > 0) {
    allNutrients.push({
      value: clientData.nutrition.sodium,
      goal: 2300, // Daily sodium limit (mg)
      label: "Sodium",
      color: '#06B6D4', // Cyan
      unit: "mg"
    });
  }
  if (clientData?.nutrition?.potassium > 0) {
    allNutrients.push({
      value: clientData.nutrition.potassium,
      goal: 3500, // Daily potassium goal (mg)
      label: "Potassium",
      color: '#C084FC', // Purple
      unit: "mg"
    });
  }

  return (
    <View style={{ gap: 12 }}>

      {/* Calories Hero */}
      <GlassCard isDark={isDark} style={{ padding: 20, alignItems: 'center' }}>
        <Text style={{ color: mutedColor, fontSize: 12, marginBottom: 4 }}>Daily Calories</Text>
        <GradientText colors={[PINK, ORANGE]} style={{ fontSize: 40, fontWeight: '800' }}>
          {(clientData.nutrition.calories || 0).toLocaleString()}
        </GradientText>
        <Text style={{ color: mutedColor, fontSize: 12, marginTop: 2 }}>kcal</Text>
      </GlassCard>

      {/* All Nutrients as Arc Progress */}
      {allNutrients.length > 0 && (
        <View style={{ alignItems: 'center' }}>
          <View style={{ 
            flexDirection: 'row', 
            flexWrap: 'wrap', 
            justifyContent: 'space-around',
            alignItems: 'flex-start',
            gap: 12,
            width: '100%',
            paddingHorizontal: 4
          }}>
            {allNutrients.map((nutrient, i) => (
              <View key={nutrient.label} style={{ 
                width: SCREEN_WIDTH < 380 ? '28%' : '30%', 
                minWidth: SCREEN_WIDTH < 380 ? 85 : 95,
                maxWidth: 110,
                alignItems: 'center'
              }}>
                <ArcProgress
                  value={nutrient.value}
                  goal={nutrient.goal}
                  label={nutrient.label}
                  color={nutrient.color}
                  isDark={isDark}
                  unit={nutrient.unit}
                />
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Micros */}
      {hasMicros && (
        <GlassCard isDark={isDark} style={{ padding: 16 }}>
          <Text style={{ color: mutedColor, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
            MICRONUTRIENTS
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(clientData?.nutrition?.micros || []).map((m, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', width: '47%' }}>
                <Text style={{ color: mutedColor, fontSize: 13 }}>{m.name}</Text>
                <Text style={{ color: textColor, fontSize: 13, fontWeight: '600' }}>{m.value}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      )}

      {/* Foods Today */}
      {hasFoods && (
        <GlassCard isDark={isDark} style={{ padding: 16 }}>
          <Text style={{ color: mutedColor, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
            FOOD ATE TODAY
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(clientData?.nutrition?.foods || []).map((food, i) => (
              <View key={i} style={{ backgroundColor: chipBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                <Text style={{ color: textColor, fontSize: 12, fontWeight: '500' }}>{food}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────
// CALENDAR TAB
// ─────────────────────────────────────────────
const CalendarTab = ({ isDark, clientData, trainerId, clientId, clientName, trainerName }) => {
  const theme = isDark ? 'dark' : 'light';
  const [route, setRoute] = useState('/');

  const parseQuery = (path) => {
    const s = String(path || '');
    const [base, qs] = s.split('?');
    const params = {};
    if (qs) {
      for (const part of qs.split('&')) {
        const [k, v] = part.split('=');
        if (!k) continue;
        params[decodeURIComponent(k)] = v != null ? decodeURIComponent(v) : '';
      }
    }
    return { base, params };
  };

  const onNavigate = (path) => setRoute(path || '/');

  if (typeof route === 'string' && route.startsWith('/sessions/new')) {
    const { params } = parseQuery(route);
    return (
      <SessionFormScreen
        theme={theme}
        onNavigate={onNavigate}
        initialDate={params.date}
        initialClientId={clientId}
        trainerName={trainerName}
      />
    );
  }

  if (typeof route === 'string' && route.startsWith('/sessions/')) {
    const sessionId = route.split('/')[2];
    return <SessionFormScreen sessionId={sessionId} theme={theme} onNavigate={onNavigate} />;
  }

  return (
    <SessionSchedulingScreen
      theme={theme}
      onNavigate={onNavigate}
      clientId={clientId}
      clientName={clientName}
    />
  );
};

// ─────────────────────────────────────────────
// NOTES & FILES TAB — grouped by who added (From client / From you) + Your documents
// ─────────────────────────────────────────────
const NotesFilesTab = ({
  isDark,
  clientData,
  trainerId,
  clientId,
  onRefetchNotesAndFiles,
  pdfViewer,
  setPdfViewer,
  spreadsheetViewer,
  setSpreadsheetViewer,
  trainerDocuments = [],
  onRefetchTrainerDocuments,
  onOpenDocumentEditor,
  onOpenShareModal,
  onOpenSpreadsheetEditor,
  onImportSpreadsheet,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [mediaViewer, setMediaViewer] = useState({ visible: false, url: null, kind: 'image', name: null });
  const [embedViewer, setEmbedViewer] = useState({ visible: false, uri: null, title: null });
  const [deletingTrainerFiles, setDeletingTrainerFiles] = useState(false);
  const textColor = isDark ? '#ffffff' : '#1a0a2e';
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.5)';
  const theme = {
    bg: '#0A0A0F',
    card: '#141419',
    text: '#FFFFFF',
    text60: 'rgba(255,255,255,0.6)',
    text40: 'rgba(255,255,255,0.4)',
    border: 'rgba(255,255,255,0.1)',
  };
  const GRADIENTS = {
    myFiles: ['#FF6B9D', '#C084FC'],
    trainer: ['#06B6D4', '#C084FC'],
    notes: ['#C084FC', '#FF6B9D'],
  };
  const items = clientData?.notesAndFiles || [];
  const fromClient = items.filter((x) => (x.addedBy || 'client') === 'client');
  const fromYou = items.filter((x) => x.addedBy === 'trainer');
  const hasAny = items.length > 0;

  const GradientBorder = ({ gradient, children, borderRadius = 14 }) => (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius, padding: 2 }}>
      <View style={{ borderRadius: borderRadius - 2, overflow: 'hidden', backgroundColor: theme.bg }}>{children}</View>
    </LinearGradient>
  );

  const SectionHeader = ({ title }) => (
    <Text style={{ color: theme.text60, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.4, marginTop: 22, marginBottom: 10 }}>
      {title}
    </Text>
  );

  const NoteCard = ({ note }) => {
    const coach = note?.coach || 'You';
    const preview = String(note?.content || '').trim();
    return (
      <View style={{ marginBottom: 12 }}>
        <GradientBorder gradient={GRADIENTS.notes} borderRadius={14}>
          <View style={{ backgroundColor: theme.card, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <MessageSquare size={18} color="#C084FC" />
              <Text style={{ color: theme.text60, fontSize: 13, fontWeight: '700' }}>From Coach: {coach}</Text>
            </View>
            <Text style={{ color: theme.text60, fontSize: 14, lineHeight: 22, marginBottom: 12 }} numberOfLines={3}>
              &quot;{preview || '—'}&quot;
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#FF6B9D' }}>View Full Note</Text>
              <ArrowRight size={14} color="#FF6B9D" />
            </View>
          </View>
        </GradientBorder>
      </View>
    );
  };

  const FileRowCard = ({ file, accentGradient, allowDelete }) => {
    const name = file?.name || file?.title || 'File';
    const t = file?.type === 'spreadsheet' ? 'spreadsheet' : (file?.type || '');
    const IconComp = t === 'spreadsheet' ? FileSpreadsheet : FileText;
    return (
      <View style={{ marginBottom: 12 }}>
        <GradientBorder gradient={accentGradient} borderRadius={14}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => openGalleryItem(file)}
            onLongPress={allowDelete ? () => onLongPressFile?.(file) : undefined}
            style={{ backgroundColor: theme.card, flexDirection: 'row', gap: 12, padding: 12, alignItems: 'center' }}
          >
            <View style={{ width: 60, height: 60, borderRadius: 12, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(6,182,212,0.10)' }}>
              <IconComp size={28} color="#06B6D4" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>{name}</Text>
              <Text style={{ color: theme.text60, fontSize: 12, fontWeight: '500', marginTop: 4 }} numberOfLines={1}>
                {file?.createdAt ? formatDate(file.createdAt?.toDate?.() || file.createdAt) : ''}
              </Text>
            </View>
            <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(6,182,212,0.3)', justifyContent: 'center', alignItems: 'center' }} onPress={() => openGalleryItem(file)}>
              <Download size={18} color="#06B6D4" />
            </TouchableOpacity>
            {allowDelete ? (
              <TouchableOpacity
                style={{ width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.35)', justifyContent: 'center', alignItems: 'center' }}
                onPress={() => {
                  if (file?.addedBy !== 'trainer') return;
                  Alert.alert('Delete file?', 'This will permanently remove it from Notes & Files.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteSingleTrainerFile(file) },
                  ]);
                }}
              >
                <Trash2 size={18} color="#EF4444" />
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        </GradientBorder>
      </View>
    );
  };

  const deleteSingleTrainerFile = async (file) => {
    if (!clientId || !file?.id) return;
    if (file.addedBy !== 'trainer') return;
    setDeletingTrainerFiles(true);
    try {
      await deleteNotesAndFilesItem(clientId, file);
      onRefetchNotesAndFiles?.();
    } catch (e) {
      console.error('Trainer delete notes/file failed:', e);
      Alert.alert('Could not delete', e?.message || 'Please try again.');
    } finally {
      setDeletingTrainerFiles(false);
    }
  };

  const deleteAllTrainerFiles = async () => {
    if (!clientId) return;
    const list = (fromYou || []).filter((f) => f && f.type !== 'note' && f?.id && f.addedBy === 'trainer');
    if (list.length === 0) return;
    setDeletingTrainerFiles(true);
    try {
      for (const f of list) {
        // eslint-disable-next-line no-await-in-loop
        await deleteNotesAndFilesItem(clientId, f);
      }
      onRefetchNotesAndFiles?.();
    } catch (e) {
      console.error('Trainer delete all notes/files failed:', e);
      Alert.alert('Could not delete all', e?.message || 'Some files may not have been deleted. Try again.');
      onRefetchNotesAndFiles?.();
    } finally {
      setDeletingTrainerFiles(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '';
    const t = d instanceof Date ? d : new Date(d);
    return t.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderBlock = (list, sectionTitle) => {
    if (list.length === 0) return null;
    const notes = list.filter((x) => x.type === 'note');
    // Include every non-note item that represents media/files (unknown legacy types still get a tile if they have a URL).
    const mediaCandidates = list.filter((x) => {
      if (x.type === 'note') return false;
      if (x.type === 'photo' || x.type === 'video') return true;
      if (x.type === 'pdf' || x.type === 'doc') return true;
      if (x.type === 'spreadsheet') return true;
      if (x.type === 'document' || (x.documentId && x.trainerId)) return true;
      if (x.url) return true;
      return false;
    });
    const seenKeys = new Set();
    const mediaFiles = mediaCandidates
      .filter((x) => {
        const key = notesFileDedupeKey(x);
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      })
      .sort((a, b) => {
        const ms = (x) => {
          const c = x?.createdAt;
          if (c && typeof c.toDate === 'function') return c.toDate().getTime();
          if (c instanceof Date) return c.getTime();
          return new Date(c || 0).getTime();
        };
        return ms(b) - ms(a);
      });

    const openGalleryItem = (f) => {
      const isSpreadsheet = f.type === 'spreadsheet';
      const isDoc = f.type === 'document';
      const isTrainerSpreadsheet = isSpreadsheet && f.documentId;
      if (isTrainerSpreadsheet && onOpenDocumentEditor) {
        onOpenDocumentEditor(f);
      } else if (isSpreadsheet && f.url) {
        setSpreadsheetViewer?.({ visible: true, url: f.url, name: f.name || 'Spreadsheet' });
      } else if (isDoc && onOpenDocumentEditor) {
        onOpenDocumentEditor(f);
      } else if (f.url && isNotesImageFile(f)) {
        setMediaViewer({ visible: true, url: f.url, kind: 'image', name: f.name || f.title || 'Photo' });
      } else if (f.url && isNotesVideoFile(f)) {
        setMediaViewer({ visible: true, url: f.url, kind: 'video', name: f.name || f.title || 'Video' });
      } else if (f.url && isNotesPdfFile(f, f.url)) {
        setPdfViewer({ visible: true, url: f.url, name: f.name || 'Document' });
      } else if (f.url) {
        setEmbedViewer({
          visible: true,
          uri: getEmbedViewerUri(f, f.url),
          title: f.name || f.title || 'Document',
        });
      }
    };

    const canDeleteInThisSection = sectionTitle === 'From you';
    const onLongPressFile = canDeleteInThisSection
      ? (f) => {
          if (deletingTrainerFiles) return;
          if (!f?.id) return;
          Alert.alert('Manage files', 'Remove files you uploaded for this client.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete this file',
              style: 'destructive',
              onPress: () =>
                Alert.alert('Delete file?', 'This will permanently remove it from Notes & Files.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteSingleTrainerFile(f) },
                ]),
            },
            {
              text: `Delete all (${(fromYou || []).filter((x) => x.type !== 'note').length})`,
              style: 'destructive',
              onPress: () =>
                Alert.alert('Delete all your files?', 'This removes every file you uploaded for this client.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete all', style: 'destructive', onPress: deleteAllTrainerFiles },
                ]),
            },
          ]);
        }
      : undefined;

    const gradientForSection = sectionTitle === 'From client' ? GRADIENTS.myFiles : GRADIENTS.trainer;
    return (
      <View key={sectionTitle} style={{ marginBottom: 16 }}>
        <SectionHeader title={sectionTitle} />
        {notes.map((n, i) => (
          <NoteCard key={n.id || i} note={n} />
        ))}
        {(mediaFiles || []).map((f, idx) => (
          <FileRowCard
            key={f.id || f.url || idx}
            file={f}
            accentGradient={gradientForSection}
            allowDelete={canDeleteInThisSection}
          />
        ))}
      </View>
    );
  };

  return (
    <>
    <View style={{ gap: 12 }}>
      {!hasAny && trainerDocuments.length === 0 ? (
        <EmptyState isDark={isDark} icon="FolderOpen" message="No notes or files yet" />
      ) : (
        <>
          {renderBlock(fromClient, 'From client')}
          {renderBlock(fromYou, 'From you')}
          {trainerDocuments.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <SectionHeader title="YOUR DOCUMENTS" />
              {trainerDocuments.map((doc) => {
                const isShared = Array.isArray(doc.sharedWith) && doc.sharedWith.length > 0;
                const name = isShared ? `${doc.title || 'Untitled'} · Shared` : (doc.title || 'Untitled');
                const file = {
                  id: doc.id,
                  type: 'document',
                  name,
                  title: doc.title,
                  createdAt: doc.updatedAt || doc.createdAt,
                  addedBy: 'trainer',
                };
                return (
                  <FileRowCard
                    key={doc.id}
                    file={file}
                    accentGradient={GRADIENTS.trainer}
                    allowDelete={false}
                  />
                );
              })}
            </View>
          )}
        </>
      )}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <TouchableOpacity onPress={() => setShowAddModal(true)} activeOpacity={0.8} style={{ flex: 1, minWidth: 140 }}>
          <LinearGradient colors={GRADIENT_NOTES} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 20 }}>
            <Icon name="Upload" size={15} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Add note or file</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
      <AddNotesFilesModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={() => { onRefetchNotesAndFiles?.(); setShowAddModal(false); }}
        isDark={isDark}
        clientId={clientId}
        addedBy="trainer"
        onNewDocument={() => onOpenDocumentEditor?.({})}
        onNewSpreadsheet={() => onOpenDocumentEditor?.({ type: 'spreadsheet' })}
        onImportSpreadsheet={() => onOpenDocumentEditor?.({ type: 'spreadsheet' })}
      />
    </View>
    <MediaViewerModal
      visible={mediaViewer.visible}
      url={mediaViewer.url}
      kind={mediaViewer.kind}
      name={mediaViewer.name}
      isDark={isDark}
      onClose={() => setMediaViewer({ visible: false, url: null, kind: 'image', name: null })}
    />
    <EmbedWebViewModal
      visible={embedViewer.visible}
      uri={embedViewer.uri}
      title={embedViewer.title}
      isDark={isDark}
      onClose={() => setEmbedViewer({ visible: false, uri: null, title: null })}
    />
    </>
  );
};

// ─────────────────────────────────────────────
// TAB PILLS
// ─────────────────────────────────────────────
const TABS = ['Progress', 'Nutrition', 'Calendar', 'Notes & Files'];

const TabPills = ({ activeTab, onTabChange, isDark }) => {
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.5)';
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)';
  const cardBorder = isDark ? CARD_BORDER_PURPLE_CYAN : 'rgba(6,182,212,0.28)';
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
      {TABS.map((tab) => {
        const isActive = tab === activeTab;
        if (isActive) {
          return (
            <TouchableOpacity key={tab} style={{ flex: 1 }} onPress={() => onTabChange(tab)} activeOpacity={0.8}>
              <LinearGradient colors={GRADIENT_TABS} style={{ paddingVertical: 8, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{tab}</Text>
              </LinearGradient>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity
            key={tab}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cardBg, borderColor: cardBorder }}
            onPress={() => onTabChange(tab)}
            activeOpacity={0.8}
          >
            <Text style={{ color: mutedColor, fontSize: 11, fontWeight: '600' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{tab}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ─────────────────────────────────────────────
// CLIENT DETAIL SCREEN
// ─────────────────────────────────────────────
const ClientDetailScreen = ({ client, trainerId, onBack, onRemoveClient, trainerName, getTrainerEditorNavChrome }) => {
  const { isDark } = useTrainerTheme();
  const textColor = isDark ? '#ffffff' : '#1a0a2e';
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.5)';

  const [activeTab, setActiveTab] = useState('Progress');
  const [showRemoveSheet, setShowRemoveSheet] = useState(false);
  const [clientData, setClientData] = useState(null);
  const [loadingClientData, setLoadingClientData] = useState(false);
  const [todayDailyLog, setTodayDailyLog] = useState(null);
  const [weightTrend7, setWeightTrend7] = useState([]);
  const [refreshNotesAndFilesTrigger, setRefreshNotesAndFilesTrigger] = useState(0);
  const [pdfViewer, setPdfViewer] = useState({ visible: false, url: null, name: null });
  const [spreadsheetViewer, setSpreadsheetViewer] = useState({ visible: false, url: null, name: null });
  const [spreadsheetEditor, setSpreadsheetEditor] = useState({ visible: false, documentId: null, title: '', rows: null });
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

  // Real-time dailyLog listener
  useEffect(() => {
    if (!client?.id || !db) { setTodayDailyLog(null); return; }
    const dateKey = getDateKey();
    const unsubscribe = onSnapshot(
      doc(db, 'users', client.id, 'dailyLogs', dateKey),
      (snap) => setTodayDailyLog(snap.exists() ? snap.data() : null),
      () => setTodayDailyLog(null)
    );
    return () => unsubscribe();
  }, [client?.id]);

  // Fetch last 7 days of weights (sparkline)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!client?.id || !db) { setWeightTrend7([]); return; }
      try {
        const tz = 'America/New_York';
        const keys = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          keys.push(d.toLocaleDateString('en-CA', { timeZone: tz }));
        }

        const snaps = await Promise.all(keys.map((k) => getDoc(doc(db, 'users', client.id, 'dailyLogs', k))));
        const weights = snaps
          .map((s) => {
            if (!s.exists()) return null;
            const v = s.data()?.dashboard_weight;
            const n = v != null && v !== '' ? Number(v) : null;
            return Number.isFinite(n) ? n : null;
          })
          .filter((v) => v != null);

        if (!cancelled) setWeightTrend7(weights);
      } catch (_) {
        if (!cancelled) setWeightTrend7([]);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [client?.id]);

  // Fetch all client data
  useEffect(() => {
    if (!client?.id || !trainerId || !db) { setClientData(null); return; }
    
    const unsubscribers = [];
    
    // Listen to user document changes (weight, profile updates)
    const userUnsub = onSnapshot(
      doc(db, 'users', client.id),
      async (userDoc) => {
        if (!userDoc.exists()) {
          try {
            const tcSnap = await getDoc(doc(db, 'trainer_clients', trainerId, 'clients', client.id));
            const tc = tcSnap.exists() ? tcSnap.data() : {};
            let notesAndFiles = [];
            try {
              notesAndFiles = await getNotesAndFiles(client.id);
            } catch (_) {}
            setClientData({
              beforeWeight: tc.startingWeight ?? tc.weight ?? client?.startingWeight ?? client?.weight ?? null,
              currentWeight: tc.weight ?? client?.weight ?? null,
              trainingDays: [],
              programName: tc.programName || 'Custom Program',
              nutrition: {
                calories: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
                foods: [],
                micros: [],
              },
              calendar: tc.calendar || { completed: [], upcoming: [], missed: [], upcomingSessions: [] },
              notesAndFiles,
            });
          } catch (e) {
            if (!isBenignTrainerClientFirestoreError(e)) {
              console.error('Error building client detail without user doc:', e);
            }
            setClientData(null);
          }
          return;
        }

        const userData = userDoc.data();

        // Fetch other related data
        try {
          const clientDoc = await getDoc(doc(db, 'trainer_clients', trainerId, 'clients', client.id));
          const clientDocData = clientDoc.exists() ? clientDoc.data() : {};

          let notesAndFiles = [];
          try {
            notesAndFiles = await getNotesAndFiles(client.id);
          } catch (_) {}

          // Fetch nutrition data
          const nutritionQuery = query(collection(db, 'users', client.id, 'nutrition'));
          const nutritionSnapshot = await getDocs(nutritionQuery);
          const nutritionLogs = nutritionSnapshot.docs.map(doc => doc.data());
          
          // Fetch training days
          const trainingQuery = query(collection(db, 'users', client.id, 'trainingDays'));
          const trainingSnapshot = await getDocs(trainingQuery);
          const trainingDays = trainingSnapshot.docs.map(doc => doc.data());
          
          // Fetch goals
          let goals = {};
          try {
            const goalsDoc = await getDoc(doc(db, 'users', client.id, 'goals', 'nutrition'));
            const g = goalsDoc.data();
            if (g?.caloriesTarget != null) goals.caloriesTarget = g.caloriesTarget;
            if (g?.proteinTarget != null) goals.proteinTarget = g.proteinTarget;
            if (g?.carbsTarget != null) goals.carbsTarget = g.carbsTarget;
            if (g?.fatTarget != null) goals.fatTarget = g.fatTarget;
          } catch (_) {}
          
          const foodNames = nutritionLogs.map((l) => l.food_name || l.foodName || 'Food').filter(Boolean);
          const macroTotals = nutritionLogs.reduce((acc, log) => {
            acc.calories += log.calories || 0;
            acc.protein += log.protein || 0;
            acc.carbs += log.carbs || 0;
            acc.fat += log.fat || 0;
            return acc;
          }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
          
          setClientData({
            beforeWeight: userData.startingWeight ?? userData.weight ?? clientDocData.startingWeight ?? clientDocData.weight ?? null,
            currentWeight: userData.weight ?? clientDocData.weight ?? null,
            trainingDays,
            programName: clientDocData.programName || 'Custom Program',
            nutrition: {
              calories: macroTotals.calories,
              protein: macroTotals.protein,
              carbs: macroTotals.carbs,
              fat: macroTotals.fat,
              foods: foodNames,
              micros: nutritionLogs.filter(l => l.micros).flatMap(l => l.micros || []).filter(Boolean),
              ...goals,
            },
            calendar: clientDocData.calendar || { completed: [], upcoming: [], missed: [], upcomingSessions: [] },
            notesAndFiles,
          });
        } catch (e) {
          console.error('Error updating client data:', e);
        }
      },
      (error) => {
        if (isBenignTrainerClientFirestoreError(error)) {
          (async () => {
            try {
              const tcSnap = await getDoc(doc(db, 'trainer_clients', trainerId, 'clients', client.id));
              const tc = tcSnap.exists() ? tcSnap.data() : {};
              let notesAndFiles = [];
              try {
                notesAndFiles = await getNotesAndFiles(client.id);
              } catch (_) {}
              setClientData({
                beforeWeight: tc.startingWeight ?? tc.weight ?? client?.startingWeight ?? client?.weight ?? null,
                currentWeight: tc.weight ?? client?.weight ?? null,
                trainingDays: [],
                programName: tc.programName || 'Custom Program',
                nutrition: {
                  calories: 0,
                  protein: 0,
                  carbs: 0,
                  fat: 0,
                  foods: [],
                  micros: [],
                },
                calendar: tc.calendar || { completed: [], upcoming: [], missed: [], upcomingSessions: [] },
                notesAndFiles,
              });
            } catch (e2) {
              if (!isBenignTrainerClientFirestoreError(e2)) {
                console.error('Error building client detail (listener fallback):', e2);
              }
              setClientData(null);
            }
          })();
          return;
        }
        console.error('User document listener error:', error);
        setClientData(null);
      }
    );
    
    unsubscribers.push(userUnsub);
    
    // Listen to nutrition changes
    const nutritionUnsub = onSnapshot(
      query(collection(db, 'users', client.id, 'nutrition')),
      async () => {
        // Re-fetch nutrition data when it changes
        try {
          const nutritionSnapshot = await getDocs(query(collection(db, 'users', client.id, 'nutrition')));
          const nutritionLogs = nutritionSnapshot.docs.map(doc => doc.data());
          
          setClientData(prev => {
            if (!prev) return prev;
            
            const foodNames = nutritionLogs.map((l) => l.food_name || l.foodName || 'Food').filter(Boolean);
            const macroTotals = nutritionLogs.reduce((acc, log) => {
              acc.calories += log.calories || 0;
              acc.protein += log.protein || 0;
              acc.carbs += log.carbs || 0;
              acc.fat += log.fat || 0;
              return acc;
            }, { calories: 0, protein: 0, carbs: 0, fat: 0 });
            
            return {
              ...prev,
              nutrition: {
                ...prev.nutrition,
                calories: macroTotals.calories,
                protein: macroTotals.protein,
                carbs: macroTotals.carbs,
                fat: macroTotals.fat,
                foods: foodNames,
                micros: nutritionLogs.filter(l => l.micros).flatMap(l => l.micros || []).filter(Boolean),
              }
            };
          });
        } catch (e) {
          if (!isBenignTrainerClientFirestoreError(e)) {
            console.error('Error updating nutrition data:', e);
          }
        }
      }
    );
    
    unsubscribers.push(nutritionUnsub);

    const notesColRef = collection(db, 'users', client.id, 'notes_and_files');
    const notesUnsub = onSnapshot(
      notesColRef,
      async () => {
        try {
          const notesAndFiles = await getNotesAndFiles(client.id);
          setClientData((prev) => {
            if (prev) return { ...prev, notesAndFiles };
            return {
              beforeWeight: client?.startingWeight ?? client?.weight ?? null,
              currentWeight: client?.weight ?? null,
              trainingDays: [],
              programName: 'Custom Program',
              nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, foods: [], micros: [] },
              calendar: { completed: [], upcoming: [], missed: [], upcomingSessions: [] },
              notesAndFiles,
            };
          });
        } catch (e) {
          console.error('Error syncing notes and files (detail):', e);
        }
      },
      (err) => console.error('notes_and_files listener error (detail):', err),
    );
    unsubscribers.push(notesUnsub);

    // Listen to trainer CRM client doc (calendar, program name — not notes; those live in notes_and_files)
    const clientDocUnsub = onSnapshot(
      doc(db, 'trainer_clients', trainerId, 'clients', client.id),
      (clientDoc) => {
        if (!clientDoc.exists()) return;
        
        const clientDocData = clientDoc.data();
        
        setClientData(prev => {
          if (!prev) return prev;
          
          return {
            ...prev,
            calendar: clientDocData.calendar || prev.calendar,
            programName: clientDocData.programName || prev.programName,
          };
        });
      }
    );
    
    unsubscribers.push(clientDocUnsub);
    
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [client?.id, trainerId]);

  const openRemoveClientMenu = () => {
    const sheetTitle = 'Remove client?';
    const sheetMessage =
      'They will be unlinked from you in Coach Connect. You can invite them again later if you change your mind.';

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Remove from my roster…'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
          title: sheetTitle,
          message: sheetMessage,
        },
        (idx) => {
          if (idx === 1) setShowRemoveSheet(true);
        }
      );
      return;
    }

    Alert.alert(sheetTitle, sheetMessage, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove from roster', style: 'destructive', onPress: () => setShowRemoveSheet(true) },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0c0c0e' : '#f5f5f7' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Header ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 16 : 0, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ width: 36, alignItems: 'flex-start' }}>
          <Icon name="ChevronLeft" size={26} color={textColor} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: textColor, fontSize: 17, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>
            {client?.name || 'Client'}
          </Text>
          <Text style={{ color: mutedColor, fontSize: 11, marginTop: 2, textAlign: 'center' }} numberOfLines={1}>
            Tap ⋮ for remove options
          </Text>
        </View>
        <TouchableOpacity
          onPress={openRemoveClientMenu}
          accessibilityLabel="Client options: remove from roster"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 36, alignItems: 'flex-end' }}
        >
          <Ionicons name="ellipsis-vertical" size={22} color={textColor} />
        </TouchableOpacity>
      </View>

      <RemoveTrainerSheet
        visible={showRemoveSheet}
        onClose={() => setShowRemoveSheet(false)}
        onRemovalComplete={() => { setShowRemoveSheet(false); onRemoveClient?.(); }}
        trainerName={trainerName || 'Trainer'}
        clientName={client?.name || 'Client'}
        removedBy="trainer"
        trainerId={trainerId}
        clientId={client?.id}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, gap: 16, paddingHorizontal: 16, paddingTop: 16 }}>

        {/* ── Client Info Card ── */}
        <GlassCard isDark={isDark} style={{ padding: 16, borderRadius: 16, borderColor: CARD_BORDER_PINK_ORANGE }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
              {client?.photoURL ? (
                <Image source={{ uri: client.photoURL }} style={{ width: 48, height: 48 }} />
              ) : (
                <LinearGradient colors={GRADIENT_AVATAR} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>{getClientInitials(client?.name)}</Text>
                </LinearGradient>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 17 }}>{client?.name || 'No Name'}</Text>
              <Text style={{ color: mutedColor, fontSize: 12, marginTop: 2 }}>{getClientSubtext(client)}</Text>
              {todayDailyLog && Object.keys(todayDailyLog).some((k) => k.startsWith('dashboard_') && todayDailyLog[k] != null && todayDailyLog[k] !== '') ? (
                <Text style={{ color: mutedColor, fontSize: 11, marginTop: 4 }}>✓ Check-in logged today</Text>
              ) : (
                <Text style={{ color: mutedColor, fontSize: 11, marginTop: 4 }}>No check-in yet today</Text>
              )}
            </View>
          </View>
          <View
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            }}
          >
            <TouchableOpacity onPress={openRemoveClientMenu} hitSlop={{ top: 6, bottom: 6 }}>
              <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>Remove from my roster</Text>
              <Text style={{ color: mutedColor, fontSize: 12, marginTop: 4, lineHeight: 16 }}>
                Unlinks this client from you (same as the ⋮ menu). They keep their account and can work with another coach.
              </Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* ── Tab Pills ── */}
        <TabPills activeTab={activeTab} onTabChange={setActiveTab} isDark={isDark} />

        {/* ── Tab Content ── */}
        {loadingClientData ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={ICON_ACCENT} />
            <Text style={{ color: mutedColor, fontSize: 13, marginTop: 12 }}>Loading client data...</Text>
          </View>
        ) : (
          <View>
            {activeTab === 'Calendar' && (
              <CalendarTab
                isDark={isDark}
                clientData={clientData}
                trainerId={trainerId}
                clientId={client?.id}
                clientName={client?.name || 'Client'}
                trainerName={trainerName}
              />
            )}
            {activeTab === 'Notes & Files' && (
              <NotesFilesTab
                isDark={isDark}
                clientData={clientData}
                trainerId={trainerId}
                clientId={client?.id}
                onRefetchNotesAndFiles={() => setRefreshNotesAndFilesTrigger((t) => t + 1)}
                pdfViewer={pdfViewer}
                setPdfViewer={setPdfViewer}
                spreadsheetViewer={spreadsheetViewer}
                setSpreadsheetViewer={setSpreadsheetViewer}
                trainerDocuments={trainerDocuments}
                onRefetchTrainerDocuments={() => getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => {})}
                onOpenDocumentEditor={(f) => {
                  if (!f) return;
                  const docId = f?.documentId || f?.id || null;
                  setDocumentEditor({ visible: true, documentId: docId });
                }}
                onOpenShareModal={({ documentId, initialSharedWith }) =>
                  setShareModal({ visible: true, documentId, sharedWith: initialSharedWith || [] })
                }
                onOpenSpreadsheetEditor={(f) => {
                  if (!f) return;
                  const docId = f?.documentId || f?.id || null;
                  setSpreadsheetEditor({ visible: true, documentId: docId, title: f?.title || f?.name || '', rows: null });
                }}
                onImportSpreadsheet={(item) => {
                  if (!item?.url) return;
                  setSpreadsheetViewer({ visible: true, url: item.url, name: item?.name || 'Spreadsheet' });
                }}
              />
            )}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

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
      <SpreadsheetEditorModal
        visible={spreadsheetEditor.visible}
        trainerId={trainerId}
        documentId={spreadsheetEditor.documentId}
        isDark={isDark}
        initialTitle={spreadsheetEditor.title}
        initialRows={spreadsheetEditor.rows}
        onClose={() => setSpreadsheetEditor({ visible: false, documentId: null, title: '', rows: null })}
        onSaved={() => getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => {})}
        trainerNavChrome={trainerEditorNav}
      />
      <DocumentEditorModal
        visible={documentEditor.visible}
        trainerId={trainerId}
        documentId={documentEditor.documentId}
        isDark={isDark}
        onClose={() => setDocumentEditor({ visible: false, documentId: null })}
        onSaved={() => getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => {})}
        trainerNavChrome={trainerEditorNav}
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
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────
// CLIENTS LIST SCREEN
// ─────────────────────────────────────────────
const CLIENT_LIST_DELETE_GRADIENT = ['#BE185D', '#C2410C'];
const SWIPE_DELETE_WIDTH = 88;

/** Rotating gradient borders for trainer client carousel + full list cards. */
const CLIENT_CARD_BORDER_GRADIENTS = [
  [CYAN, PURPLE],
  [PINK, PURPLE],
  [PURPLE, CYAN],
  [PINK, CYAN],
];
const CLIENT_CARD_INNER_BG_DARK = '#141419';
const DELETE_ICON_PINK = '#FF6B9D';

const ClientsListScreen = ({
  clients,
  trainerId,
  onBack,
  onSelectClient,
  onClientRemoved,
  onOpenClientRequests,
  isDark = true,
  weeklyReportClientId = null,
  onOpenWeeklyReport,
}) => {
  const [deletePending, setDeletePending] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const swipeRefs = useRef(new Map());

  const bg = isDark ? '#0A0A0A' : '#F5F5F7';
  const headerBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)';
  const backColor = isDark ? '#ffffff' : '#1a1040';
  const titleColor = isDark ? '#ffffff' : '#1a1040';
  const emptyColor = isDark ? '#8A8A8A' : 'rgba(0,0,0,0.5)';
  const nameColor = isDark ? '#ffffff' : '#1a1040';
  const subtextColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)';
  const modalOverlay = 'rgba(0,0,0,0.55)';
  const modalCardBg = isDark ? '#141419' : '#FFFFFF';
  const modalText = isDark ? '#FFFFFF' : '#0A0A0F';
  const modalMuted = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(10,10,15,0.65)';

  const openRemoveSheet = useCallback((client) => {
    swipeRefs.current.get(client.id)?.close?.();
    setDeletePending({
      id: client.id,
      name: String(client.name || client.displayName || 'Client').trim() || 'Client',
    });
  }, []);

  const cancelRemove = useCallback(() => {
    setDeletePending(null);
    setRemoveBusy(false);
  }, []);

  const confirmRemove = useCallback(async () => {
    if (!deletePending?.id || !trainerId) return;
    if (!functions) {
      Alert.alert('Unavailable', 'Cloud Functions are not configured.');
      return;
    }
      const clientId = deletePending.id;
      const displayName = deletePending.name;
      setRemoveBusy(true);
      try {
        const fn = httpsCallable(functions, 'removeTrainerClientLink');
        await fn({
          trainerId,
          clientId,
          reasons: [],
          otherText: null,
          removedBy: 'trainer',
        });
        cancelRemove();
        onClientRemoved?.(clientId);
        Alert.alert('Client removed', `${displayName} is no longer on your roster.`);
    } catch (e) {
      const msg = e?.message || e?.code || 'Could not remove this client. Try again.';
      Alert.alert('Remove failed', String(msg));
    } finally {
      setRemoveBusy(false);
    }
  }, [cancelRemove, deletePending, onClientRemoved, trainerId]);

  const renderRightActions = useCallback(
    (client) => (
      <View
        style={{
          width: SWIPE_DELETE_WIDTH,
          marginBottom: 12,
          justifyContent: 'stretch',
        }}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => openRemoveSheet(client)}
          style={{
            flex: 1,
            backgroundColor: '#BE185D',
            borderTopRightRadius: 14,
            borderBottomRightRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 6,
          }}
        >
          <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800', marginTop: 4 }}>Remove</Text>
        </TouchableOpacity>
      </View>
    ),
    [openRemoveSheet],
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            paddingTop: Platform.OS === 'android' ? 16 : 0,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: headerBorder,
          }}
        >
          <TouchableOpacity
            onPress={onBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ width: 36, alignItems: 'flex-start' }}
          >
            <Ionicons name="chevron-back-outline" size={26} color={backColor} />
          </TouchableOpacity>
          <Text style={{ flex: 1, color: titleColor, fontSize: 17, fontWeight: '700', textAlign: 'center' }}>
            Clients
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {clients.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 10 }}>
            <Ionicons name="people-outline" size={52} color={emptyColor} />
            <Text style={{ color: titleColor, fontSize: 18, fontWeight: '800', textAlign: 'center' }}>No clients yet</Text>
            <Text style={{ color: emptyColor, fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
              When someone connects or you accept a request, they show up here. Tap the trash on a card or swipe left to remove someone from your roster.
            </Text>
            {typeof onOpenClientRequests === 'function' ? (
              <TouchableOpacity
                onPress={onOpenClientRequests}
                activeOpacity={0.9}
                style={{ marginTop: 16, borderRadius: 14, overflow: 'hidden' }}
              >
                <LinearGradient
                  colors={CLIENT_LIST_DELETE_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 14, paddingHorizontal: 22 }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>Client requests</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 40, paddingHorizontal: 0 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 1,
                color: subtextColor,
                textTransform: 'uppercase',
                marginBottom: 10,
                paddingHorizontal: 16,
              }}
            >
              Tap trash or swipe left to remove
            </Text>
            {(clients || []).map((client, index) => {
              const borderGrad = CLIENT_CARD_BORDER_GRADIENTS[index % CLIENT_CARD_BORDER_GRADIENTS.length];
              const listInnerBg = isDark ? CLIENT_CARD_INNER_BG_DARK : '#FFFFFF';
              const avatarGrad = borderGrad;
              return (
                <Swipeable
                  key={client.id}
                  ref={(r) => {
                    if (r) swipeRefs.current.set(client.id, r);
                    else swipeRefs.current.delete(client.id);
                  }}
                  friction={2}
                  overshootRight={false}
                  renderRightActions={() => renderRightActions(client)}
                >
                  <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
                    <LinearGradient
                      colors={borderGrad}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ borderRadius: 14, padding: 2 }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          borderRadius: 12,
                          backgroundColor: listInnerBg,
                          paddingVertical: 14,
                          paddingHorizontal: 14,
                        }}
                      >
                        <TouchableOpacity
                          activeOpacity={0.75}
                          onPress={() => onSelectClient(client.id)}
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                        >
                          <View
                            style={{
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: isDark ? 0.45 : 0.18,
                              shadowRadius: 4,
                              elevation: 4,
                              borderRadius: 20,
                            }}
                          >
                            <LinearGradient
                              colors={avatarGrad}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{getClientInitials(client.name)}</Text>
                            </LinearGradient>
                          </View>
                          <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={{ color: nameColor, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>
                              {client.name || 'No Name'}
                            </Text>
                            <Text style={{ color: subtextColor, fontSize: 12, marginTop: 4 }} numberOfLines={2}>
                              {getClientSubtext(client)}
                            </Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => openRemoveSheet(client)}
                          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                          style={{ paddingLeft: 4, paddingVertical: 4 }}
                          accessibilityLabel={`Remove ${client.name || 'client'}`}
                        >
                          <Ionicons name="trash-outline" size={20} color={DELETE_ICON_PINK} />
                        </TouchableOpacity>
                      </View>
                    </LinearGradient>
                  </View>
                </Swipeable>
              );
            })}

            {(() => {
              const wid = weeklyReportClientId || clients[0]?.id;
              const wc = clients.find((c) => c.id === wid);
              if (!wid || !wc) return null;
              return (
                <View style={{ marginTop: 6, paddingHorizontal: 0 }}>
                  <TrainerWeeklyReportSection
                    clientId={wid}
                    clientName={wc.name || wc.displayName || ''}
                    isDark={isDark}
                    onOpenWeeklyReport={onOpenWeeklyReport}
                  />
                </View>
              );
            })()}
          </ScrollView>
        )}

        <Modal visible={!!deletePending} transparent animationType="fade" onRequestClose={cancelRemove}>
          <Pressable style={{ flex: 1, backgroundColor: modalOverlay, justifyContent: 'center', padding: 24 }} onPress={cancelRemove}>
            <Pressable
              onPress={(e) => e.stopPropagation?.()}
              style={{
                borderRadius: 16,
                padding: 20,
                backgroundColor: modalCardBg,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
              }}
            >
              <Text style={{ color: modalText, fontSize: 18, fontWeight: '900', marginBottom: 10 }}>Remove client?</Text>
              <Text style={{ color: modalMuted, fontSize: 14, lineHeight: 20, marginBottom: 20 }}>
                {deletePending?.name} will lose access to plans you assigned through Coach Connect. This cannot be undone from the app.
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end' }}>
                <TouchableOpacity
                  onPress={cancelRemove}
                  disabled={removeBusy}
                  style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, opacity: removeBusy ? 0.5 : 1 }}
                >
                  <Text style={{ color: modalMuted, fontSize: 15, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmRemove}
                  disabled={removeBusy}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 18,
                    borderRadius: 12,
                    backgroundColor: DELETE_ICON_PINK,
                    minWidth: 100,
                    alignItems: 'center',
                    opacity: removeBusy ? 0.75 : 1,
                  }}
                >
                  {removeBusy ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>Remove</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

// ─────────────────────────────────────────────
// DASHBOARD CONTENT
// ─────────────────────────────────────────────
const DashboardContent = ({ isDark, clients, clientsLoading, pendingRequestsCount = 0, unreadMessageCount = 0, onClientRequestsPress, onClientsPress, onMessagesPress, onOpenPhotoGallery, onOpenAIWorkouts, onRefreshClients, userName, trainerId, pdfViewer, setPdfViewer, defaultClientId, onSelectedClientChange, onOpenWeeklyReport, onTrainerClientRemoved, getTrainerEditorNavChrome }) => {
  const { width: screenW } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState('Progress');
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [clientSelectOpen, setClientSelectOpen] = useState(false);
  const [clientData, setClientData] = useState(null);
  const [loadingClientData, setLoadingClientData] = useState(false);
  const [todayDailyLog, setTodayDailyLog] = useState(null);
  const [weightTrend7, setWeightTrend7] = useState([]);
  const [refreshNotesAndFilesTrigger, setRefreshNotesAndFilesTrigger] = useState(0);
  /** Whether `users/{id}/weeklySummaries` has any docs (green dot on client chip). */
  const [weeklySummaryMap, setWeeklySummaryMap] = useState({});
  const [spreadsheetViewer, setSpreadsheetViewer] = useState({ visible: false, url: null, name: null });
  const [trainerDocuments, setTrainerDocuments] = useState([]);
  const [documentEditor, setDocumentEditor] = useState({ visible: false, documentId: null });
  const [spreadsheetEditor, setSpreadsheetEditor] = useState({ visible: false, documentId: null, title: '', rows: null });
  const [shareModal, setShareModal] = useState({ visible: false, documentId: null, sharedWith: [] });
  const plusHandlerRef = useRef(() => {});
  const [clientUnreadCount, setClientUnreadCount] = useState(0);
  const [removeClientHold, setRemoveClientHold] = useState(null);

  const textColor = isDark ? '#ffffff' : '#1a0a2e';
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.5)';
  /** Wide “profile” cards (~one per viewport + peek of next), not narrow chips. */
  const rosterCardWidth = Math.max(268, Math.min(340, Math.round((screenW - 40) * 0.9)));

  const currentClient = clients.find((c) => c.id === selectedClientId) || clients[0];

  const promptRemoveClientFromDashboard = useCallback((client) => {
    if (!client?.id || !trainerId) return;
    setRemoveClientHold(client);
  }, [trainerId]);

  // Fetch last 7 days of weights (sparkline)
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!currentClient?.id || !db) { setWeightTrend7([]); return; }
      try {
        const tz = 'America/New_York';
        const keys = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          keys.push(d.toLocaleDateString('en-CA', { timeZone: tz }));
        }
        const snaps = await Promise.all(keys.map((k) => getDoc(doc(db, 'users', currentClient.id, 'dailyLogs', k))));
        const weights = snaps
          .map((s) => {
            if (!s.exists()) return null;
            const v = s.data()?.dashboard_weight;
            const n = v != null && v !== '' ? Number(v) : null;
            return Number.isFinite(n) ? n : null;
          })
          .filter((v) => v != null);
        if (!cancelled) setWeightTrend7(weights);
      } catch (_) {
        if (!cancelled) setWeightTrend7([]);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [currentClient?.id]);

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
      return;
    }
    const dateKey = getLocalDateKey();
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
  }, [currentClient?.id]);

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
      const nowKey = getLocalDateKey();
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
  }, [currentClient?.id]);

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
    if (!currentClient?.id || !trainerId || !db) { setClientData(null); return; }
    
    const unsubscribers = [];
    
    // Listen to user document changes (weight, profile updates)
    const userUnsub = onSnapshot(
      doc(db, 'users', currentClient.id),
      async (userDoc) => {
        // Client may be in CRM (trainer_clients) but have no users/{id} row yet — still show notes & CRM fields.
        if (!userDoc.exists()) {
          try {
            let notesAndFiles = [];
            try {
              notesAndFiles = await getNotesAndFiles(currentClient.id);
            } catch (_) {}
            setClientData(buildTrainerDashboardClientDataFromCrm(currentClient, notesAndFiles));
          } catch (e) {
            if (!isBenignTrainerClientFirestoreError(e)) {
              console.error('Error building client data without user doc:', e);
            }
            setClientData(buildTrainerDashboardClientDataFromCrm(currentClient, []));
          }
          return;
        }

        const userData = userDoc.data();
        
        // Fetch other related data
        try {
          let notesAndFiles = [];
          try { notesAndFiles = await getNotesAndFiles(currentClient.id); } catch (_) {}
          
          let trainingDays = [], programName = null;
          try {
            const progressSnap = await getDocs(collection(db, `trainer_clients/${trainerId}/clients/${currentClient.id}/progress`));
            const progressDocs = progressSnap.docs.map((d) => d.data());
            if (progressDocs.length > 0) {
              const latest = progressDocs[progressDocs.length - 1];
              trainingDays = latest.trainingDays || [];
              programName = latest.programName || null;
            }
          } catch (_) {}
          
          const todayKey = getDateKey();
          let nutritionLogs = [], nutritionTotals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
          let nutritionGoals = { proteinTarget: 200, carbsTarget: 300, fatTarget: 80 };
          try {
            nutritionLogs = await getFoodLogsForDate(currentClient.id, todayKey);
            nutritionTotals = calculateMacroTotals(nutritionLogs);
            const goalsData = await getDailyGoals(currentClient.id);
            if (goalsData?.proteinTarget != null) nutritionGoals.proteinTarget = goalsData.proteinTarget;
            if (goalsData?.carbsTarget != null) nutritionGoals.carbsTarget = goalsData.carbsTarget;
            if (goalsData?.fatTarget != null) nutritionGoals.fatTarget = goalsData.fatTarget;
          } catch (_) {}
          
          const foodNames = nutritionLogs.map((l) => l.food_name || l.foodName || 'Food').filter(Boolean);
          
          setClientData({
            beforeWeight: userData.startingWeight ?? userData.weight ?? currentClient.startingWeight ?? currentClient.weight ?? null,
            currentWeight: userData.weight ?? currentClient.weight ?? null,
            trainingDays, programName,
            nutrition: {
              calories: nutritionTotals.calories || 0, protein: nutritionTotals.protein || 0,
              carbs: nutritionTotals.carbs || 0, fat: nutritionTotals.fat || 0,
              fiber: nutritionTotals.fiber || 0, sugar: nutritionTotals.sugar || 0,
              sodium: nutritionTotals.sodium || 0, potassium: nutritionTotals.potassium || 0,
              proteinGoal: userData.proteinGoal ?? nutritionGoals.proteinTarget ?? 200,
              carbsGoal: userData.carbsGoal ?? nutritionGoals.carbsTarget ?? 300,
              fatGoal: userData.fatGoal ?? nutritionGoals.fatTarget ?? 80,
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
              notesAndFiles = await getNotesAndFiles(currentClient.id);
            } catch (_) {}
            setClientData(buildTrainerDashboardClientDataFromCrm(currentClient, notesAndFiles));
          })();
          return;
        }
        console.error('User document listener error:', error);
        setClientData(null);
      }
    );
    
    unsubscribers.push(userUnsub);
    
    // Listen to nutrition changes (watching nutrition_logs collection where clients actually save food)
    const nutritionUnsub = onSnapshot(
      query(collection(db, 'nutrition_logs'), where('user_id', '==', currentClient.id)),
      async (snapshot) => {
        // Re-fetch nutrition data when it changes
        try {
          const todayKey = getDateKey();
          const nutritionLogs = await getFoodLogsForDate(currentClient.id, todayKey);
          const nutritionTotals = calculateMacroTotals(nutritionLogs);
          const foodNames = nutritionLogs.map((l) => l.food_name || l.foodName || 'Food').filter(Boolean);

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
    const notesColRef = collection(db, 'users', currentClient.id, 'notes_and_files');
    const notesUnsub = onSnapshot(
      notesColRef,
      async () => {
        try {
          const notesAndFiles = await getNotesAndFiles(currentClient.id);
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
      unsubscribers.forEach(unsub => unsub());
    };
  }, [currentClient?.id, trainerId]);

  // Refresh notes and files when trigger changes
  useEffect(() => {
    if (!currentClient?.id) return;
    const refreshNotes = async () => {
      try {
        const notesAndFiles = await getNotesAndFiles(currentClient.id);
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
        });
      } catch (e) {
        if (!isBenignTrainerClientFirestoreError(e)) {
          console.error('Error refreshing notes and files:', e);
        }
      }
    };
    refreshNotes();
  }, [refreshNotesAndFilesTrigger, currentClient?.id]);

  // Trainer documents (for Notes & Files tab)
  useEffect(() => {
    if (!trainerId) return;
    getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => setTrainerDocuments([]));
  }, [trainerId]);


  const timeOfDay = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  }, []);

  const actions = [
    { label: 'Messages', icon: 'MessageSquare', action: 'messages' },
    { label: 'Photo Gallery', imageSource: require('../assets/icons/picture.png'), action: 'photos' },
    { label: 'Workout Plans', imageSource: require('../assets/ai_workouts.png'), action: 'aiPlans' },
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
          icon: require('../assets/IMG_2562.png'),
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
          icon: require('../assets/IMG_2562.png'),
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

  return (
    <>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130, paddingHorizontal: 20, paddingTop: 4 }}>
      <AuroraHeroBanner isDark={isDark} timeOfDay={timeOfDay} userName={userName} textColor={textColor} />

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
              colors={['#7C3AED', '#EC4899']}
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
                  minHeight: 152,
                };

                const cardBody = (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => setSelectedClientId(client.id)}
                    style={innerPressableStyle}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <LinearGradient
                        colors={['#7C3AED', '#EC4899']}
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
                                backgroundColor: isDark ? 'rgba(192,132,252,0.18)' : 'rgba(124,58,237,0.12)',
                                borderWidth: 1,
                                borderColor: isDark ? 'rgba(192,132,252,0.35)' : 'rgba(124,58,237,0.25)',
                                marginRight: 8,
                                marginBottom: 4,
                              }}
                            >
                              <Text style={{ color: isDark ? '#E9D5FF' : '#5B21B6', fontSize: 11, fontWeight: '800' }} numberOfLines={1}>
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
                        { key: 'age', icon: 'calendar-outline', cap: 'Age', val: stats.age ? `${stats.age} yrs` : '—' },
                        { key: 'wt', icon: 'fitness-outline', cap: 'Weight', val: stats.weight ? `${stats.weight} lbs` : '—' },
                        { key: 'ht', icon: 'resize-outline', cap: 'Height', val: stats.height || '—' },
                      ].map((cell, idx) => (
                        <View
                          key={cell.key}
                          style={{
                            flex: 1,
                            borderRadius: 14,
                            paddingVertical: 10,
                            paddingHorizontal: 8,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
                            borderWidth: 1,
                            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                            alignItems: 'center',
                            marginRight: idx < 2 ? 10 : 0,
                          }}
                        >
                          <Ionicons name={cell.icon} size={16} color="#C084FC" />
                          <Text style={{ color: mutedColor, fontSize: 9, fontWeight: '800', letterSpacing: 0.6, marginTop: 6, textTransform: 'uppercase' }}>
                            {cell.cap}
                          </Text>
                          <Text style={{ color: textColor, fontSize: 13, fontWeight: '800', marginTop: 3 }} numberOfLines={1}>
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
                        colors={['#EC4899', '#A855F7', '#6366F1']}
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
          contentContainerStyle={{ paddingVertical: 2, paddingRight: 12 }}
        >
        {actions.map(({ label, action }) => {
          const accent =
            label === 'Messages' ? '#F472B6' : label === 'Photo Gallery' ? '#22D3EE' : '#A78BFA';
          const iconName =
            label === 'Messages'
              ? 'chatbubbles-outline'
              : label === 'Photo Gallery'
                ? 'images-outline'
                : 'barbell-outline';

          const count =
            label === 'Messages'
              ? (typeof clientUnreadCount === 'number' ? clientUnreadCount : 0)
              : null;

          const subtitle =
            label === 'Messages'
              ? (count > 0 ? `${count > 99 ? '99+' : count} unread` : 'No unread')
              : label === 'Photo Gallery'
                ? 'Client photos'
                : 'Plans & sessions';

          return (
            <TouchableOpacity
              key={label}
              activeOpacity={0.9}
              onPress={() => {
                if (action === 'messages') {
                  onMessagesPress(currentClient?.id);
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
              style={{ width: 168, marginRight: 10 }}
            >
              <View
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)',
                  borderRadius: 16,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
                  overflow: 'hidden',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={iconName} size={20} color={accent} />
                  </View>

                  {label === 'Messages' && count > 0 ? (
                    <View
                      style={{
                        minWidth: 28,
                        height: 22,
                        paddingHorizontal: 8,
                        borderRadius: 11,
                        backgroundColor: 'rgba(244,114,182,0.14)',
                        borderWidth: 1,
                        borderColor: 'rgba(244,114,182,0.35)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#F9A8D4', fontSize: 12, fontWeight: '800' }}>
                        {count > 99 ? '99+' : count}
                      </Text>
                    </View>
                  ) : (
                    <View />
                  )}
                </View>

                <View style={{ marginTop: 8 }}>
                  <Text style={{ color: textColor, fontSize: 14, fontWeight: '800' }}>{label}</Text>
                  <Text style={{ color: mutedColor, fontSize: 11, marginTop: 3 }} numberOfLines={1}>{subtitle}</Text>
                </View>

                <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 10,
                      borderRadius: 12,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.08)',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Text style={{ color: accent, fontSize: 11, fontWeight: '800' }}>View all</Text>
                    <Ionicons name="chevron-forward" size={13} color={accent} />
                  </View>

                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: accent,
                      opacity: 0.85,
                    }}
                  />
                </View>
              </View>
            </TouchableOpacity>
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
              isDark={isDark}
              clientData={clientData}
              todayDailyLog={todayDailyLog}
              weightTrend7={weightTrend7}
            />
          )}
          {activeTab === 'Nutrition' && <NutritionTab isDark={isDark} clientData={clientData} />}
          {activeTab === 'Calendar' && (
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
            <NotesFilesTab
              isDark={isDark}
              clientData={clientData}
              trainerId={trainerId}
              clientId={currentClient?.id}
              onRefetchNotesAndFiles={() => setRefreshNotesAndFilesTrigger((t) => t + 1)}
              pdfViewer={pdfViewer}
              setPdfViewer={setPdfViewer}
              spreadsheetViewer={spreadsheetViewer}
              setSpreadsheetViewer={setSpreadsheetViewer}
              trainerDocuments={trainerDocuments}
              onRefetchTrainerDocuments={() => getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => {})}
              onOpenDocumentEditor={(f) => {
                if (!f) return;
                const docId = f?.documentId || f?.id || null;
                setDocumentEditor({ visible: true, documentId: docId });
              }}
              onOpenShareModal={({ documentId, initialSharedWith }) =>
                setShareModal({ visible: true, documentId, sharedWith: initialSharedWith || [] })
              }
              onOpenSpreadsheetEditor={(f) => {
                if (!f) return;
                const docId = f?.documentId || f?.id || null;
                setSpreadsheetEditor({ visible: true, documentId: docId, title: f?.title || f?.name || '', rows: null });
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
      <DocumentEditorModal
        visible={documentEditor.visible}
        trainerId={trainerId}
        documentId={documentEditor.documentId}
        isDark={isDark}
        onClose={() => setDocumentEditor({ visible: false, documentId: null })}
        onSaved={() => getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => {})}
        trainerNavChrome={trainerEditorNav}
      />
      <SpreadsheetEditorModal
        visible={spreadsheetEditor.visible}
        trainerId={trainerId}
        documentId={spreadsheetEditor.documentId}
        isDark={isDark}
        initialTitle={spreadsheetEditor.title}
        initialRows={spreadsheetEditor.rows}
        onClose={() => setSpreadsheetEditor({ visible: false, documentId: null, title: '', rows: null })}
        onSaved={() => getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => {})}
        trainerNavChrome={trainerEditorNav}
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
    </>
  );
};

// ─────────────────────────────────────────────
// APP WITH THEME
// ─────────────────────────────────────────────
const AppWithTheme = ({ user }) => {
  const { isDark } = useTrainerTheme();

  // Ensure notification handler + (Android) channel are configured on app startup.
  useEffect(() => {
    configureNotifications();
  }, []);

  const [showTrainerSearch, setShowTrainerSearch] = useState(false);
  const [showTrainerMessaging, setShowTrainerMessaging] = useState(false);
  const [showConversationsList, setShowConversationsList] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [showVoiceAI, setShowVoiceAI] = useState(false);
  const [aiChatState, setAiChatState] = useState('home');
  const [showNutrition, setShowNutrition] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelpFAQ, setShowHelpFAQ] = useState(false);
  const [showTermsOfService, setShowTermsOfService] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showContactSupport, setShowContactSupport] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [showWorkoutPlan, setShowWorkoutPlan] = useState(false);
  const [showClientRequests, setShowClientRequests] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showClientsList, setShowClientsList] = useState(false);
  const [navSelectedClientId, setNavSelectedClientId] = useState(null);
  const [selectedClientIdForMessages, setSelectedClientIdForMessages] = useState(null);
  const [userName, setUserName] = useState(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [pdfViewer, setPdfViewer] = useState({ visible: false, url: null, name: null });
  const [documentEditor, setDocumentEditor] = useState({ visible: false, documentId: null });
  const [spreadsheetEditor, setSpreadsheetEditor] = useState({ visible: false, documentId: null, title: '', rows: null });
  const [showAddNotesFilesModal, setShowAddNotesFilesModal] = useState(false);
  const [addNotesFilesClientId, setAddNotesFilesClientId] = useState(null);
  const [selectedClientIdFromDashboard, setSelectedClientIdFromDashboard] = useState(null);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [showAIWorkouts, setShowAIWorkouts] = useState(false);
  const [day6Client, setDay6Client] = useState(null); // { id, name }
  const [showWorkoutGenerator, setShowWorkoutGenerator] = useState(false);
  const [generatorClient, setGeneratorClient] = useState(null); // { id, name }
  const [showPlanViewer, setShowPlanViewer] = useState(false);
  const [viewingPlan, setViewingPlan] = useState(null);
  const [showManualPlanBuilder, setShowManualPlanBuilder] = useState(false);
  const [manualPlanEditId, setManualPlanEditId] = useState(null);
  const [manualPlanBuilderClientIds, setManualPlanBuilderClientIds] = useState([]);
  const [manualBuilderReturnToAI, setManualBuilderReturnToAI] = useState(false);
  const [aiWorkoutsListKey, setAiWorkoutsListKey] = useState(0);
  /** Full-screen weekly report for selected client `{ clientId, clientName }`. */
  const [weeklyReportScreen, setWeeklyReportScreen] = useState(null);
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

  const { clients, loading: clientsLoading, error: clientsError, refresh: refreshClients } = useTrainerClients(user?.uid);
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

  const handleHomePress = () => {
    console.log('🔙 handleHomePress called - closing screens');
    setWeeklyReportScreen(null);
    setShowTrainerSearch(false);
    setShowTrainerMessaging(false);
    setShowConversationsList(false);
    setShowVoiceAI(false);
    setShowNutrition(false);
    setShowSettings(false);
    setShowHelpFAQ(false);
    setShowTermsOfService(false);
    setShowPrivacyPolicy(false);
    setShowContactSupport(false);
    setShowBugReport(false);
    setShowWorkoutPlan(false);
    setShowClientRequests(false);
    setShowProfile(false);
    setShowClientsList(false);
    setShowPhotoGallery(false);
    setShowAIWorkouts(false);
    setShowWorkoutGenerator(false);
    setShowPlanViewer(false);
    setShowManualPlanBuilder(false);
    setManualPlanEditId(null);
    setManualPlanBuilderClientIds([]);
    setManualBuilderReturnToAI(false);
  };

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
        setShowVoiceAI(true);
        setAiChatState('home');
      },
      onNutritionPress: () => {
        closeEditors();
        setShowNutrition(true);
      },
      onWorkoutPress: () => {
        closeEditors();
        setShowWorkoutPlan(true);
      },
      onMessagesPress: (clientId) => {
        closeEditors();
        setSelectedClientIdForMessages(clientId);
        setShowTrainerMessaging(false);
        setShowConversationsList(true);
      },
    };
  }, [handleHomePress, handlePlusPress]);

  const onNavigate = (screen) => {
    if (!screen) return;
    if (screen === 'home') {
      handleHomePress();
      return;
    }
    if (screen === 'profile' || screen === 'ProfileScreen') {
      handleHomePress();
      setShowProfile(true);
      return;
    }
    if (screen === 'settings' || screen === 'SettingsScreen') {
      handleHomePress();
      setShowSettings(true);
      return;
    }
    if (screen === 'nutrition') {
      handleHomePress();
      setShowNutrition(true);
      return;
    }
    if (screen === 'workout') {
      handleHomePress();
      setShowWorkoutPlan(true);
      return;
    }
    if (screen === 'messages') {
      handleHomePress();
      setShowConversationsList(true);
      return;
    }
    if (screen === 'voice' || screen === 'aiChat') {
      handleHomePress();
      setShowVoiceAI(true);
      setAiChatState('home');
      return;
    }
    if (screen === 'create') {
      handlePlusPress();
    }
  };

  if (weeklyReportScreen?.clientId) {
    return (
      <TrainerWeeklyReportScreen
        clientId={weeklyReportScreen.clientId}
        clientName={weeklyReportScreen.clientName || ''}
        isDark={isDark}
        onClose={() => setWeeklyReportScreen(null)}
        onHomePress={() => setWeeklyReportScreen(null)}
        onPlusPress={handlePlusPress}
        onVoicePress={() => {
          setWeeklyReportScreen(null);
          setShowVoiceAI(true);
          setAiChatState('home');
        }}
        onNutritionPress={() => {
          setWeeklyReportScreen(null);
          setShowNutrition(true);
        }}
        onWorkoutPress={() => {
          setWeeklyReportScreen(null);
          setShowWorkoutPlan(true);
        }}
        onMessagesPress={(clientId) => {
          setWeeklyReportScreen(null);
          setSelectedClientIdForMessages(clientId);
          setShowTrainerMessaging(false);
          setShowConversationsList(true);
        }}
        onProfilePress={() => {
          setWeeklyReportScreen(null);
          setShowProfile(true);
        }}
        onSettingsPress={() => {
          setWeeklyReportScreen(null);
          setShowSettings(true);
        }}
      />
    );
  }

  if (showProfile) {
    return (
      <AppNavigationProvider
        onProfilePress={() => setShowProfile(true)}
        onSettingsPress={() => setShowSettings(true)}
        onHomePress={handleHomePress}
        onPlusPress={() => {
          if (addNotesFilesClientId) {
            setShowAddNotesFilesModal(true);
          } else {
            Alert.alert("No Client Selected", "Navigate to a client's dashboard first to add notes or files for them.");
          }
        }}
        onVoicePress={() => {
          handleHomePress();
          setShowVoiceAI(true);
          setAiChatState('home');
        }}
        onNutritionPress={() => {
          handleHomePress();
          setShowNutrition(true);
        }}
        onWorkoutPress={() => {
          handleHomePress();
          setShowWorkoutPlan(true);
        }}
        onMessagesPress={() => {
          handleHomePress();
          setShowConversationsList(true);
        }}
      >
        <ProfileScreen
          onBack={() => setShowProfile(false)}
          userRole="Trainer"
          userData={trainerProfileDoc || {}}
          onboardingData={trainerProfileDoc || {}}
          onNavigate={onNavigate}
          onProfileSaved={refreshTrainerUserDoc}
        />
      </AppNavigationProvider>
    );
  }
  if (showClientsList) return (
    <ClientsListScreen
      clients={clients}
      trainerId={user?.uid}
      isDark={isDark}
      onBack={() => setShowClientsList(false)}
      onSelectClient={(id) => {
        setNavSelectedClientId(id);
        setShowClientsList(false);
      }}
      onClientRemoved={handleTrainerClientRemovedFromRoster}
      onOpenClientRequests={() => {
        setShowClientsList(false);
        setShowClientRequests(true);
      }}
      weeklyReportClientId={selectedClientIdFromDashboard || clients[0]?.id || null}
      onOpenWeeklyReport={(clientId, clientName) =>
        setWeeklyReportScreen({ clientId, clientName: clientName || '' })
      }
    />
  );
  if (showTrainerSearch) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0A0A0F' : '#F5F5F5' }}>
        <CoachConnectHeader
          title="Find a Trainer"
          isDark={isDark}
          onBack={() => setShowTrainerSearch(false)}
          onProfilePress={() => setShowProfile(true)}
          onSettingsPress={() => setShowSettings(true)}
        />
        <TrainerSearchScreen
          onSelectTrainer={(t) => {
            setSelectedTrainer(t);
            setShowTrainerSearch(false);
            setShowTrainerMessaging(true);
          }}
          onProfilePress={() => setShowProfile(true)}
          onSettingsPress={() => setShowSettings(true)}
          isDark={isDark}
        />
      </SafeAreaView>
    );
  }
  if (showVoiceAI) {
    if (aiChatState === 'home') {
      return (
        <VoiceAIHomeScreen
          userId={user?.uid}
          onStartChat={({ prefill } = {}) => setAiChatState({ prefill })}
          onSessionPress={(s) => setAiChatState({ sessionId: s.sessionId || s.id })}
          onHomePress={handleHomePress}
          onPlusPress={() => {
            if (addNotesFilesClientId) {
              setShowAddNotesFilesModal(true);
            } else {
              Alert.alert("No Client Selected", "Navigate to a client's dashboard first to add notes or files for them.");
            }
          }}
          onVoicePress={() => {
            handleHomePress();
            setShowVoiceAI(true);
            setAiChatState('home');
          }}
          onNutritionPress={() => {
            handleHomePress();
            setShowNutrition(true);
          }}
          onWorkoutPress={() => {
            handleHomePress();
            setShowWorkoutPlan(true);
          }}
          onMessagesPress={() => {
            handleHomePress();
            setShowConversationsList(true);
          }}
          onProfilePress={() => setShowProfile(true)}
          navigation={{ navigate: () => {}, goBack: handleHomePress }} 
        />
      );
    }

    if (aiChatState != null && typeof aiChatState === 'object') {
      const chatNavHandlers = {
        onHomePress: () => {
          handleHomePress();
          setAiChatState('home');
        },
        onPlusPress: () => {
          if (addNotesFilesClientId) {
            setShowAddNotesFilesModal(true);
          } else {
            Alert.alert("No Client Selected", "Navigate to a client's dashboard first to add notes or files for them.");
          }
        },
        onVoicePress: () => {
          handleHomePress();
          setShowVoiceAI(true);
          setAiChatState('home');
        },
        onNutritionPress: () => {
          handleHomePress();
          setShowNutrition(true);
        },
        onWorkoutPress: () => {
          handleHomePress();
          setShowWorkoutPlan(true);
        },
        onMessagesPress: () => {
          handleHomePress();
          setShowConversationsList(true);
        },
        onProfilePress: () => setShowProfile(true),
      };

      return (
        <AIChatScreen
          key={JSON.stringify({
            sid: aiChatState.sessionId ?? null,
            pf: aiChatState.prefill ?? null,
          })}
          userId={user?.uid}
          prefill={aiChatState.prefill}
          sessionId={aiChatState.sessionId}
          onBack={() => setAiChatState('home')}
          {...chatNavHandlers}
        />
      );
    }
  }
  if (showNutrition) {
    return (
      <NutritionContainer
        onBack={handleHomePress}
        onProfilePress={() => {
          setShowNutrition(false);
          setShowProfile(true);
        }}
        onSettingsPress={() => {
          setShowNutrition(false);
          setShowSettings(true);
        }}
        onHomePress={handleHomePress}
        onPlusPress={() => {}}
        onVoicePress={() => {
          handleHomePress();
          setShowVoiceAI(true);
        }}
        onNutritionPress={() => {}}
        onWorkoutPress={() => {
          handleHomePress();
          setShowWorkoutPlan(true);
        }}
        onMessagesPress={() => {
          handleHomePress();
          setShowTrainerMessaging(false);
          setShowConversationsList(true);
        }}
      />
    );
  }
  if (showContactSupport) {
    return (
      <ContactSupportScreen
        onClose={() => {
          setShowContactSupport(false);
          setShowSettings(true);
        }}
      />
    );
  }
  if (showBugReport) {
    return (
      <BugReportScreen
        onClose={() => {
          setShowBugReport(false);
          setShowSettings(true);
        }}
      />
    );
  }
  if (showHelpFAQ) {
    return (
      <HelpFAQScreen
        onClose={() => {
          setShowHelpFAQ(false);
          setShowSettings(true);
        }}
      />
    );
  }
  if (showTermsOfService) {
    return (
      <TermsOfServiceScreen
        onClose={() => {
          setShowTermsOfService(false);
          setShowSettings(true);
        }}
      />
    );
  }
  if (showPrivacyPolicy) {
    return (
      <PrivacyPolicyScreen
        onClose={() => {
          setShowPrivacyPolicy(false);
          setShowSettings(true);
        }}
      />
    );
  }
  if (showSettings) return (
    <SettingsScreen user={user} onClose={() => setShowSettings(false)} onNavigate={(screen) => {
      if (screen === 'helpFaq') {
        setShowSettings(false);
        setShowHelpFAQ(true);
        return;
      }
      if (screen === 'terms') {
        setShowSettings(false);
        setShowTermsOfService(true);
        return;
      }
      if (screen === 'privacy') {
        setShowSettings(false);
        setShowPrivacyPolicy(true);
        return;
      }
      if (screen === 'contactSupport') {
        setShowSettings(false);
        setShowContactSupport(true);
        return;
      }
      if (screen === 'bugReport') {
        setShowSettings(false);
        setShowBugReport(true);
        return;
      }
      handleHomePress();
      if (screen === 'profile') setShowProfile(true);
      else if (screen === 'voice') setShowVoiceAI(true);
      else if (screen === 'workout') setShowWorkoutPlan(true);
      else if (screen === 'nutrition') setShowNutrition(true);
    }} />
  );
  if (showManualPlanBuilder && user?.uid) {
    return (
      <ManualWorkoutPlanBuilderScreen
        trainerId={user.uid}
        clients={clients}
        editPlanId={manualPlanEditId}
        defaultAssignedClientIds={manualPlanBuilderClientIds}
        onClose={() => {
          const returnTo = manualBuilderReturnToAI;
          setShowManualPlanBuilder(false);
          setManualPlanEditId(null);
          setManualPlanBuilderClientIds([]);
          setManualBuilderReturnToAI(false);
          if (returnTo && day6Client?.id) {
            setShowAIWorkouts(true);
            setAiWorkoutsListKey((k) => k + 1);
          }
        }}
      />
    );
  }
  const workoutTabClientId =
    clients?.length > 0 ? selectedClientIdFromDashboard || clients[0]?.id : null;
  const workoutTabClientRow = workoutTabClientId ? clients.find((c) => c.id === workoutTabClientId) : null;
  const workoutTabClientName =
    String(workoutTabClientRow?.name || workoutTabClientRow?.displayName || '').trim() || '';

  if (showWorkoutPlan) return (
    <WorkoutPlanGeneratorScreen
      userId={workoutTabClientId || undefined}
      trainerRosterEmpty={!clients?.length}
      viewingClientName={workoutTabClientName}
      onBack={handleHomePress}
      onPlanGenerated={handleHomePress}
      onNavigate={(route) => {
        if (route === 'settings') {
          setShowWorkoutPlan(false);
          setShowSettings(true);
          return;
        }
        handleHomePress();
      }}
      onProfilePress={() => setShowProfile(true)}
      onSettingsPress={() => setShowSettings(true)}
    />
  );

  const headerTitle = showTrainerMessaging ? 'Messages' : showConversationsList ? 'Messages' : showClientRequests ? 'Client Requests' : 'COACHCONNECT';

  return (
    <LinearGradient colors={isDark ? GRADIENT_BG_DARK : GRADIENT_BG_LIGHT} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        {!showWorkoutGenerator && !showPlanViewer && !showTrainerMessaging && (
          <CoachConnectHeader title={headerTitle} isDark={isDark} onProfilePress={() => setShowProfile(true)} onSettingsPress={() => setShowSettings(true)} />
        )}

        {showTrainerMessaging && (
          <TrainerMessagingScreen
            embedInLayout
            trainer={selectedTrainer}
            conversation={selectedConversation}
            onClose={handleHomePress}
            onProfilePress={() => setShowProfile(true)}
            onSettingsPress={() => setShowSettings(true)}
          />
        )}
        {!showTrainerMessaging && showConversationsList && (
          <ConversationsListScreen
            embedInLayout
            onClose={() => setShowConversationsList(false)}
            onSelectConversation={(c, o) => { setSelectedConversation(c); setSelectedTrainer(o); setShowConversationsList(false); setShowTrainerMessaging(true); }}
            onProfilePress={() => setShowProfile(true)}
            onSettingsPress={() => setShowSettings(true)}
            selectedClientId={selectedClientIdForMessages}
          />
        )}
        {!showTrainerMessaging && showClientRequests && (
          <ClientRequestsScreen
            embedInLayout
            onClose={() => setShowClientRequests(false)}
            onProfilePress={() => setShowProfile(true)}
            onSettingsPress={() => setShowSettings(true)}
            onClientAdded={refreshClients}
          />
        )}
        {!showTrainerMessaging && !showConversationsList && !showClientRequests && !showPhotoGallery && !showAIWorkouts && !showWorkoutGenerator && !showPlanViewer && (
          <DashboardContent
            isDark={isDark}
            clients={clients}
            clientsLoading={clientsLoading}
            pendingRequestsCount={pendingRequests?.length ?? 0}
            unreadMessageCount={unreadMessageCount}
            onClientRequestsPress={() => setShowClientRequests(true)}
            onClientsPress={() => setShowClientsList(true)}
            onMessagesPress={(clientId) => { setSelectedClientIdForMessages(clientId); setShowTrainerMessaging(false); setShowConversationsList(true); }}
            onOpenPhotoGallery={(client) => {
              if (!client?.id) return;
              setDay6Client(client);
              setShowConversationsList(false);
              setShowTrainerMessaging(false);
              setShowClientRequests(false);
              setShowVoiceAI(false);
              setShowNutrition(false);
              setShowSettings(false);
              setShowWorkoutPlan(false);
              setShowProfile(false);
              setShowPhotoGallery(true);
              setShowAIWorkouts(false);
            }}
            onOpenAIWorkouts={(client) => {
              if (!client?.id) return;
              setDay6Client(client);
              setShowConversationsList(false);
              setShowTrainerMessaging(false);
              setShowClientRequests(false);
              setShowVoiceAI(false);
              setShowNutrition(false);
              setShowSettings(false);
              setShowWorkoutPlan(false);
              setShowProfile(false);
              setShowPhotoGallery(false);
              setShowAIWorkouts(true);
            }}
            onRefreshClients={refreshClients}
            userName={userName}
            trainerId={user?.uid}
            pdfViewer={pdfViewer}
            setPdfViewer={setPdfViewer}
            defaultClientId={navSelectedClientId}
            onSelectedClientChange={setSelectedClientIdFromDashboard}
            onOpenWeeklyReport={(clientId, clientName) =>
              setWeeklyReportScreen({ clientId, clientName: clientName || '' })
            }
            onTrainerClientRemoved={handleTrainerClientRemovedFromRoster}
            getTrainerEditorNavChrome={getTrainerEditorNavChrome}
          />
        )}

        {!showTrainerMessaging && !showConversationsList && !showClientRequests && showPhotoGallery && day6Client?.id && !showWorkoutGenerator && !showPlanViewer && (
          <PhotoGalleryScreen
            route={{ params: { clientId: day6Client.id, clientName: day6Client.name, allowUpload: false } }}
            navigation={{ goBack: () => setShowPhotoGallery(false) }}
          />
        )}

        {!showTrainerMessaging && !showConversationsList && !showClientRequests && showAIWorkouts && day6Client?.id && !showWorkoutGenerator && !showPlanViewer && (
          <AIWorkoutPlansScreen
            key={`aiwp-${day6Client.id}-${aiWorkoutsListKey}`}
            client={day6Client}
            trainerId={user?.uid}
            onBack={() => setShowAIWorkouts(false)}
            onGenerateWorkout={(client) => {
              setGeneratorClient(client);
              setShowAIWorkouts(false);
              setShowWorkoutGenerator(true);
            }}
            onBuildCustom={() => {
              setManualPlanEditId(null);
              setManualPlanBuilderClientIds(day6Client?.id ? [day6Client.id] : []);
              setManualBuilderReturnToAI(true);
              setShowAIWorkouts(false);
              setShowManualPlanBuilder(true);
            }}
            onEditManualPlan={(planId) => {
              setManualPlanEditId(planId);
              setManualPlanBuilderClientIds(day6Client?.id ? [day6Client.id] : []);
              setManualBuilderReturnToAI(true);
              setShowAIWorkouts(false);
              setShowManualPlanBuilder(true);
            }}
            onViewPlan={(plan) => {
              setViewingPlan(plan);
              setShowAIWorkouts(false);
              setShowPlanViewer(true);
            }}
            route={{ params: { clientId: day6Client.id, clientName: day6Client.name } }}
            navigation={{ goBack: () => setShowAIWorkouts(false) }}
          />
        )}

        {!showTrainerMessaging && !showConversationsList && !showClientRequests && showWorkoutGenerator && generatorClient?.id && (
          <WorkoutPlanGeneratorScreen
            userId={generatorClient.id}
            hideBottomNav={true}
            onBack={() => {
              setShowWorkoutGenerator(false);
              setShowAIWorkouts(true);
            }}
            onPlanGenerated={() => {
              setShowWorkoutGenerator(false);
              setShowAIWorkouts(true);
            }}
            onProfilePress={() => setShowProfile(true)}
            onSettingsPress={() => setShowSettings(true)}
          />
        )}

        {!showTrainerMessaging && !showConversationsList && !showClientRequests && showPlanViewer && viewingPlan && (
          <WorkoutPlanGeneratorScreen
            userId={day6Client?.id}
            plan={viewingPlan}
            readOnly={true}
            hideBottomNav={true}
            onBack={() => {
              setShowPlanViewer(false);
              setShowAIWorkouts(true);
            }}
            onPlanGenerated={() => {
              setShowPlanViewer(false);
              setShowAIWorkouts(true);
            }}
            onProfilePress={() => setShowProfile(true)}
            onSettingsPress={() => setShowSettings(true)}
          />
        )}

        {!showWorkoutGenerator && !showPlanViewer && (
          <BottomNavBar
            onHomePress={handleHomePress}
            onPlusPress={handlePlusPress}
            onVoicePress={() => { setShowVoiceAI(true); }}
            onNutritionPress={() => { setShowNutrition(true); }}
            onWorkoutPress={() => { setShowWorkoutPlan(true); }}
            onMessagesPress={(clientId) => { setSelectedClientIdForMessages(clientId); setShowTrainerMessaging(false); setShowConversationsList(true); }}
          />
        )}

        <AddNotesFilesModal
          visible={showAddNotesFilesModal}
          onClose={() => { setShowAddNotesFilesModal(false); setAddNotesFilesClientId(null); }}
          onAdded={() => { setShowAddNotesFilesModal(false); setAddNotesFilesClientId(null); refreshClients(); }}
          isDark={isDark}
          clientId={addNotesFilesClientId}
          addedBy="trainer"
          onNewDocument={() => setDocumentEditor({ visible: true, documentId: null, title: '' })}
          onNewSpreadsheet={() => setSpreadsheetEditor({ visible: true, documentId: null, title: '', rows: null })}
          onImportSpreadsheet={async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: [
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  'text/csv',
                ],
                copyToCacheDirectory: true,
              });
              if (result.canceled) return;
              const file = result.assets[0];
              const base64 = await FileSystem.readAsStringAsync(file.uri, {
                encoding: FileSystem.EncodingType.Base64,
              });
              const wb = XLSX.read(base64, { type: 'base64' });
              const firstSheetName = wb.SheetNames[0];
              const ws = firstSheetName ? wb.Sheets[firstSheetName] : null;
              const data = ws ? XLSX.utils.sheet_to_json(ws, { header: 1 }) : [];
              const rows = (data || []).map((row) =>
                (row || []).map((val) => (val != null ? String(val) : '')),
              );
              setSpreadsheetEditor({
                visible: true,
                documentId: null,
                title: file.name || 'Imported Spreadsheet',
                rows,
              });
            } catch (e) {
              Alert.alert('Import failed', e?.message || 'Could not import spreadsheet.');
            }
          }}
        />
        
        <PdfViewerModal
          visible={pdfViewer.visible}
          url={pdfViewer.url}
          name={pdfViewer.name}
          isDark={isDark}
          onClose={() => setPdfViewer({ visible: false, url: null, name: null })}
        />
        <SpreadsheetEditorModal
          visible={spreadsheetEditor.visible}
          trainerId={user?.uid}
          documentId={spreadsheetEditor.documentId}
          isDark={isDark}
          initialTitle={spreadsheetEditor.title}
          initialRows={spreadsheetEditor.rows}
          onClose={() => setSpreadsheetEditor({ visible: false, documentId: null, title: '', rows: null })}
          onSaved={() => refreshClients()}
          trainerNavChrome={getTrainerEditorNavChrome()}
        />
        <DocumentEditorModal
          visible={documentEditor.visible}
          trainerId={user?.uid}
          documentId={documentEditor.documentId}
          isDark={isDark}
          onClose={() => setDocumentEditor({ visible: false, documentId: null })}
          onSaved={() => refreshClients()}
          trainerNavChrome={getTrainerEditorNavChrome()}
        />
      </SafeAreaView>
    </LinearGradient>
  );
};

// ─────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────
export default function TrainerApp({ user }) {
  return (
    <TrainerStylesProvider>
      <AppWithTheme user={user} />
    </TrainerStylesProvider>
  );
}