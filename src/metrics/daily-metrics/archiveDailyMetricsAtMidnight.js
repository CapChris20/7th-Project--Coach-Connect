/**
 * daily Dashboard Day Rollover
 *
 * Purpose: Data/service layer: daily Dashboard Day Rollover. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: archiveDailyDashboardDay, tickDailyDashboardDayRollover, retryPendingDailyDashboardArchive
 *
 * @file-header
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../app-start/config';
import { getLocalDateKey } from '../../shared-utils/getLocalDay';

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

  const hasData =
    (dailyLogsData && Object.keys(dailyLogsData).length > 0) ||
    (trackingData && Object.keys(trackingData).length > 0);
  if (!hasData) return;

  const archiveDocId = `${uid}_${prevKey}`;
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
      caloriesConsumed: typeof trackingData?.caloriesConsumed === 'number' ? trackingData.caloriesConsumed : null,
      macros: trackingData?.macroTotals || null,
    },
    streak_count: typeof dailyLogsData?.streak_count === 'number' ? dailyLogsData.streak_count : null,
    timestamp: serverTimestamp(),
  };

  await setDoc(doc(db, 'daily_logs', archiveDocId), archivePayload, { merge: true });
}

/**
 * On local calendar day change: archive previous day (if any) and update stored key.
 * @returns {string|null} previous date key if rollover occurred
 */
export async function tickDailyDashboardDayRollover(uid) {
  if (!uid) return null;
  const nowKey = getLocalDateKey();
  const lastKey = await AsyncStorage.getItem(lastKeyStorage(uid));

  if (!lastKey) {
    await AsyncStorage.setItem(lastKeyStorage(uid), nowKey);
    return null;
  }

  if (lastKey === nowKey) return null;

  await AsyncStorage.setItem(lastKeyStorage(uid), nowKey);

  try {
    await archiveDailyDashboardDay(uid, lastKey);
    await AsyncStorage.removeItem(pendingKeyStorage(uid));
  } catch (e) {
    await AsyncStorage.setItem(pendingKeyStorage(uid), JSON.stringify({ prevKey: lastKey, at: Date.now() }));
    throw e;
  }

  return lastKey;
}

export async function retryPendingDailyDashboardArchive(uid) {
  if (!uid) return;
  const pending = await AsyncStorage.getItem(pendingKeyStorage(uid));
  if (!pending) return;
  let parsed = null;
  try {
    parsed = JSON.parse(pending);
  } catch (_) {
    return;
  }
  if (!parsed?.prevKey) return;
  await archiveDailyDashboardDay(uid, parsed.prevKey);
  await AsyncStorage.removeItem(pendingKeyStorage(uid));
}
