import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

const COLORS = {
  dark: {
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.6)',
    border: 'rgba(255,255,255,0.10)',
    glass: 'rgba(255,255,255,0.04)',
    glassBorder: 'rgba(255,255,255,0.08)',
    surface: '#141418',
    primary: '#FF6B9D',
    primaryLight: 'rgba(255,107,157,0.15)',
  },
  light: {
    text: '#0A0A0F',
    textSecondary: 'rgba(10,10,15,0.55)',
    border: 'rgba(10,10,15,0.10)',
    glass: '#FFFFFF',
    glassBorder: 'rgba(10,10,15,0.10)',
    surface: '#FFFFFF',
    primary: '#FF6B9D',
    primaryLight: 'rgba(255,107,157,0.12)',
  },
};

const toKey = (d) => d.toISOString().slice(0, 10);

export const MonthCalendar = ({ sessions = [], selectedDate, onSelectDate, theme = 'dark', borderless = false }) => {
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
    <View
      style={[
        styles.card,
        borderless && styles.cardBorderless,
        {
          backgroundColor: borderless ? 'transparent' : colors.surface,
          borderColor: colors.glassBorder,
          borderWidth: borderless ? 0 : 1,
        },
      ]}
    >
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

      <View style={[styles.weekdays, borderless && styles.weekdaysBorderless]}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
          <View key={`${d}-${idx}`} style={styles.weekdayCell}>
            <Text style={[styles.weekday, { color: colors.textSecondary }]}>{d}</Text>
          </View>
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
                {hasSession ? (
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: isSelected ? 'white' : colors.primary },
                    ]}
                  />
                ) : (
                  <View style={styles.dotSpacer} />
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
    padding: 12,
  },
  cardBorderless: {
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
    marginBottom: 4,
  },
  weekdaysBorderless: {
    marginBottom: 2,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  row: { flexDirection: 'row', marginBottom: 4 },
  cell: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  dayBtn: { borderRadius: 10 },
  dayText: { fontSize: 13, fontWeight: '700', lineHeight: 16 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  dotSpacer: { width: 4, height: 4, marginTop: 2 },
});

