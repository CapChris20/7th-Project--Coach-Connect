// The only writer for a client's daily metrics. Canonical home: users/{uid}/dailyLogs/{date}.
// Flow: every save funnels through mergeClientDailyMetrics → merge-write dailyLogs → mirror legacy daily_tracking.
// Used by dashboard cards and the AI coach log/delete tools. Shape translation lives in readDailyStats.js.
// Read order: re-exports → constants → small helpers → write recipes → PLUMBING refs and delete helpers.

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
const EMPTY_WORKOUT_NAME = '';

// Adding a deletable metric means adding a row here. `workout` and `restDay` clear the same fields.
// Freeze: logType keys and Firestore field letters must stay exactly as written.
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

/**
 * Use the caller's date key, or today's local key when none was passed.
 * @param {string} [dateKey]
 * @returns {string}
 */
function resolvedDateKey(dateKey) {
  if (dateKey) {
    return dateKey;
  }
  return getLocalDateKey();
}

/**
 * @param {string} userId
 * @param {string} dateKey
 * @returns {object}
 */
function dailyLogsRef(userId, dateKey) {
  return doc(db, USERS_COLLECTION, userId, DAILY_LOGS_SUBCOLLECTION, dateKey);
}

/**
 * @param {string} userId
 * @param {string} dateKey
 * @returns {object}
 */
function dailyTrackingRef(userId, dateKey) {
  return doc(db, USERS_COLLECTION, userId, DAILY_TRACKING_SUBCOLLECTION, dateKey);
}

// ===== MAIN FUNCTION =====

/**
 * One-time legacy read. Prefer the live dailyLogs listener.
 * @param {string} userId
 * @param {string} [dateKey]
 * @returns {Promise<object|null>}
 */
export async function fetchLegacyDailyTrackingSnap(userId, dateKey) {
  // 1. Need a user and Firestore.
  if (!userId) {
    return null;
  }
  if (!db) {
    return null;
  }

  // 2. Read the camelCase daily_tracking doc for that day.
  const dayKey = resolvedDateKey(dateKey);
  const trackingRef = dailyTrackingRef(userId, dayKey);
  return getDoc(trackingRef);
}

/**
 * Merge into dailyLogs and mirror into daily_tracking when the mirror has fields.
 * @param {string} userId
 * @param {string} [dateKey]
 * @param {{ logs?: object, tracking?: object }} [patch]
 * @returns {Promise<void>}
 */
export async function mergeClientDailyMetrics(userId, dateKey, { logs = {}, tracking = {} } = {}) {
  // 1. Need a user and Firestore.
  if (!userId) {
    return;
  }
  if (!db) {
    return;
  }

  const dayKey = resolvedDateKey(dateKey);

  // 2. Always touch dailyLogs first with a server timestamp.
  // vocab: serverTimestamp() = Firestore fills the clock on the server, not the phone
  const logsPatch = Object.assign({}, logs, { updatedAt: serverTimestamp() });
  await setDoc(dailyLogsRef(userId, dayKey), logsPatch, { merge: true });

  // 3. Build tracking mirror from dashboard keys, then overlay explicit tracking overrides.
  const trackingFromLogs = trackingMirrorFromLogs(logs);
  const trackingMirror = Object.assign({}, trackingFromLogs, tracking);
  const trackingKeyCount = Object.keys(trackingMirror).length;
  if (trackingKeyCount === 0) {
    return;
  }

  // 4. Merge-write the legacy daily_tracking doc so older readers still see the numbers.
  const trackingPatch = Object.assign({}, trackingMirror, { updatedAt: serverTimestamp() });
  await setDoc(dailyTrackingRef(userId, dayKey), trackingPatch, { merge: true });
}

/**
 * Save one dashboard_* field from a dashboard card.
 * @param {string} userId
 * @param {string} storageKey
 * @param {*} value
 * @param {string} [dateKey]
 * @returns {Promise<void>}
 */
export async function saveDashboardMetricField(userId, storageKey, value, dateKey) {
  // 1. One-field patch through the shared merge writer.
  const logsPatch = {};
  logsPatch[storageKey] = value;
  await mergeClientDailyMetrics(userId, dateKey, { logs: logsPatch });
}

/**
 * Save the structured workout log and the legacy summary string.
 * @param {string} userId
 * @param {{ workoutName: *, workoutLog: Array, dashboard_workouts: * }} payload
 * @param {string} [dateKey]
 * @returns {Promise<void>}
 */
export async function saveDashboardWorkoutLog(
  userId,
  { workoutName, workoutLog, dashboard_workouts },
  dateKey,
) {
  // 1. Pack both document shapes so dailyLogs and daily_tracking stay in sync.
  let workoutLogRows = [];
  if (workoutLog) {
    workoutLogRows = workoutLog;
  }
  let workoutNameForLogs = null;
  if (workoutName) {
    workoutNameForLogs = workoutName;
  }
  let workoutsSummaryForLogs = null;
  if (dashboard_workouts) {
    workoutsSummaryForLogs = dashboard_workouts;
  }

  const logsPatch = {
    workoutLog: workoutLogRows,
    dashboard_workout_name: workoutNameForLogs,
    dashboard_workouts: workoutsSummaryForLogs,
  };
  const trackingPatch = {
    workoutName: workoutNameForLogs,
    workoutSummary: workoutsSummaryForLogs,
    workoutExercises: legacyExercisesFromWorkoutLog(workoutLog),
  };

  // 2. One merge write for both docs.
  await mergeClientDailyMetrics(userId, dateKey, {
    logs: logsPatch,
    tracking: trackingPatch,
  });
}

