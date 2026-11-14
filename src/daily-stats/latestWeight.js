// Finds the client's most recently logged weight, not the number on their profile.
// Flow: try newest-first dailyLogs query → return first usable dashboard_weight → if that query fails, walk one calendar day at a time.
// Used by the trainer progress view's Current figure. Field key stays dashboard_weight.
// Read order: constants → small helpers → main recipe → PLUMBING query/scan at the bottom.

import { collection, doc, getDoc, getDocs, query, orderBy, limit, documentId } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

// Manipulate here: how far back the fast query and the day-by-day fallback look. Raising costs more reads.
const RECENT_LOG_LIMIT = 120;
const FALLBACK_SCAN_DAYS = 120;
const USERS_COLLECTION = 'users';
const DAILY_LOGS_COLLECTION = 'dailyLogs';
// Freeze: Firestore field letters must stay dashboard_weight.
const WEIGHT_FIELD = 'dashboard_weight';
// vocab: en-CA + America/New_York → YYYY-MM-DD strings that match dailyLogs document ids
const DATE_KEY_TIME_ZONE = 'America/New_York';
const DATE_KEY_LOCALE = 'en-CA';

// ===== HELPER FUNCTIONS =====

/**
 * Turn a dailyLogs day doc into a finite weight number, or null when missing/blank/NaN.
 * @param {object|null|undefined} dayData
 * @returns {number|null}
 */
function weightNumberFromDayData(dayData) {
  if (!dayData) {
    return null;
  }
  const storedWeight = dayData[WEIGHT_FIELD];
  if (storedWeight == null) {
    return null;
  }
  if (storedWeight === '') {
    return null;
  }
  const weightNumber = Number(storedWeight);
  if (!Number.isFinite(weightNumber)) {
    return null;
  }
  return weightNumber;
}

/**
 * Local YYYY-MM-DD for "today minus N days" in the app's date-key timezone.
 * @param {number} daysAgo
 * @returns {string}
 */
function dateKeyForDaysAgo(daysAgo) {
  const calendarDay = new Date();
  const todayDayOfMonth = calendarDay.getDate();
  calendarDay.setDate(todayDayOfMonth - daysAgo);
  return calendarDay.toLocaleDateString(DATE_KEY_LOCALE, { timeZone: DATE_KEY_TIME_ZONE });
}

// ===== MAIN FUNCTION =====

/**
 * Latest finite dashboard_weight from dailyLogs, newest day first.
 * Returns null when this person has never logged a weight.
 * @param {string} userId
 * @returns {Promise<number|null>}
 */
export async function fetchLatestLoggedWeight(userId) {
  // 1. Need a signed-in user and a live Firestore handle.
  if (!userId) {
    return null;
  }
  if (!db) {
    return null;
  }

  try {
    // 2. Fast path: one ordered query over the newest N day documents.
    const weightFromQuery = await readLatestWeightFromRecentQuery(userId);
    return weightFromQuery;
  } catch (ignoredQueryError) {
    // 3. Rules or missing index — walk calendar days until we hit a weight or exhaust the window.
    const weightFromDayWalk = await readLatestWeightByWalkingDays(userId);
    return weightFromDayWalk;
  }
}

// ===== PLUMBING — skip unless the newest-first query is denied and the day-by-day scan is wrong =====

/**
 * Walk newest→oldest day docs from a query snapshot; return the first usable weight.
 * @param {Array} dayDocuments
 * @returns {number|null}
 */
function firstUsableWeightInDayDocuments(dayDocuments) {
  for (let index = 0; index < dayDocuments.length; index += 1) {
    const dayDocument = dayDocuments[index];
    const dayData = dayDocument.data();
    const weightNumber = weightNumberFromDayData(dayData);
    if (weightNumber != null) {
      return weightNumber;
    }
  }
  return null;
}

/**
 * Ordered query over the newest RECENT_LOG_LIMIT dailyLogs docs.
 * @param {string} userId
 * @returns {Promise<number|null>}
 */
async function readLatestWeightFromRecentQuery(userId) {
  const logsCollection = collection(db, USERS_COLLECTION, userId, DAILY_LOGS_COLLECTION);
  // vocab: orderBy(documentId(), 'desc') = newest YYYY-MM-DD id first without a separate date field
  const recentLogsQuery = query(
    logsCollection,
    orderBy(documentId(), 'desc'),
    limit(RECENT_LOG_LIMIT),
  );
  const recentLogsSnapshot = await getDocs(recentLogsQuery);
  const dayDocuments = recentLogsSnapshot.docs;
  return firstUsableWeightInDayDocuments(dayDocuments);
}

/**
 * One getDoc per calendar day until we find a weight or hit FALLBACK_SCAN_DAYS.
 * @param {string} userId
 * @returns {Promise<number|null>}
 */
async function readLatestWeightByWalkingDays(userId) {
  for (let daysAgo = 0; daysAgo < FALLBACK_SCAN_DAYS; daysAgo += 1) {
    const dayKey = dateKeyForDaysAgo(daysAgo);
    const dayDocumentRef = doc(
      db,
      USERS_COLLECTION,
      userId,
      DAILY_LOGS_COLLECTION,
      dayKey,
    );
    const daySnapshot = await getDoc(dayDocumentRef);
    if (!daySnapshot.exists()) {
      continue;
    }
    const dayData = daySnapshot.data();
    const weightNumber = weightNumberFromDayData(dayData);
    if (weightNumber != null) {
      return weightNumber;
    }
  }
  return null;
}
