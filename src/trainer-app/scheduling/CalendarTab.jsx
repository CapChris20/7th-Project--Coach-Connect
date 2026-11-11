// Trainer Sessions tab: month calendar, upcoming list, and the new/edit session form.
// Flow: pick calendar or list → tap a day or a strip → open the schedule screen in this tab.
// Used on the trainer's client profile.
//
// vocab: neobrutalist = thick outlines (2.5px), hard shadows, nb tokens for colors

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { format } from 'date-fns';
import { CalendarDays, List as ListIcon, Check, ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { lightColors, darkColors, gradients, nb, borderRadius } from '../../look-and-feel/colorPalette';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import { useSessions } from '../scheduling/mySessions';
import { MonthCalendar } from './MonthCalendar';
import { formatTime12 } from '../../helpers/sessionTimeText';
import ScheduleSessionScreen from '../scheduling/ScheduleSessionScreen';

// ===== NAMED CONSTANTS =====

const REQUEST_STATUS_PENDING = 'pending';
const CLIENT_NAME_DEFAULT = 'Client';
const MINUTES_PER_HOUR = 60;
const UPCOMING_SESSION_LIMIT = 8;
const ISO_DATE_LENGTH = 10;
const NOON_ON_DAY_SUFFIX = 'T12:00:00';
const HOME_ROUTE = '/';
const NEW_SESSION_ROUTE = '/sessions/new';
const SESSIONS_ROUTE_PREFIX = '/sessions/';
const TAB_CALENDAR = 'calendar';
const TAB_LIST = 'list';
const WHITE = '#FFFFFF';

// ===== HELPER FUNCTIONS =====

/**
 * Tiny query-string reader for paths like /sessions/new?date=2026-10-08.
 * @param {string} path
 * @returns {object}
 */
function parseQuery(path) {
  const pathText = String(path || '');
  const queryString = pathText.split('?')[1];
  const params = {};
  if (!queryString) return params;
  for (const part of queryString.split('&')) {
    assignQueryPart(params, part);
  }
  return params;
}

/**
 * @param {object} params
 * @param {string} part
 */
function assignQueryPart(params, part) {
  const [rawKey, rawValue] = part.split('=');
  if (!rawKey) return;
  params[decodeURIComponent(rawKey)] = rawValue != null ? decodeURIComponent(rawValue) : '';
}

/**
 * 45 → "45m", 60 → "1h", 90 → "1h 30m". Missing duration counts as one hour.
 * @param {number} durationMin
 * @returns {string}
 */
function formatDurationMin(durationMin) {
  const minutes = Number(durationMin) || MINUTES_PER_HOUR;
  if (minutes < MINUTES_PER_HOUR) return `${minutes}m`;
  if (minutes % MINUTES_PER_HOUR === 0) return `${minutes / MINUTES_PER_HOUR}h`;
  return `${Math.floor(minutes / MINUTES_PER_HOUR)}h ${minutes % MINUTES_PER_HOUR}m`;
}

/**
 * @param {string} dateKey
 * @returns {string}
 */
function newSessionPath(dateKey) {
  if (!dateKey) return NEW_SESSION_ROUTE;
  return `${NEW_SESSION_ROUTE}?date=${encodeURIComponent(dateKey)}`;
}

/**
 * @param {object} session
 * @returns {string}
 */
function sessionSortKey(session) {
  return String(session.date) + String(session.time);
}

function SessionStrip({ session, colors, onPress }) {
  const status = String(session?.status || REQUEST_STATUS_PENDING);
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
      <NbCard style={styles.sessionStrip}>
        <Text style={[styles.sessionStripTime, { color: colors.nbInk }]}>
          {formatTime12(session?.time) || '—'} – {formatDurationMin(session?.durationMin || session?.duration)}
        </Text>
        <Text style={[styles.sessionStripStatus, { color: colors.nbMuted }]}>Status: {statusLabel}</Text>
      </NbCard>
    </TouchableOpacity>
  );
}

