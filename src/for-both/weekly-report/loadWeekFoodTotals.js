// Sums a client's nutrition_logs for each calendar day inside a week range.
// Flow: query nutrition_logs (both uid field spellings) → merge legacy users/{uid}/nutritionLogs → return by day key.
// Used by WeeklyReportScreen food load. Missing paths are skipped so one old store cannot blank the week.

import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const NUTRITION_LOGS_COLLECTION = 'nutrition_logs';
const USERS_COLLECTION = 'users';
const LEGACY_NUTRITION_LOGS_COLLECTION = 'nutritionLogs';
// Older rows stored the uid as user_id. Newer rows use userId. Both are queried on purpose.
const USER_ID_FIELD_NAMES = ['user_id', 'userId'];
const DATE_FIELD = 'date';

// ===== HELPER FUNCTIONS =====

function freshEmptyDayTotals() {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

/**
 * Turn a macro field into a number. Missing / junk becomes 0.
 * @param {*} value
 * @returns {number}
 */
function macroAsNumber(value) {
  // vocab: Number() turns numeric strings into numbers; NaN || 0 keeps half-filled logs from poisoning the week
  return Number(value) || 0;
}

/**
 * Add one log’s macros onto that day’s running totals (creates the day bucket if needed).
 * @param {object} totalsByDay
 * @param {string} dayKey
 * @param {object} logData
 */
function addOneLogOntoDay(totalsByDay, dayKey, logData) {
  if (!dayKey) return;
  if (!totalsByDay[dayKey]) {
    totalsByDay[dayKey] = freshEmptyDayTotals();
  }
  totalsByDay[dayKey].calories += macroAsNumber(logData.calories);
  totalsByDay[dayKey].protein += macroAsNumber(logData.protein);
  totalsByDay[dayKey].carbs += macroAsNumber(logData.carbs);
  totalsByDay[dayKey].fat += macroAsNumber(logData.fat);
}

/**
 * Day keys are "YYYY-MM-DD", so plain string compare is chronological.
 * @param {string} dayKey
 * @param {string} startKey
 * @param {string} endKey
 * @returns {boolean}
 */
function dayKeyFallsInsideWeek(dayKey, startKey, endKey) {
  if (!dayKey) return false;
  if (startKey && dayKey < startKey) return false;
  if (endKey && dayKey > endKey) return false;
  return true;
}

/**
 * Fold a list of Firestore docs into totalsByDay, skipping days outside the week.
 * @param {object} totalsByDay
 * @param {Array} logDocuments
 * @param {string} weekStart
 * @param {string} weekEndKey
 */
function foldLogDocumentsIntoTotals(totalsByDay, logDocuments, weekStart, weekEndKey) {
  for (const logDoc of logDocuments) {
    const logData = logDoc.data() || {};
    const dayKey = logData.date;
    const dayIsInWeek = dayKeyFallsInsideWeek(dayKey, weekStart, weekEndKey);
    if (!dayIsInWeek) continue;
    addOneLogOntoDay(totalsByDay, dayKey, logData);
  }
}

/**
 * Merge uses || 0, not Number(). Numeric strings would concatenate — same as the historical merge.
 * @param {object} mergedTotals
 * @param {string} dayKey
 * @param {object} totals
 */
function addDayTotalsIntoMerge(mergedTotals, dayKey, totals) {
  if (!mergedTotals[dayKey]) {
    mergedTotals[dayKey] = freshEmptyDayTotals();
  }
  mergedTotals[dayKey].calories += totals.calories || 0;
  mergedTotals[dayKey].protein += totals.protein || 0;
  mergedTotals[dayKey].carbs += totals.carbs || 0;
  mergedTotals[dayKey].fat += totals.fat || 0;
}

// ===== MAIN FUNCTION =====

/**
 * Nutrition totals keyed by YYYY-MM-DD for one client across a date range.
 * @param {string} userId
 * @param {string} weekStart
 * @param {string} [weekEnd]
 * @returns {Promise<Record<string, { calories: number, protein: number, carbs: number, fat: number }>>}
 */
export async function fetchNutritionByDayForRange(userId, weekStart, weekEnd) {
  // Failures first — no user, no db, or no start date means an empty week map.
  if (!userId || !db || !weekStart) return {};

  const totalsByDay = {};
  const weekEndKey = weekEnd || weekStart;

  // 1. Top-level nutrition_logs — try both user id field spellings.
  for (const userIdField of USER_ID_FIELD_NAMES) {
    const logDocuments = await loadNutritionLogDocs(
      userId,
      weekStart,
      weekEndKey,
      userIdField,
    );
    foldLogDocumentsIntoTotals(totalsByDay, logDocuments, weekStart, weekEndKey);
  }

  // 2. Legacy per-user subcollection adds anything the flat collection missed.
  await mergeLegacyNutritionLogs(totalsByDay, userId, weekStart, weekEndKey);

  // 3. Hand back the day → macros map (may still be {}).
  return totalsByDay;
}

/**
 * Add several week maps into one. Later maps add onto the same day. They do not replace it.
 * @param {...object} nutritionMaps
 * @returns {Record<string, { calories: number, protein: number, carbs: number, fat: number }>}
 */
export function mergeNutritionMaps(...nutritionMaps) {
  const mergedTotals = {};
  for (const nutritionMap of nutritionMaps) {
    const dayEntries = Object.entries(nutritionMap || {});
    for (const [dayKey, totals] of dayEntries) {
      addDayTotalsIntoMerge(mergedTotals, dayKey, totals);
    }
  }
  return mergedTotals;
}

// ===== PLUMBING — skip unless debugging (Firestore query fallbacks and legacy path) =====

/**
 * Preferred path: ranged query with both uid and date bounds (needs composite index).
 * @param {string} userId
 * @param {string} weekStart
 * @param {string} weekEndKey
 * @param {string} userIdField
 * @returns {Promise<Array>}
 */
async function queryLogsInDateRange(userId, weekStart, weekEndKey, userIdField) {
  // vocab: getDocs + query + where = Firestore read with filters (not a live listener)
  const rangedSnapshot = await getDocs(
    query(
      collection(db, NUTRITION_LOGS_COLLECTION),
      where(userIdField, '==', userId),
      where(DATE_FIELD, '>=', weekStart),
      where(DATE_FIELD, '<=', weekEndKey),
    ),
  );
  return rangedSnapshot.docs;
}

/**
 * Fallback when the ranged query has no index: every log for that uid (filter in memory later).
 * @param {string} userId
 * @param {string} userIdField
 * @returns {Promise<Array>}
 */
async function queryAllLogsForUser(userId, userIdField) {
  const allSnapshot = await getDocs(
    query(collection(db, NUTRITION_LOGS_COLLECTION), where(userIdField, '==', userId)),
  );
  return allSnapshot.docs;
}

/**
 * Ranged query needs a composite index. On rejection, load every log; if that fails, empty list.
 * @param {string} userId
 * @param {string} weekStart
 * @param {string} weekEndKey
 * @param {string} userIdField
 * @returns {Promise<Array>}
 */
async function loadNutritionLogDocs(userId, weekStart, weekEndKey, userIdField) {
  try {
    return await queryLogsInDateRange(userId, weekStart, weekEndKey, userIdField);
  } catch {
    return loadAllLogsOrEmpty(userId, userIdField);
  }
}

async function loadAllLogsOrEmpty(userId, userIdField) {
  try {
    return await queryAllLogsForUser(userId, userIdField);
  } catch {
    return [];
  }
}

function legacyDayKeyFromDoc(logDoc, logData) {
  return logData.date || logDoc.id;
}

function legacyTotalsPayload(logData) {
  // Older docs nest macros under dayTotals or totals; newest put them on the root.
  return logData.dayTotals || logData.totals || logData;
}

function foldLegacySnapshotIntoTotals(totalsByDay, legacySnapshot, weekStart, weekEndKey) {
  for (const logDoc of legacySnapshot.docs) {
    const logData = logDoc.data() || {};
    const dayKey = legacyDayKeyFromDoc(logDoc, logData);
    const dayIsInWeek = dayKeyFallsInsideWeek(dayKey, weekStart, weekEndKey);
    if (!dayIsInWeek) continue;
    addOneLogOntoDay(totalsByDay, dayKey, legacyTotalsPayload(logData));
  }
}

/**
 * Optional path: users/{uid}/nutritionLogs. Missing collection is not a failed week.
 * @param {object} totalsByDay
 * @param {string} userId
 * @param {string} weekStart
 * @param {string} weekEndKey
 */
async function mergeLegacyNutritionLogs(totalsByDay, userId, weekStart, weekEndKey) {
  try {
    const legacySnapshot = await getDocs(
      collection(db, USERS_COLLECTION, userId, LEGACY_NUTRITION_LOGS_COLLECTION),
    );
    foldLegacySnapshotIntoTotals(totalsByDay, legacySnapshot, weekStart, weekEndKey);
  } catch {
    // Legacy subcollection is optional — missing path is not a failed week
  }
}
