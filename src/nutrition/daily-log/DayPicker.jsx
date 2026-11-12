// Design Law week strip on the daily food log (nutrition PNG 01–04 / mockup `.d7`).
// Flow: snap to Sunday of selected week → seven day capsules → block future days.
// Used by DailyFoodLogScreen. Active = nbFill + onFill + HardShadow; log dots are ink only.

import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getClientDateKey } from '../../helpers/dateStrings';
import { lightColors, darkColors, nb, borderRadius } from '../../look-and-feel/colorPalette';
import HardShadow from '../../look-and-feel/HardShadow';

// ===== NAMED CONSTANTS =====

const DATE_KEY_NOON_SUFFIX = 'T12:00:00';
const DAYS_IN_A_WEEK = 7;
// Manipulate here: PNG `.d7 button` — min-height 62, radius 8, gap 4, shadow 3
const DAY_CARD_MIN_HEIGHT = 62;
const DAY_CARD_RADIUS = 8;
const DAY_GAP = 4;
const DOT_SIZE = 8;
const WEEKDAY_NARROW = { weekday: 'narrow' };
const MONTH_YEAR = { month: 'long', year: 'numeric' };

// ===== HELPER FUNCTIONS =====

function dateAtNoon(dateKey) {
  return new Date(`${dateKey}${DATE_KEY_NOON_SUFFIX}`);
}

function addDays(dateKey, dayCount) {
  const nextDate = dateAtNoon(dateKey);
  nextDate.setDate(nextDate.getDate() + dayCount);
  return getClientDateKey(nextDate);
}

function weekStartKey(dateKey) {
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
    list.push(addDays(weekStart, dayIndex));
  }
  return list;
}

function dayPickerColors(isDark) {
  const c = isDark ? darkColors : lightColors;
  return {
    text: c.nbInk,
    muted: c.nbMuted,
    // vocab: chip = unselected day fill (Design Law `chip` token)
    chip: c.nbSurfaceChip || c.nbSurface,
    surface: c.nbSurface,
    fill: c.nbFill,
    onFill: c.nbOnFill,
    border: c.nbBorder,
    soft: c.nbSoft,
    // Log-presence dots stay ink (never green / pink — Design Law)
    dot: c.nbFill,
    chevron: c.nbInk,
    chevronDisabled: c.nbMuted,
  };
}

/**
 * Bottom status dot: always an outlined circle; fills when logged / active+logged.
 * PNG: empty ring always visible; `.has` fills ink; active fills onFill.
 */
function DayStatusDot({ hasLogs, isActive, colors }) {
  const borderColor = isActive ? colors.onFill : colors.border;
  const fillColor = !hasLogs ? 'transparent' : isActive ? colors.onFill : colors.dot;
  return (
    <View
      style={[
        styles.dot,
        {
          borderColor,
          backgroundColor: fillColor,
        },
      ]}
    />
  );
}

/**
 * Future day — visible but not tappable. Still HardShadow (PNG 01 every capsule has offset).
 */
function FutureDayCell({ dateKey, weekday, dayNumber, colors }) {
  return (
    <View key={dateKey} style={styles.dayCol}>
      <HardShadow offset={nb.shadowOffsetSmall} radius={DAY_CARD_RADIUS} style={{ width: '100%' }}>
        <View
          style={[
            styles.dayCard,
            {
              backgroundColor: colors.soft,
              borderColor: colors.border,
              opacity: 0.5,
            },
          ]}
        >
          <Text style={[styles.weekday, { color: colors.muted }]}>{weekday}</Text>
          <Text style={[styles.dayNum, { color: colors.muted }]}>{dayNumber}</Text>
          <View style={[styles.dot, { borderColor: colors.muted, backgroundColor: 'transparent' }]} />
        </View>
      </HardShadow>
    </View>
  );
}

/**
 * Tappable day capsule. EVERY day gets HardShadow (PNG 01); active = fill + onFill.
 */
