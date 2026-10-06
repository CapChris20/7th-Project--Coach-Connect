// Weekly report screen. Loads saved weeks, then the sleep chart and daily breakdown.
// Flow: read users/{clientId}/weeklySummaries → load food and daily logs for that span → render or export a PDF.
// Used from the client home and the trainer's client view.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { db } from '../../app-start/cloudConnection';
import TopHeader from '../loading-and-header/TopHeader';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import {
  useShellBottomNavInset,
  SHELL_SAFE_AREA_EDGES,
  ShellBottomNavAnchor,
} from '../../navigation/bottomMenuSpacing';
import {
  parseDayNote,
  parseStructuredDayNote,
  formatDateRange,
} from '../../trainer-app/weekly-report/WeeklyReportBars';
import { WeeklyReportThemeProvider } from './reportColorSettings';
import { prepareReportForScreensToWeeks, formatDayForShare } from './prepareReportForScreen';
import { fetchNutritionByDayForRange } from './loadWeekFoodTotals';
import {
  fetchDailyLogsByDayForRange,
  workoutsFromDailyLog,
} from './loadWeekDailyEntries';
import { WeeklyReportBody } from './WeeklyReportBody';
import { NoReportYet } from './NoReportYet';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const WEEKLY_SUMMARIES_COLLECTION = 'weeklySummaries';
const REPORT_PARSERS = { parseDayNote, parseStructuredDayNote, formatDateRange };
// Manipulate here: extra space above the shell's bottom menu. 16 is the inset the menu already uses.
const SHELL_NAV_CONTENT_INSET = 16;

// ===== HELPER FUNCTIONS =====

function mapSummaryDocsToRows(summaryDocs) {
  return summaryDocs
    .map((summaryDoc) => ({ id: summaryDoc.id, ...summaryDoc.data() }))
    .filter((row) => row.weekStart || row.weekId)
    .map((row) => ({
      ...row,
      weekStart: row.weekStart || row.weekId,
      weekEnd: row.weekEnd || row.weekEnd,
    }))
    .sort((left, right) => String(right.weekStart).localeCompare(String(left.weekStart)));
}

async function loadSupportingWeekData(clientId, rows) {
  if (rows.length === 0) {
    return { nutrition: {}, dailyLogs: {}, meta: {} };
  }

  const oldestWeekStart = rows[rows.length - 1].weekStart;
  const newestWeekEnd = rows[0].weekEnd || rows[0].weekStart;
  const userSnap = await getDoc(doc(db, USERS_COLLECTION, clientId));
  const userData = userSnap.exists() ? userSnap.data() : {};
  const meta = {
    daysPerWeek: userData?.onboardingData?.daysPerWeek ?? userData?.daysPerWeek ?? null,
  };
  const [nutrition, dailyLogs] = await Promise.all([
    fetchNutritionByDayForRange(clientId, oldestWeekStart, newestWeekEnd),
    fetchDailyLogsByDayForRange(clientId, oldestWeekStart, newestWeekEnd),
  ]);
  return { nutrition, dailyLogs, meta };
}

function buildShareListHtml(items) {
  if (items?.length) {
    return `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`;
  }
  return '<p><em>None logged.</em></p>';
}

function buildDayShareRows(days) {
  return (days || []).map((day) => `<li>${formatDayForShare(day)}</li>`).join('');
}

function buildWeeklyReportHtml(activeWeek, clientName) {
  const dayRows = buildDayShareRows(activeWeek.days);
  return `
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
        ${buildShareListHtml(activeWeek.trends)}
        <h2>Pros & wins</h2>
        ${buildShareListHtml(activeWeek.pros)}
        <h2>Cons / areas to improve</h2>
        ${buildShareListHtml(activeWeek.cons)}
        <h2>What to focus on</h2>
        ${buildShareListHtml(activeWeek.focus)}
        ${activeWeek.signOff ? `<p><em>${activeWeek.signOff}</em></p>` : ''}
      </body></html>`;
}

