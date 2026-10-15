// WeeklyReportBody.jsx
//
// This is the scrollable middle of the weekly report: sleep/water/steps/calories cards,
// the sleep chart, trainer tips, each day the client logged, and wins vs things to work on.
// It does not talk to the database. WeeklyReportScreen already loaded the weeks and passes them in.
//
// How to read this file:
//   1. Small pieces (labels, glow, sleep card, skipped days)
//   2. WeeklyReportScrollLayout — the whole screen laid out
//   3. WeeklyReportBody at the bottom — only remembers what you tapped (popup open, skipped days open)

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';

import { GRADIENTS, useTheme } from './reportColorSettings';
import { WeekPicker } from './WeekPicker';
import { StatCard } from './StatCard';
import { WeeklyChart } from './WeeklyChart';
import { DayCard } from './DayCard';
import { TrainerTipsForWeek } from './TrainerTipsForWeek';
import { WinsAndWorkOnsSection } from './WinsAndWorkOnsSection';
import { ReportOptionsPopup } from './ReportOptionsPopup';

// ===== NAMED CONSTANTS =====

const DARK_MODE = 'dark';

// ===== HELPER FUNCTIONS =====

function reportIsUsingDarkColors(colorMode) {
  return colorMode === DARK_MODE;
}

function checkInCountLabel(loggedDayCount) {
  if (loggedDayCount === 1) {
    return '1 check-in logged';
  }
  return `${loggedDayCount} check-ins logged`;
}

function skippedDayCountLabel(skippedDayCount) {
  if (skippedDayCount === 1) {
    return '1 day without check-in';
  }
  return `${skippedDayCount} days without check-in`;
}

// Turns a stored date like "2026-03-15" into "03/15" so a skipped-day row can show the month and day.
function formatSkippedMonthDay(dateKey) {
  return dateKey.slice(5).replace('-', '/');
}

