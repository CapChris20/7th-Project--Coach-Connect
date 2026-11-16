// Trainer shell plus the client-record reads and writes.
// Flow: LoginGate mounts the shell → roster, profile, and notifications → screens read the shell.
// CRM exports are how screens read and write trainer_clients data.
// Used by LoginGate and by screens that import getClient, getTrainerClients, and the rest.
// Read order: constants → CRM recipes → shell → PLUMBING for roster/analytics helpers.

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { NavigationContainer } from '@react-navigation/native';
import TrainerScreenList from '../trainer-app/navigation/TrainerScreenList';
import { TrainerAppStartShellProvider } from '../trainer-app/navigation/TrainerOpenScreenTracker';
import { goToTrainerScreen } from '../trainer-app/navigation/goToTrainerScreen';
import { rootNavigationRef } from '../navigation/openScreenFromAnywhere';
import { trainerLinking } from '../navigation/webLinks';
import { View, Text } from "react-native";
import NbNoticeSheet from '../look-and-feel/NbNoticeSheet';
import NbSheet from '../look-and-feel/NbSheet';
import NbButton from '../look-and-feel/NbButton';
import { spacing } from '../look-and-feel/colorPalette';
import {
  doc,
  getDoc,
  collection,
  addDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { pagedTraineeList } from "../trainer-app/my-trainees/pagedTraineeList";
import { resolveTrainerClientDisplayName, isGenericClientDisplayName } from "../trainer-app/trainee-records/getTraineeDisplayName";
import { combineTraineeProfile } from "../helpers/combineTraineeProfile";
import { pendingRequestCount } from "../trainer-app/new-requests/pendingRequestCount";
import {
  configureNotifications,
  persistPushTokensForUid,
  pendingPushTokenStorageKey,
  setNotificationTapHandler,
  flushInitialNotificationResponse,
  subscribePushTokenRefreshOnResume,
} from "../notifications/manageAlerts";
import { auth, db } from "../app-start/cloudConnection";
import { reportCrashAutomaticallySync } from "../crash-reports/reportCrashAutomatically";
import { getOrCreateConversation } from "../ai-coach/coach-actions/alertTrainer";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SessionsProvider } from "../trainer-app/scheduling/SharedSessionList";
import { unreadAlertCount } from "../notifications/unreadAlertCount";
import { CrashCatcher } from "../crash-reports/CrashCatcher";
import { useStartupLoadingCoverLock } from "../for-both/loading-and-header/StartupLoadingCover";
import { clearAllUserData } from "../logout-cleanup/clearDataOnLogout";
import {
  TrainerStylesProvider,
  useTrainerTheme,
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
} from '../trainer-app/trainee-records/traineeDatabaseLocations';

// ===== NAMED CONSTANTS =====

const CRM_CLIENTS_COLLECTION = "clients";
const CRM_PROGRESS_SUBCOLLECTION = "progress";
const CRM_TASKS_SUBCOLLECTION = "tasks";
const CRM_NOTES_SUBCOLLECTION = "notes";
const TRAINER_CLIENT_LINKS = "trainer_client_links";
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const WEEKLY_REPORT_DAY_COUNT = 7;
const PERMISSION_DENIED_CODE = "permission-denied";

// CRM subcollections arrive unsorted; we sort in JS to avoid extra composite indexes.

// ===== HELPER FUNCTIONS =====
// Tiny helpers the CRM recipes call by name. Roster / analytics / shell plumbing is below.

function firestoreCreatedAtMillis(entry) {
  const createdAt = entry.createdAt;
  if (createdAt && typeof createdAt.toMillis === 'function') {
    const millis = createdAt.toMillis();
    if (millis) {
      return millis;
    }
  }
  if (createdAt) {
    return createdAt;
  }
  return 0;
}

function sortSubcollectionNewestFirst(entries) {
  const rows = Array.isArray(entries) ? [...entries] : [];
  rows.sort((left, right) => firestoreCreatedAtMillis(right) - firestoreCreatedAtMillis(left));
  return rows;
}

function signedInAuthUid() {
  if (!auth) {
    return null;
  }
  if (!auth.currentUser) {
    return null;
  }
  return auth.currentUser.uid;
}

function trainerIdForCrmWrites(trainerId) {
  if (trainerId) {
    return trainerId;
  }
  return signedInAuthUid();
}

function errorCodeOrName(errorValue) {
  if (!errorValue) {
    return null;
  }
  if (errorValue.code) {
    return errorValue.code;
  }
  if (errorValue.name) {
    return errorValue.name;
  }
  return null;
}

function errorMessageOrValue(errorValue) {
  if (errorValue && errorValue.message) {
    return errorValue.message;
  }
  return errorValue;
}

function uidFromUser(user) {
  if (!user) {
    return null;
  }
  if (!user.uid) {
    return null;
  }
  return user.uid;
}

function clientDataWithoutInternalSource(row) {
  const { _source, ...data } = row;
  void _source;
  return data;
}

function countCompletedTasks(tasks) {
  let completed = 0;
  for (let taskIndex = 0; taskIndex < tasks.length; taskIndex += 1) {
    if (tasks[taskIndex].completed === true) {
      completed += 1;
    }
  }
  return completed;
}

