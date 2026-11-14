// Design Law Sessions tab on a client record — calendar/list home + new/edit form.
// Flow: fake string route → BookSessionScreen (home) or ScheduleSessionScreen (new/edit).
// Used by: trainer client dashboard (TrainerHomeContent / ManageTraineeScreen).
// Read order: constants → path helpers → exported tab → PLUMBING styles.
//
// vocab: BookSessionScreen is the gold scheduling calendar — this tab only routes into it
// Do not edit BookSessionScreen from this file’s rewrite pass.

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import BookSessionScreen from './BookSessionScreen';
import ScheduleSessionScreen from './ScheduleSessionScreen';

// ===== NAMED CONSTANTS =====

const HOME_ROUTE = '/';
const NEW_SESSION_ROUTE = '/sessions/new';
const SESSIONS_ROUTE_PREFIX = '/sessions/';

// ===== HELPER FUNCTIONS =====

/**
 * Fake in-app paths carry ?date=… query strings — pull them into a plain object.
 * @param {string} pathText
 * @returns {Record<string, string>}
 */
function readQueryParamsFromPath(pathText) {
  const safePath = String(pathText || '');
  const queryString = safePath.split('?')[1];
  const queryParams = {};

  if (!queryString) {
    return queryParams;
  }

  const queryParts = queryString.split('&');
  for (let partIndex = 0; partIndex < queryParts.length; partIndex += 1) {
    const part = queryParts[partIndex];
    const equalsSplit = part.split('=');
    const rawKey = equalsSplit[0];
    const rawValue = equalsSplit[1];

    if (!rawKey) {
      continue;
    }

    // vocab: decodeURIComponent = turn %20-style escapes back into readable text
    const decodedKey = decodeURIComponent(rawKey);
    let decodedValue = '';
    if (rawValue != null) {
      decodedValue = decodeURIComponent(rawValue);
    }
    queryParams[decodedKey] = decodedValue;
  }

  return queryParams;
}

/**
 * Pull the session id from an embedded edit route like /sessions/<id>.
 * @param {string} routeText
 * @returns {string}
 */
function sessionIdFromEditRoute(routeText) {
  // vocab: embedded routes look like /sessions/<id> with no query
  return routeText.split('/')[2];
}

/**
 * Decide which child screen owns the tab body from the fake route string.
 * @param {string} routeText
 * @returns {'new' | 'edit' | 'home'}
 */
function whichSessionScreenOwnsRoute(routeText) {
  const isNewSessionRoute = routeText.startsWith(NEW_SESSION_ROUTE);
  if (isNewSessionRoute) {
    return 'new';
  }

  const looksLikeSessionPath = routeText.startsWith(SESSIONS_ROUTE_PREFIX);
  if (looksLikeSessionPath) {
    return 'edit';
  }

  return 'home';
}

/**
 * New-session form — optional ?date= prefill from the calendar day tap.
 */
function NewSessionFormScreen({ routeText, clientId, clientName, goToRoute }) {
  const queryParams = readQueryParamsFromPath(routeText);
  return (
    <ScheduleSessionScreen
      embedded
      onNavigate={goToRoute}
      initialDate={queryParams.date}
      clientId={clientId}
      clientName={clientName}
    />
  );
}

/**
 * Edit-session form — session id lives in the path segment after /sessions/.
 */
function EditSessionFormScreen({ routeText, clientId, clientName, goToRoute }) {
  const sessionId = sessionIdFromEditRoute(routeText);
  return (
    <ScheduleSessionScreen
      embedded
      sessionId={sessionId}
      clientId={clientId}
      clientName={clientName}
      onNavigate={goToRoute}
    />
  );
}

/**
 * Home: Design Law calendar / list (BookSessionScreen). Untouched in this rewrite.
 */
function SessionsHomeScreen({ clientId, clientName, goToRoute, onMessageClient }) {
  return (
    <View style={styles.root}>
      <BookSessionScreen
        embedded
        clientId={clientId}
        clientName={clientName}
        onNavigate={goToRoute}
        onMessageClient={onMessageClient}
      />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Embedded Sessions tab — tiny string “router” instead of a full navigation stack.
 * @param {{ clientId: string, clientName: string, onMessageClient?: Function }} props
 */
const CalendarTab = ({ clientId, clientName, onMessageClient }) => {
  // 1. Keep a tiny string “route” instead of a full navigation stack (embedded tab).
  // vocab: useState = React hook that holds the active fake path across re-renders
  const [activeRoute, setActiveRoute] = useState(HOME_ROUTE);

  const goToRoute = (nextPath) => {
    let safePath = HOME_ROUTE;
    if (nextPath) {
      safePath = nextPath;
    }
    setActiveRoute(safePath);
  };

  // 2. Normalize the route to a string and decide which child owns the body.
  let routeText = HOME_ROUTE;
  if (typeof activeRoute === 'string') {
    routeText = activeRoute;
  }
  const screenOwner = whichSessionScreenOwnsRoute(routeText);

  // 3. New session form (create).
  if (screenOwner === 'new') {
    return (
      <NewSessionFormScreen
        routeText={routeText}
        clientId={clientId}
        clientName={clientName}
        goToRoute={goToRoute}
      />
    );
  }

  // 4. Edit session form (existing id in the path).
  if (screenOwner === 'edit') {
    return (
      <EditSessionFormScreen
        routeText={routeText}
        clientId={clientId}
        clientName={clientName}
        goToRoute={goToRoute}
      />
    );
  }

  // 5. Default home — BookSessionScreen calendar / list.
  return (
    <SessionsHomeScreen
      clientId={clientId}
      clientName={clientName}
      goToRoute={goToRoute}
      onMessageClient={onMessageClient}
    />
  );
};

export default CalendarTab;

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  root: { flex: 1 },
});
