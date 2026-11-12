// Design Law weekly report screen — Nb header, HardShadow chrome, shared body.
// Flow: load users/{id}/weeklySummaries → prepare weeks → body or NoReportYet → PDF export.
// Opened from client home and trainer “Open report”. Firebase projectId stays anatrox-auth.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  Alert,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { db } from '../../app-start/cloudConnection';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import {
  useShellBottomNavInset,
  useShellTopPad,
  SHELL_SAFE_AREA_EDGES,
  ShellBottomNavAnchor,
} from '../../navigation/bottomMenuSpacing';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme as useAppTheme } from '../../look-and-feel/lightDarkMode';
import {
  parseDayNote,
  parseStructuredDayNote,
  formatDateRange,
} from '../../trainer-app/weekly-report/WeeklyReportBars';
import { WeeklyReportThemeProvider, useTheme as useReportTheme } from './reportColorSettings';
import { prepareReportForScreensToWeeks, formatDayForShare } from './prepareReportForScreen';
import { fetchNutritionByDayForRange } from './loadWeekFoodTotals';
import {
  fetchDailyLogsByDayForRange,
  workoutsFromDailyLog,
} from './loadWeekDailyEntries';
import { WeeklyReportBody } from './WeeklyReportBody';
import { NoReportYet } from './NoReportYet';
import { WeekPicker } from './WeekPicker';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const WEEKLY_SUMMARIES_COLLECTION = 'weeklySummaries';
const REPORT_PARSERS = { parseDayNote, parseStructuredDayNote, formatDateRange };
const SHELL_NAV_CONTENT_INSET = 16;
const SCROLL_PAD_WITH_NAV = 24;
const SCROLL_PAD_WITHOUT_NAV = 32;
const NOON_ON_DAY_SUFFIX = 'T12:00:00';
const HEADER_SQUARE = nb.minTouchTarget;

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

function reportScrollBottomPad(reserveShellBottomNav, showInlineBottomNav, shellBottomPad) {
  if (reserveShellBottomNav || showInlineBottomNav) return shellBottomPad + SCROLL_PAD_WITH_NAV;
  return SCROLL_PAD_WITHOUT_NAV;
}

function HeaderSquare({ onPress, accessibilityLabel, children, colors }) {
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbChip}>
      <Pressable
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.headerSq,
          { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
        ]}
      >
        {children}
      </Pressable>
    </HardShadow>
  );
}

/**
 * Back + title + options. Owns status-bar clearance via useShellTopPad.
 */
function ReportPageHeader({ title, subtitle, onBack, onOpenOptions, colors, topPad }) {
  return (
    <View style={[styles.headerRow, { paddingTop: topPad }]}>
      {typeof onBack === 'function' ? (
        <HeaderSquare onPress={onBack} accessibilityLabel="Go back" colors={colors}>
          <Ionicons name="chevron-back" size={22} color={colors.nbInk} />
        </HeaderSquare>
      ) : (
        <View style={styles.headerSqSpacer} />
      )}
      <View style={styles.headerText}>
        <Text style={[styles.headerTitle, { color: colors.nbInk }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.headerSub, { color: colors.nbMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {typeof onOpenOptions === 'function' ? (
        <HeaderSquare onPress={onOpenOptions} accessibilityLabel="Report options" colors={colors}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.nbInk} />
        </HeaderSquare>
      ) : (
        <View style={styles.headerSqSpacer} />
      )}
    </View>
  );
}

function ReportLoadingState({ colors }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.nbInk} size="large" />
      <Text style={[styles.hint, { color: colors.nbMuted }]}>Loading reports…</Text>
    </View>
  );
}

function EmptyWithWeekChrome({ isClientSelfView, colors, clientName }) {
  return (
    <View style={{ flex: 1 }}>
      <WeekPicker label="—" title="This week" canPrev={false} canNext={false} onPrev={() => {}} onNext={() => {}} />
      {!isClientSelfView && clientName ? (
        <Text style={[styles.emptyClient, { color: colors.textMuted || colors.nbMuted }]}>
          {clientName}
        </Text>
      ) : null}
      <NoReportYet isClientSelfView={isClientSelfView} />
    </View>
  );
}

