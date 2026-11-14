// Reads the last 7 days of food, workouts, and sleep so the coach can talk about the week.
// Flow: sum nutrition by day → count workout days and volume → average sleep → return three summaries (or null per slice).
// Used by loadYourWeekForCoach when the coach prompt needs the client's recent numbers.
// Read order: constants → main recipe → PLUMBING helpers.

import { db } from '../../app-start/cloudConnection';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';

// ===== NAMED CONSTANTS =====

// Manipulate here: the window the coach treats as "this week."
const DAYS_IN_WEEK = 7;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MS_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;
const SEVEN_DAYS_IN_MS = DAYS_IN_WEEK * MS_PER_DAY;
// Manipulate here: average sleep under this many hours is flagged as depleted.
const SLEEP_DEPLETED_UNDER_HOURS = 6.5;

const NUTRITION_LOGS_COLLECTION = 'nutrition_logs';
const COMPLETED_WORKOUTS_COLLECTION = 'completedWorkouts';
const USERS_COLLECTION = 'users';
const DAILY_LOGS_COLLECTION = 'dailyLogs';
const LEGACY_NUTRITION_LOGS_COLLECTION = 'nutritionLogs';
const LEGACY_DAILY_TRACKING_COLLECTION = 'daily_tracking';

// Older nutrition rows used user_id. Newer rows use userId. Both are read.
const USER_ID_FIELDS = ['user_id', 'userId'];
const DATE_FIELD = 'date';
const COMPLETED_WORKOUT_USER_FIELD = 'userId';

const VOLUME_TREND_LOGGED = 'logged';
const VOLUME_TREND_NONE = 'none';

// ===== MAIN RECIPE =====

export async function aggregateCoachWeeklyDataClient(userId) {
  if (!userId || !db) {
    return emptyWeeklySummary();
  }

  // 1. The last seven local calendar days (ISO keys like "2026-11-13").
  const weekStartMilliseconds = Date.now() - SEVEN_DAYS_IN_MS;
  const weekStartDateKey = calendarDayAsIsoKey(new Date(weekStartMilliseconds));

  // 2. Food totals for days that actually have calories or protein.
  const daysWithFood = await loadNutritionTotalsByDay(userId, weekStartDateKey);
  const nutritionAnalysis = buildNutritionAnalysisFromLoggedDays(daysWithFood);

  // 3. Workout days + total volume from completedWorkouts + dailyLogs.
  const workoutAnalysis = await loadWorkoutWeekSummary(userId, weekStartMilliseconds);

  // 4. Average sleep (dailyLogs first, old daily_tracking second).
  const sleepAnalysis = await loadSleepWeekSummary(userId);

  return { nutritionAnalysis, workoutAnalysis, sleepAnalysis };
}

// ===== PLUMBING — skip unless debugging =====

function emptyWeeklySummary() {
  return {
    nutritionAnalysis: null,
    workoutAnalysis: null,
    sleepAnalysis: null,
  };
}

function parseAsFiniteNumber(value) {
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    return asNumber;
  }
  return null;
}

function keepOnlyFiniteNumbers(valueList) {
  const safeList = valueList || [];
  const finiteOnly = [];
  for (let valueIndex = 0; valueIndex < safeList.length; valueIndex += 1) {
    const oneValue = safeList[valueIndex];
    if (Number.isFinite(oneValue)) {
      finiteOnly.push(oneValue);
    }
  }
  return finiteOnly;
}

function averageOfNumbers(valueList) {
  const finiteValues = keepOnlyFiniteNumbers(valueList);
  if (!finiteValues.length) {
    return null;
  }

  let runningTotal = 0;
  for (let valueIndex = 0; valueIndex < finiteValues.length; valueIndex += 1) {
    runningTotal += finiteValues[valueIndex];
  }
  return runningTotal / finiteValues.length;
}

