// Design Law daily-breakdown row — day chip + title + subtitle (progress PNG list).
// Flow: classify training / rest / no-log → solid or dashed day square → optional Today pill.
// Used by WeeklyReportBody for every day in the week (logged + skipped together).

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NbPill from '../../look-and-feel/NbPill';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

const DAY_ABBR = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const CHIP = 44;

// ===== HELPER FUNCTIONS =====

function isRestWorkout(workouts = []) {
  if (!workouts.length) return false;
  return workouts.every((w) => /\brest\b|recovery|off day/i.test(String(w?.name || '')));
}

function dayAbbrev(day, index) {
  if (day?.dayName && String(day.dayName).length <= 3) {
    return String(day.dayName).toUpperCase();
  }
  const fromFull = String(day?.fullDayName || '').slice(0, 3).toUpperCase();
  if (fromFull) return fromFull;
  return DAY_ABBR[index] || 'DAY';
}

function isTodayIso(dateKey) {
  if (!dateKey) return false;
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return dateKey === iso;
}

function rowCopy(day) {
  const hasWorkouts = (day.workouts || []).length > 0;
  const isTraining = hasWorkouts && !isRestWorkout(day.workouts);
  const isRest = day.isRecovery || (hasWorkouts && !isTraining) || (!hasWorkouts && day.hasCheckIn && (day.sleepHours > 0 || day.waterOz > 0));
  const workoutName = day.workoutName?.trim() || null;

  if (isTraining) {
    const title = workoutName || 'Training day';
    const rating = day.workoutRating != null ? `Rated ${day.workoutRating} of 10` : 'Workout logged';
    return { title, subtitle: rating, kind: 'done' };
  }
  if (isRest || day.isRecovery) {
    const sleep = day.sleepHours > 0 ? `Slept ${day.sleepHours} h` : 'Rest day';
    return { title: 'Rest day', subtitle: sleep, kind: 'rest' };
  }
  if (!day.hasCheckIn && !(day.sleepHours > 0) && !hasWorkouts) {
    return { title: 'No log', subtitle: 'Nothing logged', kind: 'empty' };
  }
  return {
    title: workoutName || (day.hasCheckIn ? 'Check-in' : 'Logged'),
    subtitle: day.sleepHours > 0 ? `Slept ${day.sleepHours} h` : 'Day logged',
    kind: 'done',
  };
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ day: object, index?: number, showDivider?: boolean }} props
 */
export function DayCard({ day, index = 0, showDivider = true }) {
  const { colors } = useTheme();
  const copy = useMemo(() => rowCopy(day), [day]);
  const abbr = dayAbbrev(day, index);
  const today = isTodayIso(day?.date);
  const dashed = copy.kind === 'rest' || copy.kind === 'empty';
  const fillChip = copy.kind === 'done';

  return (
    <View
      style={[
        styles.row,
        showDivider
          ? { borderBottomWidth: nb.borderWidthDivider, borderBottomColor: colors.border }
          : null,
      ]}
      testID={`daily-expand-btn-${index}`}
    >
      <View
        style={[
          styles.chip,
          {
            borderColor: colors.border,
            backgroundColor: fillChip ? colors.fill : 'transparent',
            borderStyle: dashed ? 'dashed' : 'solid',
          },
        ]}
      >
        <Text
          style={[
            styles.chipText,
            { color: fillChip ? colors.onFill : colors.textPrimary },
          ]}
        >
          {abbr}
        </Text>
      </View>

      <View style={styles.grow}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {copy.title}
        </Text>
        <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
          {copy.subtitle}
        </Text>
      </View>

      {today ? <NbPill variant="plain">Today</NbPill> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.sm + 4,
    minHeight: nb.minTouchTarget + 8,
  },
  chip: {
    width: CHIP,
    height: CHIP,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  grow: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 13,
    fontWeight: '500',
  },
});
