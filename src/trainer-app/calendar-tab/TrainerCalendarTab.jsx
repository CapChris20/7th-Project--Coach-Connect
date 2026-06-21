/**
 * Trainer Calendar Tab
 *
 * Purpose: UI screen or component: Trainer Calendar Tab. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: (see file)
 *
 * @file-header
 */
/** Trainer dashboard — Calendar tab */
import React, { useState } from 'react';
import ScheduleTrainingSessionScreen from '../screens/ScheduleTrainingSessionScreen';
import BookTraineeSessionScreen from '../screens/BookTraineeSessionScreen';

const CalendarTab = ({ isDark, clientData, trainerId, clientId, clientName, trainerName }) => {
  const theme = isDark ? 'dark' : 'light';
  const [route, setRoute] = useState('/');

  const parseQuery = (path) => {
    const s = String(path || '');
    const [base, qs] = s.split('?');
    const params = {};
    if (qs) {
      for (const part of qs.split('&')) {
        const [k, v] = part.split('=');
        if (!k) continue;
        params[decodeURIComponent(k)] = v != null ? decodeURIComponent(v) : '';
      }
    }
    return { base, params };
  };

  const onNavigate = (path) => setRoute(path || '/');

  if (typeof route === 'string' && route.startsWith('/sessions/new')) {
    const { params } = parseQuery(route);
    return (
      <ScheduleTrainingSessionScreen
        theme={theme}
        onNavigate={onNavigate}
        initialDate={params.date}
        initialClientId={clientId}
        trainerName={trainerName}
      />
    );
  }

  if (typeof route === 'string' && route.startsWith('/sessions/')) {
    const sessionId = route.split('/')[2];
    return <ScheduleTrainingSessionScreen sessionId={sessionId} theme={theme} onNavigate={onNavigate} />;
  }

  return (
    <BookTraineeSessionScreen
      embedded
      theme={theme}
      onNavigate={onNavigate}
      clientId={clientId}
      clientName={clientName}
    />
  );
};

export default CalendarTab;