function SegBtn({ active, onPress, icon, label, colors }) {
  const buttonContent = (
    <View style={styles.segBtn}>
      {icon}
      <Text style={[styles.segBtnText, { color: active ? '#0A0A0F' : colors.nbMuted }]}>{label}</Text>
    </View>
  );

  if (active) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
        <LinearGradient
          colors={gradients.brand.colors}
          start={gradients.brand.start}
          end={gradients.brand.end}
          style={styles.segBtnGradient}
        >
          {buttonContent}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      {buttonContent}
    </TouchableOpacity>
  );
}

function SessionStripList({ sessions, colors, onNavigate }) {
  return (
    <View style={styles.stripList}>
      {sessions.map((session) => (
        <SessionStrip
          key={session.id}
          session={session}
          colors={colors}
          onPress={() => onNavigate(`/sessions/${session.id}`)}
        />
      ))}
    </View>
  );
}

function DaySessionsSection({ daySectionTitle, dayList, colors, onClearDate, onNavigate }) {
  return (
    <View style={styles.daySection}>
      <View style={styles.dayHeader}>
        <Text style={[styles.dayTitle, { color: colors.nbInk }]}>{daySectionTitle}</Text>
        <TouchableOpacity onPress={onClearDate}>
          <Text style={[styles.clearLink, { color: gradients.brand.colors[0] }]}>Clear</Text>
        </TouchableOpacity>
      </View>
      {dayList.length === 0 ? (
        <Text style={[styles.emptyCopy, { color: colors.nbMuted }]}>
          No sessions on this day.
        </Text>
      ) : (
        <SessionStripList sessions={dayList} colors={colors} onNavigate={onNavigate} />
      )}
    </View>
  );
}

function CalendarSection({
  sessionsForClient,
  selectedDate,
  setSelectedDate,
  setCalendarMonth,
  theme,
  colors,
  daySectionTitle,
  dayList,
  onNavigate,
}) {
  return (
    <View style={styles.section}>
      <NbCard style={styles.calendarCard}>
        <MonthCalendar
          sessions={sessionsForClient}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onMonthChange={setCalendarMonth}
          theme={theme}
          borderless
        />
      </NbCard>
      {daySectionTitle ? (
        <DaySessionsSection
          daySectionTitle={daySectionTitle}
          dayList={dayList}
          colors={colors}
          onClearDate={() => setSelectedDate(null)}
          onNavigate={onNavigate}
        />
      ) : (
        <Text style={[styles.hint, { color: colors.nbMuted }]}>
          Tap a day to see sessions for that date.
        </Text>
      )}
    </View>
  );
}

function UpcomingListSection({ upcoming, clientLabel, colors, onNavigate }) {
  return (
    <View style={styles.section}>
      <Text style={[styles.dayTitle, { color: colors.nbInk }]}>Upcoming · {clientLabel}</Text>
      {upcoming.length === 0 ? (
        <Text style={[styles.emptyCopy, { color: colors.nbMuted }]}>No upcoming sessions.</Text>
      ) : (
        <SessionStripList sessions={upcoming} colors={colors} onNavigate={onNavigate} />
      )}
    </View>
  );
}

// ===== MAIN FUNCTION =====

