import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../app/config';
import WeeklyReportHeroCard from '../../client/components/WeeklyReportHeroCard';

function formatWeekChip(weekStart, weekEnd) {
  const ws = String(weekStart || '').trim();
  const we = String(weekEnd || ws).trim();
  if (!ws) return '';
  const s = new Date(`${ws}T12:00:00`);
  const e = new Date(`${we}T12:00:00`);
  const a = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const b = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${a} – ${b}`;
}

/**
 * Trainer dashboard: hero card under client chips → opens full weekly report for selected client.
 */
export default function TrainerWeeklyReportSection({ clientId, clientName, isDark = true, onOpenWeeklyReport }) {
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);

  const load = useCallback(async () => {
    if (!clientId || !db) {
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users', clientId, 'weeklySummaries'));
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.weekStart || r.weekId)
        .map((r) => ({
          ...r,
          weekStart: r.weekStart || r.weekId,
          weekEnd: r.weekEnd || r.weekEnd,
        }))
        .sort((a, b) => String(b.weekStart).localeCompare(String(a.weekStart)));
      setReports(rows);
    } catch (e) {
      console.warn('[TrainerWeeklyReportSection] load failed', e?.message || e);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const latest = reports[0] || null;

  if (!clientId) return null;

  return (
    <View style={styles.wrap}>
      <WeeklyReportHeroCard
        variant="compact"
        compactSurface="inline"
        audience="trainer"
        clientDisplayName={clientName}
        weekRangeLabel={latest ? formatWeekChip(latest.weekStart, latest.weekEnd) : ''}
        isDark={isDark}
        hasReport={reports.length > 0}
        loading={loading}
        onOpenReport={() => {
          if (!latest || typeof onOpenWeeklyReport !== 'function') return;
          onOpenWeeklyReport(clientId, clientName);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
  },
});
