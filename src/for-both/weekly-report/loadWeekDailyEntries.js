// Loads one client's daily food/workout logs for a week, then shapes a day into workouts for the report.
// Flow: date keys for the range → one Firestore read per day → merge maps → workoutsFromDailyLog for the UI.
// Used by trainer and client weekly-report screens.

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import { isAllowedClientWorkoutDayLabel } from '../../helpers/workoutDayNames';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const DAILY_LOGS_COLLECTION = 'dailyLogs';
// Parsing a bare 'YYYY-MM-DD' is UTC midnight, which in western timezones displays as the previous day.
const NOON_LOCAL_SUFFIX = 'T12:00:00';
const ISO_DATE_LENGTH = 10;
const REST_DAY_PATTERN = /\brest\b|off day|recovery|no workout|take a rest/i;
const WORKOUT_DAY_HINT_PATTERN = /\b(day|body|cardio|hiit|push|pull|legs?|arms?|chest|back|shoulders?)\b/i;

// ===== HELPER FUNCTIONS =====

function addDays(isoDate, dayCount) {
  const dateAtNoon = new Date(`${isoDate}${NOON_LOCAL_SUFFIX}`);
  dateAtNoon.setDate(dateAtNoon.getDate() + dayCount);
  return dateAtNoon.toISOString().slice(0, ISO_DATE_LENGTH);
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

function doesTextLookLikeWorkoutDayLabel(text) {
  const value = String(text || '').trim();
  if (!value) return false;
  if (isAllowedClientWorkoutDayLabel(value)) return true;
  return WORKOUT_DAY_HINT_PATTERN.test(value);
}

function firstNonEmptyLine(block) {
  return block.split('\n').map((line) => line.trim()).find(Boolean) || '';
}

function resolveWorkoutName(log, workouts = []) {
  const explicitName = log?.dashboard_workout_name != null ? String(log.dashboard_workout_name).trim() : '';
  if (explicitName) return explicitName;

  const legacySummary = log?.dashboard_workouts != null ? String(log.dashboard_workouts).trim() : '';
  if (legacySummary) {
    const firstLine = firstNonEmptyLine(legacySummary);
    if (doesTextLookLikeWorkoutDayLabel(firstLine)) return firstLine;
  }

  if (workouts.length === 1 && doesTextLookLikeWorkoutDayLabel(workouts[0]?.name)) {
    return workouts[0].name;
  }

  return null;
}

function setDetailText(workoutSet) {
  return `${workoutSet.reps || 0}×${workoutSet.weight || 0}`;
}

function exercisesFromStructuredLog(workoutLog) {
  return workoutLog
    .filter((exercise) => exercise && exercise.exerciseName)
    .map((exercise) => {
      const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
      const setStrings = sets.map((workoutSet) => setDetailText(workoutSet));
      return {
        name: String(exercise.exerciseName).trim(),
        setsCount: sets.length ? String(sets.length) : null,
        setsDetail: setStrings.length ? setStrings.join(', ') : null,
      };
    });
}

function workoutsFromSummaryLines(summary, title) {
  const lines = summary.split('\n').map((line) => line.trim()).filter(Boolean);
  const exerciseLines = title && lines[0] === title ? lines.slice(1) : lines;
  if (exerciseLines.length > 0) {
    return exerciseLines.map((line) => ({ name: line, setsCount: null, setsDetail: null }));
  }
  return [{ name: summary, setsCount: null, setsDetail: null }];
}

async function loadDailyLogForDate(userId, date) {
  try {
    const logSnapshot = await getDoc(doc(db, USERS_COLLECTION, userId, DAILY_LOGS_COLLECTION, date));
    return [date, logSnapshot.exists() ? logSnapshot.data() || {} : null];
  } catch {
    return [date, null];
  }
}

function dailyLogsByDate(entries) {
  const byDay = {};
  entries.forEach(([date, data]) => {
    if (data) byDay[date] = data;
  });
  return byDay;
}

// ===== MAIN FUNCTION =====

/**
 * Turn one daily log into the workout list the weekly report cards render.
 * Structured `workoutLog` wins; otherwise we parse the legacy dashboard summary string.
 * @param {object|null|undefined} log
 * @returns {{ workouts: Array, workoutName: string|null, isRest: boolean }}
 */
export function workoutsFromDailyLog(log) {
  if (!log) return { workouts: [], workoutName: null, isRest: false };

  if (Array.isArray(log.workoutLog) && log.workoutLog.length > 0) {
    const workouts = exercisesFromStructuredLog(log.workoutLog);
    if (workouts.length) {
      return {
        workouts,
        workoutName: resolveWorkoutName(log, workouts),
        isRest: false,
      };
    }
  }

  const summary = log.dashboard_workouts != null ? String(log.dashboard_workouts).trim() : '';
  const isRest = REST_DAY_PATTERN.test(summary);
  if (summary && !isRest) {
    const title = resolveWorkoutName(log, []);
    const workouts = workoutsFromSummaryLines(summary, title);
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
 * @param {string} userId
 * @param {string} weekStart
 * @param {string} weekEnd
 * @returns {Promise<Record<string, object>>}
 */
export async function fetchDailyLogsByDayForRange(userId, weekStart, weekEnd) {
  if (!userId || !db || !weekStart) return {};

  const keys = dateRangeKeys(weekStart, weekEnd);
  const entries = await Promise.all(keys.map((date) => loadDailyLogForDate(userId, date)));
  return dailyLogsByDate(entries);
}

/**
 * Overlay daily-log maps. Later maps win for the same date.
 * @param {...object} maps
 * @returns {object}
 */
export function mergeDailyLogMaps(...maps) {
  return Object.assign({}, ...maps.filter(Boolean));
}
