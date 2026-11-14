// One day in the weekly-report “Daily breakdown” list — chip + title + subtitle.
// Flow: classify the day → pick chip fill/dash → build title/subtitle → optional Today pill.
// Used by WeeklyReportBody for every day in the week (logged + skipped together).

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NbPill from '../../look-and-feel/NbPill';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

// Manipulate here: fallback weekday letters when the day object has no name fields
const WEEKDAY_ABBREVIATIONS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// Design Law chip size in the progress daily list (min touch feels right at 44)
const DAY_CHIP_SIZE = 44;

// Kind letters the chip + copy helpers share — keep these three strings stable.
const DAY_KIND_DONE = 'done';
const DAY_KIND_REST = 'rest';
const DAY_KIND_EMPTY = 'empty';

// ===== MAIN FUNCTION =====

/**
 * Daily-breakdown row for one calendar day.
 * Flow: 1. theme  2. classify copy  3. chip label / today  4. chip look  5. divider  6. row
 * @param {{ day: object, index?: number, showDivider?: boolean }} props
 */
export function DayCard({ day, index = 0, showDivider = true }) {
  // vocab: useTheme = report light/dark palette from reportColorSettings (not system Appearance alone)
  const { colors } = useTheme();

  // 1. Decide what this day row should say (training / rest / empty / fallback).
  // vocab: useMemo = recompute only when `day` identity changes (list re-renders a lot)
  const rowCopy = useMemo(() => buildDayRowCopy(day), [day]);

  // 2. Chip label + whether this calendar day is “today.”
  const weekdayAbbreviation = weekdayAbbreviationForDay(day, index);
  const dayDateKey = day && day.date ? day.date : undefined;
  const dayIsToday = calendarDateKeyIsToday(dayDateKey);

  // 3. Chip visuals follow Design Law: filled square for logged training, dashed for rest/empty.
  const chipIsFilled = rowCopy.kind === DAY_KIND_DONE;
  const chipUsesDashedBorder =
    rowCopy.kind === DAY_KIND_REST || rowCopy.kind === DAY_KIND_EMPTY;

  // 4. Optional hairline between rows — last row in the list omits it.
  let dividerStyle = null;
  if (showDivider) {
    dividerStyle = {
      borderBottomWidth: nb.borderWidthDivider,
      borderBottomColor: colors.border,
    };
  }

  // 5. Name the optional Today pill so JSX stays a straight read (no nested ternary).
  let todayPill = null;
  if (dayIsToday) {
    todayPill = <NbPill variant="plain">Today</NbPill>;
  }

  // 6. Row: chip → title block → optional Today pill.
  return (
    <View style={[styles.row, dividerStyle]} testID={`daily-expand-btn-${index}`}>
      <DayAbbrevChip
        abbreviation={weekdayAbbreviation}
        chipIsFilled={chipIsFilled}
        chipUsesDashedBorder={chipUsesDashedBorder}
        colors={colors}
      />
      <DayTitleBlock
        title={rowCopy.title}
        subtitle={rowCopy.subtitle}
        colors={colors}
      />
      {todayPill}
    </View>
  );
}

// ===== HELPER FUNCTIONS =====

/**
 * Left square: MON/TUE/… with solid fill or dashed outline.
 */
function DayAbbrevChip({ abbreviation, chipIsFilled, chipUsesDashedBorder, colors }) {
  // Name fill / ink / border style before JSX — Design Law never invents hex here.
  const chipBackground = chipIsFilled ? colors.fill : 'transparent';
  const chipTextColor = chipIsFilled ? colors.onFill : colors.textPrimary;
  const borderStyle = chipUsesDashedBorder ? 'dashed' : 'solid';

  return (
    <View
      style={[
        styles.chip,
        {
          borderColor: colors.border,
          backgroundColor: chipBackground,
          borderStyle,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: chipTextColor }]}>
        {abbreviation}
      </Text>
    </View>
  );
}

/**
 * Middle column: bold title + muted subtitle (one line each).
 */