async function loadWeightTasksAndProgress(clientId) {
  const weightTrend = await getWeightTrend(clientId);
  const taskStats = await getTaskStats(clientId);
  const progressEntries = await getProgressHistory(clientId);
  return { weightTrend, taskStats, progressEntries };
}

function createdAtAsDate(createdAt) {
  if (createdAt && typeof createdAt.toDate === 'function') {
    return createdAt.toDate();
  }
  if (createdAt) {
    return createdAt;
  }
  return null;
}

function callIfPresent(maybeFunction, ...args) {
  if (typeof maybeFunction === 'function') {
    maybeFunction(...args);
  }
}

function rosterContainsClientId(clients, clientId) {
  if (!clientId || !clients) {
    return false;
  }
  for (let clientIndex = 0; clientIndex < clients.length; clientIndex += 1) {
    if (clients[clientIndex].id === clientId) {
      return true;
    }
  }
  return false;
}

function preferredClientIdForPlusPress(clients, selectedClientIdFromDashboard) {
  if (rosterContainsClientId(clients, selectedClientIdFromDashboard)) {
    return selectedClientIdFromDashboard;
  }
  if (clients.length === 1) {
    return clients[0].id;
  }
  return null;
}

function anyChannelIsNaN(channels) {
  for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
    if (Number.isNaN(channels[channelIndex])) {
      return true;
    }
  }
  return false;
}

