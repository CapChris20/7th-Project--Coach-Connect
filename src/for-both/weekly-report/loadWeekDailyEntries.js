// Loads one client's daily food/workout logs for a week, then shapes a day into workouts for the report.
// Flow: date keys for the range → one Firestore read per day → merge maps → workoutsFromDailyLog for the UI.
// Used by trainer and client weekly-report screens.
// Read order: constants → main recipes → PLUMBING at the bottom.

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import { isAllowedClientWorkoutDayLabel } from '../../helpers/workoutDayNames';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const DAILY_LOGS_COLLECTION = 'dailyLogs';
// Parsing a bare 'YYYY-MM-DD' is UTC midnight, which in western timezones displays as the previous day.
const NOON_LOCAL_SUFFIX = 'T12:00:00';
const ISO_DATE_KEY_LENGTH = 10;
const REST_DAY_PATTERN = /\brest\b|off day|recovery|no workout|take a rest/i;
const WORKOUT_DAY_HINT_PATTERN =
  /\b(day|body|cardio|hiit|push|pull|legs?|arms?|chest|back|shoulders?)\b/i;

// ===== MAIN FUNCTION =====

/**
 * Turn one daily log into the workout list the weekly report cards render.
 * Structured `workoutLog` wins; otherwise we parse the legacy dashboard summary string.
 * @param {object|null|undefined} log
 * @returns {{ workouts: Array, workoutName: string|null, isRest: boolean }}
 */
export function workoutsFromDailyLog(log) {
  // 1. No log document → empty day for the report UI.
  if (!log) {
    return { workouts: [], workoutName: null, isRest: false };
  }

  // 2. Prefer the structured exercise list when the phone wrote workoutLog.
  const structuredExercises = tryWorkoutsFromStructuredLog(log);
  if (structuredExercises) {
    return structuredExercises;
  }

  // 3. Fall back to the legacy dashboard_workouts multi-line string.
  return workoutsFromLegacyDashboardSummary(log);
}

/**
 * Fetch users/{uid}/dailyLogs for each day in a week range.
 * @param {string} userId
 * @param {string} weekStart
 * @param {string} weekEnd
 * @returns {Promise<Record<string, object>>}
 */
export async function fetchDailyLogsByDayForRange(userId, weekStart, weekEnd) {
  // 1. Need a user, a live db, and a week start key.
  if (!userId || !db || !weekStart) return {};

  // 2. Build every YYYY-MM-DD key from start through end (inclusive).
  const dateKeys = listDateKeysInRange(weekStart, weekEnd);

  // 3. One Firestore read per day, in parallel.
  // vocab: Promise.all = wait until every day read finishes (success or caught null)
  const loadPromises = [];
  for (let index = 0; index < dateKeys.length; index += 1) {
    loadPromises.push(loadOneDailyLogPair(userId, dateKeys[index]));
  }
  const dateAndLogPairs = await Promise.all(loadPromises);

  // 4. Shape into a date → log map (missing days stay absent).
  return buildDailyLogsByDateMap(dateAndLogPairs);
}

/**
 * Overlay daily-log maps. Later maps win for the same date.
 * @param {...object} maps
 * @returns {object}
 */
export function mergeDailyLogMaps(...maps) {
  // 1. Drop null/undefined overlays so Object.assign does not choke.
  const mapsThatExist = [];
  for (let index = 0; index < maps.length; index += 1) {
    if (maps[index]) mapsThatExist.push(maps[index]);
  }

  // 2. Left-to-right merge — later maps overwrite the same date key.
  // vocab: Object.assign = copy enumerable keys from each map onto a fresh object
  return Object.assign({}, ...mapsThatExist);
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging (date math, Firestore day reads, legacy string parse)

function addDaysToIsoDateKey(isoDateKey, dayCount) {
  const dateAtLocalNoon = new Date(`${isoDateKey}${NOON_LOCAL_SUFFIX}`);
  dateAtLocalNoon.setDate(dateAtLocalNoon.getDate() + dayCount);
  return dateAtLocalNoon.toISOString().slice(0, ISO_DATE_KEY_LENGTH);
}

function listDateKeysInRange(weekStart, weekEnd) {
  const dateKeys = [];
  let cursorDateKey = weekStart;
  const endDateKey = weekEnd || weekStart;

  while (cursorDateKey && cursorDateKey <= endDateKey) {
    dateKeys.push(cursorDateKey);
    cursorDateKey = addDaysToIsoDateKey(cursorDateKey, 1);
  }
  return dateKeys;
}

function textLooksLikeWorkoutDayLabel(text) {
  const trimmedText = String(text || '').trim();
  if (!trimmedText) return false;
  if (isAllowedClientWorkoutDayLabel(trimmedText)) return true;
  return WORKOUT_DAY_HINT_PATTERN.test(trimmedText);
}

function firstNonEmptyLineFromBlock(textBlock) {
  const lines = textBlock.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const trimmedLine = lines[index].trim();
    if (trimmedLine) return trimmedLine;
  }
  return '';
}

/**
 * Prefer explicit dashboard_workout_name; else a day-label first line; else a lone exercise name.
 * Field letters stay dashboard_workout_name / dashboard_workouts (freeze).
 */
