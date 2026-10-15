// Finds the client's most recently logged weight, not the number on their profile.
// Flow: read recent dailyLogs newest-first → return the first usable dashboard_weight → if that query is blocked, read one day at a time.
// Used by the trainer progress view's Current figure.

import { collection, doc, getDoc, getDocs, query, orderBy, limit, documentId } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

// Manipulate here: how far back to look. Raising these costs more reads.
const RECENT_LOG_LIMIT = 120;
const FALLBACK_SCAN_DAYS = 120;
const USERS_COLLECTION = 'users';
const DAILY_LOGS_COLLECTION = 'dailyLogs';
const WEIGHT_FIELD = 'dashboard_weight';
const DATE_KEY_TIME_ZONE = 'America/New_York';
const DATE_KEY_LOCALE = 'en-CA';

// ===== HELPER FUNCTIONS =====

// PLUMBING — skip unless the newest-first query is denied and the day-by-day scan is wrong.

function parseDashboardWeight(dayData) {
  if (!dayData) return null;
  const storedWeight = dayData[WEIGHT_FIELD];
  if (storedWeight == null || storedWeight === '') return null;
  const weightNumber = Number(storedWeight);
  if (!Number.isFinite(weightNumber)) return null;
  return weightNumber;
}

function dateKeyDaysAgo(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toLocaleDateString(DATE_KEY_LOCALE, { timeZone: DATE_KEY_TIME_ZONE });
}

function firstLoggedWeight(dayDocuments) {
  for (const dayDocument of dayDocuments) {
    const weightNumber = parseDashboardWeight(dayDocument.data());
    if (weightNumber != null) return weightNumber;
  }
  return null;
}

async function fetchLatestLoggedWeightByScan(userId) {
  for (let daysAgo = 0; daysAgo < FALLBACK_SCAN_DAYS; daysAgo += 1) {
    const daySnapshot = await getDoc(
      doc(db, USERS_COLLECTION, userId, DAILY_LOGS_COLLECTION, dateKeyDaysAgo(daysAgo)),
    );
    if (!daySnapshot.exists()) continue;
    const weightNumber = parseDashboardWeight(daySnapshot.data());
    if (weightNumber != null) return weightNumber;
  }
  return null;
}

async function fetchLatestLoggedWeightByQuery(userId) {
  const logsCollection = collection(db, USERS_COLLECTION, userId, DAILY_LOGS_COLLECTION);
  const recentLogsQuery = query(logsCollection, orderBy(documentId(), 'desc'), limit(RECENT_LOG_LIMIT));
  const recentLogs = await getDocs(recentLogsQuery);
  return firstLoggedWeight(recentLogs.docs);
}

// ===== MAIN FUNCTION =====

/**
 * Latest finite dashboard_weight from dailyLogs, newest day first.
 * Returns null when this person has never logged a weight.
 * @param {string} userId
 * @returns {Promise<number|null>}
 */
export async function fetchLatestLoggedWeight(userId) {
  if (!userId || !db) return null;
  try {
    return await fetchLatestLoggedWeightByQuery(userId);
  } catch (ignoredQueryError) {
    return fetchLatestLoggedWeightByScan(userId);
  }
}