function DayTitleBlock({ title, subtitle, colors }) {
  return (
    <View style={styles.grow}>
      <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
        {subtitle}
      </Text>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

/**
 * True when every workout name looks like rest / recovery / off day.
 * Empty list is NOT “all rest” — that means “no workouts logged.”
 */
function workoutListIsAllRest(workouts) {
  const safeWorkouts = workouts || [];
  if (!safeWorkouts.length) {
    return false;
  }

  // Manipulate here: rest-name pattern if coaches use different “off” wording
  const restNamePattern = /\brest\b|recovery|off day/i;

  for (let i = 0; i < safeWorkouts.length; i += 1) {
    const workout = safeWorkouts[i];
    const workoutName = String(workout?.name || '');
    if (!restNamePattern.test(workoutName)) {
      return false;
    }
  }
  return true;
}

/**
 * Three-letter weekday for the chip.
 * Prefer day.dayName when already short; else first 3 of fullDayName; else list index.
 */
function weekdayAbbreviationForDay(day, listIndex) {
  const shortDayName = day?.dayName;
  if (shortDayName && String(shortDayName).length <= 3) {
    return String(shortDayName).toUpperCase();
  }

  const fromFullName = String(day?.fullDayName || '').slice(0, 3).toUpperCase();
  if (fromFullName) {
    return fromFullName;
  }

  return WEEKDAY_ABBREVIATIONS[listIndex] || 'DAY';
}

/**
 * Compare day.date ("YYYY-MM-DD") to the device’s local calendar today.
 * vocab: padStart = left-pad so month/day are always two digits
 */
function calendarDateKeyIsToday(dateKey) {
  if (!dateKey) {
    return false;
  }

  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(today.getDate()).padStart(2, '0');
  const todayIso = `${today.getFullYear()}-${month}-${dayOfMonth}`;
  return dateKey === todayIso;
}

/**
 * Pick title, subtitle, and chip kind for one day object from the week payload.
 * Same branch order as before — training → rest → nothing logged → fallback.
 */
function buildDayRowCopy(day) {
  const workouts = day.workouts || [];
  const hasWorkouts = workouts.length > 0;
  const trainingDay = hasWorkouts && !workoutListIsAllRest(workouts);

  // Rest: recovery flag, or only rest-named workouts, or check-in with sleep/water and no training.
  const restFromRecoveryFlag = Boolean(day.isRecovery);
  const restFromRestNamedWorkouts = hasWorkouts && !trainingDay;
  const restFromCheckInOnly =
    !hasWorkouts
    && day.hasCheckIn
    && (day.sleepHours > 0 || day.waterOz > 0);
  const restDay =
    restFromRecoveryFlag || restFromRestNamedWorkouts || restFromCheckInOnly;

  const workoutName = day.workoutName?.trim() || null;

  if (trainingDay) {
    return trainingDayCopy(day, workoutName);
  }

  if (restDay || day.isRecovery) {
    return restDayCopy(day);
  }

  const nothingLogged =
    !day.hasCheckIn && !(day.sleepHours > 0) && !hasWorkouts;
  if (nothingLogged) {
    return { title: 'No log', subtitle: 'Nothing logged', kind: DAY_KIND_EMPTY };
  }

  return fallbackLoggedDayCopy(day, workoutName);
}

function trainingDayCopy(day, workoutName) {
  const title = workoutName || 'Training day';
  let subtitle = 'Workout logged';
  if (day.workoutRating != null) {
    subtitle = `Rated ${day.workoutRating} of 10`;
  }
  return { title, subtitle, kind: DAY_KIND_DONE };
}

function restDayCopy(day) {
  let subtitle = 'Rest day';
  if (day.sleepHours > 0) {
    subtitle = `Slept ${day.sleepHours} h`;
  }
  return { title: 'Rest day', subtitle, kind: DAY_KIND_REST };
}

function fallbackLoggedDayCopy(day, workoutName) {
  let title = 'Logged';
  if (workoutName) {
    title = workoutName;
  } else if (day.hasCheckIn) {
    title = 'Check-in';
  }

  let subtitle = 'Day logged';
  if (day.sleepHours > 0) {
    subtitle = `Slept ${day.sleepHours} h`;
  }

  return { title, subtitle, kind: DAY_KIND_DONE };
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
    width: DAY_CHIP_SIZE,
    height: DAY_CHIP_SIZE,
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
