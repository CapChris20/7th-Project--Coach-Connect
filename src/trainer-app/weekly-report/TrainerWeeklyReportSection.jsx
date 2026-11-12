// Weekly-report teaser on the trainer dashboard (Design Law panel at bottom of home).
// Flow: clientId changes → load weeklySummaries → newest row → 2×2 grid + adherence bar.
// Used after Tools on TrainerHomeContent (not under the client carousel).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import {
  DesignLawTrainerWeeklyReportPanel,
  trainerHomeThemeColors,
} from '../home/DesignLawTrainerHomeBlocks';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const WEEKLY_SUMMARIES_COLLECTION = 'weeklySummaries';
const DATE_LOCALE = 'en-US';
const DATE_CHIP_OPTIONS = { month: 'short', day: 'numeric' };
const NOON_LOCAL_SUFFIX = 'T12:00:00';
const DAYS_IN_WEEK = 7;

// ===== HELPER FUNCTIONS =====

function formatWeekChip(weekStart, weekEnd) {
  const weekStartText = String(weekStart || '').trim();
  const weekEndText = String(weekEnd || weekStartText).trim();
  if (!weekStartText) return '';
  const startDate = new Date(`${weekStartText}${NOON_LOCAL_SUFFIX}`);
  const endDate = new Date(`${weekEndText}${NOON_LOCAL_SUFFIX}`);
  const startLabel = startDate.toLocaleDateString(DATE_LOCALE, DATE_CHIP_OPTIONS);
  const endLabel = endDate.toLocaleDateString(DATE_LOCALE, DATE_CHIP_OPTIONS);
  return `${startLabel} – ${endLabel}`;
}

function hasWeekIdentity(summaryRow) {
  return summaryRow.weekStart || summaryRow.weekId;
}

function normalizeWeekDates(summaryRow) {
  return {
    ...summaryRow,
    weekStart: summaryRow.weekStart || summaryRow.weekId,
    weekEnd: summaryRow.weekEnd || summaryRow.weekEnd,
  };
}

function newestWeekFirst(leftRow, rightRow) {
  return String(rightRow.weekStart).localeCompare(String(leftRow.weekStart));
}

function weeklySummariesFromSnapshot(summariesSnapshot) {
  return summariesSnapshot.docs
    .map((summaryDoc) => ({ id: summaryDoc.id, ...summaryDoc.data() }))
    .filter((summaryRow) => hasWeekIdentity(summaryRow))
    .map((summaryRow) => normalizeWeekDates(summaryRow))
    .sort(newestWeekFirst);
}

function parseNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function adherenceFromReport(report) {
  const logged =
    parseNum(report?.daysLogged) ??
    parseNum(report?.loggedDays) ??
    (Array.isArray(report?.days) ? report.days.filter((d) => d && d !== 'empty').length : null);
  if (logged == null) return null;
  return Math.min(1, Math.max(0, logged / DAYS_IN_WEEK));
}

function metricCellsFromReport(report, clientsLogged, clientsTotal) {
  const sleep = parseNum(report?.avgSleep);
  const sessions =
    parseNum(report?.sessionsDone) ??
    parseNum(report?.workoutsCompleted) ??
    parseNum(report?.trainingDaysCompleted);

  return [
    {
      value: sessions != null ? String(Math.round(sessions)) : '—',
      label: 'Sessions done',
    },
    {
      value: clientsTotal > 0 ? `${clientsLogged}/${clientsTotal}` : '—',
      label: 'Clients logged',
    },
    {
      value: report?.avgProtein != null ? `${report.avgProtein} g` : '—',
      label: 'Avg protein',
    },
    {
      value: sleep != null ? `${sleep} h` : '—',
      label: 'Avg sleep',
    },
  ];
}

// ===== MAIN FUNCTION =====

/**
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
  clientName: _clientName,
  isDark = true,
  clientsLogged = 0,
  clientsTotal = 0,
  onOpenWeeklyReport,
}) {
  const themeColors = trainerHomeThemeColors(isDark);
  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState([]);

  const loadWeeklySummaries = useCallback(async () => {
    if (!clientId || !db) {
      setReports([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const summariesSnapshot = await getDocs(
        collection(db, USERS_COLLECTION, clientId, WEEKLY_SUMMARIES_COLLECTION),
      );
      setReports(weeklySummariesFromSnapshot(summariesSnapshot));
    } catch (loadError) {
      console.warn('[TrainerWeeklyReportSection] load failed', loadError?.message || loadError);
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadWeeklySummaries();
  }, [loadWeeklySummaries]);

  const latestReport = reports[0] || null;
  const hasReport = reports.length > 0;

  const weekRangeLabel = latestReport
    ? formatWeekChip(latestReport.weekStart, latestReport.weekEnd)
    : '';

  const adherencePct = useMemo(() => adherenceFromReport(latestReport), [latestReport]);
  const metricCells = useMemo(
    () => metricCellsFromReport(latestReport, clientsLogged, clientsTotal),
    [latestReport, clientsLogged, clientsTotal],
  );

  if (!clientId) return null;

  return (
    <View>
      <DesignLawTrainerWeeklyReportPanel
        themeColors={themeColors}
        loading={isLoading}
        hasReport={hasReport}
        weekRangeLabel={weekRangeLabel}
        clientsLogged={clientsLogged}
        clientsTotal={clientsTotal}
        adherencePct={adherencePct}
        metricCells={metricCells}
        onOpenReport={() => {
          if (typeof onOpenWeeklyReport !== 'function' || !hasReport) return;
          onOpenWeeklyReport(clientId, _clientName);
        }}
      />
    </View>
  );
}
