// Neobrutalist session card on the home screen. Invite mode asks Pass / I'm in. Reminder mode can open the workout.
// Flow: read the session → paint when column + title → show invite buttons or the workout button.
// Used by the client home when a coach sends or confirms a session (extra invites beyond the primary Up next card).

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import { formatTime12, formatDateLong } from '../../helpers/sessionTimeText';
import { nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const SESSION_STATUS_DECLINED = 'declined';
const SESSION_STATUS_ACCEPTED = 'accepted';
const DEFAULT_DURATION_MINUTES = 60;
const INVITE_MODE = 'invite';
const REMINDER_MODE = 'reminder';

// ===== HELPER FUNCTIONS =====

function coachFirstName(coachName) {
  const coachNameText = String(coachName || 'Your coach').trim();
  return coachNameText.split(/\s+/)[0] || coachNameText;
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

function isReminderMode(mode) {
  return mode === REMINDER_MODE;
}

function passOnThisInvite(onRespond, sessionId) {
  if (!onRespond) return;
  onRespond({ sessionId, status: SESSION_STATUS_DECLINED });
}

function acceptThisInvite(onRespond, sessionId) {
  if (!onRespond) return;
  onRespond({ sessionId, status: SESSION_STATUS_ACCEPTED });
}

function InviteActionButtons({ colors, sessionId, onRespond }) {
  return (
    <View style={styles.actions}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => passOnThisInvite(onRespond, sessionId)}
        style={[styles.outlineBtn, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <Text style={[styles.outlineBtnText, { color: colors.nbInk }]}>Pass</Text>
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => acceptThisInvite(onRespond, sessionId)}
        style={[styles.primaryBtn, { backgroundColor: colors.nbFill, borderColor: colors.nbBorder }]}
      >
        <Text style={[styles.primaryBtnText, { color: colors.nbOnFill }]}>I’m in</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.nbOnFill} />
      </TouchableOpacity>
    </View>
  );
}

function ReminderWorkoutButton({ onPressViewWorkout }) {
  if (!onPressViewWorkout) return null;
  return (
    <View style={{ marginTop: 4 }}>
      <NbButton variant="brand" onPress={onPressViewWorkout}>
        View / Log Workout
      </NbButton>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Session card. mode "invite" shows Pass and I'm in. mode "reminder" can show View / Log Workout.
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
  const isReminder = isReminderMode(mode);
  const timeParts = String(timeLabel).split(' ');
  const clock = timeParts[0] || '—';
  const meridiem = timeParts[1] || '';

  return (
    <NbCard style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.when, { borderRightColor: colors.nbBorder }]}>
          <Text style={[styles.whenNum, { color: colors.nbInk }]}>{clock}</Text>
          <Text style={[styles.whenSub, { color: colors.nbMuted }]}>
            {`${meridiem}${meridiem ? ' · ' : ''}${durationMinutes} min`}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
          <Text style={[styles.badge, { color: colors.nbMuted }]}>
            {isReminder ? 'UP NEXT' : 'NEW INVITE'}
          </Text>
          <Text style={[styles.title, { color: colors.nbInk }]} numberOfLines={2}>
            {isReminder
              ? `${coachFirst} · here’s your time`
              : `${coachFirst} invited you to a session`}
          </Text>
          <Text style={{ fontSize: 13, color: colors.nbMuted }} numberOfLines={2}>
            {dateHuman}
          </Text>
          {session.notes ? (
            <Text style={{ fontSize: 13, color: colors.nbMuted }} numberOfLines={3}>
              {session.notes}
            </Text>
          ) : null}
          {mode === INVITE_MODE ? (
            <InviteActionButtons colors={colors} sessionId={session.id} onRespond={onRespond} />
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
    gap: 12,
    padding: 12,
  },
  when: {
    minWidth: 92,
    paddingRight: 12,
    borderRightWidth: nb.borderWidth,
    justifyContent: 'center',
  },
  whenNum: { fontSize: 30, fontWeight: '900', letterSpacing: -1, lineHeight: 32 },
  whenSub: { fontSize: 13, marginTop: 4, fontWeight: '600' },
  badge: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  outlineBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: { fontSize: 14, fontWeight: '900' },
  primaryBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: { fontSize: 14, fontWeight: '900' },
});
