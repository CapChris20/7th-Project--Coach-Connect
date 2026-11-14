// Loads weight / body-fat points from users/{uid}/dailyLogs for Progress charts.
// Flow: newest-first query → keep finite metric days → filter by range window → oldest→newest for the line.
// Used by ProgressChartsScreen. Field keys stay dashboard_weight / dashboard_bodyfat.
// Read order: constants → small helpers → chart recipes → PLUMBING at the bottom.

import { collection, getDocs, query, orderBy, limit, documentId } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const DAILY_LOGS_COLLECTION = 'dailyLogs';
// Manipulate here: how many dailyLogs to scan for charts (more = slower, fuller history)
const HISTORY_LOG_LIMIT = 220;
// Freeze: Firestore field letters must stay these exact strings.
export const WEIGHT_FIELD = 'dashboard_weight';
export const BODY_FAT_FIELD = 'dashboard_bodyfat';

// Manipulate here: range chip → day window. All = null means keep every loaded point.
export const RANGE_DAYS = {
  '4W': 28,
  '12W': 84,
  '6M': 183,
  All: null,
};

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const MS_PER_DAY =
  MS_PER_SECOND * SECONDS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;
const MS_PER_WEEK = MS_PER_DAY * DAYS_PER_WEEK;
// vocab: noon local avoids DST edge flips when parsing YYYY-MM-DD day keys
const NOON_LOCAL_TIME_SUFFIX = 'T12:00:00';
const DAY_KEY_LENGTH = 10;
const PROGRESS_FLOOR = 0;
const PROGRESS_CEILING = 1;
const MIN_WEEKS_SPAN = 1;

// ===== HELPER FUNCTIONS =====

/**
 * Empty card summary when the series has no points yet.
 * @param {number|null} goal
 * @returns {object}
 */
function emptyMetricSummary(goal) {
  return {
    current: null,
    start: null,
    change: null,
    goal: finiteGoalNumberOrNull(goal),
    progressPct: null,
    remaining: null,
    weeksSpan: 0,
  };
}

/**
 * @param {number|null|undefined} goal
 * @returns {number|null}
 */
function finiteGoalNumberOrNull(goal) {
  if (goal == null) {
    return null;
  }
  const goalAsNumber = Number(goal);
  if (!Number.isFinite(goalAsNumber)) {
    return null;
  }
  return goalAsNumber;
}

// ===== MAIN FUNCTION =====

/**
 * Pull one metric series from dailyLogs and return points oldest→newest for the line chart.
 * @param {string} userId
 * @param {string} fieldKey
 * @returns {Promise<{ dateKey: string, date: Date, value: number }[]>}
 */
export async function fetchMetricHistory(userId, fieldKey) {
  // 1. Bail when Firestore or ids are missing — chart shows empty, not a throw.
  if (!userId) {
    return [];
  }
  if (!db) {
    return [];
  }
  if (!fieldKey) {
    return [];
  }

  // 2. Newest days first so we stop after HISTORY_LOG_LIMIT without reading the whole collection.
  const logsCollection = collection(db, USERS_COLLECTION, userId, DAILY_LOGS_COLLECTION);
  const recentLogsQuery = query(
    logsCollection,
    orderBy(documentId(), 'desc'),
    limit(HISTORY_LOG_LIMIT),
  );
  const logsSnapshot = await getDocs(recentLogsQuery);

  // 3. Keep only days that actually logged this metric as a finite number.
  const chartPointsNewestFirst = collectFiniteMetricPoints(logsSnapshot, fieldKey);

  // 4. Query was newest-first; the chart draws left→right chronological.
  chartPointsNewestFirst.reverse();
  return chartPointsNewestFirst;
}

/**
 * Keep points inside the range window ending at the newest point (or today).
 * @param {{ date: Date, value: number }[]} points
 * @param {'4W'|'12W'|'6M'|'All'} rangeId
 * @returns {{ date: Date, value: number }[]}
 */
export function filterPointsByRange(points, rangeId) {
  // 1. Nothing to filter.
  if (!points) {
    return [];
  }
  if (points.length === 0) {
    return [];
  }

  // 2. "All" keeps a shallow copy of every loaded point.
  const windowDayCount = RANGE_DAYS[rangeId];
  if (windowDayCount == null) {
    return points.slice();
  }

  // 3. Window ends at the newest point's date (or "now" if somehow missing).
  const newestPoint = points[points.length - 1];
  let newestPointDate = new Date();
  if (newestPoint && newestPoint.date) {
    newestPointDate = newestPoint.date;
  }
  return pointsInsideDayWindow(points, newestPointDate, windowDayCount);
}

/**
 * Summaries for the Design Law weight / body-fat cards.
 * @param {{ value: number, date: Date }[]} points
 * @param {number|null} goal
 * @returns {object}
 */
