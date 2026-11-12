// Design Law trainer scheduling: Calendar (week strip / month) + List, SessionCards, empty states.
// Flow: useSessions() live listener → Calendar|List → week agenda or month grid → open / create session.
// Used by: TrainerAppStart Sessions tab and client-detail embedded calendar.
//
// vocab: week strip = primary calendar (PNG 01); month view is one tap away (PNG 05)
// vocab: useShellTopPad = status-bar clearance when shell SafeArea is left/right only
// Manipulate here: UPCOMING_LIMIT, week length (7), empty-state copy

import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react-native';
import {
  addDays,
  format,
  parseISO,
  startOfWeek,
  isValid,
  addWeeks,
  subWeeks,
} from 'date-fns';
import { useSessions } from '../scheduling/mySessions';
import { MonthCalendar } from './MonthCalendar';
import { SessionCard } from './SessionCard';
import {
  FORM_SCROLL_PROPS,
  useEmbeddedScrollBottomPad,
  useShellTopPad,
} from '../../navigation/bottomMenuSpacing';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { nb, spacing } from '../../look-and-feel/colorPalette';
import NbSegmented from '../../look-and-feel/NbSegmented';
import NbButton from '../../look-and-feel/NbButton';
import NbChip from '../../look-and-feel/NbChip';
import NbCard from '../../look-and-feel/NbCard';
import NbIconChip from '../../look-and-feel/NbIconChip';
import HardShadow from '../../look-and-feel/HardShadow';

// ===== NAMED CONSTANTS =====

const SCROLL_BOTTOM_PAD_EMBEDDED = 24;
const SCROLL_BOTTOM_PAD_STANDALONE = 40;
const UPCOMING_LIMIT = 12;
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const ICON_SCHEDULE = require('../../assets/icons/handoff/schedule.png');

const VIEW_SEGMENTS = [
  { id: 'calendar', label: 'Calendar' },
  { id: 'list', label: 'List' },
];

// ===== HELPERS =====

function dateKeyFromDate(dateValue) {
  return format(dateValue, 'yyyy-MM-dd');
}

function generateWeekDates(anchor) {
  const weekStart = startOfWeek(anchor, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

function collectSessionDayKeys(sessions) {
  const set = new Set();
  for (const s of sessions || []) {
    if (s?.date) set.add(String(s.date).slice(0, 10));
  }
  return set;
}

function formatDayHeader(dateKey, todayKey) {
  if (!dateKey) return '';
  try {
    const d = parseISO(dateKey);
    if (!isValid(d)) return dateKey;
    const base = format(d, 'EEE, MMM d');
    if (dateKey === todayKey) return `Today · ${base}`;
    return base;
  } catch (_e) {
    return dateKey;
  }
}

function formatAgendaTitle(dateKey) {
  try {
    const d = parseISO(dateKey);
    if (!isValid(d)) return dateKey;
    return format(d, 'EEEE, MMM d');
  } catch (_e) {
    return dateKey;
  }
}

function groupSessionsByDate(sessions) {
  const map = new Map();
  for (const session of sessions || []) {
    const key = String(session.date || '').slice(0, 10);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(session);
  }
  for (const list of map.values()) {
    list.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function NavSquare({ onPress, children, colors }) {
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={12}>
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles.navSquare,
          { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
        ]}
        accessibilityRole="button"
        activeOpacity={0.8}
      >
        {children}
      </TouchableOpacity>
    </HardShadow>
  );
}

function EmptyState({ title, subtitle, cta, onCta }) {
  const { colors } = useTheme();
  return (
    <NbCard style={[styles.emptyState, { borderStyle: 'dashed' }]}>
      <NbIconChip source={ICON_SCHEDULE} index={7} size={48} />
      <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.emptySubtitle, { color: colors.nbMuted }]}>{subtitle}</Text>
      ) : null}
      {cta && onCta ? (
        <NbButton variant="fill" onPress={onCta} sm style={styles.emptyBtn}>
          {cta}
        </NbButton>
      ) : null}
    </NbCard>
  );
}