function calendarDayAsIsoKey(dateInput = new Date()) {
  let dateObject = dateInput;
  if (!(dateInput instanceof Date)) {
    dateObject = new Date(dateInput);
  }

  const year = dateObject.getFullYear();
  const month = String(dateObject.getMonth() + 1).padStart(2, '0');
  const day = String(dateObject.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isoKeysForTodayAndSixDaysBefore() {
  const unsortedKeys = [];
  for (let daysAgo = 0; daysAgo < DAYS_IN_WEEK; daysAgo += 1) {
    const dayDate = new Date();
    dayDate.setDate(dayDate.getDate() - daysAgo);
    unsortedKeys.push(calendarDayAsIsoKey(dayDate));
  }

  unsortedKeys.sort();
  return unsortedKeys;
}

function addFoodRowOntoDayTotals(totalsByDay, dayKey, rowData) {
  if (!dayKey) {
    return;
  }

  if (!totalsByDay[dayKey]) {
    totalsByDay[dayKey] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  totalsByDay[dayKey].calories += Number(rowData.calories) || 0;
  totalsByDay[dayKey].protein += Number(rowData.protein) || 0;
  totalsByDay[dayKey].carbs += Number(rowData.carbs) || 0;
  totalsByDay[dayKey].fat += Number(rowData.fat) || 0;
}

function mergeNutritionDocumentsIntoDayMap(documents, startDateKey, totalsByDay) {
  for (let docIndex = 0; docIndex < documents.length; docIndex += 1) {
    const logDocument = documents[docIndex];
    const rowData = logDocument.data() || {};
    const dayKey = rowData.date;

    if (!dayKey) {
      continue;
    }
    if (dayKey < startDateKey) {
      continue;
    }

    addFoodRowOntoDayTotals(totalsByDay, dayKey, rowData);
  }
}

async function readAllNutritionRowsThenFilterByDate(userId, fieldName, startDateKey, totalsByDay) {
  try {
    const snapshot = await getDocs(
      query(collection(db, NUTRITION_LOGS_COLLECTION), where(fieldName, '==', userId)),
    );
    mergeNutritionDocumentsIntoDayMap(snapshot.docs, startDateKey, totalsByDay);
  } catch (ignoredError) {
    /* ignore */
  }
}

async function readNutritionRowsForUserSinceDate(userId, fieldName, startDateKey, totalsByDay) {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, NUTRITION_LOGS_COLLECTION),
        where(fieldName, '==', userId),
        where(DATE_FIELD, '>=', startDateKey),
      ),
    );
    mergeNutritionDocumentsIntoDayMap(snapshot.docs, startDateKey, totalsByDay);
  } catch (ignoredError) {
    await readAllNutritionRowsThenFilterByDate(userId, fieldName, startDateKey, totalsByDay);
  }
}

function foldOneLegacyNutritionDoc(logDocument, startDateKey, totalsByDay) {
  const rowData = logDocument.data() || {};
  // Legacy rows sometimes stored the day as the document id instead of a date field.
  const dayKey = rowData.date || logDocument.id;
  if (dayKey < startDateKey) {
    return;
  }

  const dayTotals = rowData.dayTotals || rowData.totals || rowData;
  addFoodRowOntoDayTotals(totalsByDay, dayKey, dayTotals);
}

async function mergeLegacyNutritionLogsIntoDayMap(userId, startDateKey, totalsByDay) {
  try {
    const legacySnapshot = await getDocs(
      collection(db, USERS_COLLECTION, userId, LEGACY_NUTRITION_LOGS_COLLECTION),
    );
    const legacyDocs = legacySnapshot.docs;
    for (let docIndex = 0; docIndex < legacyDocs.length; docIndex += 1) {
      foldOneLegacyNutritionDoc(legacyDocs[docIndex], startDateKey, totalsByDay);
    }
  } catch (ignoredError) {
    /* ignore — legacy path is best-effort */
  }
}

function daysWithCaloriesOrProtein(totalsByDay) {
  const loggedDayTotals = [];
  const dayKeys = Object.keys(totalsByDay);

  for (let keyIndex = 0; keyIndex < dayKeys.length; keyIndex += 1) {
    const dayKey = dayKeys[keyIndex];
    const dayTotals = totalsByDay[dayKey];
    const hasCalories = dayTotals.calories > 0;
    const hasProtein = dayTotals.protein > 0;
    if (!hasCalories && !hasProtein) {
      continue;
    }
    loggedDayTotals.push(dayTotals);
  }

  return loggedDayTotals;
}

