/**
 * Trainer Sessions tab — calendar home + inline form routing.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { format } from 'date-fns';
import { CalendarDays, List as ListIcon, Check, ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../shared-ui/ThemeContext';
import { useSessions } from '../hooks/useMyTrainingSessions';
import { MonthCalendar } from '../components/sessions/MonthCalendar';
import { formatTime12 } from '../../lib/sessions';
import ScheduleTrainingSessionScreen from '../screens/ScheduleTrainingSessionScreen';
import {
  ACCENT_GRADIENT,
  DARK_PINK,
  getSessionSchedulingColors,
  SESSION_GRADIENT,
} from '../sessions/sessionSchedulingTheme';

function parseQuery(path) {
  const s = String(path || '');
  const [, qs] = s.split('?');
  const params = {};
  if (qs) {
    for (const part of qs.split('&')) {
      const [k, v] = part.split('=');
      if (!k) continue;
      params[decodeURIComponent(k)] = v != null ? decodeURIComponent(v) : '';
    }
  }
  return params;
}

function formatDurationMin(min) {
  const n = Number(min) || 60;
  if (n < 60) return `${n}m`;
  if (n % 60 === 0) return `${n / 60}h`;
  return `${Math.floor(n / 60)}h ${n % 60}m`;
}

function SessionStrip({ session, colors, onPress }) {
  const status = String(session?.status || 'pending');
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[styles.sessionStrip, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
    >
      <Text style={[styles.sessionStripTime, { color: colors.text }]}>
        {formatTime12(session?.time) || '—'} – {formatDurationMin(session?.durationMin || session?.duration)}
      </Text>
      <Text style={[styles.sessionStripStatus, { color: colors.muted }]}>Status: {statusLabel}</Text>
    </TouchableOpacity>
  );
}

const CalendarTab = ({ clientId, clientName }) => {
  const { isDark } = useTheme();
  const colors = getSessionSchedulingColors(isDark);
  const theme = isDark ? 'dark' : 'light';
  const { sessions } = useSessions();
  const [route, setRoute] = useState('/');
  const [tab, setTab] = useState('calendar');
  const [selectedDate, setSelectedDate] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());

  const clientLabel = clientName || 'Client';
  const onNavigate = (path) => setRoute(path || '/');

  const sessionsForClient = useMemo(() => {
    if (!clientId) return [];
    const cid = String(clientId);
    return (sessions || []).filter((s) => s?.clientId != null && String(s.clientId) === cid);
  }, [sessions, clientId]);

  const todayKey = new Date().toISOString().slice(0, 10);

  const upcoming = useMemo(
    () =>
      [...sessionsForClient]
        .filter((s) => (s.date || '') >= todayKey)
        .sort((a, b) => (String(a.date) + String(a.time)).localeCompare(String(b.date) + String(b.time)))
        .slice(0, 8),
    [sessionsForClient, todayKey],
  );

  const dayList = selectedDate
    ? sessionsForClient
        .filter((s) => s.date === selectedDate)
        .sort((a, b) => String(a.time).localeCompare(String(b.time)))
    : [];

  const monthLabel = format(calendarMonth, 'MMM yyyy');
  const daySectionTitle = selectedDate
    ? `${format(new Date(`${selectedDate}T12:00:00`), 'MMM d')} Sessions:`
    : null;

  const newSessionPath = (dateKey) => {
    if (!dateKey) return '/sessions/new';
    return `/sessions/new?date=${encodeURIComponent(dateKey)}`;
  };

  const routeStr = typeof route === 'string' ? route : '/';
  const isNewSession = routeStr.startsWith('/sessions/new');
  const isEditSession = routeStr.startsWith('/sessions/') && !isNewSession;

  if (isNewSession) {
    const params = parseQuery(routeStr);
    return (
      <ScheduleTrainingSessionScreen
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
      <ScheduleTrainingSessionScreen
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
      <Text style={[styles.title, { color: colors.text }]}>Sessions with {clientLabel}</Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>{monthLabel}</Text>

      <View style={[styles.segmented, { borderColor: colors.divider, backgroundColor: colors.cardBg }]}>
        <SegBtn
          active={tab === 'calendar'}
          onPress={() => setTab('calendar')}
          icon={<CalendarDays size={14} color={tab === 'calendar' ? '#FFFFFF' : colors.muted} />}
          label="Calendar"
          colors={colors}
        />
        <SegBtn
          active={tab === 'list'}
          onPress={() => setTab('list')}
          icon={<ListIcon size={14} color={tab === 'list' ? '#FFFFFF' : colors.muted} />}
          label="List"
          colors={colors}
        />
      </View>

      {tab === 'calendar' ? (
        <View style={styles.section}>
          <View style={[styles.calendarCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <MonthCalendar
              sessions={sessionsForClient}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onMonthChange={setCalendarMonth}
              theme={theme}
              borderless
              accentColor={DARK_PINK}
              cardBg={colors.cardBg}
            />
          </View>

          {daySectionTitle ? (
            <View style={styles.daySection}>
              <View style={styles.dayHeader}>
                <Text style={[styles.dayTitle, { color: colors.text }]}>{daySectionTitle}</Text>
                <TouchableOpacity onPress={() => setSelectedDate(null)}>
                  <Text style={[styles.clearLink, { color: DARK_PINK }]}>Clear</Text>
                </TouchableOpacity>
              </View>
              {dayList.length === 0 ? (
                <Text style={[styles.emptyCopy, { color: colors.muted }]}>
                  No sessions on this day.
                </Text>
              ) : (
                <View style={styles.stripList}>
                  {dayList.map((s) => (
                    <SessionStrip
                      key={s.id}
                      session={s}
                      colors={colors}
                      onPress={() => onNavigate(`/sessions/${s.id}`)}
                    />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <Text style={[styles.hint, { color: colors.muted }]}>
              Tap a day to see sessions for that date.
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={[styles.dayTitle, { color: colors.text }]}>Upcoming · {clientLabel}</Text>
          {upcoming.length === 0 ? (
            <Text style={[styles.emptyCopy, { color: colors.muted }]}>No upcoming sessions.</Text>
          ) : (
            <View style={styles.stripList}>
              {upcoming.map((s) => (
                <SessionStrip
                  key={s.id}
                  session={s}
                  colors={colors}
                  onPress={() => onNavigate(`/sessions/${s.id}`)}
                />
              ))}
            </View>
          )}
        </View>
      )}

      <TouchableOpacity
        onPress={() => onNavigate(newSessionPath(selectedDate))}
        activeOpacity={0.9}
        style={styles.newBtnWrap}
      >
        <LinearGradient
          colors={ACCENT_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.newBtn}
        >
          <Check color="#FFFFFF" size={18} />
          <Text style={styles.newBtnText}>+ New Session</Text>
          <ArrowRight color="#FFFFFF" size={18} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

function SegBtn({ active, onPress, icon, label, colors }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.segBtn, active && { backgroundColor: SESSION_GRADIENT[0] }]}
    >
      {icon}
      <Text style={[styles.segBtnText, { color: active ? '#FFFFFF' : colors.muted }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default CalendarTab;

const styles = StyleSheet.create({
  home: {
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: -8,
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
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
    borderRadius: 10,
  },
  segBtnText: { fontSize: 13, fontWeight: '700' },
  section: { gap: 16 },
  calendarCard: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 12,
    overflow: 'hidden',
  },
  daySection: { gap: 10 },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayTitle: { fontSize: 15, fontWeight: '700' },
  clearLink: { fontSize: 13, fontWeight: '700' },
  hint: { fontSize: 14, lineHeight: 20 },
  emptyCopy: { fontSize: 14, lineHeight: 20 },
  stripList: { gap: 10 },
  sessionStrip: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  sessionStripTime: { fontSize: 15, fontWeight: '700' },
  sessionStripStatus: { fontSize: 13, fontWeight: '500' },
  newBtnWrap: { borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  newBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
