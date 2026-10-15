// Keeps the client home screen's today numbers live: water, sleep, soreness, energy, stress, workout, calories, and macros.
// Flow: a timer archives yesterday → a watcher clears the screen when the local date changes → a listener fills today's log.
// Used by the client home screen. Today is the device's local date.

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
// Manipulate here: how often the home screen checks whether the local day rolled over.
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

// PLUMBING — skip unless today's cards stay stuck on yesterday or the live log never arrives.

function writeEmptyHomeDailyMetrics(setters) {
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

function writeParsedDailyMetrics(parsed, setters) {
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
    const rolled = await tickDailyDashboardDayRollover(userId);
    if (rolled) clearHomeDailyMetrics();
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

function todayLogsRef(userId, todayDateKey) {
  return doc(db, USERS_COLLECTION, userId, DAILY_LOGS_COLLECTION, todayDateKey);
}

function subscribeToTodayDailyLogs({ userId, todayDateKey, applyFromSnapshots }) {
  const logsRef = todayLogsRef(userId, todayDateKey);
  let logsSnap = null;
  let trackingSnap = null;

  const applyWhenPrimaryArrives = () => {
    if (logsSnap == null) return;
    applyFromSnapshots(logsSnap, trackingSnap);
  };

  fetchLegacyDailyTrackingSnap(userId, todayDateKey)
    .then((snapshot) => {
      trackingSnap = snapshot;
      applyWhenPrimaryArrives();
    })
    .catch(() => {});

  const unsubscribeLogs = onSnapshot(
    logsRef,
    (snapshot) => {
      logsSnap = snapshot;
      applyWhenPrimaryArrives();
    },
    (error) => logSnapshotError(error, SNAPSHOT_ERROR_LABEL),
  );

  return () => {
    try {
      unsubscribeLogs();
    } catch (ignoredError) {}
  };
}

function startRolloverTimer(userId, clearHomeDailyMetrics) {
  tickRolloverAndRetryArchive(userId, clearHomeDailyMetrics);
  const intervalId = setInterval(() => {
    tickRolloverAndRetryArchive(userId, clearHomeDailyMetrics);
  }, ROLLOVER_TICK_MS);
  return () => clearInterval(intervalId);
}

// ===== MAIN FUNCTION =====

/**
 * Home-screen daily metrics: midnight rollover, archive, and the live log for today.
 * The screen owns the state and passes its setters in.
 * @param {string} userId
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
  const todayDateKey = todaysDate();
  const homeDateKeyRef = useRef(null);

  const metricSetters = {
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

  const parsedMetricSetters = {
    setWaterIntake,
    setSleepHours,
    setSoreness,
    setEnergyLevel,
    setStressLevel,
    setDashboardWorkoutSummary,
    setTodayWorkout,
  };

  const clearHomeDailyMetrics = useCallback(() => {
    writeEmptyHomeDailyMetrics(metricSetters);
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

  const applyFromSnapshots = useCallback(
    (logsSnap, trackingSnap) => {
      const parsed = parseDailyMetricsFromSnapshots(logsSnap, trackingSnap);
      writeParsedDailyMetrics(parsed, parsedMetricSetters);
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

  useEffect(() => {
    if (!userId || !db) return;
    return startRolloverTimer(userId, clearHomeDailyMetrics);
  }, [userId, clearHomeDailyMetrics]);

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

  useEffect(() => {
    if (!userId || !db) return;
    return subscribeToTodayDailyLogs({ userId, todayDateKey, applyFromSnapshots });
  }, [userId, todayDateKey, applyFromSnapshots]);

  return { todayDateKey, clearHomeDailyMetrics, applyFromSnapshots };
}
