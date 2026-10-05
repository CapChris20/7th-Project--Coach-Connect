// Weekly-report teaser card on the trainer dashboard, for whichever client is selected.
// Flow: clientId changes → load that client's weeklySummaries → keep the newest → render a
// compact hero card that opens the full report on tap.
// Used under the client chips on the trainer dashboard.
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';
import WeeklyReportBanner from './WeeklyReportBanner';

// Turns two ISO dates into the short "Mar 3 – Mar 9" chip label.
function formatWeekChip(weekStart, weekEnd) {
  const ws = String(weekStart || '').trim();
  // If no end date was stored, treat the week as a single day rather than rendering "– Invalid Date".
  const we = String(weekEnd || ws).trim();
  if (!ws) return '';
  // The 'T12:00:00' suffix is the important bit: parsing a bare 'YYYY-MM-DD' is treated as UTC
  // midnight, which in western timezones displays as the PREVIOUS day. Anchoring at local noon
  // keeps the date correct no matter the user's offset.
  const s = new Date(`${ws}T12:00:00`);
  const e = new Date(`${we}T12:00:00`);
  // Manipulate here: 'en-US' + short month/numeric day is the chip's date format. Switch to
  // undefined for the device locale, or add year: 'numeric' to include the year.
  const a = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const b = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  // Note this is an en dash (–), not a hyphen — it's the typographically correct range separator.
  return `${a} – ${b}`;
}

/**
 * Trainer dashboard: hero card under client chips → opens full weekly report for selected client.
 */
export default function TrainerWeeklyReportSection({ clientId, clientName, isDark = true, onOpenWeeklyReport }) {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);

  // Loads every weekly summary for the selected client. useCallback keyed on clientId means the
  // function identity only changes when the client does — which is what lets the effect below
  // depend on it without re-fetching on every render.
  const load = useCallback(async () => {
    // No client selected yet (or Firebase still booting): settle into the empty state rather than
    // leaving the spinner up forever.
    if (!clientId || !db) {
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // A subcollection read: users/{clientId}/weeklySummaries. One-shot getDocs rather than a
      // live listener because summaries are written once a week — realtime buys nothing here.
      const snap = await getDocs(collection(db, 'users', clientId, 'weeklySummaries'));
      const rows = snap.docs
        // Keep the doc id alongside the fields; the report screen needs it to load details.
        .map((d) => ({ id: d.id, ...d.data() }))
        // Drop docs with no week identity at all — they can't be dated, sorted, or opened.
        .filter((r) => r.weekStart || r.weekId)
        .map((r) => ({
          ...r,
          // Older summaries stored the week under `weekId`; normalize both shapes to weekStart so
          // the sort and the chip formatter only ever deal with one field name.
          weekStart: r.weekStart || r.weekId,
          weekEnd: r.weekEnd || r.weekEnd,
        }))
        // Newest first. Because weekStart is 'YYYY-MM-DD', plain string comparison sorts
        // chronologically — no Date parsing needed. b vs a makes it descending.
        .sort((a, b) => String(b.weekStart).localeCompare(String(a.weekStart)));
      setReports(rows);
    } catch (e) {
      // Soft-fail to empty: this card sits on the dashboard, so a read error should show
      // "no report yet", not break the page.
      console.warn('[TrainerWeeklyReportSection] load failed', e?.message || e);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  // Runs the load on mount and again whenever `load` changes — i.e. whenever the trainer taps a
  // different client chip.
  useEffect(() => {
    load();
  }, [load]);

  // Thanks to the descending sort, index 0 is the most recent week. `|| null` normalizes the
  // empty-array case so the checks below read cleanly.
  const latest = reports[0] || null;

  // Nothing to show without a selected client. Checked AFTER the hooks because React requires
  // hooks to run in the same order on every render — an early return above them would break that.
  if (!clientId) return null;

  return (
    <View style={styles.wrap}>
      {/* One shared hero card component serves both apps; `variant` and `audience` switch it to
          the small trainer-facing presentation instead of the client's full-size version. */}
      <WeeklyReportBanner
        variant="compact"
        audience="trainer"
        clientDisplayName={clientName}
        // Empty label when there's no report yet — the card renders its own empty state.
        weekRangeLabel={latest ? formatWeekChip(latest.weekStart, latest.weekEnd) : ''}
        isDark={isDark}
        hasReport={reports.length > 0}
        loading={loading}
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
