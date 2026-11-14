// Freezes yesterday's dashboard numbers into a permanent archive document.
// Flow: notice the local day changed → copy yesterday's live docs → write daily_logs/{uid}_{date} → retry on the next launch if that write failed.
// Used on app start and when the app comes to the front.
// Read order: constants → key helpers → main archive recipes → PLUMBING at the bottom.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';
import { getLocalDateKey } from '../helpers/getLocalDay';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const DAILY_LOGS_SUBCOLLECTION = 'dailyLogs';
const DAILY_TRACKING_SUBCOLLECTION = 'daily_tracking';
// Freeze: top-level archive collection letters stay daily_logs (underscore), not dailyLogs.
const ARCHIVE_COLLECTION = 'daily_logs';
const LAST_DATE_STORAGE_PREFIX = 'dashboard_last_dateKey_';
const PENDING_ARCHIVE_STORAGE_PREFIX = 'dashboard_pending_reset_';

// ===== HELPER FUNCTIONS =====

function lastDateStorageKey(uid) {
  return `${LAST_DATE_STORAGE_PREFIX}${uid}`;
}

function pendingArchiveStorageKey(uid) {
  return `${PENDING_ARCHIVE_STORAGE_PREFIX}${uid}`;
}

function buildArchiveDocumentId(uid, dateKey) {
  return `${uid}_${dateKey}`;
}

function canArchiveThisDay(uid, previousDateKey) {
  if (!uid) return false;
  if (!db) return false;
  if (!previousDateKey) return false;
  return true;
}

// ===== MAIN FUNCTION =====

/**
 * Merge yesterday into daily_logs/{uid}_{date}. A second run overwrites the same archive.
 * @param {string} uid
 * @param {string} previousDateKey
 * @returns {Promise<void>}
 */
export async function archiveDailyDashboardDay(uid, previousDateKey) {
  // 1. Need uid, Firestore, and a day to freeze.
  if (!canArchiveThisDay(uid, previousDateKey)) return;

  // 2. Read both live shapes for that calendar day.
  const dailyLogsData = await readDayDocument(uid, DAILY_LOGS_SUBCOLLECTION, previousDateKey);
  const trackingData = await readDayDocument(uid, DAILY_TRACKING_SUBCOLLECTION, previousDateKey);
  if (!dayHasAnythingToArchive(dailyLogsData, trackingData)) return;

  // 3. Write the frozen snapshot — merge:true so a retry is safe.
  const archiveDocumentId = buildArchiveDocumentId(uid, previousDateKey);
  const archivePayload = buildArchivePayload(
    uid,
    previousDateKey,
    dailyLogsData,
    trackingData,
  );
  const archiveRef = doc(db, ARCHIVE_COLLECTION, archiveDocumentId);
  await setDoc(archiveRef, archivePayload, { merge: true });
}

/**
 * If the stored day is no longer today, archive it and return that previous date key.
 * @param {string} uid
 * @returns {Promise<string|null>}
 */
export async function tickDailyDashboardDayRollover(uid) {
  // 1. Need a signed-in uid.
  if (!uid) return null;

  const todayDateKey = getLocalDateKey();
  const rememberedDateKey = await AsyncStorage.getItem(lastDateStorageKey(uid));

  // 2. First launch for this uid — just remember today, nothing to archive.
  if (!rememberedDateKey) {
    await AsyncStorage.setItem(lastDateStorageKey(uid), todayDateKey);
    return null;
  }

  // 3. Still the same calendar day — no rollover work.
  if (rememberedDateKey === todayDateKey) return null;

  // 4. Day changed — advance the remembered key, then archive the day we left behind.
  await AsyncStorage.setItem(lastDateStorageKey(uid), todayDateKey);
  try {
    await archiveDailyDashboardDay(uid, rememberedDateKey);
    await AsyncStorage.removeItem(pendingArchiveStorageKey(uid));
  } catch (archiveError) {
    await rememberPendingArchive(uid, rememberedDateKey);
    throw archiveError;
  }

  return rememberedDateKey;
}

/**
 * Retry a failed archive from a previous launch. The breadcrumb stays if this attempt fails too.
 * @param {string} uid
 * @returns {Promise<void>}
 */
export async function retryPendingDailyDashboardArchive(uid) {
  // 1. Need a signed-in uid.
  if (!uid) return;

  // 2. No breadcrumb → nothing to retry.
  const pendingRaw = await AsyncStorage.getItem(pendingArchiveStorageKey(uid));
  if (!pendingRaw) return;

  // 3. Parse the previous date key; skip corrupt breadcrumbs.
  const previousDateKey = parsePendingArchiveDateKey(pendingRaw);
  if (!previousDateKey) return;

  // 4. Archive again, then clear the breadcrumb on success.
  await archiveDailyDashboardDay(uid, previousDateKey);
  await AsyncStorage.removeItem(pendingArchiveStorageKey(uid));
}

// ===== PLUMBING — skip unless archive shape or AsyncStorage keys are wrong =====

async function readDayDocument(uid, subcollection, dateKey) {
  try {
    const dayRef = doc(db, USERS_COLLECTION, uid, subcollection, dateKey);
    const snapshot = await getDoc(dayRef);
    if (!snapshot.exists()) return null;
    const dayData = snapshot.data();
    if (!dayData) return {};
    return dayData;
  } catch (ignoredError) {
    return null;
  }
}

function dayHasAnythingToArchive(dailyLogsData, trackingData) {
  const logsHaveFields =
    dailyLogsData && Object.keys(dailyLogsData).length > 0;
  const trackingHasFields =
    trackingData && Object.keys(trackingData).length > 0;
  if (logsHaveFields) return true;
  if (trackingHasFields) return true;
  return false;
}

function numberFieldOrNull(record, fieldName) {
  if (!record) return null;
  if (typeof record[fieldName] === 'number') return record[fieldName];
  return null;
}

function firstFilledValue(...values) {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value) return value;
  }
  return null;
}

function buildArchivePayload(uid, dateKey, dailyLogsData, trackingData) {
  const safeDailyLogs = dailyLogsData || {};
  const safeTracking = trackingData || {};

  const workoutSummary = firstFilledValue(
    safeTracking.workoutSummary,
    safeDailyLogs.dashboard_workouts,
  );
  const workoutName = firstFilledValue(
    safeTracking.workoutName,
    safeDailyLogs.dashboard_workout_name,
  );

  return {
    userId: uid,
    date: dateKey,
    workouts: {
      workoutLog: safeDailyLogs.workoutLog || null,
      workoutSummary,
      workoutName,
      workoutExercises: safeTracking.workoutExercises || null,
    },
    nutrition: {
      caloriesConsumed: numberFieldOrNull(safeTracking, 'caloriesConsumed'),
      macros: safeTracking.macroTotals || null,
    },
    streak_count: numberFieldOrNull(safeDailyLogs, 'streak_count'),
    timestamp: serverTimestamp(),
  };
}

async function rememberPendingArchive(uid, previousDateKey) {
  const breadcrumb = {
    prevKey: previousDateKey,
    at: Date.now(),
  };
  await AsyncStorage.setItem(
    pendingArchiveStorageKey(uid),
    JSON.stringify(breadcrumb),
  );
}

function parsePendingArchiveDateKey(pendingRaw) {
  try {
    const pendingArchive = JSON.parse(pendingRaw);
    if (!pendingArchive) return null;
    if (!pendingArchive.prevKey) return null;
    return pendingArchive.prevKey;
  } catch (ignoredError) {
    return null;
  }
}
