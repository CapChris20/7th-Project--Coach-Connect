// Reads the last 7 days of food, workouts, and sleep so the coach can talk about the week.
// Flow: sum nutrition by day → count workout days and volume → average sleep →
//       return the three summaries (or null when that slice is empty).
// Used by loadYourWeekForCoach when the coach prompt needs the client's recent numbers.

import { db } from '../../app-start/cloudConnection';
// vocab: collection/doc point at Firestore paths. query+where filter. getDocs/getDoc read once.
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
const MS_PER_DAY = 24 * 60 * 60 * 1000;
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

// ===== HELPER FUNCTIONS =====

/**
 * @param {*} value
 * @returns {number|null}
 */
function toFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

/**
 * Average of the finite numbers. Null when there are none.
 * @param {Array<number|null>} values
 * @returns {number|null}
 */
function mean(values) {
  const finiteValues = (values || []).filter((value) => Number.isFinite(value));
  if (!finiteValues.length) return null;
  const total = finiteValues.reduce((sum, value) => sum + value, 0);
  return total / finiteValues.length;
}

/**
 * Local calendar day as YYYY-MM-DD. This matches the dailyLogs document id.
 * @param {Date|string|number} [dateValue]
 * @returns {string}
 */
function isoDateKey(dateValue = new Date()) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Today and the six days before it, oldest first.
 * @returns {string[]}
 */
function last7DateKeys() {
  const dateKeys = [];
  for (let daysAgo = 0; daysAgo < DAYS_IN_WEEK; daysAgo += 1) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    dateKeys.push(isoDateKey(date));
  }
  return dateKeys.sort();
}

/**
 * Add one food row onto that day's running totals. Missing day is ignored.
 * @param {object} totalsByDay
 * @param {string} day
 * @param {object} data
 */
function addToDayMap(totalsByDay, day, data) {
  if (!day) return;
  if (!totalsByDay[day]) {
    totalsByDay[day] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }
  totalsByDay[day].calories += Number(data.calories) || 0;
  totalsByDay[day].protein += Number(data.protein) || 0;
  totalsByDay[day].carbs += Number(data.carbs) || 0;
  totalsByDay[day].fat += Number(data.fat) || 0;
}

/**
 * @param {Array} documents
 * @param {string} startDateKey
 * @param {object} totalsByDay
 */
function addNutritionDocumentsOnOrAfter(documents, startDateKey, totalsByDay) {
  documents.forEach((logDocument) => {
    const data = logDocument.data() || {};
    const day = data.date;
    if (day && day >= startDateKey) addToDayMap(totalsByDay, day, data);
  });
}

/**
 * The date filter needs a composite index. If that index is missing, read the user's
 * rows and drop old days in memory. A second failure is ignored so one field spelling
 * cannot wipe the other.
 * @param {string} userId
 * @param {string} fieldName
 * @param {string} startDateKey
 * @param {object} totalsByDay
 */
async function readNutritionLogsWithoutDateFilter(userId, fieldName, startDateKey, totalsByDay) {
  try {
    const snapshot = await getDocs(
      query(collection(db, NUTRITION_LOGS_COLLECTION), where(fieldName, '==', userId)),
    );
    addNutritionDocumentsOnOrAfter(snapshot.docs, startDateKey, totalsByDay);
  } catch (ignoredError) {
    /* ignore */
  }
}

/**
 * @param {string} userId
 * @param {string} fieldName
 * @param {string} startDateKey
 * @param {object} totalsByDay
 */
async function readNutritionLogsForUserField(userId, fieldName, startDateKey, totalsByDay) {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, NUTRITION_LOGS_COLLECTION),
        where(fieldName, '==', userId),
        where(DATE_FIELD, '>=', startDateKey),
      ),
    );
    addNutritionDocumentsOnOrAfter(snapshot.docs, startDateKey, totalsByDay);
  } catch (ignoredError) {
    await readNutritionLogsWithoutDateFilter(userId, fieldName, startDateKey, totalsByDay);
  }
}

/**
 * Days that actually have calories or protein. Empty days are not "logged."
 * @param {string} userId
 * @param {string} startDateKey
 * @returns {Promise<object[]>}
 */
async function fetchNutritionDays(userId, startDateKey) {
  const totalsByDay = {};

  for (const fieldName of USER_ID_FIELDS) {
    await readNutritionLogsForUserField(userId, fieldName, startDateKey, totalsByDay);
  }

  try {
    const legacySnapshot = await getDocs(
      collection(db, USERS_COLLECTION, userId, LEGACY_NUTRITION_LOGS_COLLECTION),
    );
    legacySnapshot.docs.forEach((logDocument) => {
      const data = logDocument.data() || {};
      // Legacy rows sometimes stored the day as the document id instead of a date field.
      const day = data.date || logDocument.id;
      if (day < startDateKey) return;
      addToDayMap(totalsByDay, day, data.dayTotals || data.totals || data);
    });
  } catch (ignoredError) {
    /* ignore */
  }

  return Object.entries(totalsByDay)
    .filter(([, dayTotals]) => dayTotals.calories > 0 || dayTotals.protein > 0)
    .map(([, dayTotals]) => dayTotals);
}

/**
 * Firestore Timestamp, or the older { seconds } shape, as milliseconds.
 * @param {*} completedAt
 * @returns {number|null}
 */
