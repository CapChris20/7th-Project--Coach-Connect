/**
 * Nutrition Day Picker
 *
 * Purpose: Nutrition Day Picker — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: NutritionDayPicker
 *
 * @file-header
 */
import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getClientDateKey } from '../../app/dateKey';
import { NUT_ACTION_GRADIENT } from '../nutritionTheme';

function addDays(dateKey, delta) {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return getClientDateKey(d);
}

function weekStartKey(dateKey) {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() - d.getDay());
  return getClientDateKey(d);
}

function formatMonthLabel(weekStart) {
  const d = new Date(`${weekStart}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Week calendar — circular day buttons with prev/next week navigation. */
export default function NutritionDayPicker({
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
  const canGoForward = weekStart !== todayWeekStart && addDays(weekStart, 7) <= todayWeekStart;

  const weekDays = useMemo(() => {
    const list = [];
    for (let i = 0; i < 7; i += 1) list.push(addDays(weekStart, i));
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
    const next = addDays(weekStart, delta * 7);
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
          const d = new Date(`${dateKey}T12:00:00`);
          const weekday = d.toLocaleDateString(undefined, { weekday: 'narrow' });

          if (isFuture) {
            return (
              <View key={dateKey} style={styles.dayCol}>
                <Text style={[styles.weekday, { color: colors.muted }]}>{weekday}</Text>
                <View style={[styles.circleGhost, { backgroundColor: colors.circle }]}>
                  <Text style={[styles.dayNum, { color: colors.muted }]}>{d.getDate()}</Text>
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
                    <Text style={[styles.dayNum, { color: colors.text, fontWeight: '800' }]}>{d.getDate()}</Text>
                  </View>
                </LinearGradient>
              ) : (
                <View style={[styles.circle, { backgroundColor: colors.circle }]}>
                  <Text style={[styles.dayNum, { color: colors.text }]}>{d.getDate()}</Text>
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
