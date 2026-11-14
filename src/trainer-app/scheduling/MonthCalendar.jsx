// Design Law month grid: bordered day tiles, session dots, selected = solid fill (not gradient).
// Flow: build week rows for the cursor month → tap a day → onSelectDate(YYYY-MM-DD) → chevrons move month.
// Used by: BookSessionScreen month view (PNG 05/06).
// Read order: constants → date helpers → day/nav pieces → exported MonthCalendar → PLUMBING styles.
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
const DAY_CELL_MIN_HEIGHT = 44;
const NAV_CHEVRON_SIZE = 18;
const DAY_PRESS_OPACITY = 0.85;
const NAV_PRESS_OPACITY = 0.75;

// ===== HELPER FUNCTIONS =====

/**
 * Local calendar date → YYYY-MM-DD key the rest of scheduling already uses.
 * @param {Date} dateValue
 * @returns {string}
 */
function formatDateAsKey(dateValue) {
  const fullYear = dateValue.getFullYear();
  const monthNumber = dateValue.getMonth() + 1;
  const dayNumber = dateValue.getDate();
  const monthText = String(monthNumber).padStart(2, '0');
  const dayText = String(dayNumber).padStart(2, '0');
  return `${fullYear}-${monthText}-${dayText}`;
}

/**
 * Parse a selected YYYY-MM-DD at local noon so DST does not shift the day.
 * @param {string|null|undefined} selectedDateKey
 * @returns {Date|null}
 */
function selectedDateAtLocalNoon(selectedDateKey) {
  if (!selectedDateKey) {
    return null;
  }
  const datePrefix = String(selectedDateKey).slice(0, DATE_KEY_LENGTH);
  return new Date(datePrefix + NOON_LOCAL_SUFFIX);
}

/**
 * Unique day keys that have at least one session (for the solid/hollow dots).
 * @param {Array<{ date?: string }>|null|undefined} sessions
 * @returns {Set<string>}
 */
function collectSessionDayKeys(sessions) {
  const daysWithSessions = new Set();
  const sessionList = sessions || [];

  for (let index = 0; index < sessionList.length; index += 1) {
    const session = sessionList[index];
    // vocab: ?. = skip when session is missing; only add when date is present
    if (session?.date) {
      const dayKey = String(session.date).slice(0, DATE_KEY_LENGTH);
      daysWithSessions.add(dayKey);
    }
  }

  return daysWithSessions;
}

/**
 * Leading out-of-month cells so the first week starts on Sunday.
 * @returns {Array<{ date: Date, inMonth: boolean }>}
 */
function buildLeadingOutOfMonthCells(year, monthIndex, startWeekday) {
  const daysInPreviousMonth = new Date(year, monthIndex, 0).getDate();
  const leadingCells = [];

  for (let padIndex = 0; padIndex < startWeekday; padIndex += 1) {
    const dayNumber = daysInPreviousMonth - startWeekday + 1 + padIndex;
    const cellDate = new Date(year, monthIndex - 1, dayNumber);
    leadingCells.push({ date: cellDate, inMonth: false });
  }

  return leadingCells;
}

/**
 * One cell per day inside the cursor month.
 * @returns {Array<{ date: Date, inMonth: boolean }>}
 */
function buildInMonthCells(year, monthIndex, daysInMonth) {
  const inMonthCells = [];

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const cellDate = new Date(year, monthIndex, dayNumber);
    inMonthCells.push({ date: cellDate, inMonth: true });
  }

  return inMonthCells;
}

/**
 * Trailing out-of-month cells so the last week is a full 7-day row (PNG dashed cells).
 * @returns {Array<{ date: Date, inMonth: boolean }>}
 */
function buildTrailingOutOfMonthCells(
  year,
  monthIndex,
  startWeekday,
  daysInMonth,
  flatCellCountSoFar,
) {
  const trailingCells = [];
  let flatCellCount = flatCellCountSoFar;

  while (flatCellCount % DAYS_IN_WEEK !== 0) {
    const nextDayNumber = flatCellCount - (startWeekday + daysInMonth) + 1;
    const cellDate = new Date(year, monthIndex + 1, nextDayNumber);
    trailingCells.push({ date: cellDate, inMonth: false });
    flatCellCount += 1;
  }

  return trailingCells;
}

/**
 * Chunk a flat cell list into week rows of seven.
 * @param {Array} flatCells
 * @returns {Array<Array>}
 */
function chunkCellsIntoWeekRows(flatCells) {
  const weekRows = [];

  for (
    let startIndex = 0;
    startIndex < flatCells.length;
    startIndex += DAYS_IN_WEEK
  ) {
    weekRows.push(flatCells.slice(startIndex, startIndex + DAYS_IN_WEEK));
  }

  return weekRows;
}

