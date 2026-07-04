import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../app-start/config';
import { isAllowedClientWorkoutDayLabel } from '../../../shared-utils/workoutDayLabels';

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dateRangeKeys(weekStart, weekEnd) {
  const keys = [];
  let cursor = weekStart;
  const end = weekEnd || weekStart;
  while (cursor && cursor <= end) {
    keys.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return keys;
}

function looksLikeWorkoutDayLabel(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  if (isAllowedClientWorkoutDayLabel(value)) return true;
  return /\b(day|body|cardio|hiit|push|pull|legs?|arms?|chest|back|shoulders?)\b/i.test(value);
}

function resolveWorkoutName(log, workouts = []) {
  const explicit = log?.dashboard_workout_name != null ? String(log.dashboard_workout_name).trim() : '';
  if (explicit) return explicit;

  const legacy = log?.dashboard_workouts != null ? String(log.dashboard_workouts).trim() : '';
  if (legacy) {
    const firstLine = legacy.split('\n').map((l) => l.trim()).find(Boolean) || '';
    if (looksLikeWorkoutDayLabel(firstLine)) return firstLine;
  }

  if (workouts.length === 1 && looksLikeWorkoutDayLabel(workouts[0]?.name)) {
    return workouts[0].name;
  }

  return null;
}

export function workoutsFromDailyLog(log) {
  if (!log) return { workouts: [], workoutName: null, isRest: false };

  if (Array.isArray(log.workoutLog) && log.workoutLog.length > 0) {
    const workouts = log.workoutLog
      .filter((ex) => ex && ex.exerciseName)
      .map((ex) => {
        const sets = Array.isArray(ex.sets) ? ex.sets : [];
        const setStrings = sets.map((s) => `${s.reps || 0}×${s.weight || 0}`);
        return {
          name: String(ex.exerciseName).trim(),
          setsCount: sets.length ? String(sets.length) : null,
          setsDetail: setStrings.length ? setStrings.join(', ') : null,
        };
      });
    if (workouts.length) {
      return {
        workouts,
        workoutName: resolveWorkoutName(log, workouts),
        isRest: false,
      };
    }
  }

  const summary = log.dashboard_workouts != null ? String(log.dashboard_workouts).trim() : '';
  const isRest = /\brest\b|off day|recovery|no workout|take a rest/i.test(summary);
  if (summary && !isRest) {
    const lines = summary.split('\n').map((l) => l.trim()).filter(Boolean);
    const title = resolveWorkoutName(log, []);
    const exerciseLines = title && lines[0] === title ? lines.slice(1) : lines;
    const workouts =
      exerciseLines.length > 0
        ? exerciseLines.map((line) => ({ name: line, setsCount: null, setsDetail: null }))
        : [{ name: summary, setsCount: null, setsDetail: null }];

    return {
      workouts,
      workoutName: title || resolveWorkoutName(log, workouts),
      isRest: false,
    };
  }

  return {
    workouts: [],
    workoutName: resolveWorkoutName(log, []),
    isRest: isRest && Boolean(summary),
  };
}

/**
 * Fetch users/{uid}/dailyLogs for each day in a week range.
 * @returns {Promise<Record<string, object>>}
 */
export async function fetchDailyLogsByDayForRange(userId, weekStart, weekEnd) {
  if (!userId || !db || !weekStart) return {};

  const keys = dateRangeKeys(weekStart, weekEnd);
  const entries = await Promise.all(
    keys.map(async (date) => {
      try {
        const snap = await getDoc(doc(db, 'users', userId, 'dailyLogs', date));
        return [date, snap.exists() ? snap.data() || {} : null];
      } catch {
        return [date, null];
      }
    }),
  );

  const byDay = {};
  entries.forEach(([date, data]) => {
    if (data) byDay[date] = data;
  });
  return byDay;
}

export function mergeDailyLogMaps(...maps) {
  return Object.assign({}, ...maps.filter(Boolean));
}
