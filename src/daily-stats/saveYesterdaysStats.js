// Day-rollover job: freezes yesterday's dashboard numbers into a permanent archive doc.
// Flow: tick() compares today's local date key against the last one we stored →
//       if the day changed, read yesterday's live docs → write a flattened snapshot to
//       daily_logs/{uid}_{date} → on failure, remember it and retry on next launch.
// Called on app start / foreground. Without it, "yesterday" would be recomputed from
// mutable live docs and the weekly report would drift.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';
import { getLocalDateKey } from '../helpers/getLocalDay';

// Two bits of per-user local bookkeeping. uid is baked into the key so switching
// accounts can't make one user's rollover state apply to another.
// `lastKey`    = the last local date this device saw (how we detect a day change)
// `pendingKey` = "an archive write failed; retry this date" breadcrumb
const lastKeyStorage = (uid) => `dashboard_last_dateKey_${uid}`;
const pendingKeyStorage = (uid) => `dashboard_pending_reset_${uid}`;

/**
 * Archive yesterday's dashboard metrics into `daily_logs/{uid}_{date}`.
 * Idempotent merge write.
 */
export async function archiveDailyDashboardDay(uid, prevKey) {
  if (!uid || !db || !prevKey) return;

  let dailyLogsData = null;
  let trackingData = null;

  // Read both sources of a day's metrics. `dailyLogs` is canonical; `daily_tracking` is
  // the legacy mirror still holding nutrition/workout fields for older accounts.
  // Each read is independently wrapped: a permission error or missing doc on one must not
  // stop us from archiving whatever the other one has.
  try {
    const logsSnap = await getDoc(doc(db, 'users', uid, 'dailyLogs', prevKey));
    dailyLogsData = logsSnap.exists() ? logsSnap.data() || {} : null;
  } catch (_) {
    dailyLogsData = null;
  }

  try {
    // TODO(phase-5): remove legacy daily_tracking read after backfill
    const tSnap = await getDoc(doc(db, 'users', uid, 'daily_tracking', prevKey));
    trackingData = tSnap.exists() ? tSnap.data() || {} : null;
  } catch (_) {
    trackingData = null;
  }

  // Nothing logged yesterday → skip entirely. Writing an empty archive doc would create
  // a misleading "day existed but was blank" record in the weekly report.
  const hasData =
    (dailyLogsData && Object.keys(dailyLogsData).length > 0) ||
    (trackingData && Object.keys(trackingData).length > 0);
  if (!hasData) return;

  // Composite id instead of a subcollection, so the whole archive can be queried
  // across users in one collection.
  const archiveDocId = `${uid}_${prevKey}`;
  // Flatten the two sources into one grouped shape. Every field uses
  // `tracking ?? logs ?? null`-style fallbacks because which doc holds a given value
  // depends on the account's age. Explicit `null` (never undefined) keeps Firestore happy
  // and makes "was not logged" readable in the console.
  const archivePayload = {
    userId: uid,
    date: prevKey,
    workouts: {
      workoutLog: dailyLogsData?.workoutLog || null,
      workoutSummary: trackingData?.workoutSummary || dailyLogsData?.dashboard_workouts || null,
      workoutName: trackingData?.workoutName || dailyLogsData?.dashboard_workout_name || null,
      workoutExercises: trackingData?.workoutExercises || null,
    },
    nutrition: {
      // typeof check rather than `||` so a legitimately logged 0 calories survives.
      caloriesConsumed: typeof trackingData?.caloriesConsumed === 'number' ? trackingData.caloriesConsumed : null,
      macros: trackingData?.macroTotals || null,
    },
    streak_count: typeof dailyLogsData?.streak_count === 'number' ? dailyLogsData.streak_count : null,
    timestamp: serverTimestamp(),
  };

  // `{ merge: true }` makes this idempotent — if the rollover runs twice (retry, two
  // devices, app relaunch) the second write just overwrites the same fields instead of
  // erroring or duplicating.
  await setDoc(doc(db, 'daily_logs', archiveDocId), archivePayload, { merge: true });
}

/**
 * On local calendar day change: archive previous day (if any) and update stored key.
 * @returns {string|null} previous date key if rollover occurred
 */
// Safe to call as often as you like — it's a no-op unless the local calendar day changed.
export async function tickDailyDashboardDayRollover(uid) {
  if (!uid) return null;
  const nowKey = getLocalDateKey();
  const lastKey = await AsyncStorage.getItem(lastKeyStorage(uid));

  // First run on this device/account: just record today. There's no previous day to
  // archive, and archiving a day we never observed would invent data.
  if (!lastKey) {
    await AsyncStorage.setItem(lastKeyStorage(uid), nowKey);
    return null;
  }

  // Same day — the common case, so bail before doing any Firestore work.
  if (lastKey === nowKey) return null;

  // Advance the marker BEFORE archiving, deliberately. If the archive throws, we don't
  // want the next tick to try rolling over the same day again in a loop; the pending
  // breadcrumb below is the controlled retry path instead.
  await AsyncStorage.setItem(lastKeyStorage(uid), nowKey);

  try {
    await archiveDailyDashboardDay(uid, lastKey);
    // Success wipes any breadcrumb from a previous failed attempt.
    await AsyncStorage.removeItem(pendingKeyStorage(uid));
  } catch (e) {
    // Offline or permission hiccup: store which day still needs archiving, then rethrow
    // so the caller can log it. `at` is kept purely for debugging how long it's been stuck.
    await AsyncStorage.setItem(pendingKeyStorage(uid), JSON.stringify({ prevKey: lastKey, at: Date.now() }));
    throw e;
  }

  return lastKey;
}

// The retry half. Call this on startup (before or alongside tick) to drain a failed
// archive from a previous session.
export async function retryPendingDailyDashboardArchive(uid) {
  if (!uid) return;
  const pending = await AsyncStorage.getItem(pendingKeyStorage(uid));
  if (!pending) return;
  let parsed = null;
  try {
    parsed = JSON.parse(pending);
  } catch (_) {
    // Corrupt breadcrumb — give up rather than loop on unparseable state.
    return;
  }
  if (!parsed?.prevKey) return;
  // No try/catch here on purpose: if this attempt fails too, the breadcrumb is left in
  // place (the removeItem below never runs) so the next launch tries again.
  await archiveDailyDashboardDay(uid, parsed.prevKey);
  await AsyncStorage.removeItem(pendingKeyStorage(uid));
}
