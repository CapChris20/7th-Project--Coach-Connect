// Keeps the client home screen's today numbers live: water, sleep, soreness, energy, stress, workout, calories, and macros.
// Flow: rollover timer archives yesterday → date watcher clears stale UI → listener fills today's log.
// Used by the client home screen. Today is the device's local date.
// Key export: keepDailyStatsFresh — the screen owns state and passes setters in.

import { useCallback, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import { logSnapshotError } from '../../for-both/cloud-database/handleLiveUpdateErrors';
import { todaysDate } from '../../daily-stats/todaysDate';
import {
  archiveDailyDashboardDay,
  retryPendingDailyDashboardArchive,
  tickDailyDashboardDayRollover,
} from '../../daily-stats/saveYesterdaysStats';
import {
  fetchLegacyDailyTrackingSnap,
  parseDailyMetricsFromSnapshots,
} from '../../daily-stats/saveDailyStats';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const DAILY_LOGS_COLLECTION = 'dailyLogs';
const SNAPSHOT_ERROR_LABEL = 'Client dailyLogs listener:';
const ROLLOVER_TICK_MS = 30_000;

const EMPTY_MACRO_TOTALS = {
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0,
  sodium: 0,
  potassium: 0,
};

// ===== HELPER FUNCTIONS =====

function bundleAllHomeMetricSetters({
  setWaterIntake,
  setSleepHours,
  setSoreness,
  setEnergyLevel,
  setStressLevel,
  setTodayWorkout,
  setDashboardWorkoutSummary,
  setCaloriesConsumed,
  setMacroTotals,
}) {
  return {
    setWaterIntake,
    setSleepHours,
    setSoreness,
    setEnergyLevel,
    setStressLevel,
    setTodayWorkout,
    setDashboardWorkoutSummary,
    setCaloriesConsumed,
    setMacroTotals,
  };
}

function bundleParsedMetricSetters({
  setWaterIntake,
  setSleepHours,
  setSoreness,
  setEnergyLevel,
  setStressLevel,
  setTodayWorkout,
  setDashboardWorkoutSummary,
}) {
  return {
    setWaterIntake,
    setSleepHours,
    setSoreness,
    setEnergyLevel,
    setStressLevel,
    setDashboardWorkoutSummary,
    setTodayWorkout,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Home-screen daily metrics: midnight rollover, archive, and the live log for today.
 * The screen owns the state and passes its setters in.
 * Flow: 1. bundle setters  2. clear/apply callbacks  3. rollover timer  4. date watcher  5. live log
 * Hook order is frozen — do not reorder useRef / useCallback / useEffect calls.
 * @param {string|null|undefined} userId
 * @param {object} setters
 * @returns {{ todayDateKey: string, clearHomeDailyMetrics: Function, applyFromSnapshots: Function }}
 */
export function keepDailyStatsFresh(userId, {
  setWaterIntake,
  setSleepHours,
  setSoreness,
  setEnergyLevel,
  setStressLevel,
  setTodayWorkout,
  setDashboardWorkoutSummary,
  setCaloriesConsumed,
  setMacroTotals,
}) {
  // 1. Today's local date key + a ref that remembers which day the UI last showed.
  const todayDateKey = todaysDate();
  const homeDateKeyRef = useRef(null);

  const allMetricSetters = bundleAllHomeMetricSetters({
    setWaterIntake,
    setSleepHours,
    setSoreness,
    setEnergyLevel,
    setStressLevel,
    setTodayWorkout,
    setDashboardWorkoutSummary,
    setCaloriesConsumed,
    setMacroTotals,
  });

  const parsedMetricSetters = bundleParsedMetricSetters({
    setWaterIntake,
    setSleepHours,
    setSoreness,
    setEnergyLevel,
    setStressLevel,
    setTodayWorkout,
    setDashboardWorkoutSummary,
  });

  // 2. Stable “wipe today’s cards” callback — used when the calendar day rolls over.
  const clearHomeDailyMetrics = useCallback(() => {
    wipeHomeDailyMetricsToEmpty(allMetricSetters);
  }, [
    setWaterIntake,
    setSleepHours,
    setSoreness,
    setEnergyLevel,
    setStressLevel,
    setTodayWorkout,
    setDashboardWorkoutSummary,
    setCaloriesConsumed,
    setMacroTotals,
  ]);

  // 3. Stable “paint from snapshots” callback — live log + optional legacy tracking.
  const applyFromSnapshots = useCallback(
    (logsSnap, trackingSnap) => {
      const parsed = parseDailyMetricsFromSnapshots(logsSnap, trackingSnap);
      paintHomeDailyMetricsFromParsed(parsed, parsedMetricSetters);
    },
    [
      setWaterIntake,
      setSleepHours,
      setSoreness,
      setEnergyLevel,
      setStressLevel,
      setDashboardWorkoutSummary,
      setTodayWorkout,
    ],
  );

  // 4. Background rollover timer — archive yesterday and retry failed archives.
  useEffect(() => {
    if (!userId) return undefined;
    if (!db) return undefined;
    return startRolloverTimer(userId, clearHomeDailyMetrics);
  }, [userId, clearHomeDailyMetrics]);

  // 5. When the local date string changes, archive the previous day and clear stale UI.
  useEffect(() => {
    if (!userId) return;
    archiveIfLocalDateChanged({
      userId,
      previousDateKey: homeDateKeyRef.current,
      todayDateKey,
      homeDateKeyRef,
      clearHomeDailyMetrics,
    });
  }, [todayDateKey, userId, clearHomeDailyMetrics]);

  // 6. Live listener on users/{id}/dailyLogs/{today} (+ legacy tracking fallback).
  useEffect(() => {
    if (!userId) return undefined;
    if (!db) return undefined;
    return subscribeToTodayDailyLogs({ userId, todayDateKey, applyFromSnapshots });
  }, [userId, todayDateKey, applyFromSnapshots]);

  return { todayDateKey, clearHomeDailyMetrics, applyFromSnapshots };
}

// ===== PLUMBING — skip unless today's cards stay stuck on yesterday or the live log never arrives =====

function wipeHomeDailyMetricsToEmpty(setters) {
  setters.setWaterIntake(null);
  setters.setSleepHours(null);
  setters.setSoreness(null);
  setters.setEnergyLevel(null);
  setters.setStressLevel(null);
  setters.setTodayWorkout(null);
  setters.setDashboardWorkoutSummary(null);
  setters.setCaloriesConsumed(0);
  setters.setMacroTotals(EMPTY_MACRO_TOTALS);
}

function paintHomeDailyMetricsFromParsed(parsed, setters) {
  setters.setWaterIntake(parsed.waterIntake);
  setters.setSleepHours(parsed.sleepHours);
  setters.setSoreness(parsed.soreness);
  setters.setEnergyLevel(parsed.energyLevel);
  setters.setStressLevel(parsed.stressLevel);
  setters.setDashboardWorkoutSummary(parsed.dashboardWorkoutSummary);
  setters.setTodayWorkout(parsed.todayWorkout);
}

async function tickRolloverAndRetryArchive(userId, clearHomeDailyMetrics) {
  try {
    const dayRolledOver = await tickDailyDashboardDayRollover(userId);
    if (dayRolledOver) clearHomeDailyMetrics();
    await retryPendingDailyDashboardArchive(userId);
  } catch (ignoredError) {
    /* retry on next interval */
  }
}

function archiveIfLocalDateChanged({
  userId,
  previousDateKey,
  todayDateKey,
  homeDateKeyRef,
  clearHomeDailyMetrics,
}) {
  homeDateKeyRef.current = todayDateKey;
  if (previousDateKey == null) return;
  if (previousDateKey === todayDateKey) return;
  archiveDailyDashboardDay(userId, previousDateKey).catch(() => {});
  clearHomeDailyMetrics();
}

function firestorePathForTodayDailyLog(userId, todayDateKey) {
  return doc(db, USERS_COLLECTION, userId, DAILY_LOGS_COLLECTION, todayDateKey);
}

function subscribeToTodayDailyLogs({ userId, todayDateKey, applyFromSnapshots }) {
  const logsRef = firestorePathForTodayDailyLog(userId, todayDateKey);
  let logsSnap = null;
  let trackingSnap = null;

  function applyWhenBothSourcesReady() {
    if (logsSnap == null) return;
    applyFromSnapshots(logsSnap, trackingSnap);
  }

  fetchLegacyDailyTrackingSnap(userId, todayDateKey)
    .then((snapshot) => {
      trackingSnap = snapshot;
      applyWhenBothSourcesReady();
    })
    .catch(() => {});

  const unsubscribeLogs = onSnapshot(
    logsRef,
    (snapshot) => {
      logsSnap = snapshot;
      applyWhenBothSourcesReady();
    },
    (error) => logSnapshotError(error, SNAPSHOT_ERROR_LABEL),
  );

  return () => {
    try {
      unsubscribeLogs();
    } catch (ignoredError) {
      /* already gone */
    }
  };
}

function startRolloverTimer(userId, clearHomeDailyMetrics) {
  tickRolloverAndRetryArchive(userId, clearHomeDailyMetrics);
  const intervalId = setInterval(() => {
    tickRolloverAndRetryArchive(userId, clearHomeDailyMetrics);
  }, ROLLOVER_TICK_MS);
  return () => clearInterval(intervalId);
}
