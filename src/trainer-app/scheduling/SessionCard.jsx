// Design Law session row: time rail | avatar + name + type + status/where chips + notes.
// Flow: map status → Confirmed fill / Pending dashed / Declined strike → show where chip + notes.
// Used by trainer BookSession calendar/list and client My sessions agenda.
// Read order: constants → pure layout → main (derive labels) → PLUMBING (label helpers).
//
// vocab: HardShadow = solid offset shadow (no blur); NbChip dashed = Pending outline
// Manipulate here: left column width (78), avatar size (40), chip labels

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatTime12 } from '../../helpers/sessionTimeText';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbAvatar from '../../look-and-feel/NbAvatar';
import NbChip from '../../look-and-feel/NbChip';
import HardShadow from '../../look-and-feel/HardShadow';
import { nb, borderRadius } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const CLIENT_NAME_DEFAULT = 'Client';
const DEFAULT_DURATION_MIN = 60;
const STATUS_ACCEPTED = 'accepted';
const STATUS_DECLINED = 'declined';
const STATUS_PENDING = 'pending';
const AVATAR_SIZE = 40;
// Manipulate here: left time rail width (matches PNG time | divider | body)
const TIME_COL_WIDTH = 78;
const FALLBACK_TIME_LABEL = '—';

// ===== PURE LAYOUT (no hooks) =====

function SessionTimeRail({
  clockText,
  meridiemText,
  durationLabel,
  showDate,
  dateSlice,
  inkColor,
  mutedColor,
  borderColor,
}) {
  const shouldShowMeridiem = Boolean(meridiemText);
  const shouldShowDateHint = showDate && Boolean(dateSlice);

  return (
    <View style={[styles.timeCol, { borderRightColor: borderColor }]}>
      <Text style={[styles.clock, { color: inkColor }]} numberOfLines={1}>
        {clockText}
      </Text>
      {shouldShowMeridiem ? (
        <Text style={[styles.meridiem, { color: inkColor }]}>{meridiemText}</Text>
      ) : null}
      <Text style={[styles.duration, { color: mutedColor }]}>{durationLabel}</Text>
      {shouldShowDateHint ? (
        <Text style={[styles.dateHint, { color: mutedColor }]} numberOfLines={1}>
          {dateSlice}
        </Text>
      ) : null}
    </View>
  );
}

function SessionCardBody({
  displayName,
  avatarInitials,
  typeLabel,
  statusChipVariant,
  statusText,
  whereText,
  isConfirmed,
  isDeclined,
  notes,
  footerActions,
  inkColor,
  mutedColor,
}) {
  const hasNotes = Boolean(notes);

  return (
    <View style={styles.body}>
      <View style={styles.nameRow}>
        <NbAvatar initials={avatarInitials} size={AVATAR_SIZE} />
        <View style={styles.nameStack}>
          <Text style={[styles.name, { color: inkColor }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.type, { color: mutedColor }]} numberOfLines={1}>
            {typeLabel}
          </Text>
        </View>
      </View>

      <View style={styles.chipRow}>
        <NbChip
          selected={isConfirmed}
          variant={statusChipVariant}
          strike={isDeclined}
          contentStyle={styles.statusChip}
        >
          {statusText}
        </NbChip>
        <NbChip variant="outline" contentStyle={styles.statusChip}>
          {whereText}
        </NbChip>
      </View>

      {hasNotes ? (
        <Text style={[styles.notes, { color: mutedColor }]} numberOfLines={2}>
          {notes}
        </Text>
      ) : null}

      {footerActions}
    </View>
  );
}

function SessionCardLayout({
  colors,
  clockText,
  meridiemText,
  durationLabel,
  showDate,
  dateSlice,
  displayName,
  avatarInitials,
  typeLabel,
  statusChipVariant,
  statusText,
  whereText,
  isConfirmed,
  isDeclined,
  notes,
  footerActions,
}) {
  const cardSurfaceColor = colors.nbSurface;
  const cardBorderColor = colors.nbBorder;
  const inkColor = colors.nbInk;
  const mutedColor = colors.nbMuted;

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: cardSurfaceColor,
            borderColor: cardBorderColor,
          },
        ]}
      >
        <View style={styles.row}>
          <SessionTimeRail
            clockText={clockText}
            meridiemText={meridiemText}
            durationLabel={durationLabel}
            showDate={showDate}
            dateSlice={dateSlice}
            inkColor={inkColor}
            mutedColor={mutedColor}
            borderColor={cardBorderColor}
          />
          <SessionCardBody
            displayName={displayName}
            avatarInitials={avatarInitials}
            typeLabel={typeLabel}
            statusChipVariant={statusChipVariant}
            statusText={statusText}
            whereText={whereText}
            isConfirmed={isConfirmed}
            isDeclined={isDeclined}
            notes={notes}
            footerActions={footerActions}
            inkColor={inkColor}
            mutedColor={mutedColor}
          />
        </View>
      </View>
    </HardShadow>
  );
}