function ReportMiddle({
  isLoadingReport,
  weeks,
  isClientSelfView,
  weekIndex,
  onWeekIndexChange,
  clientName,
  onExport,
  scrollBottomPad,
  openOptionsSignal,
}) {
  const { colors } = useReportTheme();

  if (isLoadingReport) {
    return <ReportLoadingState colors={colors} />;
  }

  if (weeks.length === 0) {
    return (
      <EmptyWithWeekChrome
        isClientSelfView={isClientSelfView}
        colors={colors}
        clientName={clientName}
      />
    );
  }

  return (
    <WeeklyReportBody
      weeks={weeks}
      weekIndex={weekIndex}
      onWeekIndexChange={onWeekIndexChange}
      clientName={clientName}
      isClientSelfView={isClientSelfView}
      onExport={onExport}
      openOptionsSignal={openOptionsSignal}
      contentBottomPad={scrollBottomPad}
    />
  );
}

// ===== SCREEN LAYOUT =====

function WeeklyReportScreenLayout({
  onClose,
  isLoadingReport,
  weeks,
  weekIndex,
  onWeekIndexChange,
  clientName,
  isClientSelfView,
  onExport,
  scrollBottomPad,
  showInlineBottomNav,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
  onProfilePressForNav,
}) {
  const { colors: appColors } = useAppTheme();
  const topPad = useShellTopPad(spacing.sm);
  const [bodyOptionsTick, setBodyOptionsTick] = useState(0);

  const headerSubtitle =
    !isClientSelfView && clientName
      ? clientName
      : null;

  return (
    <View style={[styles.root, { backgroundColor: appColors.nbBackground }]}>
      <SafeAreaView style={styles.safeTop} edges={SHELL_SAFE_AREA_EDGES}>
        <ReportPageHeader
          title="Weekly report"
          subtitle={headerSubtitle}
          onBack={onClose}
          onOpenOptions={() => setBodyOptionsTick((n) => n + 1)}
          colors={appColors}
          topPad={topPad}
        />

        <View style={styles.content}>
          <ReportMiddle
            isLoadingReport={isLoadingReport}
            weeks={weeks}
            isClientSelfView={isClientSelfView}
            weekIndex={weekIndex}
            onWeekIndexChange={onWeekIndexChange}
            clientName={clientName}
            onExport={onExport}
            scrollBottomPad={scrollBottomPad}
            openOptionsSignal={bodyOptionsTick}
          />
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
              onProfilePress={onProfilePressForNav}
            />
          </ShellBottomNavAnchor>
        ) : null}
      </SafeAreaView>
    </View>
  );
}

// ===== MAIN FUNCTION =====

export function formatChipRange(weekStart, weekEnd) {
  const weekStartText = String(weekStart || '').trim();
  const weekEndText = String(weekEnd || weekStartText).trim();
  if (!weekStartText) return '';
  const startDate = new Date(`${weekStartText}${NOON_ON_DAY_SUFFIX}`);
  const endDate = new Date(`${weekEndText}${NOON_ON_DAY_SUFFIX}`);
  const startLabel = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

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
  onSettingsPress: _onSettingsPress,
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
      // vocab: getDocs = one-shot Firestore read of users/{id}/weeklySummaries
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
  const scrollBottomPad = reportScrollBottomPad(
    reserveShellBottomNav,
    showInlineBottomNav,
    shellBottomPad,
  );

  const handleExport = useCallback(async () => {
    if (!activeWeek) return;
    const html = buildWeeklyReportHtml(activeWeek, clientName);
    try {
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

  const themeMode = isDark ? 'dark' : 'light';

  return (
    <WeeklyReportThemeProvider initialMode={themeMode}>
      <WeeklyReportScreenLayout
        onClose={onClose}
        isLoadingReport={isLoadingReport}
        weeks={weeks}
        weekIndex={weekIndex}
        onWeekIndexChange={setWeekIndex}
        clientName={clientName}
        isClientSelfView={isClientSelfView}
        onExport={handleExport}
        scrollBottomPad={scrollBottomPad}
        showInlineBottomNav={showInlineBottomNav}
        onHomePress={onHomePress}
        onPlusPress={onPlusPress}
        onVoicePress={onVoicePress}
        onNutritionPress={onNutritionPress}
        onWorkoutPress={onWorkoutPress}
        onMessagesPress={onMessagesPress}
        onProfilePressForNav={onProfilePress}
      />
    </WeeklyReportThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeTop: { flex: 1, minHeight: 0 },
  content: { flex: 1, minHeight: 0 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: nb.screenGutter,
    paddingBottom: spacing.sm,
  },
  headerSq: {
    width: HEADER_SQUARE,
    height: HEADER_SQUARE,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSqSpacer: { width: HEADER_SQUARE, height: HEADER_SQUARE },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: {
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  headerSub: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    minHeight: 200,
  },
  hint: { marginTop: 12, fontSize: 13, fontWeight: '500' },
  emptyClient: {
    paddingHorizontal: nb.screenGutter,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
});
