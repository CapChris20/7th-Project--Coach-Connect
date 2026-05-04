import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

const COLORS = {
  dark: {
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.6)',
    border: 'rgba(255,255,255,0.1)',
    glass: 'rgba(255,255,255,0.04)',
    glassBorder: 'rgba(255,255,255,0.08)',
    primary: '#FF6B9D',
    primaryLight: 'rgba(255,107,157,0.15)',
  },
  light: {
    text: '#000000',
    textSecondary: 'rgba(0,0,0,0.6)',
    border: 'rgba(0,0,0,0.1)',
    glass: 'rgba(0,0,0,0.04)',
    glassBorder: 'rgba(0,0,0,0.08)',
    primary: '#FF6B9D',
    primaryLight: 'rgba(255,107,157,0.15)',
  },
};

const toKey = (d) => d.toISOString().slice(0, 10);

export const MonthCalendar = ({ sessions = [], selectedDate, onSelectDate, theme = 'dark' }) => {
  const colors = COLORS[theme] || COLORS.dark;
  const selected = selectedDate ? new Date(String(selectedDate).slice(0, 10) + 'T12:00:00') : null;
  const [cursor, setCursor] = useState(() => selected || new Date());

  const year = cursor.getFullYear();
  const month0 = cursor.getMonth();
  const first = new Date(year, month0, 1);
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  const startWeekday = first.getDay(); // 0=Sun
  const monthTitle = cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  const sessionDays = useMemo(() => {
    const set = new Set();
    for (const s of sessions || []) {
      if (s?.date) set.add(String(s.date).slice(0, 10));
    }
    return set;
  }, [sessions]);

  const weeks = useMemo(() => {
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month0, d));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [year, month0, startWeekday, daysInMonth]);

  return (
    <View style={[styles.card, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setCursor(new Date(year, month0 - 1, 1))}
          style={[styles.navBtn, { borderColor: colors.glassBorder }]}
          activeOpacity={0.75}
        >
          <ChevronLeft size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{monthTitle}</Text>
        <TouchableOpacity
          onPress={() => setCursor(new Date(year, month0 + 1, 1))}
          style={[styles.navBtn, { borderColor: colors.glassBorder }]}
          activeOpacity={0.75}
        >
          <ChevronRight size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.weekdays}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
          <Text key={`${d}-${idx}`} style={[styles.weekday, { color: colors.textSecondary }]}>
            {d}
          </Text>
        ))}
      </View>

      {weeks.map((row, rIdx) => (
        <View key={`wk-${rIdx}`} style={styles.row}>
          {row.map((cell, cIdx) => {
            if (!cell) return <View key={`empty-${cIdx}`} style={styles.cell} />;
            const key = toKey(cell);
            const isSelected = key === selectedDate;
            const hasSession = sessionDays.has(key);
            return (
              <TouchableOpacity
                key={`d-${cIdx}`}
                onPress={() => onSelectDate?.(key)}
                style={[
                  styles.cell,
                  styles.dayBtn,
                  isSelected && { backgroundColor: colors.primary },
                  !isSelected && hasSession && { backgroundColor: colors.primaryLight },
                ]}
                activeOpacity={0.85}
              >
                <Text style={[styles.dayText, { color: isSelected ? 'white' : colors.text }]}>
                  {cell.getDate()}
                </Text>
                {hasSession && (
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: isSelected ? 'white' : colors.primary },
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 6,
  },
  weekday: { width: 32, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, marginBottom: 6 },
  cell: { width: 32, height: 38, alignItems: 'center', justifyContent: 'center' },
  dayBtn: { borderRadius: 12 },
  dayText: { fontSize: 12, fontWeight: '700' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
});

