/**
 * use Client Home Daily Metrics
 *
 * Purpose: React hook: use Client Home Daily Metrics. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: useClientHomeDailyMetrics
 *
 * @file-header
 */
import { useCallback, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../app-start/config';
import { useLocalTodayDateKey } from '../../metrics/daily-metrics/useLocalTodayDateKey';
import {
  archiveDailyDashboardDay,
  retryPendingDailyDashboardArchive,
  tickDailyDashboardDayRollover,
} from '../../metrics/daily-metrics/archiveDailyMetricsAtMidnight';
import {
  fetchLegacyDailyTrackingSnap,
  parseDailyMetricsFromSnapshots,
} from '../../metrics/daily-metrics/saveDailyMetricsToFirestore';

/**
 * Home-screen daily metrics: midnight rollover, archive, live Firestore sync.
 */
export function useClientHomeDailyMetrics(userId, {
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
  const todayDateKey = useLocalTodayDateKey();
  const homeDateKeyRef = useRef(null);

  const clearHomeDailyMetrics = useCallback(() => {
    setWaterIntake(null);
    setSleepHours(null);
    setSoreness(null);
    setEnergyLevel(null);
    setStressLevel(null);
    setTodayWorkout(null);
    setDashboardWorkoutSummary(null);
    setCaloriesConsumed(0);
    setMacroTotals({ protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, potassium: 0 });
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
      setWaterIntake(parsed.waterIntake);
      setSleepHours(parsed.sleepHours);
      setSoreness(parsed.soreness);
      setEnergyLevel(parsed.energyLevel);
      setStressLevel(parsed.stressLevel);
      setDashboardWorkoutSummary(parsed.dashboardWorkoutSummary);
      setTodayWorkout(parsed.todayWorkout);
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

    const tick = async () => {
      try {
        const rolled = await tickDailyDashboardDayRollover(userId);
        if (rolled) clearHomeDailyMetrics();
        await retryPendingDailyDashboardArchive(userId);
      } catch (_) {
        /* retry on next interval */
      }
    };

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [userId, clearHomeDailyMetrics]);

  useEffect(() => {
    if (!userId) return;
    const prev = homeDateKeyRef.current;
    homeDateKeyRef.current = todayDateKey;
    if (prev != null && prev !== todayDateKey) {
      archiveDailyDashboardDay(userId, prev).catch(() => {});
      clearHomeDailyMetrics();
    }
  }, [todayDateKey, userId, clearHomeDailyMetrics]);

  useEffect(() => {
    if (!userId || !db) return;

    const logsRef = doc(db, 'users', userId, 'dailyLogs', todayDateKey);
    let logsSnap = null;
    let trackingSnap = null;

    const apply = () => {
      if (logsSnap == null) return;
      applyFromSnapshots(logsSnap, trackingSnap);
    };

    fetchLegacyDailyTrackingSnap(userId, todayDateKey)
      .then((snap) => {
        trackingSnap = snap;
        apply();
      })
      .catch(() => {});

    const unsubLogs = onSnapshot(logsRef, (snap) => {
      logsSnap = snap;
      apply();
    });

    return () => {
      try {
        unsubLogs();
      } catch (_) {}
    };
  }, [userId, todayDateKey, applyFromSnapshots]);

  return { todayDateKey, clearHomeDailyMetrics, applyFromSnapshots };
}