function completedAtToMilliseconds(completedAt) {
  // vocab: toMillis() = Firestore Timestamp → milliseconds
  if (completedAt?.toMillis) return completedAt.toMillis();
  if (completedAt?.seconds) return completedAt.seconds * 1000;
  return null;
}

/**
 * @param {object} data
 * @returns {boolean}
 */
function dailyLogHasWorkout(data) {
  return (
    (Array.isArray(data.workoutLog) && data.workoutLog.length > 0) ||
    Boolean(data.dashboard_workouts) ||
    Boolean(data.dashboard_workout_name)
  );
}

/**
 * Workout days come from completedWorkouts plus any dailyLogs row that has a workout.
 * A day can show up in both; the Set keeps it as one session.
 * @param {string} userId
 * @param {number} startMs
 * @returns {Promise<object|null>}
 */
async function fetchWorkoutAnalysis(userId, startMs) {
  const sessionDays = new Set();
  const volumes = [];

  try {
    const snapshot = await getDocs(
      query(
        collection(db, COMPLETED_WORKOUTS_COLLECTION),
        where(COMPLETED_WORKOUT_USER_FIELD, '==', userId),
      ),
    );
    snapshot.docs.forEach((workoutDocument) => {
      const data = workoutDocument.data() || {};
      const completedAtMs = completedAtToMilliseconds(data.completedAt);
      if (completedAtMs == null || completedAtMs < startMs) return;
      sessionDays.add(isoDateKey(new Date(completedAtMs)));
      const volume = toFiniteNumber(data.totalVolume);
      if (volume != null) volumes.push(volume);
    });
  } catch (ignoredError) {
    /* ignore */
  }

  for (const dateKey of last7DateKeys()) {
    try {
      const snapshot = await getDoc(doc(db, USERS_COLLECTION, userId, DAILY_LOGS_COLLECTION, dateKey));
      if (!snapshot.exists()) continue;
      const data = snapshot.data() || {};
      if (dailyLogHasWorkout(data)) sessionDays.add(dateKey);
    } catch (ignoredError) {
      /* ignore */
    }
  }

  const sessionsLogged = sessionDays.size;
  if (!sessionsLogged) return null;

  return {
    sessionsLogged,
    totalVolume: volumes.length ? volumes.reduce((sum, value) => sum + value, 0) : null,
    avgRPE: null,
    volumeTrend: sessionsLogged > 0 ? VOLUME_TREND_LOGGED : VOLUME_TREND_NONE,
  };
}

/**
 * Sleep prefers dailyLogs. The old daily_tracking doc is only opened when that day has no hours.
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function fetchSleepAnalysis(userId) {
  const sleepHours = [];

  for (const dateKey of last7DateKeys()) {
    let hours = null;
    try {
      const logSnapshot = await getDoc(doc(db, USERS_COLLECTION, userId, DAILY_LOGS_COLLECTION, dateKey));
      if (logSnapshot.exists()) {
        const data = logSnapshot.data() || {};
        hours =
          toFiniteNumber(data.dashboard_sleep) ??
          toFiniteNumber(data.sleep_hours) ??
          toFiniteNumber(data.sleepHours);
      }
    } catch (ignoredError) {
      /* ignore */
    }
    if (hours == null) {
      try {
        // TODO(phase-5): remove legacy daily_tracking fallback after backfill
        const trackingSnapshot = await getDoc(
          doc(db, USERS_COLLECTION, userId, LEGACY_DAILY_TRACKING_COLLECTION, dateKey),
        );
        if (trackingSnapshot.exists()) hours = toFiniteNumber(trackingSnapshot.data()?.sleepHours);
      } catch (ignoredError) {
        /* ignore */
      }
    }
    if (hours != null) sleepHours.push(hours);
  }

  if (!sleepHours.length) return null;
  const avgHours = mean(sleepHours);
  return {
    avgHours,
    quality: null,
    isDepleted: avgHours != null && avgHours < SLEEP_DEPLETED_UNDER_HOURS,
  };
}

/**
 * @returns {{ nutritionAnalysis: null, workoutAnalysis: null, sleepAnalysis: null }}
 */
function emptyWeeklySummary() {
  return {
    nutritionAnalysis: null,
    workoutAnalysis: null,
    sleepAnalysis: null,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Seven-day nutrition, workout, and sleep summaries for one user.
 * Matches the shape the server builds in coachWeeklyData.
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function aggregateCoachWeeklyDataClient(userId) {
  if (!userId || !db) return emptyWeeklySummary();

  const startMs = Date.now() - SEVEN_DAYS_IN_MS;
  const startDateKey = isoDateKey(new Date(startMs));
  const nutritionDays = await fetchNutritionDays(userId, startDateKey);
  const daysLogged = nutritionDays.length;

  const nutritionAnalysis = daysLogged
    ? {
        avgDailyCalories: mean(nutritionDays.map((dayTotals) => dayTotals.calories)),
        avgProtein: mean(nutritionDays.map((dayTotals) => dayTotals.protein)),
        avgCarbs: mean(nutritionDays.map((dayTotals) => dayTotals.carbs)),
        avgFat: mean(nutritionDays.map((dayTotals) => dayTotals.fat)),
        daysLogged,
        consistencyScore: Math.round((daysLogged / DAYS_IN_WEEK) * 100),
      }
    : null;

  const workoutAnalysis = await fetchWorkoutAnalysis(userId, startMs);
  const sleepAnalysis = await fetchSleepAnalysis(userId);

  return { nutritionAnalysis, workoutAnalysis, sleepAnalysis };
}