function WeekDateStrip({
  weekDates,
  selectedDateKey,
  sessionDays,
  onSelectDate,
  colors,
}) {
  return (
    <View style={styles.weekStrip}>
      {weekDates.map((date) => {
        const id = dateKeyFromDate(date);
        const selected = id === selectedDateKey;
        const hasSession = sessionDays.has(id);
        const ink = selected ? colors.nbOnFill : colors.nbInk;
        return (
          <NbChip
            key={id}
            selected={selected}
            onPress={() => onSelectDate(id)}
            style={styles.weekChip}
            contentStyle={styles.weekChipInner}
          >
            <View style={styles.weekChipContent}>
              <Text style={[styles.weekDay, { color: ink }]}>
                {WEEKDAY_LABELS[date.getDay()]}
              </Text>
              <Text style={[styles.weekDate, { color: ink }]}>{format(date, 'd')}</Text>
              <View
                style={[
                  hasSession ? styles.dotFilled : styles.dotHollow,
                  {
                    borderColor: ink,
                    backgroundColor: hasSession ? ink : 'transparent',
                  },
                ]}
              />
            </View>
          </NbChip>
        );
      })}
    </View>
  );
}

// ===== MAIN =====

/**
 * Trainer session calendar — week agenda (default), month grid, or upcoming list.
 * Pass clientId to filter to one client. Restyle only — Firestore keys unchanged.
 */
