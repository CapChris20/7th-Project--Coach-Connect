// Design Law month grid: bordered day tiles, session dots, selected = solid fill (not gradient).
// Flow: build week rows for the cursor month → tap a day → onSelectDate(YYYY-MM-DD) → chevrons move the month.
// Used by: BookSessionScreen month view (PNG 05/06).
//
// vocab: HardShadow = solid offset shadow on nav squares; out-of-month = dashed muted tiles
// Manipulate here: cell minHeight (44), nav button 36, session-dot size 5

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import HardShadow from '../../look-and-feel/HardShadow';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { nb, borderRadius, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DAYS_IN_WEEK = 7;
const NOON_LOCAL_SUFFIX = 'T12:00:00';
const DATE_KEY_LENGTH = 10;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
// Manipulate here: day cell height (Design Law min touch 44)
const DAY_CELL_MIN = 44;

// ===== HELPERS =====

function dateKeyFromDate(dateValue) {
  const y = dateValue.getFullYear();
  const m = String(dateValue.getMonth() + 1).padStart(2, '0');
  const d = String(dateValue.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

function buildMonthWeeks(year, monthIndex, startWeekday, daysInMonth) {
  // Include trailing/leading days from adjacent months so the grid is a full rectangle (PNG dashed cells)
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) {
    const dayNum = daysInPrevMonth - startWeekday + 1 + i;
    cells.push({ date: new Date(year, monthIndex - 1, dayNum), inMonth: false });
  }
  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    cells.push({ date: new Date(year, monthIndex, dayNumber), inMonth: true });
  }
  while (cells.length % DAYS_IN_WEEK !== 0) {
    const nextDay = cells.length - (startWeekday + daysInMonth) + 1;
    cells.push({ date: new Date(year, monthIndex + 1, nextDay), inMonth: false });
  }
  const rows = [];
  for (let index = 0; index < cells.length; index += DAYS_IN_WEEK) {
    rows.push(cells.slice(index, index + DAYS_IN_WEEK));
  }
  return rows;
}

function DayCell({ cell, selectedDate, sessionDays, onSelectDate, colors }) {
  const key = dateKeyFromDate(cell.date);
  const isSelected = key === selectedDate;
  const hasSession = sessionDays.has(key);
  const inMonth = cell.inMonth;

  const fillBg = isSelected ? colors.nbFill : colors.nbSurface;
  const ink = isSelected ? colors.nbOnFill : inMonth ? colors.nbInk : colors.nbMuted;

  return (
    <TouchableOpacity
      onPress={() => onSelectDate?.(key)}
      style={styles.cell}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <View
        style={[
          styles.dayBtn,
          {
            backgroundColor: fillBg,
            borderColor: inMonth || isSelected ? colors.nbBorder : colors.nbMuted,
            borderStyle: inMonth || isSelected ? 'solid' : 'dashed',
          },
          isSelected && { shadowColor: colors.nbShadow },
        ]}
      >
        <Text style={[styles.dayText, { color: ink }]}>{cell.date.getDate()}</Text>
        {/* Solid dot = day has sessions; hollow ring = empty (PNG week strip language) */}
        {hasSession ? (
          <View style={[styles.dot, { backgroundColor: isSelected ? colors.nbOnFill : colors.nbInk }]} />
        ) : (
          <View
            style={[
              styles.dotHollow,
              { borderColor: isSelected ? colors.nbOnFill : colors.nbMuted },
            ]}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

function WeekdayHeader({ colors }) {
  return (
    <View style={styles.weekdays}>
      {WEEKDAY_LABELS.map((label, index) => (
        <View key={`${label}-${index}`} style={styles.weekdayCell}>
          <Text style={[styles.weekday, { color: colors.nbMuted }]}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

function NavSquare({ onPress, children, colors }) {
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbChip}>
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles.navBtn,
          { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
        ]}
        activeOpacity={0.75}
        accessibilityRole="button"
      >
        {children}
      </TouchableOpacity>
    </HardShadow>
  );
}

// ===== MAIN =====

/**
 * Month calendar. `selectedDate` is a YYYY-MM-DD string. `sessions[].date` uses the same shape.
 * @param {object} props
 */
export const MonthCalendar = ({
  sessions = [],
  selectedDate,
  onSelectDate,
  onMonthChange,
  theme: _themeIgnored,
  borderless = false,
}) => {
  const { colors, isDark: _isDark } = useTheme();
  const selected = selectedDateAtNoon(selectedDate);
  const [cursor, setCursor] = useState(() => selected || new Date());

  useEffect(() => {
    onMonthChange?.(cursor);
  }, [cursor, onMonthChange]);

  // Keep the grid on the selected day when the parent changes selectedDate
  useEffect(() => {
    if (!selected) return;
    setCursor(selected);
  }, [selectedDate]);

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
        !borderless && {
          backgroundColor: colors.nbSurface,
          borderColor: colors.nbBorder,
          borderWidth: nb.borderWidth,
        },
      ]}
    >
      <View style={styles.header}>
        <NavSquare
          colors={colors}
          onPress={() => setCursor(new Date(year, monthIndex - 1, 1))}
        >
          <ChevronLeft size={18} color={colors.nbInk} />
        </NavSquare>
        <Text style={[styles.title, { color: colors.nbInk }]}>{monthTitle}</Text>
        <NavSquare
          colors={colors}
          onPress={() => setCursor(new Date(year, monthIndex + 1, 1))}
        >
          <ChevronRight size={18} color={colors.nbInk} />
        </NavSquare>
      </View>

      <WeekdayHeader colors={colors} />

      {weeks.map((row, rowIndex) => (
        <View key={`wk-${rowIndex}`} style={styles.row}>
          {row.map((cell, columnIndex) => (
            <DayCell
              key={`cell-${rowIndex}-${columnIndex}`}
              cell={cell}
              selectedDate={selectedDate}
              sessionDays={sessionDays}
              onSelectDate={onSelectDate}
              colors={colors}
            />
          ))}
        </View>
      ))}
    </View>
  );
};

export default MonthCalendar;

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.nbCard,
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
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.2,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdays: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekday: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  row: { flexDirection: 'row', marginBottom: 6, gap: 4 },
  cell: {
    flex: 1,
    minHeight: DAY_CELL_MIN,
  },
  dayBtn: {
    flex: 1,
    minHeight: DAY_CELL_MIN,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dayText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
    lineHeight: 16,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 3,
  },
  dotHollow: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    borderWidth: 1.5,
    marginTop: 3,
    backgroundColor: 'transparent',
  },
});
