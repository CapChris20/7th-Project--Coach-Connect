import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';

import { GRADIENTS, useTheme } from './theme/WeeklyReportThemeContext';
import { WeekSelectorHeader } from './components/WeekSelectorHeader';
import { StatCard } from './components/StatCard';
import { WeeklyChart } from './components/WeeklyChart';
import { DayCard } from './components/DayCard';
import { WeekTrainerInsights } from './components/WeekTrainerInsights';
import { CoachingProsConsSection } from './components/CoachingProsConsSection';
import { SettingsSheet } from './components/SettingsSheet';

/**
 * Weekly report scroll body — poop-main.zip layout + real Firestore data.
 */
export function WeeklyReportScreenBody({
  weeks,
  weekIndex,
  onWeekIndexChange,
  clientName = '',
  onExport,
  contentBottomPad = 32,
}) {
  const { colors, mode } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  const week = weeks[weekIndex];
  if (!week) return null;

  const checkedDays = week.loggedDays || [];
  const skippedDays = week.skippedDays || [];

  const handlePrev = () => {
    if (weekIndex < weeks.length - 1) onWeekIndexChange(weekIndex + 1);
  };
  const handleNext = () => {
    if (weekIndex > 0) onWeekIndexChange(weekIndex - 1);
  };

  const displayName = clientName || week.clientName || '';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID="weekly-report-screen">
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />

      <LinearGradient
        colors={colors.backgroundGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {mode === 'dark' && (
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
      )}

      <WeekSelectorHeader
        label={week.label}
        canPrev={weekIndex < weeks.length - 1}
        canNext={weekIndex > 0}
        onPrev={handlePrev}
        onNext={handleNext}
        onSettings={() => setSettingsOpen(true)}
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
          <View
            style={[
              styles.chartCard,
              {
                backgroundColor: mode === 'dark' ? 'rgba(20,20,30,0.55)' : 'rgba(255,255,255,0.7)',
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
        </View>

        <WeekTrainerInsights week={week} />

        <View
          key={`days-${week.id}-${mode}`}
          style={styles.section}
        >
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>DAILY BREAKDOWN</Text>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {checkedDays.length} check-in{checkedDays.length === 1 ? '' : 's'} logged
              </Text>
            </View>
          </View>

          {checkedDays.map((day, i) => (
            <DayCard key={day.date || `day-${i}`} day={day} index={i} />
          ))}

          {skippedDays.length > 0 && (
            <View>
              <Pressable
                testID="toggle-skipped"
                onPress={() => setShowSkipped((p) => !p)}
                style={[
                  styles.skippedToggle,
                  {
                    backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={[styles.skippedText, { color: colors.textSecondary }]}>
                  {skippedDays.length} day{skippedDays.length > 1 ? 's' : ''} without check-in
                </Text>
                <Ionicons
                  name={showSkipped ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={colors.textMuted}
                />
              </Pressable>
              {showSkipped && (
                <View style={styles.skippedList}>
                  {skippedDays.map((d) => (
                    <View
                      key={d.date}
                      style={[styles.skippedRow, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.skippedDay, { color: colors.textSecondary }]}>
                        {d.fullDayName || d.dayName} · {d.date.slice(5).replace('-', '/')}
                      </Text>
                      <Text style={[styles.skippedHint, { color: colors.textMuted }]}>No log</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        <CoachingProsConsSection week={week} animationKey={`coaching-${week.id}-${mode}`} />
      </ScrollView>

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} onExport={onExport} />
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
