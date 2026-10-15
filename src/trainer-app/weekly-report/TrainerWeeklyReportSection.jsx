// Weekly-report teaser card on the trainer dashboard, for whichever client is selected.
// Flow: clientId changes → load that client's weeklySummaries → keep the newest → render a compact hero card.
// Used under the client chips on the trainer dashboard.

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import WeeklyReportBanner from './WeeklyReportBanner';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const WEEKLY_SUMMARIES_COLLECTION = 'weeklySummaries';
const DATE_LOCALE = 'en-US';
const DATE_CHIP_OPTIONS = { month: 'short', day: 'numeric' };
// The 'T12:00:00' suffix is the important bit: parsing a bare 'YYYY-MM-DD' is treated as UTC
// midnight, which in western timezones displays as the PREVIOUS day. Anchoring at local noon
// keeps the date correct no matter the user's offset.
const NOON_LOCAL_SUFFIX = 'T12:00:00';
const BANNER_VARIANT = 'compact';
const BANNER_AUDIENCE = 'trainer';

// ===== HELPER FUNCTIONS =====

// Turns two ISO dates into the short "Mar 3 – Mar 9" chip label.
function formatWeekChip(weekStart, weekEnd) {
  const weekStartText = String(weekStart || '').trim();
  // If no end date was stored, treat the week as a single day rather than rendering "– Invalid Date".
  const weekEndText = String(weekEnd || weekStartText).trim();
  if (!weekStartText) return '';
  const startDate = new Date(`${weekStartText}${NOON_LOCAL_SUFFIX}`);
  const endDate = new Date(`${weekEndText}${NOON_LOCAL_SUFFIX}`);
  // Manipulate here: 'en-US' + short month/numeric day is the chip's date format.
  const startLabel = startDate.toLocaleDateString(DATE_LOCALE, DATE_CHIP_OPTIONS);
  const endLabel = endDate.toLocaleDateString(DATE_LOCALE, DATE_CHIP_OPTIONS);
  // Note this is an en dash (–), not a hyphen — it's the typographically correct range separator.
  return `${startLabel} – ${endLabel}`;
}

function hasWeekIdentity(summaryRow) {
  return summaryRow.weekStart || summaryRow.weekId;
}

function normalizeWeekDates(summaryRow) {
  return {
    ...summaryRow,
    // Older summaries stored the week under `weekId`; normalize both shapes to weekStart so
    // the sort and the chip formatter only ever deal with one field name.
    weekStart: summaryRow.weekStart || summaryRow.weekId,
    weekEnd: summaryRow.weekEnd || summaryRow.weekEnd,
  };
}

function newestWeekFirst(leftRow, rightRow) {
  // Newest first. Because weekStart is 'YYYY-MM-DD', plain string comparison sorts
  // chronologically — no Date parsing needed.
  return String(rightRow.weekStart).localeCompare(String(leftRow.weekStart));
}

function weeklySummariesFromSnapshot(summariesSnapshot) {
  return summariesSnapshot.docs
    .map((summaryDoc) => ({ id: summaryDoc.id, ...summaryDoc.data() }))
    .filter((summaryRow) => hasWeekIdentity(summaryRow))
    .map((summaryRow) => normalizeWeekDates(summaryRow))
    .sort(newestWeekFirst);
}

// ===== MAIN FUNCTION =====

/**
 * Trainer dashboard: hero card under client chips → opens full weekly report for selected client.
 * Hooks stay in this order: loading, reports, load callback, then the load effect.
 * @param {{ clientId?: string, clientName?: string, isDark?: boolean, onOpenWeeklyReport?: Function }} props
 * @returns {import('react').ReactElement|null}
 */
export default function TrainerWeeklyReportSection({ clientId, clientName, isDark = true, onOpenWeeklyReport }) {
  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState([]);

  // Loads every weekly summary for the selected client. useCallback keyed on clientId means the
  // function identity only changes when the client does — which is what lets the effect below
  // depend on it without re-fetching on every render.
  const loadWeeklySummaries = useCallback(async () => {
    // No client selected yet (or Firebase still booting): settle into the empty state rather than
    // leaving the spinner up forever.
    if (!clientId || !db) {
      setReports([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // A subcollection read: users/{clientId}/weeklySummaries. One-shot getDocs rather than a
      // live listener because summaries are written once a week — realtime buys nothing here.
      const summariesSnapshot = await getDocs(
        collection(db, USERS_COLLECTION, clientId, WEEKLY_SUMMARIES_COLLECTION),
      );
      setReports(weeklySummariesFromSnapshot(summariesSnapshot));
    } catch (loadError) {
      // Soft-fail to empty: this card sits on the dashboard, so a read error should show
      // "no report yet", not break the page.
      console.warn('[TrainerWeeklyReportSection] load failed', loadError?.message || loadError);
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  }, [clientId]);

  // Runs the load on mount and again whenever the callback changes — i.e. whenever the trainer taps a
  // different client chip.
  useEffect(() => {
    loadWeeklySummaries();
  }, [loadWeeklySummaries]);

  // Thanks to the descending sort, index 0 is the most recent week. `|| null` normalizes the
  // empty-array case so the checks below read cleanly.
  const latestReport = reports[0] || null;

  // Nothing to show without a selected client. Checked AFTER the hooks because React requires
  // hooks to run in the same order on every render — an early return above them would break that.
  if (!clientId) return null;

  return (
    <View style={styles.wrap}>
      {/* One shared hero card component serves both apps; `variant` and `audience` switch it to
          the small trainer-facing presentation instead of the client's full-size version. */}
      <WeeklyReportBanner
        variant={BANNER_VARIANT}
        audience={BANNER_AUDIENCE}
        clientDisplayName={clientName}
        // Empty label when there's no report yet — the card renders its own empty state.
        weekRangeLabel={latestReport ? formatWeekChip(latestReport.weekStart, latestReport.weekEnd) : ''}
        isDark={isDark}
        hasReport={reports.length > 0}
        loading={isLoading}
        onOpenReport={() => {
          // Double guard: the parent may not have passed a handler, and there's nothing to open
          // when the client has no summaries. Bailing here (rather than disabling the card) keeps
          // the tap a harmless no-op in both cases.
          if (typeof onOpenWeeklyReport !== 'function' || reports.length === 0) return;
          onOpenWeeklyReport(clientId, clientName);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // Manipulate here: small breathing room between the client chips above and this card.
    marginTop: 4,
  },
});
