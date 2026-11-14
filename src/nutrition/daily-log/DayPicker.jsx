// Design Law week strip on the daily food log (nutrition PNG 01–04 / mockup `.d7`).
// Flow: snap to Sunday of selected week → seven day capsules → block future days.
// Used by DailyFoodLogScreen. Active = nbFill + onFill + HardShadow; log dots are ink only.
// Read order: presentation cells → exported picker (hooks) → styles → PLUMBING.

import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getClientDateKey } from '../../helpers/dateStrings';
import { lightColors, darkColors, nb } from '../../look-and-feel/colorPalette';
import HardShadow from '../../look-and-feel/HardShadow';

// ===== NAMED CONSTANTS =====

const DATE_KEY_NOON_SUFFIX = 'T12:00:00';
const DAYS_IN_A_WEEK = 7;
// Manipulate here: PNG `.d7 button` — min-height 62, radius 8, gap 4, shadow 3
const DAY_CARD_MIN_HEIGHT = 62;
const DAY_CARD_RADIUS = 8;
const DAY_GAP = 4;
const DOT_SIZE = 8;
const WEEKDAY_NARROW = {
  weekday: 'narrow'
};
const MONTH_YEAR = {
  month: 'long',
  year: 'numeric'
};

// ===== HELPER FUNCTIONS =====
// Presentation cells (no hooks). Date math lives under PLUMBING below the export.

// ===== MAIN FUNCTION =====
// Day cells + week strip first; exported DayPicker (hooks) follows so hooks stay after layout pieces.

/**
 * Bottom status dot: always an outlined circle; fills when logged / active+logged.
 * PNG: empty ring always visible; `.has` fills ink; active fills onFill.
 */
function DayStatusDot({
  hasLogs,
  isActive,
  colors
}) {
  // Name the border and fill before JSX — no nested ternary.
  let borderColor = colors.border;
  if (isActive) borderColor = colors.onFill;
  let fillColor = 'transparent';
  if (hasLogs && isActive) {
    fillColor = colors.onFill;
  } else if (hasLogs) {
    fillColor = colors.dot;
  }
  return <View style={[styles.dot, {
    borderColor,
    backgroundColor: fillColor
  }]} />;
}
function FutureDayCell({
  dateKey,
  weekdayLabel,
  dayNumber,
  colors
}) {
  return <View key={dateKey} style={styles.dayCol}>
      <HardShadow offset={nb.shadowOffsetSmall} radius={DAY_CARD_RADIUS} style={{
      width: '100%'
    }}>
        <View style={[styles.dayCard, {
        backgroundColor: colors.soft,
        borderColor: colors.border,
        opacity: 0.5
      }]}>
          <Text style={[styles.weekday, {
          color: colors.muted
        }]}>{weekdayLabel}</Text>
          <Text style={[styles.dayNum, {
          color: colors.muted
        }]}>{dayNumber}</Text>
          <View style={[styles.dot, {
          borderColor: colors.muted,
          backgroundColor: 'transparent'
        }]} />
        </View>
      </HardShadow>
    </View>;
}
function LogDayCell({
  dateKey,
  weekdayLabel,
  dayNumber,
  isActive,
  hasLogs,
  colors,
  onSelectDate
}) {
  // Name card chrome before JSX.
  let cardBackground;
  if (isActive) {
    cardBackground = colors.fill;
  } else {
    cardBackground = colors.chip;
  }
  let weekdayColor;
  if (isActive) {
    weekdayColor = colors.onFill;
  } else {
    weekdayColor = colors.muted;
  }
  let dayNumberColor;
  if (isActive) {
    dayNumberColor = colors.onFill;
  } else {
    dayNumberColor = colors.text;
  }
  return <TouchableOpacity key={dateKey} onPress={() => onSelectDate(dateKey)} activeOpacity={0.85} style={styles.dayCol} accessibilityRole="button" accessibilityState={{
    selected: isActive
  }}>
      <HardShadow offset={nb.shadowOffsetSmall} radius={DAY_CARD_RADIUS} style={{
      width: '100%'
    }}>
        <View style={[styles.dayCard, {
        backgroundColor: cardBackground,
        borderColor: colors.border
      }]}>
          <Text style={[styles.weekday, {
          color: weekdayColor
        }]}>{weekdayLabel}</Text>
          <Text style={[styles.dayNum, {
          color: dayNumberColor
        }]}>{dayNumber}</Text>
          <DayStatusDot hasLogs={hasLogs} isActive={isActive} colors={colors} />
        </View>
      </HardShadow>
    </TouchableOpacity>;
}
function WeekMonthHeader({
  colors,
  weekStart,
  canGoForward,
  onShiftWeek
}) {
  const monthLabel = formatMonthLabel(weekStart);
  let forwardChevronColor;
  if (canGoForward) {
    forwardChevronColor = colors.chevron;
  } else {
    forwardChevronColor = colors.chevronDisabled;
  }
  return <View style={styles.monthRow}>
      <TouchableOpacity onPress={() => onShiftWeek(-1)} hitSlop={10} style={styles.chevronBtn}>
        <Ionicons name="chevron-back" size={18} color={colors.chevron} />
      </TouchableOpacity>
      <Text style={[styles.monthLabel, {
      color: colors.text
    }]}>{monthLabel}</Text>
      <TouchableOpacity onPress={() => onShiftWeek(1)} disabled={!canGoForward} hitSlop={10} style={styles.chevronBtn}>
        <Ionicons name="chevron-forward" size={18} color={forwardChevronColor} />
      </TouchableOpacity>
    </View>;
}
function WeekDayCells({
  weekDayKeys,
  selectedDate,
  todayKey,
  logSet,
  colors,
  onSelectDate
}) {
  return <View style={styles.daysRow}>
      {weekDayKeys.map(dateKey => {
      const isActive = dateKey === selectedDate;
      const isFuture = dateKey > todayKey;
      const hasLogs = logSet.has(dateKey);
      const dayDate = dateAtNoon(dateKey);
      const weekdayLabel = dayDate.toLocaleDateString(undefined, WEEKDAY_NARROW);
      const dayNumber = dayDate.getDate();
      if (isFuture) {
        return <FutureDayCell key={dateKey} dateKey={dateKey} weekdayLabel={weekdayLabel} dayNumber={dayNumber} colors={colors} />;
      }
      return <LogDayCell key={dateKey} dateKey={dateKey} weekdayLabel={weekdayLabel} dayNumber={dayNumber} isActive={isActive} hasLogs={hasLogs} colors={colors} onSelectDate={onSelectDate} />;
    })}
    </View>;
}