async function loadNutritionTotalsByDay(userId, startDateKey) {
  const totalsByDay = {};

  // 1. Newer top-level nutrition_logs (both user id spellings).
  for (let fieldIndex = 0; fieldIndex < USER_ID_FIELDS.length; fieldIndex += 1) {
    const fieldName = USER_ID_FIELDS[fieldIndex];
    await readNutritionRowsForUserSinceDate(userId, fieldName, startDateKey, totalsByDay);
  }

  // 2. Older nested nutritionLogs under the user doc.
  await mergeLegacyNutritionLogsIntoDayMap(userId, startDateKey, totalsByDay);

  // 3. Drop days that only have zeros so averages are not diluted.
  return daysWithCaloriesOrProtein(totalsByDay);
}

function completedTimestampAsMilliseconds(completedAt) {
  if (!completedAt) {
    return null;
  }
  if (typeof completedAt.toMillis === 'function') {
    return completedAt.toMillis();
  }
  if (completedAt.seconds) {
    return completedAt.seconds * MS_PER_SECOND;
  }
  return null;
}

function dailyLogRowShowsAWorkout(rowData) {
  const hasWorkoutLog = Array.isArray(rowData.workoutLog) && rowData.workoutLog.length > 0;
  if (hasWorkoutLog) {
    return true;
  }
  if (rowData.dashboard_workouts) {
    return true;
  }
  if (rowData.dashboard_workout_name) {
    return true;
  }
  return false;
}

function countCompletedWorkoutTowardWeek(workoutDocument, startMs, sessionDays, volumeList) {
  const rowData = workoutDocument.data() || {};
  const completedAtMs = completedTimestampAsMilliseconds(rowData.completedAt);

  if (completedAtMs == null) {
    return;
  }
  if (completedAtMs < startMs) {
    return;
  }

  const sessionDayKey = calendarDayAsIsoKey(new Date(completedAtMs));
  sessionDays.add(sessionDayKey);

  const volume = parseAsFiniteNumber(rowData.totalVolume);
  if (volume != null) {
    volumeList.push(volume);
  }
}

async function markWorkoutDayFromDailyLog(userId, dateKey, sessionDays) {
  try {
    const snapshot = await getDoc(doc(db, USERS_COLLECTION, userId, DAILY_LOGS_COLLECTION, dateKey));
    if (!snapshot.exists()) {
      return;
    }

    const rowData = snapshot.data() || {};
    if (!dailyLogRowShowsAWorkout(rowData)) {
      return;
    }

    sessionDays.add(dateKey);
  } catch (ignoredError) {
    /* ignore */
  }
}

// ?? keeps a logged 0 hours. || would treat 0 as missing and look at the next field.
function sleepHoursFromDailyLogRow(rowData) {
  const fromDashboard = parseAsFiniteNumber(rowData.dashboard_sleep);
  if (fromDashboard != null) {
    return fromDashboard;
  }

  const fromSnakeCase = parseAsFiniteNumber(rowData.sleep_hours);
  if (fromSnakeCase != null) {
    return fromSnakeCase;
  }

  return parseAsFiniteNumber(rowData.sleepHours);
}

async function readSleepHoursFromDailyLogDoc(userId, dateKey) {
  try {
    const logSnapshot = await getDoc(doc(db, USERS_COLLECTION, userId, DAILY_LOGS_COLLECTION, dateKey));
    if (!logSnapshot.exists()) {
      return null;
    }
    return sleepHoursFromDailyLogRow(logSnapshot.data() || {});
  } catch (ignoredError) {
    return null;
  }
}

async function readSleepHoursFromLegacyTrackingDoc(userId, dateKey) {
  try {
    // TODO(phase-5): remove legacy daily_tracking fallback after backfill
    const trackingSnapshot = await getDoc(
      doc(db, USERS_COLLECTION, userId, LEGACY_DAILY_TRACKING_COLLECTION, dateKey),
    );
    if (!trackingSnapshot.exists()) {
      return null;
    }

    const trackingData = trackingSnapshot.data() || {};
    return parseAsFiniteNumber(trackingData.sleepHours);
  } catch (ignoredError) {
    return null;
  }
}