export function summarizeMetricSeries(points, goal = null) {
  // 1. Empty series → nulls and weeksSpan 0.
  if (!points) {
    return emptyMetricSummary(goal);
  }
  if (points.length === 0) {
    return emptyMetricSummary(goal);
  }

  // 2. Start / current / change from the ends of the chronological series.
  const startValue = points[0].value;
  const currentValue = points[points.length - 1].value;
  const changeValue = currentValue - startValue;
  const goalNumber = finiteGoalNumberOrNull(goal);

  // 3. Progress toward goal (same fraction whether the target is lower or higher).
  const progressTowardGoal = progressNumbersTowardGoal(startValue, currentValue, goalNumber);

  // 4. How many weeks the loaded series spans (at least 1).
  const firstPointTime = points[0].date.getTime();
  const lastPointTime = points[points.length - 1].date.getTime();
  const spanMilliseconds = lastPointTime - firstPointTime;
  const rawWeeksSpanned = Math.round(spanMilliseconds / MS_PER_WEEK);
  const weeksSpanned = Math.max(MIN_WEEKS_SPAN, rawWeeksSpanned);

  return {
    current: currentValue,
    start: startValue,
    change: changeValue,
    goal: goalNumber,
    progressPct: progressTowardGoal.progressFraction,
    remaining: progressTowardGoal.remainingToGoal,
    weeksSpan: weeksSpanned,
  };
}

// ===== PLUMBING — skip unless debugging chart points / range math =====

/**
 * Walk a newest-first snapshot and build chart points (still newest-first order).
 * @param {{ docs: Array }} logsSnapshot
 * @param {string} fieldKey
 * @returns {{ dateKey: string, date: Date, value: number }[]}
 */
function collectFiniteMetricPoints(logsSnapshot, fieldKey) {
  const chartPoints = [];
  const dayDocuments = logsSnapshot.docs ? logsSnapshot.docs : [];
  for (let index = 0; index < dayDocuments.length; index += 1) {
    const dayDocument = dayDocuments[index];
    const dayData = dayDocument.data();
    const metricValue = parseFiniteMetricFromDay(dayData, fieldKey);
    if (metricValue == null) {
      continue;
    }
    const pointDate = dateFromDayKey(dayDocument.id);
    if (!pointDate) {
      continue;
    }
    chartPoints.push({
      dateKey: dayDocument.id,
      date: pointDate,
      value: metricValue,
    });
  }
  return chartPoints;
}

/**
 * @param {{ date: Date }[]} points
 * @param {Date} newestPointDate
 * @param {number} windowDayCount
 * @returns {{ date: Date }[]}
 */
function pointsInsideDayWindow(points, newestPointDate, windowDayCount) {
  const filteredPoints = [];
  for (let index = 0; index < points.length; index += 1) {
    const chartPoint = points[index];
    const daysFromNewest = daysBetweenDates(chartPoint.date, newestPointDate);
    if (daysFromNewest <= windowDayCount) {
      filteredPoints.push(chartPoint);
    }
  }
  return filteredPoints;
}

/**
 * @param {number} startValue
 * @param {number} currentValue
 * @param {number|null} goalNumber
 * @returns {{ progressFraction: number|null, remainingToGoal: number|null }}
 */
function progressNumbersTowardGoal(startValue, currentValue, goalNumber) {
  if (goalNumber == null) {
    return { progressFraction: null, remainingToGoal: null };
  }
  if (startValue === goalNumber) {
    return { progressFraction: null, remainingToGoal: null };
  }
  const traveledTowardGoal = startValue - currentValue;
  const totalDistanceToGoal = startValue - goalNumber;
  const rawFraction = traveledTowardGoal / totalDistanceToGoal;
  const clampedLow = Math.max(PROGRESS_FLOOR, rawFraction);
  const progressFraction = Math.min(PROGRESS_CEILING, clampedLow);
  const remainingToGoal = goalNumber - currentValue;
  return { progressFraction, remainingToGoal };
}

/**
 * @param {object|null|undefined} dayData
 * @param {string} fieldKey
 * @returns {number|null}
 */
function parseFiniteMetricFromDay(dayData, fieldKey) {
  if (!dayData) {
    return null;
  }
  const storedValue = dayData[fieldKey];
  if (storedValue == null) {
    return null;
  }
  if (storedValue === '') {
    return null;
  }
  const parsedNumber = Number(storedValue);
  if (!Number.isFinite(parsedNumber)) {
    return null;
  }
  return parsedNumber;
}

/**
 * @param {string} dayKey
 * @returns {Date|null}
 */
function dateFromDayKey(dayKey) {
  // vocab: dailyLogs doc ids are YYYY-MM-DD local keys
  if (typeof dayKey !== 'string') {
    return null;
  }
  if (dayKey.length < DAY_KEY_LENGTH) {
    return null;
  }
  const dayKeyPrefix = dayKey.slice(0, DAY_KEY_LENGTH);
  const noonLocalDate = new Date(`${dayKeyPrefix}${NOON_LOCAL_TIME_SUFFIX}`);
  if (Number.isNaN(noonLocalDate.getTime())) {
    return null;
  }
  return noonLocalDate;
}

/**
 * @param {Date} firstDate
 * @param {Date} secondDate
 * @returns {number}
 */
function daysBetweenDates(firstDate, secondDate) {
  const firstTime = firstDate.getTime();
  const secondTime = secondDate.getTime();
  const millisecondsApart = Math.abs(firstTime - secondTime);
  return millisecondsApart / MS_PER_DAY;
}