function LogDayCell({
  dateKey,
  weekdayLabel,
  dayNumber,
  isActive,
  hasLogs,
  colors,
  onSelectDate,
}) {
  return (
    <TouchableOpacity
      key={dateKey}
      onPress={() => onSelectDate(dateKey)}
      activeOpacity={0.85}
      style={styles.dayCol}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <HardShadow offset={nb.shadowOffsetSmall} radius={DAY_CARD_RADIUS} style={{ width: '100%' }}>
        <View
          style={[
            styles.dayCard,
            {
              backgroundColor: isActive ? colors.fill : colors.chip,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.weekday, { color: isActive ? colors.onFill : colors.muted }]}>
            {weekdayLabel}
          </Text>
          <Text style={[styles.dayNum, { color: isActive ? colors.onFill : colors.text }]}>
            {dayNumber}
          </Text>
          <DayStatusDot hasLogs={hasLogs} isActive={isActive} colors={colors} />
        </View>
      </HardShadow>
    </TouchableOpacity>
  );
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ selectedDate: string, onSelectDate: Function, todayKey?: string, isDark?: boolean, datesWithLogs?: string[] }} props
 */
export default function DayPicker({
  selectedDate,
  onSelectDate,
  todayKey = getClientDateKey(),
  isDark = true,
  datesWithLogs = [],
}) {
  const logSet = useMemo(() => new Set(datesWithLogs || []), [datesWithLogs]);
  const [weekStart, setWeekStart] = useState(() => weekStartKey(selectedDate));

  useEffect(() => {
    setWeekStart(weekStartKey(selectedDate));
  }, [selectedDate]);

  const todayWeekStart = weekStartKey(todayKey);
  const canGoForward =
    weekStart !== todayWeekStart && addDays(weekStart, DAYS_IN_A_WEEK) <= todayWeekStart;

  const weekDays = useMemo(() => dateKeysForWeek(weekStart), [weekStart]);
  const colors = dayPickerColors(isDark);

  const shiftWeek = (delta) => {
    const nextWeekStart = addDays(weekStart, delta * DAYS_IN_A_WEEK);
    if (delta > 0 && nextWeekStart > todayWeekStart) return;
    setWeekStart(nextWeekStart);
  };

  return (
    <View style={styles.wrap}>
      {/* Week jump — not on PNG chrome, kept so past weeks stay reachable */}
      <View style={styles.monthRow}>
        <TouchableOpacity onPress={() => shiftWeek(-1)} hitSlop={10} style={styles.chevronBtn}>
          <Ionicons name="chevron-back" size={18} color={colors.chevron} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text }]}>{formatMonthLabel(weekStart)}</Text>
        <TouchableOpacity
          onPress={() => shiftWeek(1)}
          disabled={!canGoForward}
          hitSlop={10}
          style={styles.chevronBtn}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={canGoForward ? colors.chevron : colors.chevronDisabled}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.daysRow}>
        {weekDays.map((dateKey) => {
          const isActive = dateKey === selectedDate;
          const isFuture = dateKey > todayKey;
          const hasLogs = logSet.has(dateKey);
          const dayDate = dateAtNoon(dateKey);
          const weekday = dayDate.toLocaleDateString(undefined, WEEKDAY_NARROW);
          const dayNumber = dayDate.getDate();

          if (isFuture) {
            return (
              <FutureDayCell
                key={dateKey}
                dateKey={dateKey}
                weekday={weekday}
                dayNumber={dayNumber}
                colors={colors}
              />
            );
          }

          return (
            <LogDayCell
              key={dateKey}
              dateKey={dateKey}
              weekdayLabel={weekday}
              dayNumber={dayNumber}
              isActive={isActive}
              hasLogs={hasLogs}
              colors={colors}
              onSelectDate={onSelectDate}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Manipulate here: space under the week strip before the ring card (Design Law block gap = 16)
  wrap: { width: '100%', marginBottom: 16 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chevronBtn: {
    width: 32,
    alignItems: 'center',
    minHeight: nb.minTouchTarget,
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.2,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    gap: DAY_GAP,
  },
  dayCol: { flex: 1, minWidth: 0 },
  // PNG `.d7 button` — rounded-rect capsules (not circles)
  dayCard: {
    minHeight: DAY_CARD_MIN_HEIGHT,
    borderRadius: DAY_CARD_RADIUS,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    gap: 2,
  },
  weekday: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dayNum: {
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  // Always-visible ring; fill when `.has` / active+has
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2,
    marginTop: 2,
  },
});