// ===== MAIN =====

/**
 * One session row for calendar/list: time rail + client + status chips.
 * theme prop is accepted for call-site compat but colors come from useTheme().
 */
export const SessionCard = ({
  session,
  theme: _themeIgnored,
  showDate = false,
  nameOverride,
  subtitleOverride,
  footerActions = null,
}) => {
  const { colors } = useTheme();

  // 1. Clock label from stored 24h time string (e.g. "18:30" → "6:30 PM").
  // vocab: useMemo = recompute only when session.time changes
  const timeLabel = useMemo(() => {
    const formatted = formatTime12(session?.time);
    return formatted || FALLBACK_TIME_LABEL;
  }, [session?.time]);

  // 2. Status and display fields for chips and avatar.
  const durationMin = session?.durationMin || session?.duration || DEFAULT_DURATION_MIN;
  const status = session?.status || STATUS_PENDING;
  const isConfirmed = status === STATUS_ACCEPTED;
  const isDeclined = status === STATUS_DECLINED;
  const displayName = nameOverride || session?.clientName || CLIENT_NAME_DEFAULT;
  const typeLabel = subtitleOverride || sessionTypeLabel(session);
  const notesText = session?.notes ? String(session.notes) : '';

  // 3. Split "6:30 PM" so the rail stacks clock + meridiem like the PNG.
  const { clockText, meridiemText } = splitTimeLabelForRail(timeLabel);
  const durationLabel = formatDurationMin(durationMin);
  const statusChipVariant = pickStatusChipVariant(isConfirmed, isDeclined);
  const statusText = statusLabel(status);
  const whereText = whereLabel(session);
  const avatarInitials = initialsFromName(displayName);
  const dateSlice = session?.date ? String(session.date).slice(5) : '';

  return (
    <SessionCardLayout
      colors={colors}
      clockText={clockText}
      meridiemText={meridiemText}
      durationLabel={durationLabel}
      showDate={showDate}
      dateSlice={dateSlice}
      displayName={displayName}
      avatarInitials={avatarInitials}
      typeLabel={typeLabel}
      statusChipVariant={statusChipVariant}
      statusText={statusText}
      whereText={whereText}
      isConfirmed={isConfirmed}
      isDeclined={isDeclined}
      notes={notesText}
      footerActions={footerActions}
    />
  );
};

export default SessionCard;

// ===== PLUMBING — skip unless debugging =====

function initialsFromName(fullName) {
  const nameParts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (nameParts.length === 0) {
    return '?';
  }
  if (nameParts.length === 1) {
    return nameParts[0].slice(0, 2).toUpperCase();
  }

  const firstInitial = nameParts[0][0] || '';
  const secondInitial = nameParts[1][0] || '';
  return `${firstInitial}${secondInitial}`.toUpperCase();
}

function statusLabel(status) {
  if (status === STATUS_ACCEPTED) {
    return 'Confirmed';
  }
  if (status === STATUS_DECLINED) {
    return 'Declined';
  }
  return 'Pending';
}

function sessionTypeLabel(session) {
  if (session?.title) {
    return session.title;
  }
  if (session?.focus) {
    return session.focus;
  }
  if (session?.type) {
    return session.type;
  }
  if (session?.sessionType) {
    return session.sessionType;
  }
  return 'Training';
}

function whereLabel(session) {
  if (session?.zoomLink) {
    return 'Video link attached';
  }
  return 'In person';
}

function formatDurationMin(durationMin) {
  const minutes = Number(durationMin) || DEFAULT_DURATION_MIN;
  return `${minutes} min`;
}

function pickStatusChipVariant(isConfirmed, isDeclined) {
  if (isConfirmed) {
    return 'default';
  }
  if (isDeclined) {
    return 'outline';
  }
  return 'dashed';
}

function splitTimeLabelForRail(timeLabel) {
  const pieces = String(timeLabel).split(' ');
  const clockText = pieces[0] || timeLabel;
  const meridiemText = pieces[1] || '';
  return { clockText, meridiemText };
}

const styles = StyleSheet.create({
  card: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  timeCol: {
    width: TIME_COL_WIDTH,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRightWidth: nb.borderWidthDivider,
    justifyContent: 'center',
  },
  clock: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    letterSpacing: -0.3,
  },
  meridiem: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    marginTop: 1,
  },
  duration: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginTop: 6,
  },
  dateHint: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    marginTop: 4,
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nameStack: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  type: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // Manipulate here: status chips are shorter than filter chips
  statusChip: {
    minHeight: 28,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  notes: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
});