/**
 * Full rectangle of day cells for one month (leading + in-month + trailing).
 * @returns {Array<Array<{ date: Date, inMonth: boolean }>>}
 */
function buildMonthWeeks(year, monthIndex, startWeekday, daysInMonth) {
  const leadingCells = buildLeadingOutOfMonthCells(
    year,
    monthIndex,
    startWeekday,
  );
  const inMonthCells = buildInMonthCells(year, monthIndex, daysInMonth);
  const flatSoFar = leadingCells.concat(inMonthCells);
  const trailingCells = buildTrailingOutOfMonthCells(
    year,
    monthIndex,
    startWeekday,
    daysInMonth,
    flatSoFar.length,
  );
  const flatCells = flatSoFar.concat(trailingCells);
  return chunkCellsIntoWeekRows(flatCells);
}

/**
 * Day-number ink: on-fill when selected, muted when out of month, else ink.
 * @param {boolean} isSelected
 * @param {boolean} inMonth
 * @param {object} colors
 * @returns {string}
 */
function dayNumberTextColor(isSelected, inMonth, colors) {
  if (isSelected) {
    return colors.nbOnFill;
  }
  if (inMonth) {
    return colors.nbInk;
  }
  return colors.nbMuted;
}

/**
 * Border for a day tile: solid for in-month / selected; dashed muted for padding days.
 */
function dayTileBorderLook(inMonth, isSelected, colors) {
  if (inMonth || isSelected) {
    return { borderColor: colors.nbBorder, borderStyle: 'solid' };
  }
  return { borderColor: colors.nbMuted, borderStyle: 'dashed' };
}

/**
 * One tappable day tile with solid/hollow session dot.
 */
