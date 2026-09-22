// Keeps the client home screen's "today" numbers live: water, sleep, soreness, energy, stress,
// workout, calories and macros.
// Flow: three effects working together — (1) a 30s timer that archives yesterday and rolls the day
// over, (2) a watcher that clears state the moment the local date changes, (3) a Firestore listener
// on today's log that pushes values into the screen's setters.
// Why the day handling is this careful: "today" depends on the DEVICE's local date, so the screen
// must reset at local midnight and archive the finished day even if the app was backgrounded.
import { useCallback, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../app-start/config';
import { logSnapshotError } from '../../for-both/services/firestoreListenerUtils';
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
// This hook doesn't own the state — the screen does, and passes its setters in. That's deliberate:
// the home screen already holds these values for other purposes, so duplicating them here would
// create two sources of truth.
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
  // 'YYYY-MM-DD' in the DEVICE's timezone, and it re-renders when that flips at local midnight.
  const todayDateKey = useLocalTodayDateKey();
  // Remembers which day the screen is currently showing, so effect (2) can detect a change.
  // A ref, not state, because writing it must not trigger a re-render.
  const homeDateKeyRef = useRef(null);

  // Wipes the screen back to an empty day. Note the asymmetry, which is intentional: the
  // subjective metrics reset to null ("not logged yet", so the UI shows a prompt), while the
  // consumption totals reset to 0 ("you've eaten nothing yet today", a real value).
  const clearHomeDailyMetrics = useCallback(() => {
    setWaterIntake(null);
    setSleepHours(null);
    setSoreness(null);
    setEnergyLevel(null);
    setStressLevel(null);
    setTodayWorkout(null);
    setDashboardWorkoutSummary(null);
    setCaloriesConsumed(0);
    // Manipulate here: this object is the full macro shape the home screen expects — every key must
    // be present, or a macro ring would render undefined instead of zero.
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

  // Fans one parsed result out into the individual setters. The parsing lives in a shared module so
  // the home screen and the dashboard interpret the same documents identically.
  // Note calories/macros are NOT set here — those come from the meal-logging path, not the daily log.
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

  // EFFECT 1 — the rollover/archive heartbeat.
  // A polling timer rather than a scheduled midnight callback, because the app can be backgrounded
  // or the device asleep across midnight; polling means we catch up as soon as we're running again.
  useEffect(() => {
    if (!userId || !db) return;

    const tick = async () => {
      try {
        // Ask the archiver whether the stored day is now in the past. If it rolled the day, the
        // on-screen values belong to yesterday and must be cleared.
        const rolled = await tickDailyDashboardDayRollover(userId);
        if (rolled) clearHomeDailyMetrics();
        // Second call covers the offline case: an archive that failed earlier (no network) is
        // retried here, so a day is never silently lost.
        await retryPendingDailyDashboardArchive(userId);
      } catch (_) {
        /* retry on next interval */
      }
    };

    // Run once immediately so a fresh app launch doesn't wait a full interval to catch up.
    tick();
    // Manipulate here: 30_000 = every 30 seconds. (The underscore is just a numeric separator for
    // readability.) Raising it delays the midnight reset; lowering it adds background work.
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [userId, clearHomeDailyMetrics]);

  // EFFECT 2 — instant local-midnight response, independent of the timer above.
  // This fires the moment useLocalTodayDateKey reports a new date, so the UI resets immediately
  // rather than up to 30 seconds later.
  useEffect(() => {
    if (!userId) return;
    const prev = homeDateKeyRef.current;
    homeDateKeyRef.current = todayDateKey;
    // The `prev != null` half is what makes this "changed", not "first run" — on mount prev is null
    // and we must NOT archive or clear, or every app launch would wipe the day.
    if (prev != null && prev !== todayDateKey) {
      // Fire-and-forget: archiving yesterday shouldn't block clearing the UI, and effect 1's retry
      // path will pick it up if this fails.
      archiveDailyDashboardDay(userId, prev).catch(() => {});
      clearHomeDailyMetrics();
    }
  }, [todayDateKey, userId, clearHomeDailyMetrics]);

  // EFFECT 3 — the live data feed for today. Re-subscribes whenever the user or the date changes,
  // which is exactly what's needed at midnight (close yesterday's listener, open today's).
  useEffect(() => {
    if (!userId || !db) return;

    const logsRef = doc(db, 'users', userId, 'dailyLogs', todayDateKey);
    // Two sources arrive independently — one live, one a one-shot legacy read — so they're held in
    // closure variables and combined by apply() whenever either lands. This avoids the flicker of
    // rendering once per source.
    let logsSnap = null;
    let trackingSnap = null;

    const apply = () => {
      // Gate on the PRIMARY source only: the legacy tracking doc is optional, so waiting for it
      // would stall the UI for users who don't have one. logsSnap null means "not arrived yet".
      if (logsSnap == null) return;
      applyFromSnapshots(logsSnap, trackingSnap);
    };

    // Legacy read for older accounts whose metrics predate the dailyLogs collection. One-shot, not
    // a listener, because that data is historical and never changes. Failure is ignored — most
    // users simply have no legacy doc.
    fetchLegacyDailyTrackingSnap(userId, todayDateKey)
      .then((snap) => {
        trackingSnap = snap;
        apply();
      })
      .catch(() => {});

    // The live listener: fires immediately with current data and again on every write, so logging
    // water on another screen updates the home screen without a refresh.
    const unsubLogs = onSnapshot(
      logsRef,
      (snap) => {
        logsSnap = snap;
        apply();
      },
      // Routed through the shared logger, which knows which listener errors are benign flicker.
      (err) => logSnapshotError(err, 'Client dailyLogs listener:'),
    );

    // Cleanup closes the listener on unmount AND before re-subscribing for a new day — without it
    // each midnight would leak another listener.
    return () => {
      try {
        unsubLogs();
      } catch (_) {}
    };
  }, [userId, todayDateKey, applyFromSnapshots]);

  // Returned so the screen can react to the current day and force a clear/re-apply itself (e.g.
  // after the user logs metrics from a modal).
  return { todayDateKey, clearHomeDailyMetrics, applyFromSnapshots };
}
