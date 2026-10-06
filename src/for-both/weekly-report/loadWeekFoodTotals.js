// Adds up a client's food logs for each calendar day in a week.
// Flow: query nutrition_logs by both user-id spellings → add the legacy subcollection → return totals keyed by day.
// Used by the weekly report. A missing collection is skipped so one old path cannot blank the whole week.

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

function emptyDayTotals() {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

// Number() turns a numeric string into a number. A missing field is NaN, and NaN || 0 is 0,
// so a half-filled log still adds instead of poisoning the week with NaN.
function addFoodLogToDay(totalsByDay, dayKey, logData) {
  if (!dayKey) return;
  if (!totalsByDay[dayKey]) totalsByDay[dayKey] = emptyDayTotals();
  totalsByDay[dayKey].calories += Number(logData.calories) || 0;
  totalsByDay[dayKey].protein += Number(logData.protein) || 0;
  totalsByDay[dayKey].carbs += Number(logData.carbs) || 0;
  totalsByDay[dayKey].fat += Number(logData.fat) || 0;
}

// Day keys are "YYYY-MM-DD", so plain string compare is chronological.
function isDayInsideRange(dayKey, startKey, endKey) {
  if (!dayKey) return false;
  if (startKey && dayKey < startKey) return false;
  if (endKey && dayKey > endKey) return false;
  return true;
}

function addLogsInsideRange(totalsByDay, logDocuments, weekStart, weekEndKey) {
  logDocuments.forEach((logDoc) => {
    const logData = logDoc.data() || {};
    const dayKey = logData.date;
    if (isDayInsideRange(dayKey, weekStart, weekEndKey)) {
      addFoodLogToDay(totalsByDay, dayKey, logData);
    }
  });
}

// The ranged query needs a composite index. If Firestore rejects it, load every log for that
// user and keep only the days in range. If that also fails, this field spelling has no rows.
async function loadNutritionLogDocs(userId, weekStart, weekEndKey, userIdField) {
  try {
    const rangedSnapshot = await getDocs(
      query(
        collection(db, NUTRITION_LOGS_COLLECTION),
        where(userIdField, '==', userId),
        where(DATE_FIELD, '>=', weekStart),
        where(DATE_FIELD, '<=', weekEndKey),
      ),
    );
    return rangedSnapshot.docs;
  } catch {
    try {
      const allSnapshot = await getDocs(
        query(collection(db, NUTRITION_LOGS_COLLECTION), where(userIdField, '==', userId)),
      );
      return allSnapshot.docs;
    } catch {
      return [];
    }
  }
}

// Legacy rows live at users/{uid}/nutritionLogs/{day}. The day is the date field, or the doc id
// when the field was never written. Totals may be nested under dayTotals or totals.
function legacyDayKey(logDoc, logData) {
  return logData.date || logDoc.id;
}

function legacyDayTotals(logData) {
  return logData.dayTotals || logData.totals || logData;
}

async function addLegacyNutritionLogs(totalsByDay, userId, weekStart, weekEndKey) {
  try {
    const legacySnapshot = await getDocs(
      collection(db, USERS_COLLECTION, userId, LEGACY_NUTRITION_LOGS_COLLECTION),
    );
    legacySnapshot.docs.forEach((logDoc) => {
      const logData = logDoc.data() || {};
      const dayKey = legacyDayKey(logDoc, logData);
      if (!isDayInsideRange(dayKey, weekStart, weekEndKey)) return;
      addFoodLogToDay(totalsByDay, dayKey, legacyDayTotals(logData));
    });
  } catch {
    // The legacy subcollection is optional. A missing one is not a failed week.
  }
}

// Merge uses || 0, not Number(). A numeric string would be concatenated, which is what the
// old merge did. Do not "fix" that here or two weeks of totals will disagree.
function addMergedDayTotals(mergedTotals, dayKey, totals) {
  if (!mergedTotals[dayKey]) mergedTotals[dayKey] = emptyDayTotals();
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
  if (!userId || !db || !weekStart) return {};

  const totalsByDay = {};
  const weekEndKey = weekEnd || weekStart;

  for (const userIdField of USER_ID_FIELD_NAMES) {
    const logDocuments = await loadNutritionLogDocs(userId, weekStart, weekEndKey, userIdField);
    addLogsInsideRange(totalsByDay, logDocuments, weekStart, weekEndKey);
  }

  await addLegacyNutritionLogs(totalsByDay, userId, weekStart, weekEndKey);
  return totalsByDay;
}

/**
 * Add several week maps into one. Later maps add onto the same day. They do not replace it.
 * @param {...object} nutritionMaps
 * @returns {Record<string, { calories: number, protein: number, carbs: number, fat: number }>}
 */
export function mergeNutritionMaps(...nutritionMaps) {
  const mergedTotals = {};
  nutritionMaps.forEach((nutritionMap) => {
    Object.entries(nutritionMap || {}).forEach(([dayKey, totals]) => {
      addMergedDayTotals(mergedTotals, dayKey, totals);
    });
  });
  return mergedTotals;
}