function DarkModeGlow() {
  return (
    <>
      <View style={[styles.orb, styles.orbTop]}>
        <LinearGradient
          colors={['#ff1493', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>
      <View style={[styles.orb, styles.orbBottom]}>
        <LinearGradient
          colors={['#00bfff', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>
    </>
  );
}

function SleepTrendCard({ week, colors, colorMode }) {
  const usingDarkColors = reportIsUsingDarkColors(colorMode);
  const cardBackgroundColor = usingDarkColors ? 'rgba(20,20,30,0.55)' : 'rgba(255,255,255,0.7)';
  const cardStyle = [
    styles.chartCard,
    { backgroundColor: cardBackgroundColor, borderColor: colors.border },
  ];
  const smallLabelStyle = [styles.sectionLabel, { color: colors.textMuted }];
  const titleStyle = [styles.sectionTitle, { color: colors.textPrimary }];
  const legendTextStyle = [styles.legendText, { color: colors.textSecondary }];

  return (
    <View style={cardStyle}>
      <BlurView intensity={25} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
      <View style={styles.chartHeader}>
        <View>
          <Text style={smallLabelStyle}>SLEEP TREND</Text>
          <Text style={titleStyle}>This week</Text>
        </View>
        <View style={styles.legendChip}>
          <View style={styles.legendDot}>
            <LinearGradient
              colors={GRADIENTS.g1}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </View>
          <Text style={legendTextStyle}>Hours / night</Text>
        </View>
      </View>
      <WeeklyChart
        days={week.days}
        metricKey="sleepHours"
        legend="Hours / night"
        valueSuffix="h"
      />
    </View>
  );
}

function SkippedDayRow({ skippedDay, colors }) {
  const rowStyle = [styles.skippedRow, { borderColor: colors.border }];
  const dayNameStyle = [styles.skippedDay, { color: colors.textSecondary }];
  const noLogStyle = [styles.skippedHint, { color: colors.textMuted }];
  const dayName = skippedDay.fullDayName || skippedDay.dayName;
  const monthAndDay = formatSkippedMonthDay(skippedDay.date);

  return (
    <View style={rowStyle}>
      <Text style={dayNameStyle}>{dayName} · {monthAndDay}</Text>
      <Text style={noLogStyle}>No log</Text>
    </View>
  );
}

function SkippedDaysSection({ skippedDays, skippedListIsOpen, onToggleSkippedList, colors, colorMode }) {
  if (skippedDays.length === 0) {
    return null;
  }

  const usingDarkColors = reportIsUsingDarkColors(colorMode);
  const buttonBackgroundColor = usingDarkColors ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
  const buttonStyle = [
    styles.skippedToggle,
    { backgroundColor: buttonBackgroundColor, borderColor: colors.border },
  ];
  const buttonLabelStyle = [styles.skippedText, { color: colors.textSecondary }];
  const buttonLabel = skippedDayCountLabel(skippedDays.length);
  const arrowIconName = skippedListIsOpen ? 'chevron-up' : 'chevron-down';

  return (
    <View>
      <Pressable testID="toggle-skipped" onPress={onToggleSkippedList} style={buttonStyle}>
        <Ionicons name="time-outline" size={14} color={colors.textMuted} />
        <Text style={buttonLabelStyle}>{buttonLabel}</Text>
        <Ionicons name={arrowIconName} size={14} color={colors.textMuted} />
      </Pressable>
      {skippedListIsOpen ? (
        <View style={styles.skippedList}>
          {skippedDays.map((skippedDay) => (
            <SkippedDayRow key={skippedDay.date} skippedDay={skippedDay} colors={colors} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function AverageStatCards({ week, colorMode }) {
  const sleep = week.stats.display.sleep;
  const water = week.stats.display.water;
  const steps = week.stats.display.steps;
  const calories = week.stats.display.calories;

  return (
    <View key={`stats-${week.id}-${colorMode}`} style={styles.statsGrid}>
      <StatCard
        testID="stat-card-sleep"
        label="Avg Sleep"
        value={sleep}
        suffix="h"
        trend={week.stats.sleepTrend}
        icon="moon"
        gradient={GRADIENTS.g1}
      />
      <StatCard
        testID="stat-card-water"
        label="Avg Water"
        value={water}
        suffix="oz"
        trend={week.stats.waterTrend}
        icon="water"
        gradient={GRADIENTS.g4}
      />
      <StatCard
        testID="stat-card-steps"
        label="Avg Steps"
        value={steps}
        trend={week.stats.stepsTrend}
        icon="footsteps"
        gradient={GRADIENTS.g3}
      />
      <StatCard
        testID="stat-card-calories"
        label="Avg Calories"
        value={calories}
        suffix="cal"
        trend={week.stats.caloriesTrend}
        icon="restaurant"
        gradient={GRADIENTS.g3}
      />
    </View>
  );
}

// ===== SCREEN LAYOUT (what the user sees — read this first) =====

// Lays out the whole report you scroll: week arrows, the four stat cards, sleep chart,
// trainer tips, each logged day, skipped days, and the export popup.
// It does not load anything. WeeklyReportBody (below) hands it a week that is already ready.
function WeeklyReportScrollLayout({
  week,
  weeks,
  weekIndex,
  colors,
  colorMode,
  clientDisplayName,
  loggedDays,
  skippedDays,
  skippedListIsOpen,
  onToggleSkippedList,
  onPreviousWeek,
  onNextWeek,
  onOpenSettings,
  onCloseSettings,
  settingsPopupIsOpen,
  onExport,
  contentBottomPad,
}) {
  const usingDarkColors = reportIsUsingDarkColors(colorMode);
  const phoneStatusBarStyle = usingDarkColors ? 'light' : 'dark';
  const screenStyle = [styles.root, { backgroundColor: colors.background }];
  const canGoToOlderWeek = weekIndex < weeks.length - 1;
  const canGoToNewerWeek = weekIndex > 0;
  const scrollContentStyle = [styles.scrollContent, { paddingBottom: contentBottomPad }];
  const clientNameStyle = [styles.clientLine, { color: colors.textSecondary }];
  const smallLabelStyle = [styles.sectionLabel, { color: colors.textMuted }];
  const titleStyle = [styles.sectionTitle, { color: colors.textPrimary }];
  const loggedDayHeading = checkInCountLabel(loggedDays.length);

  return (
    <View style={screenStyle} testID="weekly-report-screen">
      <StatusBar style={phoneStatusBarStyle} />

      <LinearGradient
        colors={colors.backgroundGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {usingDarkColors ? <DarkModeGlow /> : null}

      <WeekPicker
        label={week.label}
        canPrev={canGoToOlderWeek}
        canNext={canGoToNewerWeek}
        onPrev={onPreviousWeek}
        onNext={onNextWeek}
        onSettings={onOpenSettings}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={scrollContentStyle}
        showsVerticalScrollIndicator={false}
      >
        {clientDisplayName ? (
          <Text style={clientNameStyle}>{`${clientDisplayName}'s week`}</Text>
        ) : null}

        <AverageStatCards week={week} colorMode={colorMode} />

        <View key={`chart-${week.id}-${colorMode}`} style={styles.section}>
          <SleepTrendCard week={week} colors={colors} colorMode={colorMode} />
        </View>

        <TrainerTipsForWeek week={week} />

        <View key={`days-${week.id}-${colorMode}`} style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={smallLabelStyle}>DAILY BREAKDOWN</Text>
              <Text style={titleStyle}>{loggedDayHeading}</Text>
            </View>
          </View>

          {loggedDays.map((day, dayIndex) => (
            <DayCard key={day.date || `day-${dayIndex}`} day={day} index={dayIndex} />
          ))}

          <SkippedDaysSection
            skippedDays={skippedDays}
            skippedListIsOpen={skippedListIsOpen}
            onToggleSkippedList={onToggleSkippedList}
            colors={colors}
            colorMode={colorMode}
          />
        </View>

        <WinsAndWorkOnsSection week={week} animationKey={`coaching-${week.id}-${colorMode}`} />
      </ScrollView>

      <ReportOptionsPopup
        visible={settingsPopupIsOpen}
        onClose={onCloseSettings}
        onExport={onExport}
      />
    </View>
  );
}

// ===== MAIN FUNCTION =====
// (week index + “show skipped days” toggles — read this last; WeeklyReportScrollLayout above is the UI)

// What other screens import. It only remembers two taps:
// whether the options popup is open, and whether the skipped-days list is open.
// Then it sends the current week plus those taps up to WeeklyReportScrollLayout.
export function WeeklyReportBody({
  weeks,
  weekIndex,
  onWeekIndexChange,
  clientName = '',
  onExport,
  contentBottomPad = 32,
}) {
  const { colors, mode } = useTheme();
  const [settingsPopupIsOpen, setSettingsPopupIsOpen] = useState(false);
  const [skippedListIsOpen, setSkippedListIsOpen] = useState(false);

  const week = weeks[weekIndex];
  if (!week) {
    return null;
  }

  const loggedDays = week.loggedDays || [];
  const skippedDays = week.skippedDays || [];
  const clientDisplayName = clientName || week.clientName || '';
  const olderWeekExists = weekIndex < weeks.length - 1;
  const newerWeekExists = weekIndex > 0;

  function showOlderWeek() {
    if (olderWeekExists) {
      onWeekIndexChange(weekIndex + 1);
    }
  }

  function showNewerWeek() {
    if (newerWeekExists) {
      onWeekIndexChange(weekIndex - 1);
    }
  }

  function openSkippedDayList() {
    const listIsCurrentlyOpen = skippedListIsOpen;
    setSkippedListIsOpen(!listIsCurrentlyOpen);
  }

  return (
    <WeeklyReportScrollLayout
      week={week}
      weeks={weeks}
      weekIndex={weekIndex}
      colors={colors}
      colorMode={mode}
      clientDisplayName={clientDisplayName}
      loggedDays={loggedDays}
      skippedDays={skippedDays}
      skippedListIsOpen={skippedListIsOpen}
      onToggleSkippedList={openSkippedDayList}
      onPreviousWeek={showOlderWeek}
      onNextWeek={showNewerWeek}
      onOpenSettings={() => setSettingsPopupIsOpen(true)}
      onCloseSettings={() => setSettingsPopupIsOpen(false)}
      settingsPopupIsOpen={settingsPopupIsOpen}
      onExport={onExport}
      contentBottomPad={contentBottomPad}
    />
  );
}

// Fixed sizes, spacing, and card shapes for the layout above — colors come from reportColorSettings.
const styles = StyleSheet.create({
  root: { flex: 1 },
  orb: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    opacity: 0.18,
    overflow: 'hidden',
  },
  orbTop: { top: -180, right: -120 },
  orbBottom: { bottom: -200, left: -160, opacity: 0.12 },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 20 },
  clientLine: {
    paddingHorizontal: 20,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  statsGrid: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  section: { paddingHorizontal: 20, marginTop: 32 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  chartCard: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  legendChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5, overflow: 'hidden' },
  legendText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  skippedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  skippedText: { fontSize: 13, fontWeight: '600', flex: 1 },
  skippedList: { marginTop: 8, gap: 6 },
  skippedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  skippedDay: { fontSize: 13, fontWeight: '600' },
  skippedHint: { fontSize: 12 },
});