function clearLoadedReport(setters) {
  setters.setReports([]);
  setters.setNutritionByDay({});
  setters.setDailyLogsByDay({});
  setters.setClientMeta({});
}

// ===== MAIN FUNCTION =====

/**
 * Short "Mar 1 – Mar 7" label for a week chip.
 * @param {string} weekStart
 * @param {string} weekEnd
 * @returns {string}
 */
export function formatChipRange(weekStart, weekEnd) {
  const weekStartText = String(weekStart || '').trim();
  const weekEndText = String(weekEnd || weekStartText).trim();
  if (!weekStartText) return '';
  const startDate = new Date(`${weekStartText}T12:00:00`);
  const endDate = new Date(`${weekEndText}T12:00:00`);
  const startLabel = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

/**
 * Full weekly report for one client, including PDF export.
 * @param {object} props
 */
export default function WeeklyReportScreen({
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
  const shellBottomPad = useShellBottomNavInset(SHELL_NAV_CONTENT_INSET);
  const [isLoadingReport, setIsLoadingReport] = useState(true);
  const [reports, setReports] = useState([]);
  const [weekIndex, setWeekIndex] = useState(0);
  const [nutritionByDay, setNutritionByDay] = useState({});
  const [dailyLogsByDay, setDailyLogsByDay] = useState({});
  const [clientMeta, setClientMeta] = useState({});

  const load = useCallback(async () => {
    if (!clientId || !db) {
      clearLoadedReport({ setReports, setNutritionByDay, setDailyLogsByDay, setClientMeta });
      setIsLoadingReport(false);
      return;
    }
    setIsLoadingReport(true);
    try {
      // vocab: getDocs = one-shot Firestore read. collection() points at users/{id}/weeklySummaries.
      const snap = await getDocs(collection(db, USERS_COLLECTION, clientId, WEEKLY_SUMMARIES_COLLECTION));
      const rows = mapSummaryDocsToRows(snap.docs);
      const supporting = await loadSupportingWeekData(clientId, rows);
      setReports(rows);
      setNutritionByDay(supporting.nutrition);
      setDailyLogsByDay(supporting.dailyLogs);
      setClientMeta(supporting.meta);
      setWeekIndex(0);
    } catch (error) {
      console.warn('[WeeklyReportScreen] load failed', error?.message || error);
      clearLoadedReport({ setReports, setNutritionByDay, setDailyLogsByDay, setClientMeta });
    } finally {
      setIsLoadingReport(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const weeks = useMemo(
    () =>
      prepareReportForScreensToWeeks(
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
  const showInlineBottomNav = !reserveShellBottomNav;
  const scrollBottomPad =
    reserveShellBottomNav || showInlineBottomNav ? shellBottomPad + 24 : 32;

  const handleExport = useCallback(async () => {
    if (!activeWeek) return;
    const html = buildWeeklyReportHtml(activeWeek, clientName);
    try {
      // vocab: printToFileAsync = Expo writes the HTML to a PDF file and returns its uri.
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export weekly report' });
      } else {
        Alert.alert('Export ready', 'PDF saved — sharing is not available on this device.');
      }
    } catch (error) {
      console.warn('[WeeklyReportScreen] export failed', error?.message || error);
      Alert.alert('Export failed', 'Could not create PDF for this report.');
    }
  }, [activeWeek, clientName]);

  return (
    <WeeklyReportThemeProvider initialMode={isDark ? 'dark' : 'light'}>
      <View style={styles.root}>
        <SafeAreaView style={styles.safeTop} edges={SHELL_SAFE_AREA_EDGES}>
          <TopHeader
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
            {isLoadingReport ? (
              <View style={styles.centered}>
                <ActivityIndicator color="#ff6b35" size="large" />
                <Text style={styles.hint}>Loading reports…</Text>
              </View>
            ) : weeks.length === 0 ? (
              <NoReportYet isClientSelfView={isClientSelfView} />
            ) : (
              <WeeklyReportBody
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
              <BottomMenuBar
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