function clientWritePayload(clientId, clientData) {
  return {
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
}

// ===== MAIN FUNCTION =====
// CLIENT CRM SERVICE — screens import these names; keep export names + return shapes frozen.
// Read one client record.
export async function getClient(clientId, trainerId = null) {
  if (!clientId || !db) {
    return null;
  }

  try {
    // 1. Load from canonical (or legacy) path helper.
    const row = await fetchTrainerClientDoc(clientId, trainerId);
    if (!row) {
      return null;
    }
    // 2. Strip `_source` so callers never persist path-helper bookkeeping.
    return clientDataWithoutInternalSource(row);
  } catch (error) {
    // Some Firestore errors here are expected (permission-denied while a link is being torn down).
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
    // 1. Build the CRM row shape (field letters stay frozen).
    const payload = clientWritePayload(clientId, clientData);
    // 2. Conversation first so messaging never points at a missing client.
    await ensureConversationExists(clientId, trainerId);
    // 3. Canonical trainer_clients doc.
    await writeCanonicalClientDoc(trainerId, clientId, payload);
    // 4. Flat link the client app listens to.
    await writeTrainerClientLink(trainerId, clientId, payload);
    // 5. Confirm the canonical write landed.
    await confirmClientDocSaved(trainerId, clientId);
    // 6. Legacy mirror (best-effort).
    await mirrorLegacyClientDoc(clientId, trainerId, payload);
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
    return await loadSortedRoster(trainerId);
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

  const trainerIdForWrite = trainerIdForCrmWrites(trainerId);
  if (!trainerIdForWrite) {
    throw new Error("Missing trainerId for canonical client update");
  }

  try {
    await updateTrainerClientDoc(trainerIdForWrite, clientId, updates);
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

  const trainerIdForWrite = trainerIdForCrmWrites(trainerId);

  try {
    const progressRef = progressCollectionRef(trainerIdForWrite, clientId);
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

// Newest check-ins first.
export async function getProgressHistory(clientId, trainerId = null) {
  if (!clientId || !db) {
    return [];
  }

  try {
    const trainerIdForWrite = trainerIdForCrmWrites(trainerId);
    const progressEntries = await fetchTrainerClientSubcollectionDocs(
      clientId,
      CRM_PROGRESS_SUBCOLLECTION,
      trainerIdForWrite,
    );

    return sortSubcollectionNewestFirst(progressEntries);
  } catch (error) {
    // permission-denied is routine here (the client revoked access), so stay quiet about it and
    // let anything else through to the console.
    const code = errorCodeOrName(error);
    if (code !== "permission-denied") {
      console.error("Error getting progress history:", error);
    }
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - getProgressHistory");
    return [];
  }
}

// Remove one check-in row.
export async function deleteProgress(clientId, progressId, trainerId = null) {
  if (!clientId || !progressId || !db) {
    throw new Error("Missing required parameters: clientId or progressId");
  }

  try {
    const trainerIdForWrite = trainerIdForCrmWrites(trainerId);
    await deleteTrainerClientSubdoc(
      trainerIdForWrite,
      clientId,
      CRM_PROGRESS_SUBCOLLECTION,
      progressId,
    );
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

// Newest tasks first.
export async function getTasks(clientId, trainerId = null) {
  if (!clientId || !db) {
    return [];
  }

  try {
    const trainerIdForWrite = trainerIdForCrmWrites(trainerId);
    const tasks = await fetchTrainerClientSubcollectionDocs(
      clientId,
      CRM_TASKS_SUBCOLLECTION,
      trainerIdForWrite,
    );

    return sortSubcollectionNewestFirst(tasks);
  } catch (error) {
    const code = errorCodeOrName(error);
    if (code !== "permission-denied") {
      console.error("Error getting tasks:", error);
    }
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - getTasks");
    return [];
  }
}

// Change fields on one task.
export async function updateTask(clientId, taskId, updates, trainerId = null) {
  if (!clientId || !taskId || !db) {
    throw new Error("Missing required parameters: clientId or taskId");
  }

  try {
    const trainerIdForWrite = trainerIdForCrmWrites(trainerId);
    await updateTrainerClientSubdoc(
      trainerIdForWrite,
      clientId,
      CRM_TASKS_SUBCOLLECTION,
      taskId,
      updates,
    );
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

// Remove one task.
export async function deleteTask(clientId, taskId, trainerId = null) {
  if (!clientId || !taskId || !db) {
    throw new Error("Missing required parameters: clientId or taskId");
  }

  try {
    const trainerIdForWrite = trainerIdForCrmWrites(trainerId);
    await deleteTrainerClientSubdoc(
      trainerIdForWrite,
      clientId,
      CRM_TASKS_SUBCOLLECTION,
      taskId,
    );
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

// Newest notes first.
export async function getNotes(clientId, trainerId = null) {
  if (!clientId || !db) {
    return [];
  }

  try {
    const trainerIdForWrite = trainerIdForCrmWrites(trainerId);
    const notes = await fetchTrainerClientSubcollectionDocs(
      clientId,
      CRM_NOTES_SUBCOLLECTION,
      trainerIdForWrite,
    );

    return sortSubcollectionNewestFirst(notes);
  } catch (error) {
    console.error("Error getting notes:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - getNotes");
    return [];
  }
}

// Change fields on one note.
export async function updateNote(clientId, noteId, updates, trainerId = null) {
  if (!clientId || !noteId || !db) {
    throw new Error("Missing required parameters: clientId or noteId");
  }

  try {
    const trainerIdForWrite = trainerIdForCrmWrites(trainerId);
    await updateTrainerClientSubdoc(
      trainerIdForWrite,
      clientId,
      CRM_NOTES_SUBCOLLECTION,
      noteId,
      updates,
    );
    return { success: true };
  } catch (error) {
    console.error("Error updating note:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - updateNote");
    throw error;
  }
}

// Remove one note.
export async function deleteNote(clientId, noteId, trainerId = null) {
  if (!clientId || !noteId || !db) {
    throw new Error("Missing required parameters: clientId or noteId");
  }

  try {
    const trainerIdForWrite = trainerIdForCrmWrites(trainerId);
    await deleteTrainerClientSubdoc(
      trainerIdForWrite,
      clientId,
      CRM_NOTES_SUBCOLLECTION,
      noteId,
    );
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
    return weightPointsFromProgress(progressEntries, limitCount);
  } catch (error) {
    console.error("Error getting weight trend:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - getWeightTrend");
    return [];
  }
}

// Count finished and unfinished tasks.
export async function getTaskStats(clientId) {
  if (!clientId || !db) {
    return { total: 0, completed: 0, pending: 0 };
  }

  try {
    // 1. Load tasks for this client.
    const tasks = await getTasks(clientId);
    // 2. Count finished ones with strict === true (older docs may omit `completed`).
    const total = tasks.length;
    const completed = countCompletedTasks(tasks);
    const pending = total - completed;

    return { total, completed, pending };
  } catch (error) {
    console.error("Error getting task stats:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - getTaskStats");
    return { total: 0, completed: 0, pending: 0 };
  }
}

// Weight trend, task counts, and days since the last check-in.
export async function getClientAnalytics(clientId) {
  if (!clientId || !db) {
    return emptyClientAnalytics();
  }

  try {
    // 1. Pull weight, tasks, and check-ins (named helper owns the fetches).
    const bundle = await loadWeightTasksAndProgress(clientId);
    // 2. Summarize the newest check-in.
    const checkIn = latestCheckInSummary(bundle.progressEntries);
    return {
      weightTrend: bundle.weightTrend,
      taskStats: bundle.taskStats,
      lastProgressDate: checkIn.lastProgressDate,
      daysSinceLastCheckIn: checkIn.daysSinceLastCheckIn,
      progressEntriesCount: bundle.progressEntries.length,
    };
  } catch (error) {
    console.error("Error getting client analytics:", error);
    reportCrashAutomaticallySync(error, "TrainerAppStart CRM - getClientAnalytics");
    return emptyClientAnalytics();
  }
}

// Answers "does this client have enough logged data for a weekly report?" by checking the last 7
// daily log documents.
export async function checkWeeklyDataAvailability(userId) {
  if (!userId || !db) {
    throw new Error("Missing userId or db");
  }

  const dateKeys = recentReportDateKeys(WEEKLY_REPORT_DAY_COUNT);
  try {
    const daysWithData = await dailyLogRowsForKeys(userId, dateKeys);
    return weekAvailabilityReport(dateKeys, daysWithData);
  } catch (error) {
    return weeklyAvailabilityFailed(error, dateKeys);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// END CLIENT CRM SERVICE

// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Notification taps are independent booleans, not a stack — each branch closes what would
 * layer on top, then opens the destination screen the payload describes.
 */
function routeTrainerNotificationTap(data, panelActions) {
  const type = data.type;

  if (type === 'client_request') {
    panelActions.closeConversationsAndMessaging();
    panelActions.openClientRequests();
    return;
  }

  if ((type === 'session_response' || type === 'notes_shared') && data.senderId) {
    panelActions.closeMessagingAndRequests();
    panelActions.openDashboardClient(String(data.senderId));
    return;
  }

  if (type === 'session_reminder' || type === 'session_update') {
    panelActions.closeConversationsAndMessaging();
    return;
  }

  if (type === 'session_scheduled') {
    panelActions.closeConversationsAndMessaging();
    return;
  }

  if (type === 'message' && data.senderId) {
    panelActions.openConversationsForClient(String(data.senderId));
    return;
  }

  panelActions.openConversationsListFallback();
}

async function flushTrainerPendingPushToken(uid) {
  const pendingToken = await AsyncStorage.getItem(pendingPushTokenStorageKey(uid));
  if (!pendingToken) return;
  await persistPushTokensForUid(uid, pendingToken);
  await AsyncStorage.removeItem(pendingPushTokenStorageKey(uid));
}

async function loadTrainerDisplayName(uid, fallbackDisplayName) {
  const userDoc = await getDoc(doc(db, 'users', uid));
  const trainerDoc = await getDoc(doc(db, 'trainers', uid));

  let userProfile = null;
  if (userDoc.exists()) {
    userProfile = userDoc.data();
  }
  let trainerProfile = null;
  if (trainerDoc.exists()) {
    trainerProfile = trainerDoc.data();
  }

  if (userProfile && userProfile.firstName) {
    return userProfile.firstName;
  }
  if (userProfile && userProfile.name) {
    return userProfile.name;
  }
  if (trainerProfile && trainerProfile.name) {
    return trainerProfile.name;
  }
  if (fallbackDisplayName) {
    return fallbackDisplayName;
  }
  return 'Coach';
}

function clientLabelForPicker(client) {
  if (client.name) {
    return client.name;
  }
  if (client.displayName) {
    return client.displayName;
  }
  return 'Client';
}

function buildClientPickerButtons(shell) {
  const clients = shell.clientPickerClients || [];
  const buttons = [];
  for (let clientIndex = 0; clientIndex < clients.length; clientIndex += 1) {
    const client = clients[clientIndex];
    buttons.push(
      <NbButton
        key={client.id}
        variant="plain"
        onPress={() => {
          callIfPresent(shell.setAddNotesFilesClientId, client.id);
          callIfPresent(shell.setShowAddFilePopup, true);
          callIfPresent(shell.setClientPickerForFilesOpen, false);
        }}
      >
        {clientLabelForPicker(client)}
      </NbButton>,
    );
  }
  return buttons;
}

function noticeTitle(notice) {
  if (notice && notice.title) {
    return notice.title;
  }
  return '';
}

function noticeConfirmLabel(notice) {
  if (notice && notice.confirmLabel) {
    return notice.confirmLabel;
  }
  return 'OK';
}

function TrainerShellLayout({ shell }) {
  const notice = shell.notice;
  const clientPickerButtons = buildClientPickerButtons(shell);

  return (
    <TrainerAppStartShellProvider value={shell}>
      <CrashCatcher>
        <NavigationContainer ref={rootNavigationRef} webLinks={trainerLinking}>
          <TrainerScreenList />
        </NavigationContainer>
      </CrashCatcher>
      <NbSheet
        visible={!!shell.clientPickerForFilesOpen}
        onClose={() => callIfPresent(shell.setClientPickerForFilesOpen, false)}
        title="Add to Notes & Files"
      >
        <View style={{ gap: 10, paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}>
          <Text style={{ fontSize: 14, fontWeight: '600', marginBottom: 4 }}>Select a client</Text>
          {clientPickerButtons}
          <NbButton
            variant="ghost"
            onPress={() => callIfPresent(shell.setClientPickerForFilesOpen, false)}
          >
            Cancel
          </NbButton>
        </View>
      </NbSheet>
      <NbNoticeSheet
        visible={!!notice}
        onClose={() => callIfPresent(shell.dismissNotice)}
        title={noticeTitle(notice)}
        message={notice ? notice.message : undefined}
        confirmLabel={noticeConfirmLabel(notice)}
        cancelLabel={notice ? notice.cancelLabel : undefined}
        onConfirm={notice ? notice.onConfirm : undefined}
      />
    </TrainerAppStartShellProvider>
  );
}

// Thin wrapper whose only job is stacking the providers the trainer UI depends on.
// Order matters outside-in: styles first (everything themes off it), then subscription (gates
// features), then sessions (needs to know the user). The real work lives in TrainerAppStartContent so
// that component can USE these contexts — a component can't consume a provider it renders itself.
export default function TrainerAppStart({ user }) {
  const trainerUid = uidFromUser(user);
  return (
    <TrainerStylesProvider>
      <ProPlanSetup userId={trainerUid}>
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
  const trainerUid = uidFromUser(user);
  // vocab/symbol: ?? false = default only when theme.isDark is null/undefined, so a real `false`
  // from the theme is preserved.
  let isDark = false;
  if (theme != null && theme.isDark != null) {
    isDark = theme.isDark;
  }

  // Sets up how notifications are displayed and (on Android) creates the notification channel —
  // required before any notification can appear. Empty deps: once per app launch.
  useEffect(() => {
    configureNotifications();
  }, []);

  // Same pattern as the client shell: one hook owns every "which panel is open" flag and all the
  // open*/handle* functions, and the big destructure below just unpacks it.
  const trainerNavigation = goToTrainerScreen();
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
    openPrivacyDataRights,
    openNutrition,
    openWorkoutPlan,
    openVoiceAI,
    openAIChatSession,
    openWeeklyReport,
    openNotifications,
    openManualPlanBuilder,
    openPayments,
    handleHomePress: navHandleHomePress,
    onNavigate,
    navProviderProps,
    rootGoBack,
  } = trainerNavigation;
  // Several separate "selected client" slots rather than one shared value. That's intentional: the
  // client you're viewing in the dashboard, the one you're messaging, and the one highlighted in nav
  // are different questions, and collapsing them into one would make opening a chat also change the
  // dashboard behind it.
  const [navSelectedClientId, setNavSelectedClientId] = useState(null);
  const [selectedClientIdForMessages, setSelectedClientIdForMessages] = useState(null);
  const [userName, setUserName] = useState(null);
  const unreadMessageCount = unreadAlertCount(trainerUid);
  // Viewer/editor modals: objects rather than booleans so one setState both opens the modal and
  // supplies what it should show.
  const [pdfViewer, setPdfViewer] = useState({ visible: false, url: null, name: null });
  const [documentEditor, setDocumentEditor] = useState({ visible: false, documentId: null });
  const [spreadsheetEditor, setSpreadsheetEditor] = useState({
    visible: false,
    documentId: null,
    title: '',
    rows: null,
    isProgramStarter: false,
  });
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
  const [clientPickerForFilesOpen, setClientPickerForFilesOpen] = useState(false);
  const [notice, setNotice] = useState(null);
  const showNotice = useCallback(
    (title, message, extras = {}) => setNotice({ title, message, ...extras }),
    [],
  );
  const dismissNotice = useCallback(() => setNotice(null), []);
  const [trainerProfileDoc, setTrainerProfileDoc] = useState(null);

  // Re-reads the trainer's own profile. Exposed on the shell so screens can refresh it after
  // editing the profile without a full app reload.
  // Note both fallbacks set {} rather than leaving null: null means "still loading" to consumers,
  // so an empty object is how we say "loaded, just nothing there".
  const refreshTrainerUserDoc = useCallback(async () => {
    if (!trainerUid || !db) {
      return;
    }
    try {
      const snap = await getDoc(doc(db, 'users', trainerUid));
      if (snap.exists()) {
        setTrainerProfileDoc(snap.data());
      } else {
        setTrainerProfileDoc({});
      }
    } catch {
      setTrainerProfileDoc({});
    }
  }, [trainerUid]);

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
  } = pagedTraineeList(trainerUid);
  // First roster fetch only — mirror ClientAppStart so home does not flash under the boot poster.
  const [trainerHomeBootLocked, setTrainerHomeBootLocked] = useState(true);
  useEffect(() => {
    if (!clientsLoading && trainerHomeBootLocked) {
      setTrainerHomeBootLocked(false);
    }
  }, [clientsLoading, trainerHomeBootLocked]);
  useStartupLoadingCoverLock(trainerHomeBootLocked);
  // Incoming "please coach me" requests — the badge on the requests screen.
  const { requests: pendingRequests } = pendingRequestCount(trainerUid);

  // After a client is removed, refresh the list AND clear them from any selection that points at
  // them — otherwise the dashboard keeps rendering a client that no longer exists.
  // The `prev === clientId ? null : prev` form only clears when it's actually the removed client,
  // leaving an unrelated selection untouched.
  const handleTrainerClientRemovedFromRoster = useCallback((clientId) => {
    refreshClients();
    setNavSelectedClientId((previousClientId) => (previousClientId === clientId ? null : previousClientId));
    setSelectedClientIdFromDashboard((previousClientId) => (previousClientId === clientId ? null : previousClientId));
  }, [refreshClients]);

  // Account-switch reset, same reasoning as the client shell: this component can survive a user
  // change, so anything user-specific is cleared or the next trainer briefly sees the last one's
  // name, selections, and cached data.
  useEffect(() => {
    if (!trainerUid) {
      return;
    }

    console.log(`🔄 TrainerAppStart: User changed to ${trainerUid} - resetting state`);

    // Reset all user-specific state
    setTrainerHomeBootLocked(true);
    setUserName(null);
    setTrainerProfileDoc(null);
    setSelectedTrainer(null);
    setSelectedConversation(null);
    setNavSelectedClientId(null);
    setSelectedClientIdForMessages(null);

    // Clear any cached data
    clearAllUserData().catch((clearError) => {
      console.log('⚠️ Failed to clear cache in TrainerAppStart:', clearError.message);
    });
  }, [trainerUid]);

  // Push-token upkeep — identical to the client shell's version: claim any token issued before
  // sign-in, refresh the current one (respecting the user's notification setting), and re-check
  // whenever the app returns from the background, since tokens can rotate while it's closed.
  useEffect(() => {
    if (!trainerUid || !db) {
      return undefined;
    }
    let cancelled = false;

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', trainerUid));
        if (!snap.exists() || cancelled) {
          return;
        }
        await flushTrainerPendingPushToken(trainerUid);
      } catch (pushError) {
        if (__DEV__) {
          console.warn('[push] pending token flush failed:', errorMessageOrValue(pushError));
        }
      }

      if (!cancelled) {
        persistPushTokensForUid(trainerUid, { skipIfDisabled: true }).catch(() => {});
      }
    })();

    const unsubResume = subscribePushTokenRefreshOnResume(trainerUid, () => true);
    return () => {
      cancelled = true;
      unsubResume();
    };
  }, [trainerUid]);

  // "What happens when the trainer taps a notification."
  // Kept in a ref so the handler registered once below always calls the LATEST closure — registering
  // the function directly would freeze today's state and navigation setters inside it forever.
  const trainerNotifTapRef = useRef(() => {});

  useEffect(() => {
    trainerNotifTapRef.current = async (data) => {
      try {
        if (!trainerUid || !data || typeof data !== 'object') {
          return;
        }

        routeTrainerNotificationTap(data, {
          closeConversationsAndMessaging: () => {
            setShowConversationsList(false);
            setShowTrainerMessaging(false);
          },
          openClientRequests: () => setShowClientRequests(true),
          closeMessagingAndRequests: () => {
            setShowTrainerMessaging(false);
            setShowConversationsList(false);
            setShowClientRequests(false);
          },
          openDashboardClient: (clientId) => setSelectedClientIdFromDashboard(clientId),
          openConversationsForClient: (clientId) => {
            setShowTrainerMessaging(false);
            setShowClientRequests(false);
            setSelectedClientIdForMessages(clientId);
            setShowConversationsList(true);
          },
          openConversationsListFallback: () => setShowConversationsList(true),
        });
      } catch {
        setShowConversationsList(true);
      }
    };
  }, [trainerUid]);

  // Register once; the arrow reads through the ref each time so it's never stale.
  useEffect(() => {
    setNotificationTapHandler((notificationData) => {
      callIfPresent(trainerNotifTapRef.current, notificationData);
    });
    return () => setNotificationTapHandler(null);
  }, []);

  // Replays the notification that launched the app from cold — that tap happened before any handler
  // existed. Manipulate here: 650ms gives the navigator time to mount before we act on it.
  useEffect(() => {
    if (!trainerUid) {
      return undefined;
    }
    return flushInitialNotificationResponse(650);
  }, [trainerUid]);

  // The greeting name. Read from BOTH the users and trainers documents because trainer profiles were
  // historically split across the two; the || chain picks the first that has a name and ends at
  // 'Coach' so the header is never blank or "undefined".
  useEffect(() => {
    if (!trainerUid || !db) {
      return;
    }
    const fallbackDisplayName = user && user.displayName ? user.displayName : null;
    const load = async () => {
      try {
        const greeting = await loadTrainerDisplayName(trainerUid, fallbackDisplayName);
        setUserName(greeting);
      } catch {
        if (fallbackDisplayName) {
          setUserName(fallbackDisplayName);
        } else {
          setUserName('Coach');
        }
      }
    };
    load();
  }, [trainerUid, user]);

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
    const clientCount = clients ? clients.length : 0;
    if (!clientCount) {
      showNotice('No clients', 'Add a client first to add notes or files for them.');
      return;
    }
    // Prefer the dashboard client if they are still on the roster; else the only client; else ask.
    const preferredId = preferredClientIdForPlusPress(
      clients,
      selectedClientIdFromDashboard,
    );
    if (preferredId) {
      setAddNotesFilesClientId(preferredId);
      setShowAddFilePopup(true);
      return;
    }
    setClientPickerForFilesOpen(true);
  };

  // Builds the nav-bar handlers used WHILE a document editor is open.
  // The problem it solves: editors are full-screen modals over the shell, so tapping a nav icon
  // would navigate underneath one and leave the editor floating on top. Every handler here closes
  // the editors first, then performs the normal action.
  const getTrainerEditorNavChrome = useCallback((closeDashboardEditors) => {
    const closeEditors = () => {
      callIfPresent(closeDashboardEditors);
      setDocumentEditor({ visible: false, documentId: null });
      setSpreadsheetEditor({ visible: false, documentId: null, title: '', rows: null, isProgramStarter: false });
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
    openPrivacyDataRights,
    openNutrition,
    openWorkoutPlan,
    openVoiceAI,
    openAIChatSession,
    openWeeklyReport,
    openNotifications,
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
    clientPickerForFilesOpen,
    setClientPickerForFilesOpen,
    clientPickerClients: clients,
    notice,
    dismissNotice,
    showNotice,
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
    clientPickerForFilesOpen,
    notice,
    showNotice,
    dismissNotice,
  ]);

  return <TrainerShellLayout shell={shell} />;
}

// ===== PLUMBING — skip unless debugging =====
// Heavy roster / write / analytics helpers the CRM recipes call.
// Converts lightColors.primary into '255, 107, 157' so it can be dropped into an `rgba(…, 0.2)` string —
// React Native has no color-with-opacity helper, so the channels must be split out by hand.
// vocab: parseInt(x, 16) = read the two hex characters as a base-16 number.
// Manipulate here: '255, 107, 157' is the brand pink used as the fallback whenever the input isn't
// a clean 6-digit hex (both guards below return it rather than producing an invalid color string).
function hexToRgbTriple(hexColor) {
  const hexDigits = String(hexColor || "").replace("#", "").trim();
  if (hexDigits.length !== 6) {
    return "255, 107, 157";
  }
  const redChannel = parseInt(hexDigits.slice(0, 2), 16);
  const greenChannel = parseInt(hexDigits.slice(2, 4), 16);
  const blueChannel = parseInt(hexDigits.slice(4, 6), 16);
  const channels = [redChannel, greenChannel, blueChannel];
  if (anyChannelIsNaN(channels)) {
    return "255, 107, 157";
  }
  return `${redChannel}, ${greenChannel}, ${blueChannel}`;
}

// Fallback dashboard payload built purely from CRM data, used when the client's own user profile
// can't be read (they haven't finished signup, or rules block it). Every field gets a defined value
// so the dashboard renders a real empty state instead of crashing on undefined.
// Manipulate here: the *Goal numbers and 'Custom Program' are placeholder defaults shown until the
// trainer sets real ones.
function crmFieldOrNull(currentClient, fieldName) {
  if (!currentClient) {
    return null;
  }
  if (currentClient[fieldName] == null) {
    return null;
  }
  return currentClient[fieldName];
}

function crmFieldOrEmptyList(currentClient, fieldName) {
  if (!currentClient) {
    return [];
  }
  if (!currentClient[fieldName]) {
    return [];
  }
  return currentClient[fieldName];
}

function beforeWeightFromCrm(currentClient) {
  const startingWeight = crmFieldOrNull(currentClient, 'startingWeight');
  if (startingWeight != null) {
    return startingWeight;
  }
  return crmFieldOrNull(currentClient, 'weight');
}

function buildTrainerDashboardClientDataFromCrm(currentClient, notesAndFiles = []) {
  let programName = 'Custom Program';
  if (currentClient && currentClient.programName) {
    programName = currentClient.programName;
  }
  return {
    beforeWeight: beforeWeightFromCrm(currentClient),
    currentWeight: crmFieldOrNull(currentClient, 'weight'),
    trainingDays: [],
    programName,
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
      micros: crmFieldOrEmptyList(currentClient, 'micros'),
      foods: [],
    },
    calendar: {
      completed: crmFieldOrEmptyList(currentClient, 'completedDays'),
      upcoming: crmFieldOrEmptyList(currentClient, 'upcomingDays'),
      missed: crmFieldOrEmptyList(currentClient, 'missedDays'),
      upcomingSessions: crmFieldOrEmptyList(currentClient, 'upcomingSessions'),
    },
    notesAndFiles,
  };
}

async function ensureConversationExists(clientId, trainerId) {
  try {
    await getOrCreateConversation(clientId, trainerId);
  } catch (conversationError) {
    console.error("⚠️ Error creating auto-conversation:", conversationError);
  }
}

async function writeCanonicalClientDoc(trainerId, clientId, payload) {
  const clientRef = doc(db, `trainer_clients/${trainerId}/clients/${clientId}`);
  const existingDoc = await getDoc(clientRef);
  if (existingDoc.exists()) {
    await setDoc(clientRef, payload, { merge: true });
    return;
  }
  await setDoc(clientRef, payload);
}

async function writeTrainerClientLink(trainerId, clientId, payload) {
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
  } catch (linkError) {
    console.warn("⚠️ trainer_client_links write skipped:", errorMessageOrValue(linkError));
  }
}

async function confirmClientDocSaved(trainerId, clientId) {
  const clientRef = doc(db, `trainer_clients/${trainerId}/clients/${clientId}`);
  const verifyDoc = await getDoc(clientRef);
  if (verifyDoc.exists()) return;
  console.error("❌ ERROR: Client was not saved!");
}

async function mirrorLegacyClientDoc(clientId, trainerId, payload) {
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
}

function compareClientNames(leftClient, rightClient) {
  const leftName = (leftClient.name || "").toLowerCase();
  const rightName = (rightClient.name || "").toLowerCase();
  return leftName.localeCompare(rightName);
}

function clientStatusIsHidden(client) {
  const status = String(client.status || "active").toLowerCase();
  if (status === "inactive" || status === "removed" || status === "deleted") return true;
  return client.archived === true;
}

function clientStillBelongsToTrainer(userData, trainerId) {
  if (!userData) {
    return false;
  }
  const linkedTrainerId = userData.trainerId;
  if (linkedTrainerId == null || linkedTrainerId === "") {
    return false;
  }
  return String(linkedTrainerId) === String(trainerId);
}

async function saveRealNameIfPlaceholder(trainerId, clientId, storedName, resolvedName) {
  if (!resolvedName) return;
  if (isGenericClientDisplayName(resolvedName)) return;
  if (!isGenericClientDisplayName(storedName)) return;
  try {
    await setDoc(
      doc(db, `trainer_clients/${trainerId}/clients/${clientId}`),
      { name: resolvedName, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch (ignoredError) {
    /* ignore */
  }
}

async function rosterRowFromUserDoc(client, trainerId) {
  const userDoc = await getDoc(doc(db, "users", client.id));
  if (!userDoc.exists()) return combineTraineeProfile(client, {});
  const userData = userDoc.data();
  if (!clientStillBelongsToTrainer(userData, trainerId)) return null;
  const storedName = String(client.name || "").trim();
  const resolvedName = resolveTrainerClientDisplayName(client, userData);
  const mergedClient = combineTraineeProfile(
    { ...client, name: resolvedName, photoURL: client.photoURL || userData.photoURL || null },
    userData,
  );
  await saveRealNameIfPlaceholder(trainerId, client.id, storedName, mergedClient.name);
  return mergedClient;
}

async function rosterRowForClient(client, trainerId) {
  if (clientStatusIsHidden(client)) return null;
  try {
    return await rosterRowFromUserDoc(client, trainerId);
  } catch (ignoredError) {
    return null;
  }
}

async function loadSortedRoster(trainerId) {
  const clients = await fetchTrainerClientRoster(trainerId, { includeLegacy: true });
  const validClients = [];
  for (const client of clients) {
    const rosterRow = await rosterRowForClient(client, trainerId);
    if (!rosterRow) continue;
    validClients.push(rosterRow);
  }
  validClients.sort(compareClientNames);
  return validClients;
}

function weightPointsFromProgress(progressEntries, limitCount) {
  const weightData = [];
  for (let index = 0; index < progressEntries.length; index += 1) {
    const entry = progressEntries[index];
    if (entry.weight == null || entry.weight <= 0) {
      continue;
    }
    const pointDate = createdAtAsDate(entry.createdAt);
    weightData.push({
      date: pointDate || new Date(),
      weight: Number(entry.weight),
    });
    if (weightData.length >= limitCount) {
      break;
    }
  }
  return weightData;
}

function wholeDaysSince(earlierDate) {
  if (!earlierDate) return null;
  const millisecondsPerDay = MILLISECONDS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;
  const elapsedMilliseconds = new Date() - earlierDate;
  return Math.floor(elapsedMilliseconds / millisecondsPerDay);
}

function latestCheckInSummary(progressEntries) {
  if (progressEntries.length === 0) {
    return { lastProgressDate: null, daysSinceLastCheckIn: null };
  }
  const lastEntry = progressEntries[0];
  const lastProgressDate = createdAtAsDate(lastEntry.createdAt);
  return {
    lastProgressDate,
    daysSinceLastCheckIn: wholeDaysSince(lastProgressDate),
  };
}

function emptyClientAnalytics() {
  return {
    weightTrend: [],
    taskStats: { total: 0, completed: 0, pending: 0 },
    lastProgressDate: null,
    daysSinceLastCheckIn: null,
    progressEntriesCount: 0,
  };
}

// Day keys use en-CA (YYYY-MM-DD) in America/New_York. Those letters must stay.
function recentReportDateKeys(dayCount) {
  const today = new Date();
  const dateKeys = [];
  for (let dayOffset = 0; dayOffset < dayCount; dayOffset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - dayOffset);
    const dateKey = date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    dateKeys.push(dateKey);
  }
  return dateKeys;
}

function weekAvailabilityReport(dateKeys, daysWithData) {
  return {
    totalDays: WEEKLY_REPORT_DAY_COUNT,
    daysWithData: daysWithData.length,
    missingDays: WEEKLY_REPORT_DAY_COUNT - daysWithData.length,
    details: daysWithData,
    dateRange: {
      start: dateKeys[dateKeys.length - 1],
      end: dateKeys[0],
    },
  };
}

function emptyWeekAvailability(dateKeys) {
  return {
    totalDays: WEEKLY_REPORT_DAY_COUNT,
    daysWithData: 0,
    missingDays: WEEKLY_REPORT_DAY_COUNT,
    details: [],
    dateRange: {
      start: dateKeys[dateKeys.length - 1],
      end: dateKeys[0],
    },
  };
}

function loggedDayRow(dateKey, data) {
  return {
    date: dateKey,
    hasWorkout: !!data.workout,
    hasNutrition: !!data.nutrition,
    hasWeight: !!data.weight,
    hasMood: !!data.mood,
    data,
  };
}

async function dailyLogRowsForKeys(userId, dateKeys) {
  const daysWithData = [];
  const dailyLogsRef = collection(db, "users", userId, "dailyLogs");
  for (const dateKey of dateKeys) {
    const docSnap = await getDoc(doc(dailyLogsRef, dateKey));
    if (!docSnap.exists()) continue;
    daysWithData.push(loggedDayRow(dateKey, docSnap.data()));
  }
  return daysWithData;
}

function weeklyAvailabilityFailed(error, dateKeys) {
  let code = null;
  if (error && error.code) {
    code = error.code;
  }
  const message = String(errorMessageOrValue(error) || "").toLowerCase();
  const permissionDenied =
    code === PERMISSION_DENIED_CODE || message.includes("missing or insufficient permissions");
  if (permissionDenied) {
    return emptyWeekAvailability(dateKeys);
  }
  console.error("Error checking weekly data availability:", error);
  reportCrashAutomaticallySync(error, "TrainerAppStart CRM - checkWeeklyDataAvailability");
  throw error;
}
