// Finds the client's most recently logged weight, not the number on their profile.
// Flow: read recent dailyLogs newest-first → return the first usable dashboard_weight → if that query is blocked, read one day at a time.
// Used by the trainer progress view's "Current" figure. A stale profile number would mislead.

import { collection, doc, getDoc, getDocs, query, orderBy, limit, documentId } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

// Manipulate here: how far back to look. Raising these costs more reads.
// Lowering them means a long-inactive client shows no current weight.
const RECENT_LOG_LIMIT = 120;
const FALLBACK_SCAN_DAYS = 120;
const USERS_COLLECTION = 'users';
const DAILY_LOGS_COLLECTION = 'dailyLogs';
const WEIGHT_FIELD = 'dashboard_weight';
// The fallback rebuilds date-key strings, so it must use the same timezone the keys were written under.
const DATE_KEY_TIME_ZONE = 'America/New_York';
const DATE_KEY_LOCALE = 'en-CA';

// ===== HELPER FUNCTIONS =====

function parseDashboardWeight(dayData) {
  const storedWeight = dayData?.[WEIGHT_FIELD];
  if (storedWeight == null || storedWeight === '') return null;
  const weightNumber = Number(storedWeight);
  return Number.isFinite(weightNumber) ? weightNumber : null;
}

// vocab: setDate(getDate() - days) rolls the month and year backward automatically.
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

// Slow path used when rules allow one day doc but deny listing the whole collection.
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

// ===== MAIN FUNCTION =====

/**
 * Latest finite dashboard_weight from dailyLogs, newest day first.
 * Returns null if this person has never logged a weight.
 * @param {string} userId
 * @returns {Promise<number|null>}
 */
export async function fetchLatestLoggedWeight(userId) {
  if (!userId || !db) return null;
  try {
    // vocab: documentId() orders by the doc id. Ids are "YYYY-MM-DD", so descending string order is newest first.
    const logsCollection = collection(db, USERS_COLLECTION, userId, DAILY_LOGS_COLLECTION);
    const recentLogsQuery = query(
      logsCollection,
      orderBy(documentId(), 'desc'),
      limit(RECENT_LOG_LIMIT),
    );
    const recentLogs = await getDocs(recentLogsQuery);
    return firstLoggedWeight(recentLogs.docs);
  } catch (_) {
    return fetchLatestLoggedWeightByScan(userId);
  }
}
