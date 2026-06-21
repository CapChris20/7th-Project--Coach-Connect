/**
 * Trainer Weekly Report Screen
 *
 * Purpose: UI screen or component: Trainer Weekly Report Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: formatChipRange, TrainerViewWeekProgressReportScreen
 *
 * @file-header
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { db } from '../../app-start/config';
import { WeeklyReportScrollBody, getWRTheme } from '../../trainer-app/weekly-report/WeeklyReportPremium';

export function formatChipRange(weekStart, weekEnd) {
  const ws = String(weekStart || '').trim();
  const we = String(weekEnd || ws).trim();
  if (!ws) return '';
  const s = new Date(`${ws}T12:00:00`);
  const e = new Date(`${we}T12:00:00`);
  const a = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const b = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${a} – ${b}`;
}

function CompactWeekSelector({ reports, selectedId, onSelect, isDark }) {
  const t = getWRTheme(isDark);
  const idx = reports.findIndex((r) => r.id === selectedId);
  const safeIdx = idx >= 0 ? idx : 0;
  const current = reports[safeIdx];
  const canPrev = safeIdx < reports.length - 1;
  const canNext = safeIdx > 0;
  const label = current ? formatChipRange(current.weekStart, current.weekEnd) : '—';

  const goPrev = () => {
    if (!canPrev) return;
    onSelect(reports[safeIdx + 1].id);
  };

  const goNext = () => {
    if (!canNext) return;
    onSelect(reports[safeIdx - 1].id);
  };

  const disabledColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.2)';

  return (
    <View style={[styles.weekBar, { backgroundColor: t.weekBarBg }]}>
      <TouchableOpacity
        onPress={goPrev}
        disabled={!canPrev}
        hitSlop={12}
        style={styles.weekNavBtn}
        accessibilityLabel="Previous week"
      >
        <Ionicons name="chevron-back" size={22} color={canPrev ? t.textSecondary : disabledColor} />
      </TouchableOpacity>

      <View style={[styles.weekPill, { backgroundColor: t.weekPillBg }]}>
        <Text style={[styles.weekPillText, { color: t.textPrimary }]} numberOfLines={1}>
          {label}
        </Text>
      </View>

      <TouchableOpacity
        onPress={goNext}
        disabled={!canNext}
        hitSlop={12}
        style={styles.weekNavBtn}
        accessibilityLabel="Next week"
      >
        <Ionicons name="chevron-forward" size={22} color={canNext ? t.textSecondary : disabledColor} />
      </TouchableOpacity>
    </View>
  );
}

/**
 * Full-screen weekly report: header, compact week selector, scrollable report body, bottom nav.
 */
export default function TrainerViewWeekProgressReportScreen({
  clientId,
  clientName = '',
  isClientSelfView = false,
  isDark = true,
  onClose,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
  onProfilePress,
  onSettingsPress,
}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);

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
      setSelectedDocId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } catch (e) {
      console.warn('[TrainerViewWeekProgressReportScreen] load failed', e?.message || e);
      setReports([]);
      setSelectedDocId(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedDocId) || reports[0] || null,
    [reports, selectedDocId]
  );

  const scrollBottomPad = 100 + insets.bottom;
  const theme = getWRTheme(isDark);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <SafeAreaView style={styles.safeTop} edges={['top', 'left', 'right']}>
        <CoachConnectHeader
          title="Weekly Report"
          isDark={isDark}
          skipTopSafeInset
          onBack={onClose}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />

        {!loading && reports.length > 0 ? (
          <CompactWeekSelector
            reports={reports}
            selectedId={selectedReport?.id || selectedDocId}
            onSelect={setSelectedDocId}
            isDark={isDark}
          />
        ) : null}

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.cyan} size="large" />
            <Text style={[styles.hint, { color: theme.textLabel }]}>Loading reports…</Text>
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.centered}>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {isClientSelfView
                ? 'No weekly reports yet. Check-ins will generate your first recap.'
                : 'No weekly reports saved for this client yet.'}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: scrollBottomPad }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <WeeklyReportScrollBody
              report={selectedReport}
              isDark={isDark}
              clientName={clientName}
            />
          </ScrollView>
        )}

        <BottomNavBar
          activeTabKey="home"
          onHomePress={onHomePress}
          onPlusPress={onPlusPress}
          onVoicePress={onVoicePress}
          onNutritionPress={onNutritionPress}
          onWorkoutPress={onWorkoutPress}
          onMessagesPress={onMessagesPress}
          onProfilePress={onProfilePress}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeTop: { flex: 1 },
  weekBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  weekNavBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekPill: {
    flex: 1,
    marginHorizontal: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekPillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scroll: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    minHeight: 200,
  },
  hint: { marginTop: 12, fontSize: 13, fontWeight: '500' },
  emptyText: { fontSize: 15, textAlign: 'center', lineHeight: 22, fontWeight: '500' },
});