// ===== MAIN EXPORT =====

export default function DayPicker({
  selectedDate,
  onSelectDate,
  todayKey = getClientDateKey(),
  isDark = true,
  datesWithLogs = []
}) {
  // Hook order frozen — do not reorder.
  // vocab: logSet = fast lookup for which calendar days already have nutrition_logs
  const logSet = useMemo(() => new Set(datesWithLogs || []), [datesWithLogs]);
  const [weekStart, setWeekStart] = useState(() => sundayOfWeekKey(selectedDate));

  // When parent changes selected day, keep the visible week in sync.
  useEffect(() => {
    setWeekStart(sundayOfWeekKey(selectedDate));
  }, [selectedDate]);

  // 1. Decide whether the forward chevron can leave this week.
  const todayWeekStart = sundayOfWeekKey(todayKey);
  const nextWeekFromHere = addDaysToDateKey(weekStart, DAYS_IN_A_WEEK);
  const canGoForward = weekStart !== todayWeekStart && nextWeekFromHere <= todayWeekStart;

  // 2. Build the seven date keys for the visible week.
  const weekDayKeys = useMemo(() => dateKeysForWeek(weekStart), [weekStart]);
  const colors = dayPickerThemeColors(isDark);

  // 3. Shift the week strip; never jump past today's week.
  const shiftWeek = deltaWeeks => {
    const nextWeekStart = addDaysToDateKey(weekStart, deltaWeeks * DAYS_IN_A_WEEK);
    const isMovingForward = deltaWeeks > 0;
    if (isMovingForward && nextWeekStart > todayWeekStart) return;
    setWeekStart(nextWeekStart);
  };
  return <View style={styles.wrap}>
      <WeekMonthHeader colors={colors} weekStart={weekStart} canGoForward={canGoForward} onShiftWeek={shiftWeek} />
      <WeekDayCells weekDayKeys={weekDayKeys} selectedDate={selectedDate} todayKey={todayKey} logSet={logSet} colors={colors} onSelectDate={onSelectDate} />
    </View>;
}
const styles = StyleSheet.create({
  // Manipulate here: space under the week strip before the ring card (Design Law block gap = 16)
  wrap: {
    width: '100%',
    marginBottom: 16
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  chevronBtn: {
    width: 32,
    alignItems: 'center',
    minHeight: nb.minTouchTarget,
    justifyContent: 'center'
  },
  monthLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.2
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: DAY_GAP
  },
  dayCol: {
    flex: 1,
    minWidth: 0
  },
  dayCard: {
    minHeight: DAY_CARD_MIN_HEIGHT,
    borderRadius: DAY_CARD_RADIUS,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    gap: 2
  },
  weekday: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3
  },
  dayNum: {
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums']
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2,
    marginTop: 2
  }
});

// ===== PLUMBING — skip unless debugging =====

function dateAtNoon(dateKey) {
  return new Date(`${dateKey}${DATE_KEY_NOON_SUFFIX}`);
}
function addDaysToDateKey(dateKey, dayCount) {
  const nextDate = dateAtNoon(dateKey);
  nextDate.setDate(nextDate.getDate() + dayCount);
  return getClientDateKey(nextDate);
}
function sundayOfWeekKey(dateKey) {
  const date = dateAtNoon(dateKey);
  date.setDate(date.getDate() - date.getDay());
  return getClientDateKey(date);
}
function formatMonthLabel(weekStart) {
  return dateAtNoon(weekStart).toLocaleDateString(undefined, MONTH_YEAR);
}
function dateKeysForWeek(weekStart) {
  const list = [];
  for (let dayIndex = 0; dayIndex < DAYS_IN_A_WEEK; dayIndex += 1) {
    list.push(addDaysToDateKey(weekStart, dayIndex));
  }
  return list;
}
function dayPickerThemeColors(isDark) {
  let palette;
  if (isDark) {
    palette = darkColors;
  } else {
    palette = lightColors;
  }
  return {
    text: palette.nbInk,
    muted: palette.nbMuted,
    chip: palette.nbSurfaceChip || palette.nbSurface,
    surface: palette.nbSurface,
    fill: palette.nbFill,
    onFill: palette.nbOnFill,
    border: palette.nbBorder,
    soft: palette.nbSoft,
    dot: palette.nbFill,
    chevron: palette.nbInk,
    chevronDisabled: palette.nbMuted
  };
}