function resolveWorkoutDayName(log, workouts = []) {
  const hasExplicitName = log && log.dashboard_workout_name != null;
  const explicitName = hasExplicitName ? String(log.dashboard_workout_name).trim() : '';
  if (explicitName) return explicitName;

  const hasLegacySummary = log && log.dashboard_workouts != null;
  const legacySummary = hasLegacySummary ? String(log.dashboard_workouts).trim() : '';
  if (legacySummary) {
    const firstLine = firstNonEmptyLineFromBlock(legacySummary);
    if (textLooksLikeWorkoutDayLabel(firstLine)) return firstLine;
  }

  const onlyOneWorkout = workouts.length === 1;
  if (onlyOneWorkout) {
    const loneWorkoutName = workouts[0] && workouts[0].name;
    if (textLooksLikeWorkoutDayLabel(loneWorkoutName)) return loneWorkoutName;
  }

  return null;
}

function setDetailTextFromRepsAndWeight(workoutSet) {
  const reps = workoutSet.reps || 0;
  const weight = workoutSet.weight || 0;
  return `${reps}×${weight}`;
}

function exercisesFromStructuredWorkoutLog(workoutLog) {
  const workouts = [];
  for (let index = 0; index < workoutLog.length; index += 1) {
    const exercise = workoutLog[index];
    if (!exercise || !exercise.exerciseName) continue;

    const sets = Array.isArray(exercise.sets) ? exercise.sets : [];
    const setDetailStrings = [];
    for (let setIndex = 0; setIndex < sets.length; setIndex += 1) {
      setDetailStrings.push(setDetailTextFromRepsAndWeight(sets[setIndex]));
    }

    let setsCount = null;
    if (sets.length) setsCount = String(sets.length);

    let setsDetail = null;
    if (setDetailStrings.length) setsDetail = setDetailStrings.join(', ');

    workouts.push({
      name: String(exercise.exerciseName).trim(),
      setsCount,
      setsDetail,
    });
  }
  return workouts;
}

function workoutsFromSummaryLines(summary, dayTitle) {
  const rawLines = summary.split('\n');
  const nonEmptyLines = [];
  for (let index = 0; index < rawLines.length; index += 1) {
    const trimmedLine = rawLines[index].trim();
    if (trimmedLine) nonEmptyLines.push(trimmedLine);
  }

  let exerciseLines = nonEmptyLines;
  const firstLineIsTheDayTitle = dayTitle && nonEmptyLines[0] === dayTitle;
  if (firstLineIsTheDayTitle) {
    exerciseLines = nonEmptyLines.slice(1);
  }

  if (exerciseLines.length === 0) {
    return [{ name: summary, setsCount: null, setsDetail: null }];
  }

  const workouts = [];
  for (let index = 0; index < exerciseLines.length; index += 1) {
    workouts.push({
      name: exerciseLines[index],
      setsCount: null,
      setsDetail: null,
    });
  }
  return workouts;
}

function tryWorkoutsFromStructuredLog(log) {
  const workoutLog = log.workoutLog;
  const hasStructuredLog = Array.isArray(workoutLog) && workoutLog.length > 0;
  if (!hasStructuredLog) return null;

  const workouts = exercisesFromStructuredWorkoutLog(workoutLog);
  if (!workouts.length) return null;

  return {
    workouts,
    workoutName: resolveWorkoutDayName(log, workouts),
    isRest: false,
  };
}

function workoutsFromLegacyDashboardSummary(log) {
  const hasSummaryField = log.dashboard_workouts != null;
  const summary = hasSummaryField ? String(log.dashboard_workouts).trim() : '';
  const looksLikeRestDay = REST_DAY_PATTERN.test(summary);

  if (summary && !looksLikeRestDay) {
    const dayTitle = resolveWorkoutDayName(log, []);
    const workouts = workoutsFromSummaryLines(summary, dayTitle);
    return {
      workouts,
      workoutName: dayTitle || resolveWorkoutDayName(log, workouts),
      isRest: false,
    };
  }

  return {
    workouts: [],
    workoutName: resolveWorkoutDayName(log, []),
    isRest: looksLikeRestDay && Boolean(summary),
  };
}

async function loadOneDailyLogPair(userId, dateKey) {
  try {
    // vocab: getDoc = one-shot Firestore read; path users/{uid}/dailyLogs/{YYYY-MM-DD}
    const logRef = doc(db, USERS_COLLECTION, userId, DAILY_LOGS_COLLECTION, dateKey);
    const logSnapshot = await getDoc(logRef);
    if (!logSnapshot.exists()) return [dateKey, null];
    return [dateKey, logSnapshot.data() || {}];
  } catch {
    return [dateKey, null];
  }
}

function buildDailyLogsByDateMap(dateAndLogPairs) {
  const logsByDate = {};
  for (let index = 0; index < dateAndLogPairs.length; index += 1) {
    const dateKey = dateAndLogPairs[index][0];
    const logData = dateAndLogPairs[index][1];
    if (logData) logsByDate[dateKey] = logData;
  }
  return logsByDate;
}
