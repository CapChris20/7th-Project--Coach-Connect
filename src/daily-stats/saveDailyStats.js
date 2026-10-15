// The only writer for a client's daily metrics. Canonical home: users/{uid}/dailyLogs/{date}.
// Flow: every save funnels through mergeClientDailyMetrics → merge-write dailyLogs → mirror legacy daily_tracking.
// Used by dashboard cards and the AI coach log/delete tools. Shape translation lives in readDailyStats.js.

import { deleteField, deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';
import { getLocalDateKey } from '../helpers/getLocalDay';

const {
  trackingMirrorFromLogs,
  parseDailyMetricsFromSnapshots,
  buildWorkoutLogHydration,
} = require('./readDailyStats');

export { getLocalDateKey as getClientDateKey };
export { parseDailyMetricsFromSnapshots, buildWorkoutLogHydration };

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const DAILY_LOGS_SUBCOLLECTION = 'dailyLogs';
const DAILY_TRACKING_SUBCOLLECTION = 'daily_tracking';

// Adding a deletable metric means adding a row here. `workout` and `restDay` clear the same fields.
const DAILY_METRIC_CLEAR = {
  sleep: { logs: ['dashboard_sleep'], tracking: ['sleepHours'], sub: 'sleep_logs' },
  water: { logs: ['dashboard_water'], tracking: ['waterIntake'], sub: 'water_logs' },
  steps: { logs: ['dashboard_steps'], tracking: ['steps'], sub: 'step_logs' },
  energy: { logs: ['dashboard_energy'], tracking: ['energyLevel'], sub: 'energy_logs' },
  mood: { logs: ['dashboard_mood'], tracking: ['mood'], sub: 'mood_logs' },
  workout: {
    logs: ['dashboard_workout_name', 'dashboard_workouts', 'workoutLog'],
    tracking: ['workoutName', 'workoutSummary', 'workoutExercises'],
    sub: 'workout_ratings',
  },
  restDay: {
    logs: ['dashboard_workout_name', 'dashboard_workouts', 'workoutLog'],
    tracking: ['workoutName', 'workoutSummary', 'workoutExercises'],
    sub: 'workout_ratings',
  },
};

// ===== HELPER FUNCTIONS =====

function dailyLogsRef(userId, dateKey) {
  return doc(db, USERS_COLLECTION, userId, DAILY_LOGS_SUBCOLLECTION, dateKey);
}

function dailyTrackingRef(userId, dateKey) {
  return doc(db, USERS_COLLECTION, userId, DAILY_TRACKING_SUBCOLLECTION, dateKey);
}

function deleteFieldPatch(fieldNames) {
  const patch = {};
  for (const fieldName of fieldNames) patch[fieldName] = deleteField();
  return patch;
}

async function deleteHistoryRowIfPresent(userId, subcollection, dateKey) {
  try {
    await deleteDoc(doc(db, USERS_COLLECTION, userId, subcollection, dateKey));
  } catch (ignoredError) {
    /* non-fatal */
  }
}

function legacyExercisesFromWorkoutLog(workoutLog) {
  return (workoutLog || []).map((exercise) => ({
    name: exercise.exerciseName || exercise.name || '',
    sets: exercise.sets || [],
  }));
}

function resolvedDateKey(dateKey) {
  return dateKey || getLocalDateKey();
}

// ===== MAIN FUNCTION =====

/**
 * One-time legacy read. Prefer the live dailyLogs listener.
 * @param {string} userId
 * @param {string} [dateKey]
 * @returns {Promise<object|null>}
 */
export async function fetchLegacyDailyTrackingSnap(userId, dateKey) {
  if (!userId || !db) return null;
  return getDoc(dailyTrackingRef(userId, resolvedDateKey(dateKey)));
}

/**
 * Merge into dailyLogs and mirror into daily_tracking when the mirror has fields.
 * @param {string} userId
 * @param {string} [dateKey]
 * @param {{ logs?: object, tracking?: object }} [patch]
 * @returns {Promise<void>}
 */
export async function mergeClientDailyMetrics(userId, dateKey, { logs = {}, tracking = {} } = {}) {
  if (!userId || !db) return;
  const dayKey = resolvedDateKey(dateKey);
  const logsPatch = { ...logs, updatedAt: serverTimestamp() };
  await setDoc(dailyLogsRef(userId, dayKey), logsPatch, { merge: true });

  const mirror = { ...trackingMirrorFromLogs(logs), ...tracking };
  if (Object.keys(mirror).length === 0) return;
  await setDoc(
    dailyTrackingRef(userId, dayKey),
    { ...mirror, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Save one dashboard_* field from a dashboard card.
 * @param {string} userId
 * @param {string} storageKey
 * @param {*} value
 * @param {string} [dateKey]
 */
export async function saveDashboardMetricField(userId, storageKey, value, dateKey) {
  await mergeClientDailyMetrics(userId, dateKey, { logs: { [storageKey]: value } });
}

/**
 * Save the structured workout log and the legacy summary string.
 * @param {string} userId
 * @param {{ workoutName: *, workoutLog: Array, dashboard_workouts: * }} payload
 * @param {string} [dateKey]
 */
export async function saveDashboardWorkoutLog(
  userId,
  { workoutName, workoutLog, dashboard_workouts },
  dateKey,
) {
  const logs = {
    workoutLog: workoutLog || [],
    dashboard_workout_name: workoutName || null,
    dashboard_workouts: dashboard_workouts || null,
  };
  await mergeClientDailyMetrics(userId, dateKey, {
    logs,
    tracking: {
      workoutName: workoutName || null,
      workoutSummary: dashboard_workouts || null,
      workoutExercises: legacyExercisesFromWorkoutLog(workoutLog),
    },
  });
}

/**
 * Sleep hours, stored as a number in both docs.
 * @param {string} userId
 * @param {number|string} hours
 * @param {string} [dateKey]
 */
export async function saveDashboardSleepHours(userId, hours, dateKey) {
  const sleepHours = Number(hours);
  await mergeClientDailyMetrics(userId, dateKey, {
    logs: { dashboard_sleep: sleepHours },
    tracking: { sleepHours },
  });
}

/**
 * Water ounces. dailyLogs stores a string. The legacy mirror stores a number.
 * @param {string} userId
 * @param {number|string} amountOz
 * @param {string} [dateKey]
 */
export async function saveDashboardWaterOz(userId, amountOz, dateKey) {
  const waterOunces = Number(amountOz);
  if (!Number.isFinite(waterOunces) || waterOunces <= 0) return;
  await mergeClientDailyMetrics(userId, dateKey, {
    logs: { dashboard_water: String(waterOunces) },
    tracking: { waterIntake: waterOunces },
  });
}

/**
 * Clear one dashboard metric for a day. Throws when the type is unknown.
 * @param {string} userId
 * @param {string} logType
 * @param {string} [dateKey]
 */
export async function clearClientDailyMetric(userId, logType, dateKey) {
  const clearConfig = DAILY_METRIC_CLEAR[logType];
  if (!clearConfig || !userId || !db) throw new Error(`Unknown log type: ${logType}`);
  const dayKey = resolvedDateKey(dateKey);
  await mergeClientDailyMetrics(userId, dayKey, {
    logs: deleteFieldPatch(clearConfig.logs),
    tracking: deleteFieldPatch(clearConfig.tracking),
  });
  if (!clearConfig.sub) return;
  await deleteHistoryRowIfPresent(userId, clearConfig.sub, dayKey);
}
