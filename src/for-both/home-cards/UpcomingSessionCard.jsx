// Design Law home / My-sessions invite card: time rail + trainer info + Decline / Confirm.
// Flow: read the session → paint when column + title → invite buttons or reminder workout CTA.
// Used by the client home when a coach sends or confirms a session (extra invites beyond Up next).
//
// vocab: HardShadow via NbCard; status chips match SessionCard Confirmed/Pending language
// Manipulate here: button labels (Decline / Confirm per PNG 17), Pass/I'm in retired

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import NbAvatar from '../../look-and-feel/NbAvatar';
import NbChip from '../../look-and-feel/NbChip';
import { formatTime12, formatDateLong } from '../../helpers/sessionTimeText';
import { nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const SESSION_STATUS_DECLINED = 'declined';
const SESSION_STATUS_ACCEPTED = 'accepted';
const DEFAULT_DURATION_MINUTES = 60;
const INVITE_MODE = 'invite';
const REMINDER_MODE = 'reminder';
const TIME_COL_WIDTH = 78;
const AVATAR_SIZE = 40;

// ===== HELPERS =====

function coachFirstName(coachName) {
  const coachNameText = String(coachName || 'Your coach').trim();
  return coachNameText.split(/\s+/)[0] || coachNameText;
}

function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function sessionDurationMinutes(session) {
  return session.durationMin || session.duration || DEFAULT_DURATION_MINUTES;
}

function sessionDateLabel(session) {
  const dateKey = (session.date || '').slice(0, 10);
  if (!dateKey) return '—';
  return formatDateLong(dateKey);
}

function sessionTimeLabel(session) {
  return formatTime12(session.time) || '—';
}

function sessionTypeLabel(session) {
  return session?.title || session?.focus || session?.type || session?.workoutName || 'Training';
}

function whereLabel(session) {
  if (session?.zoomLink) return 'Video link attached';
  return 'In person';
}

function passOnThisInvite(onRespond, sessionId) {
  if (!onRespond) return;
  onRespond({ sessionId, status: SESSION_STATUS_DECLINED });
}

function acceptThisInvite(onRespond, sessionId) {
  if (!onRespond) return;
  onRespond({ sessionId, status: SESSION_STATUS_ACCEPTED });
}

function InviteActionButtons({ sessionId, onRespond }) {
  return (
    <View style={styles.actions}>
      <View style={styles.actionHalf}>
        <NbButton variant="ghost" sm onPress={() => passOnThisInvite(onRespond, sessionId)}>
          Decline
        </NbButton>
      </View>
      <View style={styles.actionHalf}>
        <NbButton variant="fill" sm onPress={() => acceptThisInvite(onRespond, sessionId)}>
          Confirm
        </NbButton>
      </View>
    </View>
  );
}

function ReminderWorkoutButton({ onPressViewWorkout }) {
  if (!onPressViewWorkout) return null;
  return (
    <View style={{ marginTop: 4 }}>
      <NbButton variant="fill" onPress={onPressViewWorkout}>
        View / Log Workout
      </NbButton>
    </View>
  );
}

// ===== MAIN =====

/**
 * Session card. mode "invite" shows Decline and Confirm. mode "reminder" can show View / Log Workout.
 * @param {object} props
 * @param {'invite'|'reminder'} [props.mode]
 * @param {boolean} props.isDark
 * @param {string} props.coachName
 * @param {object|null} props.session
 * @param {Function} [props.onRespond]
 * @param {Function} [props.onPressViewWorkout]
 */
export function UpcomingSessionCard({
  mode = INVITE_MODE,
  isDark: _isDark,
  coachName,
  session,
  onRespond,
  onPressViewWorkout,
}) {
  const { colors } = useTheme();
  const coachFirst = useMemo(() => coachFirstName(coachName), [coachName]);

  if (!session) return null;

  const durationMinutes = sessionDurationMinutes(session);
  const dateHuman = sessionDateLabel(session);
  const timeLabel = sessionTimeLabel(session);
  const isReminder = mode === REMINDER_MODE;
  const timeParts = String(timeLabel).split(' ');
  const clock = timeParts[0] || '—';
  const meridiem = timeParts[1] || '';
  const typeLabel = sessionTypeLabel(session);
  const status = session.status || 'pending';
  const isConfirmed = status === SESSION_STATUS_ACCEPTED;
  const isPending = !isConfirmed && status !== SESSION_STATUS_DECLINED;

  return (
    <NbCard style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.when, { borderRightColor: colors.nbBorder }]}>
          <Text style={[styles.whenNum, { color: colors.nbInk }]}>{clock}</Text>
          {meridiem ? (
            <Text style={[styles.whenMeridiem, { color: colors.nbInk }]}>{meridiem}</Text>
          ) : null}
          <Text style={[styles.whenSub, { color: colors.nbMuted }]}>
            {`${durationMinutes} min`}
          </Text>
        </View>

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <NbAvatar initials={initialsFromName(coachName)} size={AVATAR_SIZE} />
            <View style={styles.nameStack}>
              <Text style={[styles.title, { color: colors.nbInk }]} numberOfLines={1}>
                {isReminder ? 'Your trainer' : `${coachFirst} invited you`}
              </Text>
              <Text style={[styles.subtitle, { color: colors.nbMuted }]} numberOfLines={1}>
                {typeLabel}
              </Text>
            </View>
          </View>

          <View style={styles.chipRow}>
            <NbChip
              selected={isConfirmed}
              variant={isConfirmed ? 'default' : 'dashed'}
              contentStyle={styles.statusChip}
            >
              {isConfirmed ? 'Confirmed' : isPending ? 'Pending' : 'Declined'}
            </NbChip>
            <NbChip variant="outline" contentStyle={styles.statusChip}>
              {whereLabel(session)}
            </NbChip>
          </View>

          <Text style={[styles.meta, { color: colors.nbMuted }]} numberOfLines={1}>
            {dateHuman}
          </Text>

          {session.notes ? (
            <Text style={[styles.notes, { color: colors.nbMuted }]} numberOfLines={2}>
              {session.notes}
            </Text>
          ) : null}

          {mode === INVITE_MODE ? (
            <InviteActionButtons sessionId={session.id} onRespond={onRespond} />
          ) : (
            <ReminderWorkoutButton onPressViewWorkout={onPressViewWorkout} />
          )}
        </View>
      </View>
    </NbCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 14,
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  when: {
    width: TIME_COL_WIDTH,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRightWidth: nb.borderWidthDivider,
    justifyContent: 'center',
  },
  whenNum: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    letterSpacing: -0.3,
  },
  whenMeridiem: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    marginTop: 1,
  },
  whenSub: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginTop: 6,
  },
  body: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nameStack: { flex: 1, minWidth: 0, gap: 2 },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusChip: {
    minHeight: 28,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  meta: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  notes: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  actionHalf: { flex: 1 },
});
