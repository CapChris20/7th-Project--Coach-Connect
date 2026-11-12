// Design Law session row: time column | avatar + name + type + status/where chips + notes.
// Flow: map status → Confirmed fill / Pending dashed / Declined strike → show where chip + notes.
// Used by trainer BookSession calendar/list and client My sessions agenda.
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

// ===== HELPERS =====

function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

function statusLabel(status) {
  if (status === STATUS_ACCEPTED) return 'Confirmed';
  if (status === STATUS_DECLINED) return 'Declined';
  return 'Pending';
}

function sessionTypeLabel(session) {
  return (
    session?.title ||
    session?.focus ||
    session?.type ||
    session?.sessionType ||
    'Training'
  );
}

function whereLabel(session) {
  if (session?.zoomLink) return 'Video link attached';
  return 'In person';
}

function formatDurationMin(durationMin) {
  const minutes = Number(durationMin) || DEFAULT_DURATION_MIN;
  return `${minutes} min`;
}

// ===== MAIN =====

/**
 * Design Law session card (PNG calendar/list agenda).
 * @param {{ session: object, theme?: string, showDate?: boolean, nameOverride?: string, subtitleOverride?: string, footerActions?: import('react').ReactNode }} props
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

  const timeLabel = useMemo(() => formatTime12(session?.time) || '—', [session?.time]);
  const durationMin = session?.durationMin || session?.duration || DEFAULT_DURATION_MIN;
  const status = session?.status || STATUS_PENDING;
  const isConfirmed = status === STATUS_ACCEPTED;
  const isDeclined = status === STATUS_DECLINED;
  const displayName = nameOverride || session?.clientName || CLIENT_NAME_DEFAULT;
  const typeLabel = subtitleOverride || sessionTypeLabel(session);
  const notes = session?.notes ? String(session.notes) : '';

  // Split "6:30 PM" so the rail can stack clock + meridiem like the PNG when space is tight
  const timeParts = String(timeLabel).split(' ');
  const clock = timeParts[0] || timeLabel;
  const meridiem = timeParts[1] || '';

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.nbSurface,
            borderColor: colors.nbBorder,
          },
        ]}
      >
        <View style={styles.row}>
          {/* Left rail: start time + duration */}
          <View style={[styles.timeCol, { borderRightColor: colors.nbBorder }]}>
            <Text style={[styles.clock, { color: colors.nbInk }]} numberOfLines={1}>
              {clock}
            </Text>
            {meridiem ? (
              <Text style={[styles.meridiem, { color: colors.nbInk }]}>{meridiem}</Text>
            ) : null}
            <Text style={[styles.duration, { color: colors.nbMuted }]}>
              {formatDurationMin(durationMin)}
            </Text>
            {showDate && session?.date ? (
              <Text style={[styles.dateHint, { color: colors.nbMuted }]} numberOfLines={1}>
                {String(session.date).slice(5)}
              </Text>
            ) : null}
          </View>

          {/* Body: avatar, name, type, chips, notes */}
          <View style={styles.body}>
            <View style={styles.nameRow}>
              <NbAvatar initials={initialsFromName(displayName)} size={AVATAR_SIZE} />
              <View style={styles.nameStack}>
                <Text style={[styles.name, { color: colors.nbInk }]} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={[styles.type, { color: colors.nbMuted }]} numberOfLines={1}>
                  {typeLabel}
                </Text>
              </View>
            </View>

            <View style={styles.chipRow}>
              <NbChip
                selected={isConfirmed}
                variant={isConfirmed ? 'default' : isDeclined ? 'outline' : 'dashed'}
                strike={isDeclined}
                contentStyle={styles.statusChip}
              >
                {statusLabel(status)}
              </NbChip>
              <NbChip variant="outline" contentStyle={styles.statusChip}>
                {whereLabel(session)}
              </NbChip>
            </View>

            {notes ? (
              <Text style={[styles.notes, { color: colors.nbMuted }]} numberOfLines={2}>
                {notes}
              </Text>
            ) : null}

            {footerActions}
          </View>
        </View>
      </View>
    </HardShadow>
  );
};

export default SessionCard;

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
