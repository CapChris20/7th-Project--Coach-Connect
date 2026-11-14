// Weekly-report teaser on the trainer dashboard (Design Law panel under Tools).
// Flow: clientId changes → read weeklySummaries → newest week → 2×2 metrics + adherence.
// Used by TrainerHomeContent after the Tools block (not under the client carousel).
//
// vocab: getDocs = one-shot Firestore read of a collection (not a live listener)
// vocab: weeklySummaries = users/{clientId}/weeklySummaries docs keyed by week

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import {
  TrainerWeeklyReportPanel,
  trainerHomeThemeColors,
} from '../home/TrainerHomeBlocks';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const WEEKLY_SUMMARIES_COLLECTION = 'weeklySummaries';
const DATE_LOCALE = 'en-US';
const DATE_CHIP_OPTIONS = { month: 'short', day: 'numeric' };
// Manipulate here: noon local avoids DST shifting the chip label by a day.
const NOON_LOCAL_SUFFIX = 'T12:00:00';
const DAYS_IN_WEEK = 7;
const EMPTY_METRIC_PLACEHOLDER = '—';

// ===== HELPER FUNCTIONS =====

/**
 * Turn weekStart / weekEnd ISO dates into a short chip like "Nov 10 – Nov 16".
 * @param {string} weekStart
 * @param {string} weekEnd
 * @returns {string}
 */
function weekRangeChipLabel(weekStart, weekEnd) {
  const weekStartText = String(weekStart || '').trim();
  const weekEndText = String(weekEnd || weekStartText).trim();
  if (!weekStartText) {
    return '';
  }

  const startDate = new Date(`${weekStartText}${NOON_LOCAL_SUFFIX}`);
  const endDate = new Date(`${weekEndText}${NOON_LOCAL_SUFFIX}`);
  const startLabel = startDate.toLocaleDateString(DATE_LOCALE, DATE_CHIP_OPTIONS);
  const endLabel = endDate.toLocaleDateString(DATE_LOCALE, DATE_CHIP_OPTIONS);
  return `${startLabel} – ${endLabel}`;
}

function summaryRowHasWeekIdentity(summaryRow) {
  const hasWeekStart = Boolean(summaryRow.weekStart);
  const hasWeekId = Boolean(summaryRow.weekId);
  return hasWeekStart || hasWeekId;
}

function summaryRowWithNormalizedWeekDates(summaryRow) {
  // Some older docs only store weekId — treat it as weekStart so sorting still works.
  const weekStart = summaryRow.weekStart || summaryRow.weekId;
  const weekEnd = summaryRow.weekEnd || summaryRow.weekEnd;
  return {
    ...summaryRow,
    weekStart,
    weekEnd,
  };
}

function sortSummariesNewestWeekFirst(leftRow, rightRow) {
  const rightWeek = String(rightRow.weekStart);
  const leftWeek = String(leftRow.weekStart);
  return rightWeek.localeCompare(leftWeek);
}

/**
 * Snapshot docs → plain rows → keep week-shaped ones → newest first.
 * @param {object} summariesSnapshot
 * @returns {object[]}
 */
function weeklyReportsFromFirestoreSnapshot(summariesSnapshot) {
  const rowsFromDocs = [];
  for (const summaryDoc of summariesSnapshot.docs) {
    rowsFromDocs.push({
      id: summaryDoc.id,
      ...summaryDoc.data(),
    });
  }

  const rowsWithWeek = [];
  for (const summaryRow of rowsFromDocs) {
    if (!summaryRowHasWeekIdentity(summaryRow)) {
      continue;
    }
    rowsWithWeek.push(summaryRowWithNormalizedWeekDates(summaryRow));
  }

  rowsWithWeek.sort(sortSummariesNewestWeekFirst);
  return rowsWithWeek;
}

function finiteNumberOrNull(value) {
  const parsedNumber = Number(value);
  if (!Number.isFinite(parsedNumber)) {
    return null;
  }
  return parsedNumber;
}

/**
 * Count non-empty day slots when the summary only has a days[] array.
 * @param {Array|*} daysArray
 * @returns {number|null}
 */
function countLoggedDaysFromDaysArray(daysArray) {
  if (!Array.isArray(daysArray)) {
    return null;
  }

  let loggedCount = 0;
  for (const dayEntry of daysArray) {
    const dayLooksEmpty = !dayEntry || dayEntry === 'empty';
    if (dayLooksEmpty) {
      continue;
    }
    loggedCount += 1;
  }
  return loggedCount;
}

/**
 * Prefer daysLogged / loggedDays fields; fall back to counting days[].
 * @param {object|null} report
 * @returns {number|null}
 */
function daysLoggedFromReport(report) {
  const fromDaysLogged = finiteNumberOrNull(report?.daysLogged);
  if (fromDaysLogged != null) {
    return fromDaysLogged;
  }

  const fromLoggedDays = finiteNumberOrNull(report?.loggedDays);
  if (fromLoggedDays != null) {
    return fromLoggedDays;
  }

  return countLoggedDaysFromDaysArray(report?.days);
}

/**
 * Fraction of the week that was logged (0–1), or null when unknown.
 * @param {object|null} report
 * @returns {number|null}
 */
