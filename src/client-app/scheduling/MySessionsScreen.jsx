// Client “My sessions” list — upcoming invites and confirmed times.
// Flow: listen under trainer_clients/{trainer}/sessions → keep today-or-later → group by day → Decline/Confirm.
// Used as a stack screen from home (Up next / Request CTA).

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  limit,
} from 'firebase/firestore';
import { format, isValid, parseISO } from 'date-fns';
import { db } from '../../app-start/cloudConnection';
import { SessionCard } from '../../trainer-app/scheduling/SessionCard';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import NbButton from '../../look-and-feel/NbButton';
import NbCard from '../../look-and-feel/NbCard';
import NbIconChip from '../../look-and-feel/NbIconChip';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { FORM_SCROLL_PROPS, useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import { spacing } from '../../look-and-feel/colorPalette';
import { getLocalDateKey } from '../../helpers/getLocalDay';

// ===== NAMED CONSTANTS =====

const ICON_SCHEDULE = require('../../assets/icons/handoff/schedule.png');
// Manipulate here: how many upcoming session docs we pull from Firestore
const UPCOMING_LIMIT = 30;
const SCROLL_BOTTOM_PAD = 48;
const STATUS_PENDING = 'pending';
const STATUS_ACCEPTED = 'accepted';
const STATUS_DECLINED = 'declined';
const DEFAULT_TRAINER_LABEL = 'Your trainer';
const DEFAULT_SESSION_FOCUS = 'Training';
const FALLBACK_COACH_WORD = 'your coach';
const TRAINER_CLIENTS_COLLECTION = 'trainer_clients';
const SESSIONS_SUBCOLLECTION = 'sessions';
const ALERT_UPDATE_FAILED_TITLE = 'Could not update';
const ALERT_UPDATE_FAILED_FALLBACK = 'Please try again.';

// ===== HELPER FUNCTIONS =====

function formatDayHeader(dateKey, todayKey) {
  if (!dateKey) return '';
  try {
    const parsedDay = parseISO(dateKey);
    if (!isValid(parsedDay)) return dateKey;
    const weekdayMonthDay = format(parsedDay, 'EEE, MMM d');
    if (dateKey === todayKey) return `Today · ${weekdayMonthDay}`;
    return weekdayMonthDay;
  } catch {
    return dateKey;
  }
}

function compareSessionTimes(first, second) {
  const firstStamp = String(first.time || '');
  const secondStamp = String(second.time || '');
  return firstStamp.localeCompare(secondStamp);
}

function compareDateThenTime(first, second) {
  const firstStamp = `${first.date}${first.time}`;
  const secondStamp = `${second.date}${second.time}`;
  return firstStamp.localeCompare(secondStamp);
}

function compareDateKeys(firstKey, secondKey) {
  return firstKey.localeCompare(secondKey);
}

function groupSessionsByDate(sessions) {
  const safeSessions = sessions || [];
  const sessionsByDate = new Map();

  for (const session of safeSessions) {
    const dateKey = String(session.date || '').slice(0, 10);
    if (!dateKey) continue;
    if (!sessionsByDate.has(dateKey)) {
      sessionsByDate.set(dateKey, []);
    }
    sessionsByDate.get(dateKey).push(session);
  }

  for (const dayList of sessionsByDate.values()) {
    dayList.sort(compareSessionTimes);
  }

  const dayEntries = [];
  for (const entry of sessionsByDate.entries()) {
    dayEntries.push(entry);
  }
  dayEntries.sort((firstEntry, secondEntry) =>
    compareDateKeys(firstEntry[0], secondEntry[0]),
  );
  return dayEntries;
}

function trainerDisplayName(trainerName) {
  const text = String(trainerName || DEFAULT_TRAINER_LABEL).trim();
  if (!text) return DEFAULT_TRAINER_LABEL;
  return text;
}

function firstWordOfName(fullName) {
  const trimmed = String(fullName || '').trim();
  if (!trimmed) return FALLBACK_COACH_WORD;
  const pieces = trimmed.split(/\s+/);
  if (!pieces[0]) return trimmed;
  return pieces[0];
}

function keepUpcomingSessions(rows, todayKey) {
  const upcoming = [];
  for (const session of rows) {
    const sessionDate = String(session.date || '');
    const isOnOrAfterToday = sessionDate >= todayKey;
    const isDeclined = session.status === STATUS_DECLINED;
    if (isOnOrAfterToday && !isDeclined) {
      upcoming.push(session);
    }
  }
  upcoming.sort(compareDateThenTime);
  return upcoming;
}

function readSessionsFromSnapshot(snapshot) {
  const rows = [];
  snapshot.forEach((sessionDoc) => {
    rows.push({ id: sessionDoc.id, ...sessionDoc.data() });
  });
  return rows;
}

function sessionFocusLabel(session) {
  if (session.title) return session.title;
  if (session.focus) return session.focus;
  if (session.type) return session.type;
  return DEFAULT_SESSION_FOCUS;
}

function isPendingInvite(session) {
  const status = session.status || STATUS_PENDING;
  return status === STATUS_PENDING;
}

function alertMessageFromError(error) {
  if (error && error.message) return error.message;
  return ALERT_UPDATE_FAILED_FALLBACK;
}

function notifyParentInviteResponded(onResponded, sessionId, status) {
  if (typeof onResponded !== 'function') return;
  onResponded({ sessionId, status });
}

function sessionsCollectionPath(trainerId) {
  return `${TRAINER_CLIENTS_COLLECTION}/${trainerId}/${SESSIONS_SUBCOLLECTION}`;
}

function oneSessionDocPath(trainerId, sessionId) {
  return `${TRAINER_CLIENTS_COLLECTION}/${trainerId}/${SESSIONS_SUBCOLLECTION}/${sessionId}`;
}

function PendingInviteActions({ sessionId, respondBusyId, onRespond }) {
  const thisCardIsBusy = respondBusyId === sessionId;

  return (
    <View style={styles.actions}>
      <View style={styles.half}>
        <NbButton
          variant="ghost"
          sm
          disabled={thisCardIsBusy}
          onPress={() => onRespond(sessionId, STATUS_DECLINED)}
        >
          Decline
        </NbButton>
      </View>
      <View style={styles.half}>
        <NbButton
          variant="fill"
          sm
          disabled={thisCardIsBusy}
          onPress={() => onRespond(sessionId, STATUS_ACCEPTED)}
        >
          Confirm
        </NbButton>
      </View>
    </View>
  );
}

function SessionsEmptyCard({ title, subtitle, requestLabel, onRequest }) {
  const { colors } = useTheme();
  const showRequestButton = typeof onRequest === 'function';

  return (
    <NbCard style={[styles.empty, { borderStyle: 'dashed' }]}>
      <NbIconChip source={ICON_SCHEDULE} index={7} size={48} />
      <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>{title}</Text>
      <Text style={[styles.emptySub, { color: colors.nbMuted }]}>{subtitle}</Text>
      {showRequestButton ? (
        <NbButton variant="fill" onPress={onRequest} style={styles.emptyBtn}>
          {requestLabel}
        </NbButton>
      ) : null}
    </NbCard>
  );
}

function buildSessionCardsForDay(daySessions, respondBusyId, onRespond) {
  const cards = [];
  for (const session of daySessions) {
    let footerActions = null;
    if (isPendingInvite(session)) {
      footerActions = (
        <PendingInviteActions
          sessionId={session.id}
          respondBusyId={respondBusyId}
          onRespond={onRespond}
        />
      );
    }
    cards.push(
      <SessionCard
        key={session.id}
        session={session}
        nameOverride={DEFAULT_TRAINER_LABEL}
        subtitleOverride={sessionFocusLabel(session)}
        footerActions={footerActions}
      />,
    );
  }
  return cards;
}

function SessionDayGroup({ dateKey, daySessions, todayKey, respondBusyId, onRespond }) {
  const { colors } = useTheme();
  const dayHeaderText = formatDayHeader(dateKey, todayKey);
  const sessionCards = buildSessionCardsForDay(daySessions, respondBusyId, onRespond);

  return (
    <View style={styles.group}>
      <Text style={[styles.dayHeader, { color: colors.nbInk }]}>{dayHeaderText}</Text>
      <View style={styles.stack}>{sessionCards}</View>
    </View>
  );
}

function buildDayGroupElements(groupedByDay, todayKey, respondBusyId, respondToInvite) {
  const dayGroups = [];
  for (const dayEntry of groupedByDay) {
    const dateKey = dayEntry[0];
    const daySessions = dayEntry[1];
    dayGroups.push(
      <SessionDayGroup
        key={dateKey}
        dateKey={dateKey}
        daySessions={daySessions}
        todayKey={todayKey}
        respondBusyId={respondBusyId}
        onRespond={respondToInvite}
      />,
    );
  }
  return dayGroups;
}

function pickSessionsListBody({
  hasNoTrainer,
  hasNoUpcoming,
  showSessionList,
  coachFirstName,
  showRequestButton,
  onRequestSession,
  groupedByDay,
  todayKey,
  respondBusyId,
  respondToInvite,
}) {
  if (hasNoTrainer) {
    return (
      <SessionsEmptyCard
        title="No trainer linked yet."
        subtitle="Connect with a coach and sessions show up here."
      />
    );
  }
  if (hasNoUpcoming) {
    return (
      <SessionsEmptyCard
        title="No upcoming sessions."
        subtitle={`Ask ${coachFirstName} for a time and it shows up here.`}
        requestLabel="Request a session"
        onRequest={showRequestButton ? onRequestSession : undefined}
      />
    );
  }
  if (!showSessionList) return null;

  return buildDayGroupElements(groupedByDay, todayKey, respondBusyId, respondToInvite);
}

function applyUpcomingFromSnapshot(snapshot, todayKey, setSessions) {
  const rows = readSessionsFromSnapshot(snapshot);
  const upcoming = keepUpcomingSessions(rows, todayKey);
  setSessions(upcoming);
}

function clearSessionsOnListenError(setSessions) {
  setSessions([]);
}

function stopListeningSafely(unsubscribe) {
  try {
    unsubscribe();
  } catch {
    // Listener already gone — ignore.
  }
}

// ===== MAIN FUNCTION =====

/**
 * Client upcoming sessions list with pending invite actions.
 * @param {{
 *   clientId: string,
 *   trainerId: string|null,
 *   trainerName?: string,
 *   onBack: Function,
 *   onRequestSession?: Function,
 *   onResponded?: Function,
 * }} props
 */
export default function MySessionsScreen({
  clientId,
  trainerId,
  trainerName,
  onBack,
  onRequestSession,
  onResponded,
}) {
  const { colors } = useTheme();
  const scrollBottomPad = useShellBottomNavInset(SCROLL_BOTTOM_PAD);
  const [sessions, setSessions] = useState([]);
  const [respondBusyId, setRespondBusyId] = useState(null);

  const todayKey = getLocalDateKey();
  const coachLabel = trainerDisplayName(trainerName);
  const coachFirstName = firstWordOfName(coachLabel);
  const subtitle = `With your trainer, ${coachLabel}`;
  const showRequestButton = typeof onRequestSession === 'function';

  // 1. Live Firestore feed for this client under the linked trainer.
  useEffect(() => {
    const missingIds = !clientId || !trainerId || !db;
    if (missingIds) {
      setSessions([]);
      return undefined;
    }

    const sessionsRef = collection(db, sessionsCollectionPath(trainerId));
    const sessionsQuery = query(
      sessionsRef,
      where('clientId', '==', clientId),
      limit(UPCOMING_LIMIT),
    );

    const unsubscribe = onSnapshot(
      sessionsQuery,
      (snapshot) => applyUpcomingFromSnapshot(snapshot, todayKey, setSessions),
      () => clearSessionsOnListenError(setSessions),
    );

    return () => stopListeningSafely(unsubscribe);
  }, [clientId, trainerId, todayKey]);

  const groupedByDay = useMemo(() => groupSessionsByDate(sessions), [sessions]);

  // 2. Confirm or decline a pending invite — same Firestore keys as trainer flow.
  const respondToInvite = useCallback(
    async (sessionId, status) => {
      if (!trainerId || !sessionId || !db) return;

      setRespondBusyId(sessionId);
      try {
        const sessionRef = doc(db, oneSessionDocPath(trainerId, sessionId));
        // Freeze: field keys status / respondedAt / updatedAt stay as-is.
        await updateDoc(sessionRef, {
          status,
          respondedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        notifyParentInviteResponded(onResponded, sessionId, status);
      } catch (error) {
        Alert.alert(ALERT_UPDATE_FAILED_TITLE, alertMessageFromError(error));
      } finally {
        setRespondBusyId(null);
      }
    },
    [onResponded, trainerId],
  );

  const hasNoTrainer = !trainerId;
  const hasNoUpcoming = groupedByDay.length === 0;
  const showSessionList = !hasNoTrainer && !hasNoUpcoming;
  const showRequestAtBottom = Boolean(trainerId) && !hasNoUpcoming && showRequestButton;

  const listBody = pickSessionsListBody({
    hasNoTrainer,
    hasNoUpcoming,
    showSessionList,
    coachFirstName,
    showRequestButton,
    onRequestSession,
    groupedByDay,
    todayKey,
    respondBusyId,
    respondToInvite,
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.nbBackground }]}>
      <NbPageHeader title="My sessions" subtitle={subtitle} onBack={onBack} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPad }]}
        {...FORM_SCROLL_PROPS}
      >
        {listBody}

        {showRequestAtBottom ? (
          <NbButton variant="ghost" onPress={onRequestSession}>
            Request a session
          </NbButton>
        ) : null}
      </ScrollView>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  group: { gap: 10 },
  dayHeader: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  stack: { gap: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  half: { flex: 1 },
  empty: {
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
  emptySub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyBtn: { marginTop: 6, alignSelf: 'stretch' },
});
