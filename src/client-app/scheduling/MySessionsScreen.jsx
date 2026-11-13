// Design Law client “My sessions” list (scheduling PNG 17–20).
// Flow: listen to trainer_clients/{trainer}/sessions for this client → group by day → Decline/Confirm.
// Used as a stack screen from home (Up next / Request CTA).
//
// vocab: SessionCard footerActions = Decline/Confirm row for pending invites
// Manipulate here: upcoming window (UPCOMING_DAYS), empty copy

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
const UPCOMING_LIMIT = 30;
const SCROLL_BOTTOM_PAD = 48;
const STATUS_PENDING = 'pending';
const STATUS_ACCEPTED = 'accepted';
const STATUS_DECLINED = 'declined';

// ===== HELPERS =====

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

function trainerDisplayName(trainerName) {
  const text = String(trainerName || 'Your trainer').trim();
  return text || 'Your trainer';
}

// ===== MAIN =====

/**
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
  const subtitle = `With your trainer, ${coachLabel}`;

  // Live upcoming sessions for this client under the linked trainer
  useEffect(() => {
    if (!clientId || !trainerId || !db) {
      setSessions([]);
      return undefined;
    }
    const sessionsRef = collection(db, `trainer_clients/${trainerId}/sessions`);
    const q = query(sessionsRef, where('clientId', '==', clientId), limit(UPCOMING_LIMIT));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = [];
        snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
        const upcoming = rows
          .filter((s) => String(s.date || '') >= todayKey && s.status !== STATUS_DECLINED)
          .sort((a, b) =>
            `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
          );
        setSessions(upcoming);
      },
      () => setSessions([]),
    );
    return () => {
      try {
        unsub();
      } catch (_e) {
        /* ignore */
      }
    };
  }, [clientId, trainerId, todayKey]);

  const grouped = useMemo(() => groupSessionsByDate(sessions), [sessions]);

  const respond = useCallback(
    async (sessionId, status) => {
      if (!trainerId || !sessionId || !db) return;
      setRespondBusyId(sessionId);
      try {
        await updateDoc(doc(db, `trainer_clients/${trainerId}/sessions/${sessionId}`), {
          status,
          respondedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        onResponded?.({ sessionId, status });
      } catch (e) {
        Alert.alert('Could not update', e?.message || 'Please try again.');
      } finally {
        setRespondBusyId(null);
      }
    },
    [onResponded, trainerId],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.nbBackground }]}>
      <NbPageHeader title="My sessions" subtitle={subtitle} onBack={onBack} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPad }]}
        {...FORM_SCROLL_PROPS}
      >
        {!trainerId ? (
          <NbCard style={[styles.empty, { borderStyle: 'dashed' }]}>
            <NbIconChip source={ICON_SCHEDULE} index={7} size={48} />
            <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>
              No trainer linked yet.
            </Text>
            <Text style={[styles.emptySub, { color: colors.nbMuted }]}>
              Connect with a coach and sessions show up here.
            </Text>
          </NbCard>
        ) : grouped.length === 0 ? (
          <NbCard style={[styles.empty, { borderStyle: 'dashed' }]}>
            <NbIconChip source={ICON_SCHEDULE} index={7} size={48} />
            <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>
              No upcoming sessions.
            </Text>
            <Text style={[styles.emptySub, { color: colors.nbMuted }]}>
              {`Ask ${coachLabel.split(/\s+/)[0]} for a time and it shows up here.`}
            </Text>
            {typeof onRequestSession === 'function' ? (
              <NbButton variant="fill" onPress={onRequestSession} style={styles.emptyBtn}>
                Request a session
              </NbButton>
            ) : null}
          </NbCard>
        ) : (
          grouped.map(([dateKey, daySessions]) => (
            <View key={dateKey} style={styles.group}>
              <Text style={[styles.dayHeader, { color: colors.nbInk }]}>
                {formatDayHeader(dateKey, todayKey)}
              </Text>
              <View style={styles.stack}>
                {daySessions.map((session) => {
                  const pending = (session.status || STATUS_PENDING) === STATUS_PENDING;
                  return (
                    <SessionCard
                      key={session.id}
                      session={session}
                      nameOverride="Your trainer"
                      subtitleOverride={
                        session.title || session.focus || session.type || 'Training'
                      }
                      footerActions={
                        pending ? (
                          <View style={styles.actions}>
                            <View style={styles.half}>
                              <NbButton
                                variant="ghost"
                                sm
                                disabled={respondBusyId === session.id}
                                onPress={() => respond(session.id, STATUS_DECLINED)}
                              >
                                Decline
                              </NbButton>
                            </View>
                            <View style={styles.half}>
                              <NbButton
                                variant="fill"
                                sm
                                disabled={respondBusyId === session.id}
                                onPress={() => respond(session.id, STATUS_ACCEPTED)}
                              >
                                Confirm
                              </NbButton>
                            </View>
                          </View>
                        ) : null
                      }
                    />
                  );
                })}
              </View>
            </View>
          ))
        )}

        {trainerId && grouped.length > 0 && typeof onRequestSession === 'function' ? (
          <NbButton variant="ghost" onPress={onRequestSession}>
            Request a session
          </NbButton>
        ) : null}
      </ScrollView>
    </View>
  );
}

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
