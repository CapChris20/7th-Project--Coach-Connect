// Design Law Sessions tab (trainer-home mockup ct:s): upcoming agenda + Schedule CTA.
// Flow: filter sessions for this client → list next few → open schedule form in-tab.
// Used on the trainer client dashboard. ScheduleSessionScreen stays for create/edit.
//
// vocab: agenda = short upcoming list (not a full month grid)

import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { format, parseISO, isValid } from 'date-fns';
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import NbIconChip from '../../look-and-feel/NbIconChip';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { useSessions } from '../scheduling/mySessions';
import { formatTime12 } from '../../helpers/sessionTimeText';
import ScheduleSessionScreen from '../scheduling/ScheduleSessionScreen';

// ===== NAMED CONSTANTS =====

const ICON_SCHEDULE = require('../../assets/icons/handoff/schedule.png');
const CLIENT_NAME_DEFAULT = 'Client';
const MINUTES_PER_HOUR = 60;
const UPCOMING_SESSION_LIMIT = 6;
const ISO_DATE_LENGTH = 10;
const HOME_ROUTE = '/';
const NEW_SESSION_ROUTE = '/sessions/new';
const SESSIONS_ROUTE_PREFIX = '/sessions/';

// ===== HELPERS =====

function parseQuery(path) {
  const pathText = String(path || '');
  const queryString = pathText.split('?')[1];
  const params = {};
  if (!queryString) return params;
  for (const part of queryString.split('&')) {
    const [rawKey, rawValue] = part.split('=');
    if (!rawKey) continue;
    params[decodeURIComponent(rawKey)] = rawValue != null ? decodeURIComponent(rawValue) : '';
  }
  return params;
}

function formatDurationMin(durationMin) {
  const minutes = Number(durationMin) || MINUTES_PER_HOUR;
  if (minutes < MINUTES_PER_HOUR) return `${minutes}m`;
  if (minutes % MINUTES_PER_HOUR === 0) return `${minutes / MINUTES_PER_HOUR}h`;
  return `${Math.floor(minutes / MINUTES_PER_HOUR)}h ${minutes % MINUTES_PER_HOUR}m`;
}

function sessionSortKey(session) {
  return `${String(session.date || '')}${String(session.time || '')}`;
}

function formatSessionDayLabel(dateKey, todayKey) {
  if (!dateKey) return 'Session';
  if (dateKey === todayKey) return 'Today';
  try {
    const parsed = parseISO(dateKey);
    if (isValid(parsed)) return format(parsed, 'EEE');
  } catch (_err) {
    // fall through
  }
  return dateKey;
}

function AgendaRow({
  session,
  todayKey,
  isDark,
  isFirst,
  isLast,
  onPress,
}) {
  const ink = isDark ? darkColors.nbInk : lightColors.nbInk;
  const muted = isDark ? darkColors.nbMuted : lightColors.nbMuted;
  const dayLabel = formatSessionDayLabel(session?.date, todayKey);
  const timeLabel = formatTime12(session?.time) || '—';
  const title = `${dayLabel} · ${timeLabel}`;
  const subtitle = [
    session?.title || session?.focus || session?.type || 'Training',
    formatDurationMin(session?.durationMin || session?.duration),
  ].join(' · ');
  const isUpNext = isFirst && session?.date === todayKey;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[
        styles.row,
        !isLast
          ? {
              borderBottomWidth: 2,
              borderBottomColor: isDark ? darkColors.nbBorder : lightColors.nbBorder,
            }
          : null,
      ]}
    >
      <NbIconChip source={ICON_SCHEDULE} index={isFirst ? 7 : 10} size={40} />
      <View style={styles.grow}>
        <Text style={[styles.rowTitle, { color: ink }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.rowSub, { color: muted }]} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      {isUpNext ? (
        <View
          style={[
            styles.pill,
            {
              borderColor: isDark ? darkColors.nbBorder : lightColors.nbBorder,
              backgroundColor: accentPillBg(isDark),
            },
          ]}
        >
          <Text style={styles.pillText} numberOfLines={1}>
            Up next
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function accentPillBg(isDark) {
  // Small accent only — Design Law “Up next” pill uses a soft tint, not purple chrome.
  return isDark ? 'rgba(253, 224, 71, 0.22)' : 'rgba(253, 224, 71, 0.55)';
}

// ===== MAIN =====

const CalendarTab = ({ clientId, clientName }) => {
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;
  const { sessions } = useSessions();
  const [route, setRoute] = useState(HOME_ROUTE);

  const clientLabel = clientName || CLIENT_NAME_DEFAULT;
  const onNavigate = (path) => setRoute(path || HOME_ROUTE);

  const sessionsForClient = useMemo(() => {
    const allSessions = sessions || [];
    if (!clientId) return allSessions;
    const clientIdText = String(clientId);
    return allSessions.filter(
      (session) => session?.clientId != null && String(session.clientId) === clientIdText,
    );
  }, [sessions, clientId]);

  const todayKey = new Date().toISOString().slice(0, ISO_DATE_LENGTH);

  const upcoming = useMemo(
    () =>
      [...sessionsForClient]
        .filter((session) => (session.date || '') >= todayKey)
        .sort((a, b) => sessionSortKey(a).localeCompare(sessionSortKey(b)))
        .slice(0, UPCOMING_SESSION_LIMIT),
    [sessionsForClient, todayKey],
  );

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
    <View style={styles.root}>
      <NbCard style={styles.listCard}>
        {upcoming.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>No sessions yet</Text>
            <Text style={[styles.emptyBody, { color: colors.nbMuted }]}>
              Schedule something with {clientLabel} so it shows up here.
            </Text>
          </View>
        ) : (
          upcoming.map((session, index) => (
            <AgendaRow
              key={session.id || `${session.date}-${session.time}-${index}`}
              session={session}
              todayKey={todayKey}
              isDark={isDark}
              isFirst={index === 0}
              isLast={index === upcoming.length - 1}
              onPress={() => onNavigate(`/sessions/${session.id}`)}
            />
          ))
        )}
      </NbCard>

      <NbButton variant="ghost" onPress={() => onNavigate(NEW_SESSION_ROUTE)}>
        Schedule a session
      </NbButton>
    </View>
  );
};

export default CalendarTab;

const styles = StyleSheet.create({
  root: {
    gap: 16,
    paddingTop: 4,
  },
  listCard: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  rowSub: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 17,
  },
  pill: {
    borderWidth: 2.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0A0A',
  },
  emptyWrap: {
    paddingVertical: 18,
    paddingHorizontal: 4,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  emptyBody: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
