/**
 * daily Metrics Service
 *
 * Purpose: Data/service layer: daily Metrics Service. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: fetchLegacyDailyTrackingSnap, mergeClientDailyMetrics, saveDashboardMetricField, saveDashboardWorkoutLog, saveDashboardSleepHours, saveDashboardWaterOz, clearClientDailyMetric
 *
 * @file-header
 */
/**
 * Canonical client daily metrics: `users/{uid}/dailyLogs/{date}`.
 * Mirrors home-screen fields into `daily_tracking` on write (legacy compat).
 */
import { deleteField, deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../app-start/config';
import { getLocalDateKey } from '../../shared-utils/getLocalDay';

const {
  trackingMirrorFromLogs,
  parseDailyMetricsFromSnapshots,
  buildWorkoutLogHydration,
} = require('./parseUserDailyMetrics');

export { getLocalDateKey as getClientDateKey };
export { parseDailyMetricsFromSnapshots, buildWorkoutLogHydration };

/** One-time legacy read — prefer live `dailyLogs` listener. TODO: remove after backfill. */
export async function fetchLegacyDailyTrackingSnap(userId, dateKey) {
  if (!userId || !db) return null;
  const key = dateKey || getLocalDateKey();
  return getDoc(doc(db, 'users', userId, 'daily_tracking', key));
}

/**
 * Merge into dailyLogs (canonical) and mirror into daily_tracking when needed.
 */
export async function mergeClientDailyMetrics(userId, dateKey, { logs = {}, tracking = {} } = {}) {
  if (!userId || !db) return;
  const key = dateKey || getLocalDateKey();
  const logsPatch = { ...logs, updatedAt: serverTimestamp() };

  await setDoc(doc(db, 'users', userId, 'dailyLogs', key), logsPatch, { merge: true });

  const mirror = { ...trackingMirrorFromLogs(logs), ...tracking };
  if (Object.keys(mirror).length > 0) {
    await setDoc(
      doc(db, 'users', userId, 'daily_tracking', key),
      { ...mirror, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
}

/** Save a single dashboard_* field from My Dashboard cards. */
export async function saveDashboardMetricField(userId, storageKey, value, dateKey) {
  await mergeClientDailyMetrics(userId, dateKey, { logs: { [storageKey]: value } });
}

/** Workout log save (structured + legacy summary string). */
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
      workoutExercises: (workoutLog || []).map((ex) => ({
        name: ex.exerciseName || ex.name || '',
        sets: ex.sets || [],
      })),
    },
  });
}

export async function saveDashboardSleepHours(userId, hours, dateKey) {
  const h = Number(hours);
  await mergeClientDailyMetrics(userId, dateKey, {
    logs: { dashboard_sleep: h },
    tracking: { sleepHours: h },
  });
}

export async function saveDashboardWaterOz(userId, amountOz, dateKey) {
  const oz = Number(amountOz);
  if (!Number.isFinite(oz) || oz <= 0) return;
  await mergeClientDailyMetrics(userId, dateKey, {
    logs: { dashboard_water: String(oz) },
    tracking: { waterIntake: oz },
  });
}

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

/** Clear a dashboard metric for a day (AI Coach deleteLog). */
export async function clearClientDailyMetric(userId, logType, dateKey) {
  const cfg = DAILY_METRIC_CLEAR[logType];
  if (!cfg || !userId || !db) throw new Error(`Unknown log type: ${logType}`);
  const key = dateKey || getLocalDateKey();

  const logsPatch = {};
  for (const field of cfg.logs) logsPatch[field] = deleteField();
  const trackingPatch = {};
  for (const field of cfg.tracking) trackingPatch[field] = deleteField();

  await mergeClientDailyMetrics(userId, key, { logs: logsPatch, tracking: trackingPatch });

  if (cfg.sub) {
    try {
      await deleteDoc(doc(db, 'users', userId, cfg.sub, key));
    } catch (_) {
      /* non-fatal */
    }
  }
}
