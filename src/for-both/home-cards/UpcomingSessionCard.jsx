// Home / My-sessions invite card: left time rail, trainer row, Decline / Confirm (or reminder CTA).
// Flow: read session fields → paint when column + title → invite buttons or View / Log Workout.
// Used by the client home when a coach sends or confirms a session (extra invites beyond Up next).

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

// Firestore / API status letters — do not rename these string values.
const SESSION_STATUS_DECLINED = 'declined';
const SESSION_STATUS_ACCEPTED = 'accepted';
const SESSION_STATUS_PENDING_FALLBACK = 'pending';

// Manipulate here: fallback length when the session record omits durationMin / duration.
const DEFAULT_DURATION_MINUTES = 60;

const INVITE_MODE = 'invite';
const REMINDER_MODE = 'reminder';

// Manipulate here: left rail width (matches Design Law invite card).
const TIME_COL_WIDTH = 78;
// Manipulate here: coach avatar diameter in the name row.
const AVATAR_SIZE = 40;

const FALLBACK_COACH_NAME = 'Your coach';
const FALLBACK_TRAINING_TITLE = 'Training';
const FALLBACK_CLOCK = '—';
const FALLBACK_DATE = '—';
const FALLBACK_INITIALS = '?';

const CHIP_WORDS_CONFIRMED = 'Confirmed';
const CHIP_WORDS_PENDING = 'Pending';
const CHIP_WORDS_DECLINED = 'Declined';
const CHIP_WORDS_VIDEO = 'Video link attached';
const CHIP_WORDS_IN_PERSON = 'In person';

const HEADLINE_REMINDER = 'Your trainer';
const BUTTON_DECLINE = 'Decline';
const BUTTON_CONFIRM = 'Confirm';
const BUTTON_VIEW_LOG_WORKOUT = 'View / Log Workout';

const CHIP_VARIANT_DEFAULT = 'default';
const CHIP_VARIANT_DASHED = 'dashed';
const CHIP_VARIANT_OUTLINE = 'outline';

// ===== HELPER FUNCTIONS =====

// First word of the coach’s display name for “Alex invited you”.
function coachFirstNameFromFullName(coachName) {
  const fullName = String(coachName || FALLBACK_COACH_NAME).trim();
  const nameParts = fullName.split(/\s+/);
  const firstWord = nameParts[0] || fullName;
  return firstWord;
}

// Two-letter avatar initials from a full name (or “?” when empty).
function avatarInitialsFromName(name) {
  const trimmedName = String(name || '').trim();
  const nameParts = trimmedName.split(/\s+/).filter(Boolean);

  if (nameParts.length === 0) {
    return FALLBACK_INITIALS;
  }

  if (nameParts.length === 1) {
    return nameParts[0].slice(0, 2).toUpperCase();
  }

  const firstInitial = nameParts[0][0] || '';
  const secondInitial = nameParts[1][0] || '';
  return `${firstInitial}${secondInitial}`.toUpperCase();
}

// Prefer durationMin (Design Law field); fall back to duration, then 60.
function durationMinutesFromSession(session) {
  const fromDurationMin = session.durationMin;
  if (fromDurationMin) {
    return fromDurationMin;
  }

  const fromDuration = session.duration;
  if (fromDuration) {
    return fromDuration;
  }

  return DEFAULT_DURATION_MINUTES;
}

// Long human date from session.date (YYYY-MM-DD slice).
function humanDateFromSession(session) {
  const rawDate = session.date || '';
  const dateKey = rawDate.slice(0, 10);
  if (!dateKey) {
    return FALLBACK_DATE;
  }
  return formatDateLong(dateKey);
}

// 12-hour clock label from session.time, or em dash.
function clockLabelFromSession(session) {
  const formatted = formatTime12(session.time);
  if (formatted) {
    return formatted;
  }
  return FALLBACK_CLOCK;
}

// Title preference: title → focus → type → workoutName → “Training”.
// Field letters stay frozen for callers that store any of these keys.
function trainingTitleFromSession(session) {
  if (session.title) {
    return session.title;
  }
  if (session.focus) {
    return session.focus;
  }
  if (session.type) {
    return session.type;
  }
  if (session.workoutName) {
    return session.workoutName;
  }
  return FALLBACK_TRAINING_TITLE;
}