export const BookSessionScreen = ({
  theme: _themeIgnored,
  embedded = true,
  onNavigate,
  clientId,
  clientName,
}) => {
  const { colors, isDark: _isDark } = useTheme();
  const { sessions } = useSessions();
  const shellTopPad = useShellTopPad(spacing.sm);
  const scrollBottomPad = useEmbeddedScrollBottomPad(
    embedded ? SCROLL_BOTTOM_PAD_EMBEDDED : SCROLL_BOTTOM_PAD_STANDALONE,
  );

  const [tab, setTab] = useState('calendar');
  // vocab: calendarMode = week strip (default) vs full month grid
  const [calendarMode, setCalendarMode] = useState('week');
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKeyFromDate(new Date()));

  const clientLabel = clientName || (clientId ? 'this client' : 'all clients');
  const todayKey = dateKeyFromDate(new Date());

  const sessionsForClient = useMemo(() => {
    const all = sessions || [];
    if (!clientId) return all;
    const id = String(clientId);
    return all.filter((s) => s?.clientId != null && String(s.clientId) === id);
  }, [sessions, clientId]);

  const sessionDays = useMemo(
    () => collectSessionDayKeys(sessionsForClient),
    [sessionsForClient],
  );

  const weekDates = useMemo(() => generateWeekDates(weekAnchor), [weekAnchor]);
  const monthTitle = format(weekAnchor, 'MMMM yyyy');

  const sessionsOnSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return sessionsForClient
      .filter((s) => s.date === selectedDate)
      .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  }, [sessionsForClient, selectedDate]);

  const upcomingSessions = useMemo(
    () =>
      [...sessionsForClient]
        .filter((s) => (s.date || '') >= todayKey)
        .sort((a, b) =>
          `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
        )
        .slice(0, UPCOMING_LIMIT),
    [sessionsForClient, todayKey],
  );

  const groupedUpcoming = useMemo(
    () => groupSessionsByDate(upcomingSessions),
    [upcomingSessions],
  );

  function newSessionPath(dateKey) {
    if (!dateKey) return '/sessions/new';
    return `/sessions/new?date=${encodeURIComponent(dateKey)}`;
  }

  function goToSession(sessionId) {
    onNavigate?.(`/sessions/${sessionId}`);
  }

  const agendaCount = sessionsOnSelectedDate.length;
  const agendaTitle = selectedDate
    ? calendarMode === 'month'
      ? `${formatAgendaTitle(selectedDate)} · ${agendaCount} session${agendaCount === 1 ? '' : 's'}`
      : formatAgendaTitle(selectedDate)
    : 'Pick a day';

  const headerPad = embedded ? 0 : shellTopPad;

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: embedded ? 'transparent' : colors.nbBackground,
          paddingTop: headerPad,
        },
      ]}
    >
      {/* Title row + add — Design Law PNG header */}
      {!embedded ? (
        <View style={styles.headerRow}>
          <Text style={[styles.screenTitle, { color: colors.nbInk }]} numberOfLines={1}>
            Trainer scheduling
          </Text>
          <NavSquare
            colors={colors}
            onPress={() => onNavigate?.(newSessionPath(selectedDate))}
          >
            <Plus size={22} color={colors.nbInk} strokeWidth={3} />
          </NavSquare>
        </View>
      ) : null}

      <View style={[styles.switcherWrap, embedded && styles.switcherEmbedded]}>
        <NbSegmented segments={VIEW_SEGMENTS} selected={tab} onSelect={setTab} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
        {...FORM_SCROLL_PROPS}
      >
        {tab === 'calendar' ? (
          <View style={styles.section}>
            {/* Week mode owns the month chevrons; month mode uses MonthCalendar's header (PNG 05) */}
            {calendarMode === 'week' ? (
              <>
                <View style={styles.monthNav}>
                  <NavSquare
                    colors={colors}
                    onPress={() => setWeekAnchor((d) => subWeeks(d, 1))}
                  >
                    <ChevronLeft size={18} color={colors.nbInk} />
                  </NavSquare>
                  <Text style={[styles.monthTitle, { color: colors.nbInk }]}>
                    {monthTitle}
                  </Text>
                  <NavSquare
                    colors={colors}
                    onPress={() => setWeekAnchor((d) => addWeeks(d, 1))}
                  >
                    <ChevronRight size={18} color={colors.nbInk} />
                  </NavSquare>
                </View>
                <WeekDateStrip
                  weekDates={weekDates}
                  selectedDateKey={selectedDate}
                  sessionDays={sessionDays}
                  onSelectDate={setSelectedDate}
                  colors={colors}
                />
              </>
            ) : (
              <MonthCalendar
                key={`${weekAnchor.getFullYear()}-${weekAnchor.getMonth()}`}
                sessions={sessionsForClient}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onMonthChange={(cursor) => setWeekAnchor(cursor)}
                borderless
              />
            )}

            {/* Agenda header + Month view / Week view toggle chip */}
            <View style={styles.agendaHeader}>
              <Text style={[styles.agendaTitle, { color: colors.nbInk }]} numberOfLines={1}>
                {agendaTitle}
              </Text>
              <NbChip
                selected={false}
                variant="outline"
                onPress={() =>
                  setCalendarMode((m) => (m === 'week' ? 'month' : 'week'))
                }
                contentStyle={styles.monthViewChip}
              >
                {calendarMode === 'week' ? 'Month view' : 'Week view'}
              </NbChip>
            </View>

            {sessionsOnSelectedDate.length === 0 ? (
              <EmptyState
                title="Schedule your first session."
                subtitle={
                  clientId
                    ? `Tap a day to see ${clientLabel}'s sessions. Add one and they get an invite.`
                    : 'Tap a day on the calendar to see sessions. Add one and your client gets an invite.'
                }
                cta="New session"
                onCta={() => onNavigate?.(newSessionPath(selectedDate))}
              />
            ) : (
              <View style={styles.cardStack}>
                {sessionsOnSelectedDate.map((session) => (
                  <TouchableOpacity
                    key={session.id}
                    onPress={() => goToSession(session.id)}
                    activeOpacity={0.88}
                  >
                    <SessionCard session={session} showDate={false} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {tab === 'list' ? (
          <View style={styles.section}>
            {groupedUpcoming.length === 0 ? (
              <EmptyState
                title="No upcoming sessions."
                subtitle="Sessions you schedule show up here in date order."
                cta="New session"
                onCta={() => onNavigate?.(newSessionPath(null))}
              />
            ) : (
              groupedUpcoming.map(([dateKey, daySessions]) => (
                <View key={dateKey} style={styles.listGroup}>
                  <Text style={[styles.listDayHeader, { color: colors.nbInk }]}>
                    {formatDayHeader(dateKey, todayKey)}
                  </Text>
                  <View style={styles.cardStack}>
                    {daySessions.map((session) => (
                      <TouchableOpacity
                        key={session.id}
                        onPress={() => goToSession(session.id)}
                        activeOpacity={0.88}
                      >
                        <SessionCard session={session} showDate={false} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {/* Embedded client detail still needs an obvious create CTA */}
        {embedded ? (
          <NbButton
            variant="ghost"
            onPress={() => onNavigate?.(newSessionPath(selectedDate))}
          >
            New session
          </NbButton>
        ) : null}
      </ScrollView>
    </View>
  );
};

export default BookSessionScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: 12,
  },
  screenTitle: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    letterSpacing: -0.4,
  },
  navSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcherWrap: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  switcherEmbedded: {
    paddingHorizontal: 0,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  section: { gap: spacing.md },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  weekStrip: {
    flexDirection: 'row',
    gap: 6,
  },
  weekChip: { flex: 1, minWidth: 0 },
  weekChipInner: {
    minHeight: 68,
    paddingVertical: 8,
    paddingHorizontal: 4,
    width: '100%',
  },
  weekChipContent: { alignItems: 'center', gap: 2 },
  weekDay: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  weekDate: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  },
  dotFilled: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  dotHollow: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1.5,
    marginTop: 4,
  },
  agendaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  agendaTitle: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  monthViewChip: {
    minHeight: 32,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cardStack: { gap: 12 },
  listGroup: { gap: 10, marginBottom: 8 },
  listDayHeader: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  emptyState: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyBtn: { marginTop: 6, alignSelf: 'stretch' },
});
