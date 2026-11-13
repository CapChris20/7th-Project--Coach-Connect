// Loads weight / body-fat points from users/{uid}/dailyLogs for Progress charts.
// Flow: newest-first query → keep finite metric days → filter by range window → oldest→newest for the line.
// Used by ProgressChartsScreen. Field keys stay dashboard_weight / dashboard_bodyfat.

import { collection, getDocs, query, orderBy, limit, documentId } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const DAILY_LOGS_COLLECTION = 'dailyLogs';
// Manipulate here: how many dailyLogs to scan for charts (more = slower, fuller history)
const HISTORY_LOG_LIMIT = 220;
export const WEIGHT_FIELD = 'dashboard_weight';
export const BODY_FAT_FIELD = 'dashboard_bodyfat';

export const RANGE_DAYS = {
  '4W': 28,
  '12W': 84,
  '6M': 183,
  All: null,
};

// ===== HELPER FUNCTIONS =====

function parseFiniteMetric(dayData, fieldKey) {
  if (!dayData) return null;
  const raw = dayData[fieldKey];
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function dateFromDayKey(dayKey) {
  // vocab: dailyLogs doc ids are YYYY-MM-DD local keys
  if (typeof dayKey !== 'string' || dayKey.length < 10) return null;
  const d = new Date(`${dayKey.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a, b) {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * @param {string} userId
 * @param {string} fieldKey
 * @returns {Promise<{ dateKey: string, date: Date, value: number }[]>}
 */
export async function fetchMetricHistory(userId, fieldKey) {
  if (!userId || !db || !fieldKey) return [];
  const logsCollection = collection(db, USERS_COLLECTION, userId, DAILY_LOGS_COLLECTION);
  const recentLogsQuery = query(logsCollection, orderBy(documentId(), 'desc'), limit(HISTORY_LOG_LIMIT));
  const snap = await getDocs(recentLogsQuery);
  const points = [];
  snap.forEach((dayDoc) => {
    const value = parseFiniteMetric(dayDoc.data(), fieldKey);
    if (value == null) return;
    const date = dateFromDayKey(dayDoc.id);
    if (!date) return;
    points.push({ dateKey: dayDoc.id, date, value });
  });
  // Chart wants left→right chronological
  points.reverse();
  return points;
}

/**
 * Keep points inside the range window ending at the newest point (or today).
 * @param {{ date: Date, value: number }[]} points
 * @param {'4W'|'12W'|'6M'|'All'} rangeId
 */
export function filterPointsByRange(points, rangeId) {
  if (!points?.length) return [];
  const windowDays = RANGE_DAYS[rangeId];
  if (windowDays == null) return points.slice();
  const end = points[points.length - 1]?.date || new Date();
  return points.filter((p) => daysBetween(p.date, end) <= windowDays);
}

/**
 * Summaries for the Design Law weight / body-fat cards.
 * @param {{ value: number, date: Date }[]} points
 * @param {number|null} goal
 */
export function summarizeMetricSeries(points, goal = null) {
  if (!points?.length) {
    return {
      current: null,
      start: null,
      change: null,
      goal: goal != null && Number.isFinite(Number(goal)) ? Number(goal) : null,
      progressPct: null,
      remaining: null,
      weeksSpan: 0,
    };
  }
  const start = points[0].value;
  const current = points[points.length - 1].value;
  const change = current - start;
  const goalN = goal != null && Number.isFinite(Number(goal)) ? Number(goal) : null;
  let progressPct = null;
  let remaining = null;
  if (goalN != null && start !== goalN) {
    const traveled = start - current;
    const total = start - goalN;
    // Losing toward a lower goal (typical weight) or gaining toward higher — same fraction
    progressPct = Math.max(0, Math.min(1, traveled / total));
    remaining = goalN - current;
  }
  const ms = points[points.length - 1].date.getTime() - points[0].date.getTime();
  const weeksSpan = Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24 * 7)));
  return { current, start, change, goal: goalN, progressPct, remaining, weeksSpan };
}