// Location chip copy: zoom link means remote; otherwise in person.
function locationChipWords(session) {
  if (session.zoomLink) {
    return CHIP_WORDS_VIDEO;
  }
  return CHIP_WORDS_IN_PERSON;
}

// Split “3:30 PM” into clock digits + AM/PM for the time rail.
function splitClockAndMeridiem(timeLabel) {
  const timeParts = String(timeLabel).split(' ');
  const clockDigits = timeParts[0] || FALLBACK_CLOCK;
  const meridiem = timeParts[1] || '';
  return { clockDigits, meridiem };
}

// Status chip label matching SessionCard Confirmed / Pending / Declined language.
function inviteStatusChipWords(inviteWasAccepted, inviteStillPending) {
  if (inviteWasAccepted) {
    return CHIP_WORDS_CONFIRMED;
  }
  if (inviteStillPending) {
    return CHIP_WORDS_PENDING;
  }
  return CHIP_WORDS_DECLINED;
}

function inviteHeadlineText(isReminderCard, coachFirstName) {
  if (isReminderCard) {
    return HEADLINE_REMINDER;
  }
  return `${coachFirstName} invited you`;
}

function statusChipVariantName(inviteWasAccepted) {
  if (inviteWasAccepted) {
    return CHIP_VARIANT_DEFAULT;
  }
  return CHIP_VARIANT_DASHED;
}

// Tell the parent the client declined this invite (status letter frozen).
function passOnInvite(onRespond, sessionId) {
  if (!onRespond) {
    return;
  }
  onRespond({ sessionId, status: SESSION_STATUS_DECLINED });
}

// Tell the parent the client confirmed this invite (status letter frozen).
function confirmInvite(onRespond, sessionId) {
  if (!onRespond) {
    return;
  }
  onRespond({ sessionId, status: SESSION_STATUS_ACCEPTED });
}

// Left column: clock digits, optional AM/PM, duration under.
function SessionTimeRail({
  clockDigits,
  meridiem,
  durationMinutes,
  borderColor,
  inkColor,
  mutedColor,
}) {
  const durationLabel = `${durationMinutes} min`;
  const whenStyle = [styles.when, { borderRightColor: borderColor }];
  const clockStyle = [styles.whenNum, { color: inkColor }];
  const meridiemStyle = [styles.whenMeridiem, { color: inkColor }];
  const durationStyle = [styles.whenSub, { color: mutedColor }];

  let meridiemLine = null;
  if (meridiem) {
    meridiemLine = <Text style={meridiemStyle}>{meridiem}</Text>;
  }

  return (
    <View style={whenStyle}>
      <Text style={clockStyle}>{clockDigits}</Text>
      {meridiemLine}
      <Text style={durationStyle}>{durationLabel}</Text>
    </View>
  );
}

// Invite mode only: Decline (ghost) + Confirm (fill), half width each.
function InviteDeclineConfirmRow({ sessionId, onRespond }) {
  const pressDecline = () => {
    passOnInvite(onRespond, sessionId);
  };
  const pressConfirm = () => {
    confirmInvite(onRespond, sessionId);
  };

  return (
    <View style={styles.actions}>
      <View style={styles.actionHalf}>
        <NbButton variant="ghost" sm onPress={pressDecline}>
          {BUTTON_DECLINE}
        </NbButton>
      </View>
      <View style={styles.actionHalf}>
        <NbButton variant="fill" sm onPress={pressConfirm}>
          {BUTTON_CONFIRM}
        </NbButton>
      </View>
    </View>
  );
}

// Reminder mode: optional View / Log Workout fill button.
function ReminderViewWorkoutRow({ onPressViewWorkout }) {
  if (!onPressViewWorkout) {
    return null;
  }

  return (
    <View style={styles.reminderActionPad}>
      <NbButton variant="fill" onPress={onPressViewWorkout}>
        {BUTTON_VIEW_LOG_WORKOUT}
      </NbButton>
    </View>
  );
}

// Notes block only when the session carries notes text.
function SessionNotesLine({ notes, mutedColor }) {
  if (!notes) {
    return null;
  }
  const notesStyle = [styles.notes, { color: mutedColor }];
  return (
    <Text style={notesStyle} numberOfLines={2}>
      {notes}
    </Text>
  );
}

