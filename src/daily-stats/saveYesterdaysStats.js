// Freezes yesterday's dashboard numbers into a permanent archive document.
// Flow: notice the local day changed → copy yesterday's live docs → write daily_logs/{uid}_{date} → retry on the next launch if that write failed.
// Used on app start and when the app comes to the front.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';
import { getLocalDateKey } from '../helpers/getLocalDay';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const DAILY_LOGS_SUBCOLLECTION = 'dailyLogs';
const DAILY_TRACKING_SUBCOLLECTION = 'daily_tracking';
const ARCHIVE_COLLECTION = 'daily_logs';

// ===== HELPER FUNCTIONS =====

function lastDateStorageKey(uid) {
  return `dashboard_last_dateKey_${uid}`;
}

function pendingArchiveStorageKey(uid) {
  return `dashboard_pending_reset_${uid}`;
}

function archiveDocumentId(uid, dateKey) {
  return `${uid}_${dateKey}`;
}

async function readDayDocument(uid, subcollection, dateKey) {
  try {
    const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid, subcollection, dateKey));
    if (!snapshot.exists()) return null;
    return snapshot.data() || {};
  } catch (ignoredError) {
    return null;
  }
}

function hasAnyLoggedData(dailyLogsData, trackingData) {
  const hasLogs = dailyLogsData && Object.keys(dailyLogsData).length > 0;
  const hasTracking = trackingData && Object.keys(trackingData).length > 0;
  return Boolean(hasLogs || hasTracking);
}

function numberOrNull(record, fieldName) {
  if (!record) return null;
  if (typeof record[fieldName] === 'number') return record[fieldName];
  return null;
}

function firstFilled(...values) {
  for (const value of values) {
    if (value) return value;
  }
  return null;
}

function archivePayload(uid, dateKey, dailyLogsData, trackingData) {
  return {
    userId: uid,
    date: dateKey,
    workouts: {
      workoutLog: dailyLogsData?.workoutLog || null,
      workoutSummary: firstFilled(trackingData?.workoutSummary, dailyLogsData?.dashboard_workouts),
      workoutName: firstFilled(trackingData?.workoutName, dailyLogsData?.dashboard_workout_name),
      workoutExercises: trackingData?.workoutExercises || null,
    },
    nutrition: {
      caloriesConsumed: numberOrNull(trackingData, 'caloriesConsumed'),
      macros: trackingData?.macroTotals || null,
    },
    streak_count: numberOrNull(dailyLogsData, 'streak_count'),
    timestamp: serverTimestamp(),
  };
}

async function rememberPendingArchive(uid, previousDateKey) {
  await AsyncStorage.setItem(
    pendingArchiveStorageKey(uid),
    JSON.stringify({ prevKey: previousDateKey, at: Date.now() }),
  );
}

function pendingDateKey(pendingRaw) {
  try {
    const pendingArchive = JSON.parse(pendingRaw);
    if (!pendingArchive || !pendingArchive.prevKey) return null;
    return pendingArchive.prevKey;
  } catch (ignoredError) {
    return null;
  }
}

// ===== MAIN FUNCTION =====

/**
 * Merge yesterday into daily_logs/{uid}_{date}. A second run overwrites the same archive.
 * @param {string} uid
 * @param {string} previousDateKey
 * @returns {Promise<void>}
 */
export async function archiveDailyDashboardDay(uid, previousDateKey) {
  if (!uid || !db || !previousDateKey) return;

  const dailyLogsData = await readDayDocument(uid, DAILY_LOGS_SUBCOLLECTION, previousDateKey);
  const trackingData = await readDayDocument(uid, DAILY_TRACKING_SUBCOLLECTION, previousDateKey);
  if (!hasAnyLoggedData(dailyLogsData, trackingData)) return;

  await setDoc(
    doc(db, ARCHIVE_COLLECTION, archiveDocumentId(uid, previousDateKey)),
    archivePayload(uid, previousDateKey, dailyLogsData, trackingData),
    { merge: true },
  );
}

/**
 * If the stored day is no longer today, archive it and return that previous date key.
 * @param {string} uid
 * @returns {Promise<string|null>}
 */
export async function tickDailyDashboardDayRollover(uid) {
  if (!uid) return null;
  const todayDateKey = getLocalDateKey();
  const lastDateKey = await AsyncStorage.getItem(lastDateStorageKey(uid));

  if (!lastDateKey) {
    await AsyncStorage.setItem(lastDateStorageKey(uid), todayDateKey);
    return null;
  }
  if (lastDateKey === todayDateKey) return null;

  await AsyncStorage.setItem(lastDateStorageKey(uid), todayDateKey);
  try {
    await archiveDailyDashboardDay(uid, lastDateKey);
    await AsyncStorage.removeItem(pendingArchiveStorageKey(uid));
  } catch (archiveError) {
    await rememberPendingArchive(uid, lastDateKey);
    throw archiveError;
  }
  return lastDateKey;
}

/**
 * Retry a failed archive from a previous launch. The breadcrumb stays if this attempt fails too.
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function retryPendingDailyDashboardArchive(uid) {
  if (!uid) return;
  const pendingRaw = await AsyncStorage.getItem(pendingArchiveStorageKey(uid));
  if (!pendingRaw) return;
  const previousDateKey = pendingDateKey(pendingRaw);
  if (!previousDateKey) return;
  await archiveDailyDashboardDay(uid, previousDateKey);
  await AsyncStorage.removeItem(pendingArchiveStorageKey(uid));
}
