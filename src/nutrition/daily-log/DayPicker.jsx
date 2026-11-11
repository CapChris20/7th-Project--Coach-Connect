// Week strip on the food log. Each circle is one day. Future days stay disabled.
// Flow: snap to the Sunday of the selected week → draw seven days → block weeks after today.
// Used by: the daily food log screen.

import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getClientDateKey } from '../../helpers/dateStrings';
import { gradients, lightColors, darkColors, nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// vocab: date keys are YYYY-MM-DD. Noon avoids a timezone shifting the day backward.
const DATE_KEY_NOON_SUFFIX = 'T12:00:00';
const DAYS_IN_A_WEEK = 7;
// Manipulate here: day circle diameter (keep >= 44 for touch target)
const CIRCLE = 44;
const TODAY_LABEL = 'Today';
const WEEKDAY_NARROW = { weekday: 'narrow' };
const MONTH_YEAR = { month: 'long', year: 'numeric' };
// Brand pink from gradients.brand[0] — used as selected weekday accent
const ACTIVE_WEEKDAY_COLOR = gradients.brand.colors[0];

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} dateKey
 * @returns {Date}
 */
function dateAtNoon(dateKey) {
  return new Date(`${dateKey}${DATE_KEY_NOON_SUFFIX}`);
}

/**
 * @param {string} dateKey
 * @param {number} dayCount
 * @returns {string}
 */
function addDays(dateKey, dayCount) {
  const nextDate = dateAtNoon(dateKey);
  nextDate.setDate(nextDate.getDate() + dayCount);
  return getClientDateKey(nextDate);
}

/**
 * Sunday of the week that contains this date key. getDay() is 0 on Sunday.
 * @param {string} dateKey
 * @returns {string}
 */
function weekStartKey(dateKey) {
  const date = dateAtNoon(dateKey);
  date.setDate(date.getDate() - date.getDay());
  return getClientDateKey(date);
}

/**
 * @param {string} weekStart
 * @returns {string}
 */
function formatMonthLabel(weekStart) {
  return dateAtNoon(weekStart).toLocaleDateString(undefined, MONTH_YEAR);
}

/**
 * Seven date keys starting at Sunday.
 * @param {string} weekStart
 * @returns {string[]}
 */
function dateKeysForWeek(weekStart) {
  const list = [];
  for (let dayIndex = 0; dayIndex < DAYS_IN_A_WEEK; dayIndex += 1) {
    list.push(addDays(weekStart, dayIndex));
  }
  return list;
}

/**
 * Theme → neobrutalist tokens for the week strip.
 * @param {boolean} isDark
 */
function dayPickerColors(isDark) {
  const c = isDark ? darkColors : lightColors;
  return {
    text: c.nbInk,
    muted: c.nbMuted,
    circle: c.nbSurfaceChip,
    circleBorder: c.nbBorder,
    chevron: c.nbInk,
    chevronDisabled: c.nbMuted,
    // Manipulate here: log-presence dot color
    dot: c.success,
    surface: c.nbSurface,
  };
}

/**
 * Future days are visible but not tappable so a client cannot log food that has not happened yet.
 */
function FutureDayCell({ dateKey, weekday, dayNumber, colors }) {
  return (
    <View key={dateKey} style={styles.dayCol}>
      <Text style={[styles.weekday, { color: colors.muted }]}>{weekday}</Text>
      <View style={[styles.circleGhost, { backgroundColor: colors.circle }]}>
        <Text style={[styles.dayNum, { color: colors.muted }]}>{dayNumber}</Text>
      </View>
      <View style={styles.dotSlot} />
    </View>
  );
}

/**
 * Tappable day. The selected day gets the nutrition gradient ring; days with logs get a green dot.
 */
function LogDayCell({
  dateKey,
  weekdayLabel,
  dayNumber,
  isActive,
  hasLogs,
  isDark,
  colors,
  onSelectDate,
}) {
  return (
    <TouchableOpacity
      key={dateKey}
      onPress={() => onSelectDate(dateKey)}
      activeOpacity={0.82}
      style={styles.dayCol}
    >
      <Text style={[styles.weekday, { color: isActive ? ACTIVE_WEEKDAY_COLOR : colors.muted }]}>
        {weekdayLabel}
      </Text>
      {isActive ? (
        <LinearGradient
          colors={gradients.brand.colors}
          start={gradients.brand.start}
          end={gradients.brand.end}
          style={[styles.circleActiveRing, { borderColor: colors.circleBorder }]}
        >
          <View style={[styles.circleActiveInner, { backgroundColor: colors.surface }]}>
            <Text style={[styles.dayNum, { color: colors.text, fontFamily: 'SpaceGrotesk_700Bold' }]}>{dayNumber}</Text>
          </View>
        </LinearGradient>
      ) : (
        <View style={[styles.circle, { backgroundColor: colors.circle, borderColor: colors.circleBorder }]}>
          <Text style={[styles.dayNum, { color: colors.text }]}>{dayNumber}</Text>
        </View>
      )}
      <View style={styles.dotSlot}>
        {hasLogs ? <View style={[styles.dot, { backgroundColor: colors.dot }]} /> : null}
      </View>
    </TouchableOpacity>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Week calendar — circular day buttons with prev/next week navigation.
 * vocab: useState holds which Sunday the strip is showing; selecting a date in another week
 * snaps it via useEffect.
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
  const canGoForward = weekStart !== todayWeekStart && addDays(weekStart, DAYS_IN_A_WEEK) <= todayWeekStart;

  const weekDays = useMemo(() => dateKeysForWeek(weekStart), [weekStart]);
  const colors = dayPickerColors(isDark);

  const shiftWeek = (delta) => {
    const nextWeekStart = addDays(weekStart, delta * DAYS_IN_A_WEEK);
    if (delta > 0 && nextWeekStart > todayWeekStart) return;
    setWeekStart(nextWeekStart);
  };

  return (
    <View style={styles.wrap}>
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
          const isToday = dateKey === todayKey;
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
              weekdayLabel={isToday ? TODAY_LABEL : weekday}
              dayNumber={dayNumber}
              isActive={isActive}
              hasLogs={hasLogs}
              isDark={isDark}
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
  wrap: { width: '100%' },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  chevronBtn: { width: 32, alignItems: 'center' },
  monthLabel: { fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: -0.2 },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dayCol: { flex: 1, alignItems: 'center', gap: 6 },
  // Design rule: never below 12px
  weekday: { fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold', textTransform: 'uppercase', letterSpacing: 0.3 },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleGhost: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.45,
  },
  circleActiveRing: {
    width: CIRCLE + 4,
    height: CIRCLE + 4,
    borderRadius: (CIRCLE + 4) / 2,
    borderWidth: nb.borderWidth,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActiveInner: {
    width: CIRCLE - 4,
    height: CIRCLE - 4,
    borderRadius: (CIRCLE - 4) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: { fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' },
  dotSlot: { height: 5, justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