// Bottom actions: invite Decline/Confirm vs reminder workout CTA.
function SessionCardActions({ mode, sessionId, onRespond, onPressViewWorkout }) {
  const isInviteMode = mode === INVITE_MODE;
  if (isInviteMode) {
    return <InviteDeclineConfirmRow sessionId={sessionId} onRespond={onRespond} />;
  }
  return <ReminderViewWorkoutRow onPressViewWorkout={onPressViewWorkout} />;
}

// ===== MAIN FUNCTION =====

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
  // vocab: useTheme = Design Law light/dark token bag (nbInk, nbMuted, nbBorder, …).
  const { colors } = useTheme();

  // vocab: useMemo = recompute first name only when coachName changes.
  const coachFirstName = useMemo(
    () => coachFirstNameFromFullName(coachName),
    [coachName],
  );

  // No session row yet → paint nothing (parent still mounts the slot).
  if (!session) {
    return null;
  }

  // 1. Pull human-readable when / what / where from the session record.
  const durationMinutes = durationMinutesFromSession(session);
  const dateHuman = humanDateFromSession(session);
  const timeLabel = clockLabelFromSession(session);
  const clockParts = splitClockAndMeridiem(timeLabel);
  const trainingTitle = trainingTitleFromSession(session);
  const locationWords = locationChipWords(session);
  const avatarInitials = avatarInitialsFromName(coachName);

  // 2. Decide invite vs reminder chrome and status chip wording.
  const isReminderCard = mode === REMINDER_MODE;
  const sessionStatus = session.status || SESSION_STATUS_PENDING_FALLBACK;
  const inviteWasAccepted = sessionStatus === SESSION_STATUS_ACCEPTED;
  const inviteWasDeclined = sessionStatus === SESSION_STATUS_DECLINED;
  const inviteStillPending = !inviteWasAccepted && !inviteWasDeclined;
  const statusChipWords = inviteStatusChipWords(inviteWasAccepted, inviteStillPending);
  const statusChipVariant = statusChipVariantName(inviteWasAccepted);
  const headlineText = inviteHeadlineText(isReminderCard, coachFirstName);

  // Named style locals so JSX stays a short recipe (no inline ternaries).
  const titleStyle = [styles.title, { color: colors.nbInk }];
  const subtitleStyle = [styles.subtitle, { color: colors.nbMuted }];
  const metaStyle = [styles.meta, { color: colors.nbMuted }];

  // 3. NbCard row: time rail + body (avatar, chips, meta, actions).
  // vocab: HardShadow comes from NbCard; chips match SessionCard Confirmed/Pending language.
  return (
    <NbCard style={styles.card}>
      <View style={styles.row}>
        <SessionTimeRail
          clockDigits={clockParts.clockDigits}
          meridiem={clockParts.meridiem}
          durationMinutes={durationMinutes}
          borderColor={colors.nbBorder}
          inkColor={colors.nbInk}
          mutedColor={colors.nbMuted}
        />

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <NbAvatar initials={avatarInitials} size={AVATAR_SIZE} />
            <View style={styles.nameStack}>
              <Text style={titleStyle} numberOfLines={1}>
                {headlineText}
              </Text>
              <Text style={subtitleStyle} numberOfLines={1}>
                {trainingTitle}
              </Text>
            </View>
          </View>

          <View style={styles.chipRow}>
            <NbChip
              selected={inviteWasAccepted}
              variant={statusChipVariant}
              contentStyle={styles.statusChip}
            >
              {statusChipWords}
            </NbChip>
            <NbChip variant={CHIP_VARIANT_OUTLINE} contentStyle={styles.statusChip}>
              {locationWords}
            </NbChip>
          </View>

          <Text style={metaStyle} numberOfLines={1}>
            {dateHuman}
          </Text>

          <SessionNotesLine notes={session.notes} mutedColor={colors.nbMuted} />

          <SessionCardActions
            mode={mode}
            sessionId={session.id}
            onRespond={onRespond}
            onPressViewWorkout={onPressViewWorkout}
          />
        </View>
      </View>
    </NbCard>
  );
}

// ===== PLUMBING — skip unless debugging =====

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
  // Manipulate here: top pad above the reminder CTA (was inline marginTop: 4).
  reminderActionPad: { marginTop: 4 },
});
