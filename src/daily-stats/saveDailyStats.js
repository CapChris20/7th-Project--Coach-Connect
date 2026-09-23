// The ONLY writer for a client's daily metrics. Canonical home: `users/{uid}/dailyLogs/{date}`.
// Flow: every save funnels through mergeClientDailyMetrics → merge-write to dailyLogs →
//       mirror the equivalent fields into the legacy `daily_tracking` doc.
// Dashboard cards and the AI coach's log/delete tools call the small named wrappers below,
// so field-name knowledge stays in one file. Shape translation lives in readDailyStats.js.

// vocab: deleteField() = a sentinel you WRITE to tell Firestore to remove that key
//        (writing null would instead store a null value)
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

/** One-time legacy read — prefer live `dailyLogs` listener. TODO: remove after backfill. */
export async function fetchLegacyDailyTrackingSnap(userId, dateKey) {
  if (!userId || !db) return null;
  const key = dateKey || getLocalDateKey();
  return getDoc(doc(db, 'users', userId, 'daily_tracking', key));
}

/**
 * Merge into dailyLogs (canonical) and mirror into daily_tracking when needed.
 */
// The single write path everything else delegates to.
// `dateKey` is optional and defaults to the device's local today, so callers editing
// "today" never have to compute a date key themselves.
export async function mergeClientDailyMetrics(userId, dateKey, { logs = {}, tracking = {} } = {}) {
  if (!userId || !db) return;
  const key = dateKey || getLocalDateKey();
  const logsPatch = { ...logs, updatedAt: serverTimestamp() };

  // `{ merge: true }` on every write: these docs accumulate one card at a time, so a
  // full overwrite would wipe the other metrics logged earlier today.
  await setDoc(doc(db, 'users', userId, 'dailyLogs', key), logsPatch, { merge: true });

  // Legacy mirror. Auto-derived fields come first, then the caller's explicit `tracking`
  // block — spread order means an explicit value always beats the auto-mapped one.
  const mirror = { ...trackingMirrorFromLogs(logs), ...tracking };
  // Skip the second write entirely when there's nothing to mirror (saves a Firestore
  // write on fields that only exist in dailyLogs).
  if (Object.keys(mirror).length > 0) {
    await setDoc(
      doc(db, 'users', userId, 'daily_tracking', key),
      { ...mirror, updatedAt: serverTimestamp() },
      { merge: true },
    );
  }
}

/** Save a single dashboard_* field from My Dashboard cards. */
// vocab/symbol: { [storageKey]: value } = computed key — the variable's VALUE becomes the
//               field name, which is how one function can save any dashboard_* field.
export async function saveDashboardMetricField(userId, storageKey, value, dateKey) {
  await mergeClientDailyMetrics(userId, dateKey, { logs: { [storageKey]: value } });
}

/** Workout log save (structured + legacy summary string). */
// Writes both representations at once: structured `workoutLog` for the logger UI and the
// `dashboard_workouts` summary string for the feed/legacy readers. The explicit `tracking`
// block is passed because exercises need a shape change the auto-mirror can't infer here.
export async function saveDashboardWorkoutLog(
  userId,
  { workoutName, workoutLog, dashboard_workouts },
  dateKey,
) {
  // `|| null` rather than leaving fields out: writing an explicit null CLEARS a previously
  // saved name, which is what the user expects when they remove it.
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

// Sleep: stored as a NUMBER in both docs.
export async function saveDashboardSleepHours(userId, hours, dateKey) {
  const h = Number(hours);
  await mergeClientDailyMetrics(userId, dateKey, {
    logs: { dashboard_sleep: h },
    tracking: { sleepHours: h },
  });
}

// Water: note the deliberate asymmetry — a STRING in dailyLogs, a NUMBER in the legacy
// mirror. That's the historical storage cellFormatting of each doc; the read-side parser coerces
// both, so don't "fix" one without updating readDailyStats.js.
export async function saveDashboardWaterOz(userId, amountOz, dateKey) {
  const oz = Number(amountOz);
  // Reject junk and zero before writing. Unlike sleep (where 0 could be meaningful),
  // "logged 0 oz of water" is always a bad input, not an intention.
  if (!Number.isFinite(oz) || oz <= 0) return;
  await mergeClientDailyMetrics(userId, dateKey, {
    logs: { dashboard_water: String(oz) },
    tracking: { waterIntake: oz },
  });
}

// Delete map for the AI coach's "remove my log" tool. One entry per metric type listing
// every place that metric is stored: dailyLogs fields, legacy mirror fields, and the
// per-metric history subcollection.
// Manipulate here: adding a new deletable metric means adding a row here — miss a field
//                  and a "deleted" metric will reappear from the doc you forgot.
// Note `workout` and `restDay` intentionally clear the same fields: logging a rest day
// occupies the workout slot, so clearing either must clear the same data.
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
  // Throws (rather than returning quietly) because this is driven by an AI tool call —
  // the coach needs to know the delete didn't happen so it can tell the user.
  if (!cfg || !userId || !db) throw new Error(`Unknown log type: ${logType}`);
  const key = dateKey || getLocalDateKey();

  // Build patches whose VALUES are deleteField() sentinels. This reuses the normal merge
  // write path to perform a deletion — no separate code path needed.
  const logsPatch = {};
  for (const field of cfg.logs) logsPatch[field] = deleteField();
  const trackingPatch = {};
  for (const field of cfg.tracking) trackingPatch[field] = deleteField();

  await mergeClientDailyMetrics(userId, key, { logs: logsPatch, tracking: trackingPatch });

  // Also drop the day's row from the metric's history subcollection (used by charts).
  // Non-fatal: the main fields are already cleared, so the dashboard is correct even if
  // this cleanup is blocked or the doc never existed.
  if (cfg.sub) {
    try {
      await deleteDoc(doc(db, 'users', userId, cfg.sub, key));
    } catch (_) {
      /* non-fatal */
    }
  }
}
