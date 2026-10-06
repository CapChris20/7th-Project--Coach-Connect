// Scroll body of the weekly report: stats, sleep chart, trainer snapshot, daily rows, wins.
// Flow: pick the week → render the grid and chart → list logged days → tuck skipped days behind a toggle.
// Used by WeeklyReportScreen once Firestore weeks are loaded.

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

function isDarkMode(mode) {
  return mode === DARK_MODE;
}

function checkInCountLabel(checkedDayCount) {
  const pluralSuffix = checkedDayCount === 1 ? '' : 's';
  return `${checkedDayCount} check-in${pluralSuffix} logged`;
}

function skippedDayCountLabel(skippedDayCount) {
  const pluralSuffix = skippedDayCount > 1 ? 's' : '';
  return `${skippedDayCount} day${pluralSuffix} without check-in`;
}

// "2026-03-15" → "03/15". Only the first hyphen is replaced, matching the old label.
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

function SleepTrendCard({ week, colors, mode }) {
  return (
    <View
      style={[
        styles.chartCard,
        {
          backgroundColor: isDarkMode(mode) ? 'rgba(20,20,30,0.55)' : 'rgba(255,255,255,0.7)',
          borderColor: colors.border,
        },
      ]}
    >
      <BlurView intensity={25} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
      <View style={styles.chartHeader}>
        <View>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>SLEEP TREND</Text>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>This week</Text>
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
          <Text style={[styles.legendText, { color: colors.textSecondary }]}>Hours / night</Text>
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

function SkippedDaysSection({ skippedDays, isShowingSkipped, onToggleSkipped, colors, mode }) {
  if (skippedDays.length === 0) return null;

  return (
    <View>
      <Pressable
        testID="toggle-skipped"
        onPress={onToggleSkipped}
        style={[
          styles.skippedToggle,
          {
            backgroundColor: isDarkMode(mode) ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name="time-outline" size={14} color={colors.textMuted} />
        <Text style={[styles.skippedText, { color: colors.textSecondary }]}>
          {skippedDayCountLabel(skippedDays.length)}
        </Text>
        <Ionicons
          name={isShowingSkipped ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={colors.textMuted}
        />
      </Pressable>
      {isShowingSkipped && (
        <View style={styles.skippedList}>
          {skippedDays.map((skippedDay) => (
            <View
              key={skippedDay.date}
              style={[styles.skippedRow, { borderColor: colors.border }]}
            >
              <Text style={[styles.skippedDay, { color: colors.textSecondary }]}>
                {skippedDay.fullDayName || skippedDay.dayName} · {formatSkippedMonthDay(skippedDay.date)}
              </Text>
              <Text style={[styles.skippedHint, { color: colors.textMuted }]}>No log</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Weekly report scroll body.
 * @param {object} props
 * @param {object[]} props.weeks
 * @param {number} props.weekIndex
 * @param {Function} props.onWeekIndexChange
 * @param {string} [props.clientName]
 * @param {Function} [props.onExport]
 * @param {number} [props.contentBottomPad]
 */
export function WeeklyReportBody({
  weeks,
  weekIndex,
  onWeekIndexChange,
  clientName = '',
  onExport,
  contentBottomPad = 32,
}) {
  const { colors, mode } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShowingSkipped, setIsShowingSkipped] = useState(false);

  const week = weeks[weekIndex];
  if (!week) return null;

  const checkedDays = week.loggedDays || [];
  const skippedDays = week.skippedDays || [];
  const displayName = clientName || week.clientName || '';

  // Weeks are newest-first, so "previous" walks toward older weeks (a higher index).
  const handlePreviousWeek = () => {
    if (weekIndex < weeks.length - 1) onWeekIndexChange(weekIndex + 1);
  };
  const handleNextWeek = () => {
    if (weekIndex > 0) onWeekIndexChange(weekIndex - 1);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID="weekly-report-screen">
      <StatusBar style={isDarkMode(mode) ? 'light' : 'dark'} />

      <LinearGradient
        colors={colors.backgroundGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {isDarkMode(mode) && <DarkModeGlow />}

      <WeekPicker
        label={week.label}
        canPrev={weekIndex < weeks.length - 1}
        canNext={weekIndex > 0}
        onPrev={handlePreviousWeek}
        onNext={handleNextWeek}
        onSettings={() => setIsSettingsOpen(true)}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {displayName ? (
          <Text style={[styles.clientLine, { color: colors.textSecondary }]}>
            {displayName}&apos;s week
          </Text>
        ) : null}

        <View
          key={`stats-${week.id}-${mode}`}
          style={styles.statsGrid}
        >
          <StatCard
            testID="stat-card-sleep"
            label="Avg Sleep"
            value={week.stats.display.sleep}
            suffix="h"
            trend={week.stats.sleepTrend}
            icon="moon"
            gradient={GRADIENTS.g1}
          />
          <StatCard
            testID="stat-card-water"
            label="Avg Water"
            value={week.stats.display.water}
            suffix="oz"
            trend={week.stats.waterTrend}
            icon="water"
            gradient={GRADIENTS.g4}
          />
          <StatCard
            testID="stat-card-steps"
            label="Avg Steps"
            value={week.stats.display.steps}
            trend={week.stats.stepsTrend}
            icon="footsteps"
            gradient={GRADIENTS.g3}
          />
          <StatCard
            testID="stat-card-calories"
            label="Avg Calories"
            value={week.stats.display.calories}
            suffix="cal"
            trend={week.stats.caloriesTrend}
            icon="restaurant"
            gradient={GRADIENTS.g3}
          />
        </View>

        <View
          key={`chart-${week.id}-${mode}`}
          style={styles.section}
        >
          <SleepTrendCard week={week} colors={colors} mode={mode} />
        </View>

        <TrainerTipsForWeek week={week} />

        <View
          key={`days-${week.id}-${mode}`}
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>DAILY BREAKDOWN</Text>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {checkInCountLabel(checkedDays.length)}
              </Text>
            </View>
          </View>

          {checkedDays.map((day, dayIndex) => (
            <DayCard key={day.date || `day-${dayIndex}`} day={day} index={dayIndex} />
          ))}

          <SkippedDaysSection
            skippedDays={skippedDays}
            isShowingSkipped={isShowingSkipped}
            onToggleSkipped={() => setIsShowingSkipped((previous) => !previous)}
            colors={colors}
            mode={mode}
          />
        </View>

        <WinsAndWorkOnsSection week={week} animationKey={`coaching-${week.id}-${mode}`} />
      </ScrollView>

      <ReportOptionsPopup
        visible={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onExport={onExport}
      />
    </View>
  );
}

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
