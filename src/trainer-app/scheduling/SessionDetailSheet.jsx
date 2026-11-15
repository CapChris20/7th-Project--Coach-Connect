// Design Law session detail bottom sheet (scheduling PNG 13/14).
// Flow: open from agenda card → When/Length/Where + notes → Message / Reschedule / Delete.
// Used by BookSessionScreen (trainer calendar + list). Do not rewrite BookSessionScreen here.
// Read order: constants → layout pieces → main → PLUMBING (label helpers).
//
// vocab: NbSheet = bottom sheet; status fill chip = Confirmed black pill
// Manipulate here: row labels, button labels, avatar size

import React, { useMemo } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { format, isValid, parseISO } from 'date-fns';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';
import NbAvatar from '../../look-and-feel/NbAvatar';
import NbChip from '../../look-and-feel/NbChip';
import NbCard from '../../look-and-feel/NbCard';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { formatTime12 } from '../../helpers/sessionTimeText';
import { nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_DURATION = 60;
const STATUS_ACCEPTED = 'accepted';
const STATUS_DECLINED = 'declined';
const STATUS_PENDING = 'pending';
const CLIENT_NAME_DEFAULT = 'Client';
const AVATAR_SIZE = 48;
const FALLBACK_TIME_LABEL = '—';

// ===== HELPER FUNCTIONS =====

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

function sessionTypeLabel(session) {
  if (session == null) {
    return 'Training';
  }
  if (session.title) {
    return session.title;
  }
  if (session.focus) {
    return session.focus;
  }
  if (session.type) {
    return session.type;
  }
  if (session.sessionType) {
    return session.sessionType;
  }
  return 'Training';
}

function whereLabel(session) {
  if (session == null) {
    return 'In person';
  }
  if (session.zoomLink) {
    return 'Video link';
  }
  return 'In person';
}

function formatWhen(session) {
  let dateRaw = '';
  let timeRaw = null;
  if (session != null) {
    if (session.date) {
      dateRaw = String(session.date);
    }
    timeRaw = session.time;
  }
  const dateKey = dateRaw.slice(0, 10);
  let timeLabel = formatTime12(timeRaw);
  if (!timeLabel) {
    timeLabel = FALLBACK_TIME_LABEL;
  }
  if (!dateKey) {
    return timeLabel;
  }

  try {
    // vocab: parseISO = turn "2026-11-13" into a Date; isValid = date-fns guard
    const parsedDay = parseISO(dateKey);
    if (!isValid(parsedDay)) {
      return `${dateKey} · ${timeLabel}`;
    }
    return `${format(parsedDay, 'EEE, MMM d')} · ${timeLabel}`;
  } catch {
    return `${dateKey} · ${timeLabel}`;
  }
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

function pickStatusChipVariant(isConfirmed) {
  if (isConfirmed) {
    return 'default';
  }
  return 'outline';
}

function extractSessionFields(session) {
  if (!session) {
    return {
      name: CLIENT_NAME_DEFAULT,
      status: STATUS_PENDING,
      durationMin: DEFAULT_DURATION,
      notesText: '',
    };
  }
  const name = session.clientName || CLIENT_NAME_DEFAULT;
  const status = session.status || STATUS_PENDING;
  const durationRaw = session.durationMin || session.duration || DEFAULT_DURATION;
  const durationMin = Number(durationRaw);
  const notesText = session.notes ? String(session.notes) : '';
  return { name, status, durationMin, notesText };
}

function DetailRow({ label, value, colors, isLastRow }) {
  // Name the border decision before JSX — no nested ternary in the style array.
  let rowBorderStyle = null;
  if (!isLastRow) {
    rowBorderStyle = {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.nbBorder,
    };
  }

  return (
    <View style={[styles.detailRow, rowBorderStyle]}>
      <Text style={[styles.detailLabel, { color: colors.nbInk }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.nbInk }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function SessionDetailHeader({
  name,
  typeLabel,
  initials,
  isConfirmed,
  statusChipVariant,
  statusText,
  colors,
}) {
  return (
    <View style={styles.headerRow}>
      <NbAvatar initials={initials} size={AVATAR_SIZE} />
      <View style={styles.headerText}>
        <Text style={[styles.name, { color: colors.nbInk }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.sub, { color: colors.nbMuted }]} numberOfLines={1}>
          {typeLabel}
        </Text>
      </View>
      <NbChip selected={isConfirmed} variant={statusChipVariant}>
        {statusText}
      </NbChip>
    </View>
  );
}

function SessionDetailNotesBox({ notes, colors }) {
  let notesSurfaceColor = colors.nbBackground;
  if (colors.nbSurfaceChip) {
    notesSurfaceColor = colors.nbSurfaceChip;
  }

  return (
    <View
      style={[
        styles.notesBox,
        { borderColor: colors.nbBorder, backgroundColor: notesSurfaceColor },
      ]}
    >
      <Text style={[styles.notesLabel, { color: colors.nbMuted }]}>NOTES</Text>
      <Text style={[styles.notesBody, { color: colors.nbInk }]}>{notes}</Text>
    </View>
  );
}

function SessionDetailActions({ session, onMessage, onReschedule, onDelete }) {
  const handleMessagePress = () => {
    if (typeof onMessage === 'function') {
      onMessage(session);
    }
  };
  const handleReschedulePress = () => {
    if (typeof onReschedule === 'function') {
      onReschedule(session);
    }
  };
  const handleDeletePress = () => {
    if (typeof onDelete === 'function') {
      onDelete(session);
    }
  };

  return (
    <>
      <View style={styles.actionRow}>
        <NbButton variant="plain" onPress={handleMessagePress} style={styles.half}>
          Message
        </NbButton>
        <NbButton variant="fill" onPress={handleReschedulePress} style={styles.half}>
          Reschedule
        </NbButton>
      </View>
      <NbButton variant="ghost" onPress={handleDeletePress}>
        Delete Session
      </NbButton>
    </>
  );
}

function SessionDetailSheetLayout({
  colors,
  name,
  typeLabel,
  isConfirmed,
  statusChipVariant,
  statusText,
  initials,
  whenLabel,
  durationLabel,
  whereText,
  notes,
  onMessage,
  onReschedule,
  onDelete,
  session,
}) {
  const hasNotes = Boolean(notes);

  let notesBox = null;
  if (hasNotes) {
    notesBox = <SessionDetailNotesBox notes={notes} colors={colors} />;
  }

  return (
    <View style={styles.body}>
      <SessionDetailHeader
        name={name}
        typeLabel={typeLabel}
        initials={initials}
        isConfirmed={isConfirmed}
        statusChipVariant={statusChipVariant}
        statusText={statusText}
        colors={colors}
      />

      <NbCard style={styles.detailCard}>
        <DetailRow label="When" value={whenLabel} colors={colors} />
        <DetailRow label="Length" value={durationLabel} colors={colors} />
        <DetailRow label="Where" value={whereText} colors={colors} isLastRow />
      </NbCard>

      {notesBox}

      <SessionDetailActions
        session={session}
        onMessage={onMessage}
        onReschedule={onReschedule}
        onDelete={onDelete}
      />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Bottom sheet for one session: when/length/where, notes, and action buttons.
 * @param {object} props
 */
export default function SessionDetailSheet({
  visible,
  session,
  onClose,
  onMessage,
  onReschedule,
  onDelete,
}) {
  const { colors } = useTheme();

  // 1. Client-facing labels from the session doc (Firestore keys unchanged).
  const { name, status, durationMin, notesText } = extractSessionFields(session);
  const typeLabel = sessionTypeLabel(session);
  const isConfirmed = status === STATUS_ACCEPTED;

  // 2. Avatar initials memoized so long names do not re-split every render.
  // vocab: useMemo = cache the string until `name` changes
  const initials = useMemo(() => initialsFromName(name), [name]);

  // 3. Chip / row labels for the layout.
  const statusChipVariant = pickStatusChipVariant(isConfirmed);
  const statusText = statusLabel(status);
  const whenLabel = formatWhen(session);
  const durationLabel = `${durationMin} min`;
  const whereText = whereLabel(session);
  const sheetIsOpen = visible && Boolean(session);

  return (
    <NbSheet visible={sheetIsOpen} onClose={onClose}>
      <SessionDetailSheetLayout
        colors={colors}
        name={name}
        typeLabel={typeLabel}
        isConfirmed={isConfirmed}
        statusChipVariant={statusChipVariant}
        statusText={statusText}
        initials={initials}
        whenLabel={whenLabel}
        durationLabel={durationLabel}
        whereText={whereText}
        notes={notesText}
        onMessage={onMessage}
        onReschedule={onReschedule}
        onDelete={onDelete}
        session={session}
      />
    </NbSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerText: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    letterSpacing: -0.2,
  },
  sub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    marginTop: 2,
  },
  detailCard: { paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  detailLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  detailValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    flexShrink: 1,
    textAlign: 'right',
  },
  notesBox: {
    borderWidth: nb.borderWidth,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  notesLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.1,
  },
  notesBody: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
  },
  actionRow: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
});
