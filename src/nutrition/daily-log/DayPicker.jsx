// Week strip on the food log. Each circle is one day. Future days stay disabled.
// Flow: snap to the Sunday of the selected week → draw seven days → block weeks after today.
// Used by: the daily food log screen.

import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getClientDateKey } from '../../helpers/dateStrings';
import { NUT_ACTION_GRADIENT } from '../nutritionColors';

// ===== NAMED CONSTANTS =====

// vocab: date keys are YYYY-MM-DD. Noon avoids a timezone shifting the day backward.
const DATE_KEY_NOON_SUFFIX = 'T12:00:00';
const DAYS_IN_A_WEEK = 7;

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
  return dateAtNoon(weekStart).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Week calendar — circular day buttons with prev/next week navigation. */
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

  const weekDays = useMemo(() => {
    const list = [];
    for (let dayIndex = 0; dayIndex < DAYS_IN_A_WEEK; dayIndex += 1) {
      list.push(addDays(weekStart, dayIndex));
    }
    return list;
  }, [weekStart]);

  const colors = isDark
    ? {
        text: '#FFFFFF',
        muted: 'rgba(255,255,255,0.42)',
        circle: 'rgba(255,255,255,0.06)',
        chevron: 'rgba(255,255,255,0.55)',
        chevronDisabled: 'rgba(255,255,255,0.18)',
        dot: '#34D399',
      }
    : {
        text: '#0A0A0F',
        muted: 'rgba(10,10,15,0.42)',
        circle: 'rgba(0,0,0,0.04)',
        chevron: 'rgba(10,10,15,0.55)',
        chevronDisabled: 'rgba(10,10,15,0.18)',
        dot: '#16A34A',
      };

  const shiftWeek = (delta) => {
    const next = addDays(weekStart, delta * DAYS_IN_A_WEEK);
    if (delta > 0 && next > todayWeekStart) return;
    setWeekStart(next);
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
          const active = dateKey === selectedDate;
          const isToday = dateKey === todayKey;
          const isFuture = dateKey > todayKey;
          const hasLogs = logSet.has(dateKey);
          const dayDate = dateAtNoon(dateKey);
          const weekday = dayDate.toLocaleDateString(undefined, { weekday: 'narrow' });

          if (isFuture) {
            return (
              <View key={dateKey} style={styles.dayCol}>
                <Text style={[styles.weekday, { color: colors.muted }]}>{weekday}</Text>
                <View style={[styles.circleGhost, { backgroundColor: colors.circle }]}>
                  <Text style={[styles.dayNum, { color: colors.muted }]}>{dayDate.getDate()}</Text>
                </View>
                <View style={styles.dotSlot} />
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={dateKey}
              onPress={() => onSelectDate(dateKey)}
              activeOpacity={0.82}
              style={styles.dayCol}
            >
              <Text style={[styles.weekday, { color: active ? '#FF6B9D' : colors.muted }]}>
                {isToday ? 'Today' : weekday}
              </Text>
              {active ? (
                <LinearGradient
                  colors={NUT_ACTION_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.circleActiveRing}
                >
                  <View style={[styles.circleActiveInner, { backgroundColor: isDark ? '#121018' : '#FFFFFF' }]}>
                    <Text style={[styles.dayNum, { color: colors.text, fontWeight: '800' }]}>{dayDate.getDate()}</Text>
                  </View>
                </LinearGradient>
              ) : (
                <View style={[styles.circle, { backgroundColor: colors.circle }]}>
                  <Text style={[styles.dayNum, { color: colors.text }]}>{dayDate.getDate()}</Text>
                </View>
              )}
              <View style={styles.dotSlot}>
                {hasLogs ? <View style={[styles.dot, { backgroundColor: colors.dot }]} /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const CIRCLE = 40;

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  chevronBtn: { width: 32, alignItems: 'center' },
  monthLabel: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dayCol: { flex: 1, alignItems: 'center', gap: 6 },
  weekday: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
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
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActiveInner: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: { fontSize: 15, fontWeight: '700' },
  dotSlot: { height: 5, justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
