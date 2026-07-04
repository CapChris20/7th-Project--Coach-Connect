/**
 * Weekly Report Screen
 *
 * Loads `users/{clientId}/weeklySummaries` from Firestore and renders the premium
 * weekly report UI from mapped client check-in data.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { db } from '../../app-start/config';
import CoachConnectHeader from '../components/shell/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import {
  useShellBottomNavInset,
  SHELL_SAFE_AREA_EDGES,
  ShellBottomNavAnchor,
} from '../../navigation/bottomNavMetrics';
import {
  parseDayNote,
  parseStructuredDayNote,
  formatDateRange,
} from '../../trainer-app/weekly-report/WeeklyReportPremium';
import { WeeklyReportThemeProvider } from './theme/WeeklyReportThemeContext';
import { mapFirestoreReportsToWeeks, formatDayForShare } from './data/mapFirestoreReport';
import { fetchNutritionByDayForRange } from './data/fetchWeekNutrition';
import {
  fetchDailyLogsByDayForRange,
  workoutsFromDailyLog,
} from './data/fetchWeekDailyLogs';
import { WeeklyReportScreenBody } from './WeeklyReportScreenBody';
import { WeeklyReportEmptyState } from './components/WeeklyReportEmptyState';

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

const REPORT_PARSERS = { parseDayNote, parseStructuredDayNote, formatDateRange };

export default function ViewWeekProgressReportScreen({
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
  reserveShellBottomNav = false,
}) {
  const shellBottomPad = useShellBottomNavInset(16);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [weekIndex, setWeekIndex] = useState(0);

  const [nutritionByDay, setNutritionByDay] = useState({});
  const [dailyLogsByDay, setDailyLogsByDay] = useState({});
  const [clientMeta, setClientMeta] = useState({});

  const load = useCallback(async () => {
    if (!clientId || !db) {
      setReports([]);
      setNutritionByDay({});
      setDailyLogsByDay({});
      setClientMeta({});
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

      let nutrition = {};
      let dailyLogs = {};
      let meta = {};
      if (rows.length > 0) {
        const oldest = rows[rows.length - 1].weekStart;
        const newestEnd = rows[0].weekEnd || rows[0].weekStart;
        const userSnap = await getDoc(doc(db, 'users', clientId));
        const userData = userSnap.exists() ? userSnap.data() : {};
        meta = {
          daysPerWeek: userData?.onboardingData?.daysPerWeek ?? userData?.daysPerWeek ?? null,
        };
        [nutrition, dailyLogs] = await Promise.all([
          fetchNutritionByDayForRange(clientId, oldest, newestEnd),
          fetchDailyLogsByDayForRange(clientId, oldest, newestEnd),
        ]);
      }

      setReports(rows);
      setNutritionByDay(nutrition);
      setDailyLogsByDay(dailyLogs);
      setClientMeta(meta);
      setWeekIndex(0);
    } catch (e) {
      console.warn('[ViewWeekProgressReportScreen] load failed', e?.message || e);
      setReports([]);
      setNutritionByDay({});
      setDailyLogsByDay({});
      setClientMeta({});
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const weeks = useMemo(
    () =>
      mapFirestoreReportsToWeeks(
        reports,
        REPORT_PARSERS,
        nutritionByDay,
        dailyLogsByDay,
        workoutsFromDailyLog,
        clientMeta,
      ),
    [reports, nutritionByDay, dailyLogsByDay, clientMeta],
  );

  const activeWeek = weeks[weekIndex] || null;
  const scrollBottomPad = reserveShellBottomNav ? shellBottomPad : 32;
  const showInlineBottomNav = !reserveShellBottomNav;

  const handleExport = useCallback(async () => {
    if (!activeWeek) return;
    const dayRows = (activeWeek.days || [])
      .map((d) => `<li>${formatDayForShare(d)}</li>`)
      .join('');
    const listHtml = (items) =>
      items?.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : '<p><em>None logged.</em></p>';

    const html = `
      <html><body style="font-family: -apple-system, sans-serif; padding: 24px;">
        <h1>Weekly Report</h1>
        <p><strong>${activeWeek.label}</strong>${clientName ? ` — ${clientName}` : ''}</p>
        <ul>
          <li>Avg sleep: ${activeWeek.stats.display.sleep}h</li>
          <li>Avg water: ${activeWeek.stats.display.water}oz</li>
          <li>Avg steps: ${activeWeek.stats.display.steps}</li>
          <li>Avg calories: ${activeWeek.stats.display.calories} cal</li>
          ${activeWeek.stats.workoutDaysLogged ? `<li>Workout days: ${activeWeek.stats.workoutDaysLogged}</li>` : ''}
        </ul>
        ${activeWeek.summary ? `<h2>Week summary</h2><p>${activeWeek.summary}</p>` : ''}
        <h2>Daily breakdown</h2>
        <ul>${dayRows}</ul>
        <h2>Weekly trends</h2>
        ${listHtml(activeWeek.trends)}
        <h2>Pros & wins</h2>
        ${listHtml(activeWeek.pros)}
        <h2>Cons / areas to improve</h2>
        ${listHtml(activeWeek.cons)}
        <h2>What to focus on</h2>
        ${listHtml(activeWeek.focus)}
        ${activeWeek.signOff ? `<p><em>${activeWeek.signOff}</em></p>` : ''}
      </body></html>`;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export weekly report' });
      } else {
        Alert.alert('Export ready', 'PDF saved — sharing is not available on this device.');
      }
    } catch (e) {
      console.warn('[ViewWeekProgressReportScreen] export failed', e?.message || e);
      Alert.alert('Export failed', 'Could not create PDF for this report.');
    }
  }, [activeWeek, clientName]);

  return (
    <WeeklyReportThemeProvider initialMode={isDark ? 'dark' : 'light'}>
      <View style={styles.root}>
        <SafeAreaView style={styles.safeTop} edges={SHELL_SAFE_AREA_EDGES}>
          <CoachConnectHeader
            title="Weekly Report"
            skipTopSafeInset
            appearanceIsDark={isDark}
            onBack={onClose}
            onProfilePress={onProfilePress}
            onSettingsPress={onSettingsPress}
            headerLeft={
              onClose ? (
                <TouchableOpacity
                  onPress={onClose}
                  activeOpacity={0.85}
                  accessibilityLabel="Go back"
                  style={styles.headerBack}
                  hitSlop={12}
                >
                  <Ionicons
                    name="chevron-back"
                    size={22}
                    color={isDark ? '#FFFFFF' : '#0A0A0F'}
                  />
                  <Text style={[styles.headerBackText, { color: isDark ? '#FFFFFF' : '#0A0A0F' }]}>
                    Weekly Report
                  </Text>
                </TouchableOpacity>
              ) : null
            }
          />

          <View style={styles.content}>
            {loading ? (
              <View style={styles.centered}>
                <ActivityIndicator color="#ff6b35" size="large" />
                <Text style={styles.hint}>Loading reports…</Text>
              </View>
            ) : weeks.length === 0 ? (
              <WeeklyReportEmptyState isClientSelfView={isClientSelfView} />
            ) : (
              <WeeklyReportScreenBody
                weeks={weeks}
                weekIndex={weekIndex}
                onWeekIndexChange={setWeekIndex}
                clientName={clientName}
                onExport={handleExport}
                contentBottomPad={scrollBottomPad}
              />
            )}
          </View>

          {showInlineBottomNav ? (
            <ShellBottomNavAnchor>
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
            </ShellBottomNavAnchor>
          ) : null}
        </SafeAreaView>
      </View>
    </WeeklyReportThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  safeTop: { flex: 1, minHeight: 0 },
  content: { flex: 1, minHeight: 0 },
  headerBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingRight: 8,
    maxWidth: '100%',
  },
  headerBackText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    minHeight: 200,
  },
  hint: { marginTop: 12, fontSize: 13, fontWeight: '500', color: '#b4b4c0' },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    color: '#b4b4c0',
  },
});