async function sleepHoursForOneCalendarDay(userId, dateKey) {
  const fromDailyLog = await readSleepHoursFromDailyLogDoc(userId, dateKey);
  if (fromDailyLog != null) {
    return fromDailyLog;
  }
  return readSleepHoursFromLegacyTrackingDoc(userId, dateKey);
}

function sumVolumeList(volumeList) {
  if (!volumeList.length) {
    return null;
  }

  let volumeSum = 0;
  for (let volumeIndex = 0; volumeIndex < volumeList.length; volumeIndex += 1) {
    volumeSum += volumeList[volumeIndex];
  }
  return volumeSum;
}

function volumeTrendLabelForSessionCount(sessionsLogged) {
  if (sessionsLogged > 0) {
    return VOLUME_TREND_LOGGED;
  }
  return VOLUME_TREND_NONE;
}

async function loadWorkoutWeekSummary(userId, startMs) {
  const sessionDays = new Set();
  const volumeList = [];

  try {
    const snapshot = await getDocs(
      query(
        collection(db, COMPLETED_WORKOUTS_COLLECTION),
        where(COMPLETED_WORKOUT_USER_FIELD, '==', userId),
      ),
    );
    const workoutDocs = snapshot.docs;

    for (let docIndex = 0; docIndex < workoutDocs.length; docIndex += 1) {
      countCompletedWorkoutTowardWeek(workoutDocs[docIndex], startMs, sessionDays, volumeList);
    }
  } catch (ignoredError) {
    /* ignore */
  }

  const dateKeysThisWeek = isoKeysForTodayAndSixDaysBefore();
  for (let dayIndex = 0; dayIndex < dateKeysThisWeek.length; dayIndex += 1) {
    const dateKey = dateKeysThisWeek[dayIndex];
    await markWorkoutDayFromDailyLog(userId, dateKey, sessionDays);
  }

  const sessionsLogged = sessionDays.size;
  if (!sessionsLogged) {
    return null;
  }

  const totalVolume = sumVolumeList(volumeList);
  const volumeTrend = volumeTrendLabelForSessionCount(sessionsLogged);

  return {
    sessionsLogged,
    totalVolume,
    avgRPE: null,
    volumeTrend,
  };
}

async function loadSleepWeekSummary(userId) {
  const sleepHoursList = [];
  const dateKeysThisWeek = isoKeysForTodayAndSixDaysBefore();

  for (let dayIndex = 0; dayIndex < dateKeysThisWeek.length; dayIndex += 1) {
    const dateKey = dateKeysThisWeek[dayIndex];
    const hours = await sleepHoursForOneCalendarDay(userId, dateKey);
    if (hours != null) {
      sleepHoursList.push(hours);
    }
  }

  if (!sleepHoursList.length) {
    return null;
  }

  const avgHours = averageOfNumbers(sleepHoursList);
  const isDepleted = avgHours != null && avgHours < SLEEP_DEPLETED_UNDER_HOURS;

  return {
    avgHours,
    quality: null,
    isDepleted,
  };
}

function buildNutritionAnalysisFromLoggedDays(nutritionDays) {
  const daysLogged = nutritionDays.length;
  if (!daysLogged) {
    return null;
  }

  const calorieList = [];
  const proteinList = [];
  const carbsList = [];
  const fatList = [];

  for (let dayIndex = 0; dayIndex < nutritionDays.length; dayIndex += 1) {
    const dayTotals = nutritionDays[dayIndex];
    calorieList.push(dayTotals.calories);
    proteinList.push(dayTotals.protein);
    carbsList.push(dayTotals.carbs);
    fatList.push(dayTotals.fat);
  }

  return {
    avgDailyCalories: averageOfNumbers(calorieList),
    avgProtein: averageOfNumbers(proteinList),
    avgCarbs: averageOfNumbers(carbsList),
    avgFat: averageOfNumbers(fatList),
    daysLogged,
    consistencyScore: Math.round((daysLogged / DAYS_IN_WEEK) * 100),
  };
}