function DayCell({ cell, selectedDate, sessionDays, onSelectDate, colors }) {
  const dayKey = formatDateAsKey(cell.date);
  const isSelected = dayKey === selectedDate;
  const hasSession = sessionDays.has(dayKey);
  const inMonth = cell.inMonth;

  let tileBackground = colors.nbSurface;
  if (isSelected) {
    tileBackground = colors.nbFill;
  }

  const numberColor = dayNumberTextColor(isSelected, inMonth, colors);
  const { borderColor: tileBorderColor, borderStyle: tileBorderStyle } =
    dayTileBorderLook(inMonth, isSelected, colors);

  let sessionDotFill = colors.nbInk;
  let hollowDotBorder = colors.nbMuted;
  if (isSelected) {
    sessionDotFill = colors.nbOnFill;
    hollowDotBorder = colors.nbOnFill;
  }

  // Named local: selected tiles also get a soft shadow tint from theme.
  let selectedShadowStyle = null;
  if (isSelected) {
    selectedShadowStyle = { shadowColor: colors.nbShadow };
  }

  const handleDayPress = () => {
    // vocab: ?. = only call when the parent passed onSelectDate
    onSelectDate?.(dayKey);
  };

  let sessionMarker = (
    <View style={[styles.dotHollow, { borderColor: hollowDotBorder }]} />
  );
  if (hasSession) {
    // Solid dot = day has sessions; hollow ring = empty (PNG week strip language)
    sessionMarker = (
      <View style={[styles.dot, { backgroundColor: sessionDotFill }]} />
    );
  }

  return (
    <TouchableOpacity
      onPress={handleDayPress}
      style={styles.cell}
      activeOpacity={DAY_PRESS_OPACITY}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <View
        style={[
          styles.dayBtn,
          {
            backgroundColor: tileBackground,
            borderColor: tileBorderColor,
            borderStyle: tileBorderStyle,
          },
          selectedShadowStyle,
        ]}
      >
        <Text style={[styles.dayText, { color: numberColor }]}>
          {cell.date.getDate()}
        </Text>
        {sessionMarker}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Single letter weekday headers across the top of the grid.
 */
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

/**
 * Hard-shadow chevron square for previous / next month.
 */
function NavSquare({ onPress, children, colors }) {
  const navButtonStyle = [
    styles.navBtn,
    { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
  ];

  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbChip}>
      <TouchableOpacity
        onPress={onPress}
        style={navButtonStyle}
        activeOpacity={NAV_PRESS_OPACITY}
        accessibilityRole="button"
      >
        {children}
      </TouchableOpacity>
    </HardShadow>
  );
}

/**
 * Month title + left/right chevrons.
 */
function MonthCalendarHeader({ monthTitle, colors, onPreviousMonth, onNextMonth }) {
  return (
    <View style={styles.header}>
      <NavSquare colors={colors} onPress={onPreviousMonth}>
        <ChevronLeft size={NAV_CHEVRON_SIZE} color={colors.nbInk} />
      </NavSquare>
      <Text style={[styles.title, { color: colors.nbInk }]}>{monthTitle}</Text>
      <NavSquare colors={colors} onPress={onNextMonth}>
        <ChevronRight size={NAV_CHEVRON_SIZE} color={colors.nbInk} />
      </NavSquare>
    </View>
  );
}

/**
 * One week row of seven DayCell tiles.
 */
function MonthWeekRow({
  row,
  rowIndex,
  selectedDate,
  sessionDays,
  onSelectDate,
  colors,
}) {
  return (
    <View style={styles.row}>
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
  );
}

/**
 * Outer card chrome — bordered surface, or borderless flush when parent asks.
 */
function buildMonthCardStyle(borderless, colors) {
  const styleList = [styles.card];

  if (borderless) {
    styleList.push(styles.cardBorderless);
  }

  if (!borderless) {
    styleList.push({
      backgroundColor: colors.nbSurface,
      borderColor: colors.nbBorder,
      borderWidth: nb.borderWidth,
    });
  }

  return styleList;
}

// ===== MAIN FUNCTION =====

/**
 * Month grid for BookSessionScreen — select a day, page months with chevrons.
 * Hook order frozen: theme → month cursor → onMonthChange effect → selectedDate effect → memos.
 * @param {{ sessions?: Array, selectedDate: string, onSelectDate: Function, onMonthChange?: Function, theme?: *, borderless?: boolean }} props
 */
export const MonthCalendar = ({
  sessions = [],
  selectedDate,
  onSelectDate,
  onMonthChange,
  theme: _themeIgnored,
  borderless = false,
}) => {
  // 1. Theme colors (caller `theme` prop is accepted but ignored — Design Law useTheme wins).
  const { colors, isDark: _isDark } = useTheme();

  // 2. Month cursor starts on the selected day (local noon) or today.
  const selectedAtNoon = selectedDateAtLocalNoon(selectedDate);
  const [monthCursor, setMonthCursor] = useState(
    () => selectedAtNoon || new Date(),
  );

  // 3. Tell the parent whenever the visible month changes (filter sessions, etc.).
  // vocab: useEffect = run after paint; cleanup not needed — we only notify
  useEffect(() => {
    onMonthChange?.(monthCursor);
  }, [monthCursor, onMonthChange]);

  // 4. Keep the grid on the selected day when the parent changes selectedDate.
  // Dependency stays [selectedDate] (same as before) — do not add selectedAtNoon.
  useEffect(() => {
    if (!selectedAtNoon) {
      return;
    }
    setMonthCursor(selectedAtNoon);
  }, [selectedDate]);

  // 5. Cursor month math for the grid title and week builder.
  const cursorYear = monthCursor.getFullYear();
  const cursorMonthIndex = monthCursor.getMonth();
  const firstOfMonth = new Date(cursorYear, cursorMonthIndex, 1);
  const daysInMonth = new Date(cursorYear, cursorMonthIndex + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const monthTitle = monthCursor.toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  // 6. Session-dot set + week rows — memoized so day taps do not rebuild the whole grid.
  // vocab: useMemo = recompute only when listed inputs change
  const sessionDays = useMemo(
    () => collectSessionDayKeys(sessions),
    [sessions],
  );
  const weeks = useMemo(
    () =>
      buildMonthWeeks(
        cursorYear,
        cursorMonthIndex,
        startWeekday,
        daysInMonth,
      ),
    [cursorYear, cursorMonthIndex, startWeekday, daysInMonth],
  );

  // 7. Chevron handlers — jump to the 1st of the neighboring month.
  const goToPreviousMonth = () => {
    setMonthCursor(new Date(cursorYear, cursorMonthIndex - 1, 1));
  };
  const goToNextMonth = () => {
    setMonthCursor(new Date(cursorYear, cursorMonthIndex + 1, 1));
  };

  // 8. Name card chrome before JSX.
  const cardStyle = buildMonthCardStyle(borderless, colors);

  return (
    <View style={cardStyle}>
      <MonthCalendarHeader
        monthTitle={monthTitle}
        colors={colors}
        onPreviousMonth={goToPreviousMonth}
        onNextMonth={goToNextMonth}
      />

      <WeekdayHeader colors={colors} />

      {weeks.map((row, rowIndex) => (
        <MonthWeekRow
          key={`wk-${rowIndex}`}
          row={row}
          rowIndex={rowIndex}
          selectedDate={selectedDate}
          sessionDays={sessionDays}
          onSelectDate={onSelectDate}
          colors={colors}
        />
      ))}
    </View>
  );
};

export default MonthCalendar;

// ===== PLUMBING — skip unless debugging =====

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
    minHeight: DAY_CELL_MIN_HEIGHT,
  },
  dayBtn: {
    flex: 1,
    minHeight: DAY_CELL_MIN_HEIGHT,
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