const CalendarTab = ({ clientId, clientName }) => {
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;
  const theme = isDark ? 'dark' : 'light';
  const { sessions } = useSessions();
  const [route, setRoute] = useState(HOME_ROUTE);
  const [tab, setTab] = useState(TAB_CALENDAR);
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const clientLabel = clientName || CLIENT_NAME_DEFAULT;
  const onNavigate = (path) => setRoute(path || HOME_ROUTE);

  // No clientId → show every session (trainer Sessions tab). With clientId → filter to that trainee.
  const sessionsForClient = useMemo(() => {
    const allSessions = sessions || [];
    if (!clientId) return allSessions;
    const clientIdText = String(clientId);
    return allSessions.filter((session) => session?.clientId != null && String(session.clientId) === clientIdText);
  }, [sessions, clientId]);

  const todayKey = new Date().toISOString().slice(0, ISO_DATE_LENGTH);

  const upcoming = useMemo(
    () =>
      [...sessionsForClient]
        .filter((session) => (session.date || '') >= todayKey)
        .sort((leftSession, rightSession) => sessionSortKey(leftSession).localeCompare(sessionSortKey(rightSession)))
        .slice(0, UPCOMING_SESSION_LIMIT),
    [sessionsForClient, todayKey],
  );

  const dayList = selectedDate
    ? sessionsForClient
        .filter((session) => session.date === selectedDate)
        .sort((leftSession, rightSession) => String(leftSession.time).localeCompare(String(rightSession.time)))
    : [];

  const monthLabel = format(calendarMonth, 'MMM yyyy');
  const daySectionTitle = selectedDate
    ? `${format(new Date(`${selectedDate}${NOON_ON_DAY_SUFFIX}`), 'MMM d')} Sessions:`
    : null;

  const routeStr = typeof route === 'string' ? route : HOME_ROUTE;
  const isNewSession = routeStr.startsWith(NEW_SESSION_ROUTE);
  const isEditSession = routeStr.startsWith(SESSIONS_ROUTE_PREFIX) && !isNewSession;

  if (isNewSession) {
    const params = parseQuery(routeStr);
    return (
      <ScheduleSessionScreen
        embedded
        onNavigate={onNavigate}
        initialDate={params.date}
        clientId={clientId}
        clientName={clientName}
      />
    );
  }

  if (isEditSession) {
    const sessionId = routeStr.split('/')[2];
    return (
      <ScheduleSessionScreen
        embedded
        sessionId={sessionId}
        clientId={clientId}
        clientName={clientName}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <View style={styles.home}>
      <Text style={[styles.title, { color: colors.nbInk }]}>Sessions with {clientLabel}</Text>
      <Text style={[styles.subtitle, { color: colors.nbMuted }]}>{monthLabel}</Text>

      <View style={[styles.segmented, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}>
        <SegBtn
          active={tab === TAB_CALENDAR}
          onPress={() => setTab(TAB_CALENDAR)}
          icon={<CalendarDays size={14} color={tab === TAB_CALENDAR ? '#0A0A0F' : colors.nbMuted} />}
          label="Calendar"
          colors={colors}
        />
        <SegBtn
          active={tab === TAB_LIST}
          onPress={() => setTab(TAB_LIST)}
          icon={<ListIcon size={14} color={tab === TAB_LIST ? '#0A0A0F' : colors.nbMuted} />}
          label="List"
          colors={colors}
        />
      </View>

      {tab === TAB_CALENDAR ? (
        <CalendarSection
          sessionsForClient={sessionsForClient}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          setCalendarMonth={setCalendarMonth}
          theme={theme}
          colors={colors}
          daySectionTitle={daySectionTitle}
          dayList={dayList}
          onNavigate={onNavigate}
        />
      ) : (
        <UpcomingListSection
          upcoming={upcoming}
          clientLabel={clientLabel}
          colors={colors}
          onNavigate={onNavigate}
        />
      )}

      <NbButton 
        variant="brand" 
        onPress={() => onNavigate(newSessionPath(selectedDate))}
        style={styles.newBtn}
      >
        + New Session
      </NbButton>
    </View>
  );
};

export default CalendarTab;

const styles = StyleSheet.create({
  home: {
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: -8,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    padding: 4,
    gap: 6,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: borderRadius.nbChip,
  },
  segBtnGradient: {
    borderRadius: borderRadius.nbChip,
    overflow: 'hidden',
  },
  segBtnText: { 
    fontSize: 13, 
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700' 
  },
  section: { gap: 16 },
  calendarCard: {
    padding: 12,
  },
  daySection: { gap: 10 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayTitle: { 
    fontSize: 15, 
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700' 
  },
  clearLink: { 
    fontSize: 13, 
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700' 
  },
  hint: { fontSize: 14, lineHeight: 20 },
  emptyCopy: { fontSize: 14, lineHeight: 20 },
  stripList: { gap: 10 },
  sessionStrip: {
    padding: 14,
    gap: 4,
  },
  sessionStripTime: { 
    fontSize: 15, 
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700' 
  },
  sessionStripStatus: { fontSize: 13, fontWeight: '500' },
  newBtn: {
    marginTop: 4,
  },
});