function adherenceFractionFromReport(report) {
  const daysLogged = daysLoggedFromReport(report);
  if (daysLogged == null) {
    return null;
  }

  const rawFraction = daysLogged / DAYS_IN_WEEK;
  const clampedLow = Math.max(0, rawFraction);
  const clamped = Math.min(1, clampedLow);
  return clamped;
}

function sessionsDoneFromReport(report) {
  const fromSessionsDone = finiteNumberOrNull(report?.sessionsDone);
  if (fromSessionsDone != null) {
    return fromSessionsDone;
  }

  const fromWorkoutsCompleted = finiteNumberOrNull(report?.workoutsCompleted);
  if (fromWorkoutsCompleted != null) {
    return fromWorkoutsCompleted;
  }

  return finiteNumberOrNull(report?.trainingDaysCompleted);
}

/**
 * Four cells for the Design Law 2×2 grid on the trainer home panel.
 * @param {object|null} report
 * @param {number} clientsLogged
 * @param {number} clientsTotal
 * @returns {{ value: string, label: string }[]}
 */
function metricCellsForLatestReport(report, clientsLogged, clientsTotal) {
  const averageSleepHours = finiteNumberOrNull(report?.avgSleep);
  const sessionsDone = sessionsDoneFromReport(report);

  let sessionsText = EMPTY_METRIC_PLACEHOLDER;
  if (sessionsDone != null) {
    sessionsText = String(Math.round(sessionsDone));
  }

  let clientsLoggedText = EMPTY_METRIC_PLACEHOLDER;
  if (clientsTotal > 0) {
    clientsLoggedText = `${clientsLogged}/${clientsTotal}`;
  }

  let proteinText = EMPTY_METRIC_PLACEHOLDER;
  if (report?.avgProtein != null) {
    proteinText = `${report.avgProtein} g`;
  }

  let sleepText = EMPTY_METRIC_PLACEHOLDER;
  if (averageSleepHours != null) {
    sleepText = `${averageSleepHours} h`;
  }

  return [
    { value: sessionsText, label: 'Sessions done' },
    { value: clientsLoggedText, label: 'Clients logged' },
    { value: proteinText, label: 'Avg protein' },
    { value: sleepText, label: 'Avg sleep' },
  ];
}

// ===== MAIN FUNCTION =====

/**
 * Trainer-home weekly report teaser for the selected client.
 * @param {{
 *   clientId?: string,
 *   clientName?: string,
 *   isDark?: boolean,
 *   clientsLogged?: number,
 *   clientsTotal?: number,
 *   onOpenWeeklyReport?: Function,
 * }} props
 */
export default function TrainerWeeklyReportSection({
  clientId,
  clientName: clientDisplayName,
  isDark = true,
  clientsLogged = 0,
  clientsTotal = 0,
  onOpenWeeklyReport,
}) {
  const themeColors = trainerHomeThemeColors(isDark);
  // Hook order frozen: loading flag, then report list.
  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState([]);

  /**
   * Pull users/{clientId}/weeklySummaries once and keep newest-first in state.
   */
  const loadWeeklySummaries = useCallback(async () => {
    // 1. No client (or no db) → clear panel; do not spin forever.
    if (!clientId || !db) {
      setReports([]);
      setIsLoading(false);
      return;
    }

    // 2. Read the collection and normalize into newest-week-first rows.
    setIsLoading(true);
    try {
      // vocab: collection(db, users, clientId, weeklySummaries) = nested path under that client
      const summariesPath = collection(db, USERS_COLLECTION, clientId, WEEKLY_SUMMARIES_COLLECTION);
      const summariesSnapshot = await getDocs(summariesPath);
      const sortedReports = weeklyReportsFromFirestoreSnapshot(summariesSnapshot);
      setReports(sortedReports);
    } catch (loadError) {
      console.warn('[TrainerWeeklyReportSection] load failed', loadError?.message || loadError);
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  // Re-fetch whenever the selected client changes (callback identity tracks clientId).
  useEffect(() => {
    loadWeeklySummaries();
  }, [loadWeeklySummaries]);

  const latestReport = reports[0] || null;
  const hasReport = reports.length > 0;

  let weekRangeLabel = '';
  if (latestReport) {
    weekRangeLabel = weekRangeChipLabel(latestReport.weekStart, latestReport.weekEnd);
  }

  const adherencePct = useMemo(
    () => adherenceFractionFromReport(latestReport),
    [latestReport],
  );
  const metricCells = useMemo(
    () => metricCellsForLatestReport(latestReport, clientsLogged, clientsTotal),
    [latestReport, clientsLogged, clientsTotal],
  );

  // No selected client → render nothing (parent still owns the carousel).
  if (!clientId) {
    return null;
  }

  const openReportForClient = () => {
    // 1. Need a real opener and at least one saved week.
    if (typeof onOpenWeeklyReport !== 'function') {
      return;
    }
    if (!hasReport) {
      return;
    }
    // 2. Hand client id + display name up to the home screen navigator.
    onOpenWeeklyReport(clientId, clientDisplayName);
  };

  return (
    <View>
      <TrainerWeeklyReportPanel
        themeColors={themeColors}
        loading={isLoading}
        hasReport={hasReport}
        weekRangeLabel={weekRangeLabel}
        clientsLogged={clientsLogged}
        clientsTotal={clientsTotal}
        adherencePct={adherencePct}
        metricCells={metricCells}
        onOpenReport={openReportForClient}
      />
    </View>
  );
}