/**
 * Sleep hours, stored as a number in both docs.
 * @param {string} userId
 * @param {number|string} hours
 * @param {string} [dateKey]
 * @returns {Promise<void>}
 */
export async function saveDashboardSleepHours(userId, hours, dateKey) {
  // 1. Coerce to number, then write both shapes.
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
 * @returns {Promise<void>}
 */
export async function saveDashboardWaterOz(userId, amountOz, dateKey) {
  // 1. Refuse zero / NaN so we never wipe water with a bad tap.
  const waterOunces = Number(amountOz);
  if (!Number.isFinite(waterOunces)) {
    return;
  }
  if (waterOunces <= 0) {
    return;
  }

  // 2. String on dailyLogs, number on tracking — that split is intentional.
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
 * @returns {Promise<void>}
 */
export async function clearClientDailyMetric(userId, logType, dateKey) {
  // 1. Look up which fields this log type owns.
  const clearConfig = DAILY_METRIC_CLEAR[logType];
  if (!clearConfig) {
    throw new Error(`Unknown log type: ${logType}`);
  }
  if (!userId) {
    throw new Error(`Unknown log type: ${logType}`);
  }
  if (!db) {
    throw new Error(`Unknown log type: ${logType}`);
  }

  const dayKey = resolvedDateKey(dateKey);

  // 2. Delete fields on both dailyLogs and daily_tracking via Firestore deleteField().
  // vocab: deleteField() = sentinel that removes the key on merge write (not null)
  await mergeClientDailyMetrics(userId, dayKey, {
    logs: deleteFieldPatch(clearConfig.logs),
    tracking: deleteFieldPatch(clearConfig.tracking),
  });

  // 3. Drop the optional per-metric history row when this type keeps one.
  if (!clearConfig.sub) {
    return;
  }
  await deleteHistoryRowIfPresent(userId, clearConfig.sub, dayKey);
}

// ===== PLUMBING — skip unless paths or deleteField patches are wrong =====

/**
 * @param {string[]} fieldNames
 * @returns {object}
 */
function deleteFieldPatch(fieldNames) {
  const patch = {};
  for (let index = 0; index < fieldNames.length; index += 1) {
    const fieldName = fieldNames[index];
    patch[fieldName] = deleteField();
  }
  return patch;
}

/**
 * Best-effort delete of users/{uid}/{sub}/{date}. Failures are non-fatal.
 * @param {string} userId
 * @param {string} subcollection
 * @param {string} dateKey
 * @returns {Promise<void>}
 */
async function deleteHistoryRowIfPresent(userId, subcollection, dateKey) {
  try {
    const historyRef = doc(db, USERS_COLLECTION, userId, subcollection, dateKey);
    await deleteDoc(historyRef);
  } catch (ignoredError) {
    /* non-fatal — the main metric clear already succeeded */
  }
}

/**
 * Prefer exerciseName; fall back to name. Empty string when neither is set.
 * @param {object} exerciseRow
 * @returns {string}
 */
function exerciseNameFromWorkoutLogRow(exerciseRow) {
  if (exerciseRow.exerciseName) {
    return exerciseRow.exerciseName;
  }
  if (exerciseRow.name) {
    return exerciseRow.name;
  }
  return EMPTY_WORKOUT_NAME;
}

/**
 * Truthy sets only — matches the prior save path (not Array.isArray).
 * @param {object} exerciseRow
 * @returns {Array}
 */
function truthySetsFromWorkoutLogRow(exerciseRow) {
  if (!exerciseRow.sets) {
    return [];
  }
  return exerciseRow.sets;
}

/**
 * One workoutLog row → one legacy workoutExercises entry.
 * @param {object} exerciseRow
 * @returns {{ name: string, sets: Array }}
 */
function legacyExerciseFromWorkoutLogRow(exerciseRow) {
  return {
    name: exerciseNameFromWorkoutLogRow(exerciseRow),
    sets: truthySetsFromWorkoutLogRow(exerciseRow),
  };
}

/**
 * Workout logger rows → legacy workoutExercises shape (name + sets).
 * @param {Array|null|undefined} workoutLog
 * @returns {Array}
 */
function legacyExercisesFromWorkoutLog(workoutLog) {
  let rows = [];
  if (workoutLog) {
    rows = workoutLog;
  }
  const legacyExercises = [];
  for (let index = 0; index < rows.length; index += 1) {
    legacyExercises.push(legacyExerciseFromWorkoutLogRow(rows[index]));
  }
  return legacyExercises;
}
