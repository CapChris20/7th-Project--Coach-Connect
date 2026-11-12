// Design Law Sessions tab on a client record — BookSessionScreen calendar/list + new/edit form.
// Flow: BookSessionScreen (week/month/list) → navigate to ScheduleSessionScreen for create/edit.
// Used on the trainer client dashboard (TrainerHomeContent / ManageTraineeScreen).
//
// vocab: BookSessionScreen was restyled but unused — this tab is the live mount point

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import BookSessionScreen from './BookSessionScreen';
import ScheduleSessionScreen from './ScheduleSessionScreen';

// ===== NAMED CONSTANTS =====

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

// ===== MAIN =====

const CalendarTab = ({ clientId, clientName }) => {
  const [route, setRoute] = useState(HOME_ROUTE);
  const onNavigate = (path) => setRoute(path || HOME_ROUTE);

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
      <BookSessionScreen
        embedded
        clientId={clientId}
        clientName={clientName}
        onNavigate={onNavigate}
      />
    </View>
  );
};

export default CalendarTab;

const styles = StyleSheet.create({
  root: { flex: 1 },
});
