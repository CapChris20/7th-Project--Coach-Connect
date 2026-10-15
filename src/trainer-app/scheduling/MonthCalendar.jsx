// Month grid for picking a session date. Days with sessions get a dot; the selected day fills with the accent.
// Flow: build week rows for the cursor month → tap a day → onSelectDate(YYYY-MM-DD) → chevrons move the month.
// Used by: the trainer scheduling screen.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

// ===== NAMED CONSTANTS =====

const THEME_DARK = 'dark';
const DAYS_IN_WEEK = 7;
const NOON_LOCAL_SUFFIX = 'T12:00:00';
const DATE_KEY_LENGTH = 10;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

// ===== HELPER FUNCTIONS =====

function dateKeyFromDate(dateValue) {
  return dateValue.toISOString().slice(0, DATE_KEY_LENGTH);
}

function selectedDateAtNoon(selectedDate) {
  if (!selectedDate) return null;
  return new Date(String(selectedDate).slice(0, DATE_KEY_LENGTH) + NOON_LOCAL_SUFFIX);
}

function collectSessionDayKeys(sessions) {
  const daysWithSessions = new Set();
  for (const session of sessions || []) {
    if (session?.date) daysWithSessions.add(String(session.date).slice(0, DATE_KEY_LENGTH));
  }
  return daysWithSessions;
}

function padLeadingEmptyCells(startWeekday) {
  const emptyCells = [];
  for (let index = 0; index < startWeekday; index += 1) emptyCells.push(null);
  return emptyCells;
}

function monthDayCells(year, monthIndex, daysInMonth) {
  const dayCells = [];
  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    dayCells.push(new Date(year, monthIndex, dayNumber));
  }
  return dayCells;
}

function padTrailingEmptyCells(cells) {
  const padded = [...cells];
  while (padded.length % DAYS_IN_WEEK !== 0) padded.push(null);
  return padded;
}

function chunkIntoWeeks(cells) {
  const rows = [];
  for (let index = 0; index < cells.length; index += DAYS_IN_WEEK) {
    rows.push(cells.slice(index, index + DAYS_IN_WEEK));
  }
  return rows;
}

function buildMonthWeeks(year, monthIndex, startWeekday, daysInMonth) {
  const leading = padLeadingEmptyCells(startWeekday);
  const days = monthDayCells(year, monthIndex, daysInMonth);
  const padded = padTrailingEmptyCells([...leading, ...days]);
  return chunkIntoWeeks(padded);
}

function dayCellBackground({ isSelected, hasSession, accent }) {
  if (isSelected) return { backgroundColor: accent };
  if (hasSession) return { backgroundColor: `${accent}22` };
  return null;
}

function DayCell({ cell, columnIndex, selectedDate, sessionDays, accent, textColor, onSelectDate }) {
  if (!cell) return <View key={`empty-${columnIndex}`} style={styles.cell} />;
  const key = dateKeyFromDate(cell);
  const isSelected = key === selectedDate;
  const hasSession = sessionDays.has(key);
  return (
    <TouchableOpacity
      key={`d-${columnIndex}`}
      onPress={() => onSelectDate?.(key)}
      style={[
        styles.cell,
        styles.dayBtn,
        dayCellBackground({ isSelected, hasSession, accent }),
      ]}
      activeOpacity={0.85}
    >
      <Text style={[styles.dayText, { color: isSelected ? 'white' : textColor }]}>
        {cell.getDate()}
      </Text>
      {hasSession ? (
        <View style={[styles.dot, { backgroundColor: isSelected ? 'white' : accent }]} />
      ) : (
        <View style={styles.dotSpacer} />
      )}
    </TouchableOpacity>
  );
}

function WeekdayHeader({ colors, borderless }) {
  return (
    <View style={[styles.weekdays, borderless && styles.weekdaysBorderless]}>
      {WEEKDAY_LABELS.map((label, index) => (
        <View key={`${label}-${index}`} style={styles.weekdayCell}>
          <Text style={[styles.weekday, { color: colors.textSecondary }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Month calendar. `selectedDate` is a YYYY-MM-DD string. `sessions[].date` uses the same shape.
 * @param {object} props
 */
export const MonthCalendar = ({
  sessions = [],
  selectedDate,
  onSelectDate,
  onMonthChange,
  theme = THEME_DARK,
  borderless = false,
  accentColor,
  cardBg,
}) => {
  const colors = COLORS[theme] || COLORS.dark;
  const accent = accentColor || colors.primary;
  const selected = selectedDateAtNoon(selectedDate);
  const [cursor, setCursor] = useState(() => selected || new Date());

  useEffect(() => {
    onMonthChange?.(cursor);
  }, [cursor, onMonthChange]);

  const year = cursor.getFullYear();
  const monthIndex = cursor.getMonth();
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const startWeekday = first.getDay();
  const monthTitle = cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  const sessionDays = useMemo(() => collectSessionDayKeys(sessions), [sessions]);

  const weeks = useMemo(
    () => buildMonthWeeks(year, monthIndex, startWeekday, daysInMonth),
    [year, monthIndex, startWeekday, daysInMonth],
  );

  return (
    <View
      style={[
        styles.card,
        borderless && styles.cardBorderless,
        {
          backgroundColor: borderless ? (cardBg || 'transparent') : colors.surface,
          borderColor: accent,
          borderWidth: borderless ? 0 : 2,
        },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setCursor(new Date(year, monthIndex - 1, 1))}
          style={[styles.navBtn, { borderColor: colors.glassBorder }]}
          activeOpacity={0.75}
        >
          <ChevronLeft size={16} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{monthTitle}</Text>
        <TouchableOpacity
          onPress={() => setCursor(new Date(year, monthIndex + 1, 1))}
          style={[styles.navBtn, { borderColor: colors.glassBorder }]}
          activeOpacity={0.75}
        >
          <ChevronRight size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <WeekdayHeader colors={colors} borderless={borderless} />

      {weeks.map((row, rowIndex) => (
        <View key={`wk-${rowIndex}`} style={styles.row}>
          {row.map((cell, columnIndex) => (
            <DayCell
              key={`cell-${rowIndex}-${columnIndex}`}
              cell={cell}
              columnIndex={columnIndex}
              selectedDate={selectedDate}
              sessionDays={sessionDays}
              accent={accent}
              textColor={colors.text}
              onSelectDate={onSelectDate}
            />
          ))}
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
