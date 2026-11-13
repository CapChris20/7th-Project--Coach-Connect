// Design Law session detail bottom sheet (scheduling PNG 13/14).
// Flow: open from agenda card → When/Length/Where + notes → Message / Reschedule / Delete.
// Used by BookSessionScreen (trainer calendar + list).
//
// vocab: NbSheet = bottom sheet; status fill chip = Confirmed black pill
// Manipulate here: row labels, button labels

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
const AVATAR_SIZE = 48;

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
  if (session?.zoomLink) return 'Video link';
  return 'In person';
}

function formatWhen(session) {
  const dateKey = String(session?.date || '').slice(0, 10);
  const timeLabel = formatTime12(session?.time) || '—';
  if (!dateKey) return timeLabel;
  try {
    const d = parseISO(dateKey);
    if (!isValid(d)) return `${dateKey} · ${timeLabel}`;
    return `${format(d, 'EEE, MMM d')} · ${timeLabel}`;
  } catch (_e) {
    return `${dateKey} · ${timeLabel}`;
  }
}

function statusLabel(status) {
  if (status === STATUS_ACCEPTED) return 'Confirmed';
  if (status === 'declined') return 'Declined';
  return 'Pending';
}

function DetailRow({ label, value, colors, last }) {
  return (
    <View
      style={[
        styles.detailRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.nbBorder },
      ]}
    >
      <Text style={[styles.detailLabel, { color: colors.nbInk }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.nbInk }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

// ===== MAIN =====

/**
 * @param {{
 *   visible: boolean,
 *   session: object|null,
 *   onClose: Function,
 *   onMessage?: Function,
 *   onReschedule?: Function,
 *   onDelete?: Function,
 * }} props
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

  const name = session?.clientName || 'Client';
  const typeLabel = sessionTypeLabel(session);
  const status = session?.status || 'pending';
  const isConfirmed = status === STATUS_ACCEPTED;
  const durationMin = Number(session?.durationMin || session?.duration || DEFAULT_DURATION);
  const notes = session?.notes ? String(session.notes) : '';
  const initials = useMemo(() => initialsFromName(name), [name]);

  return (
    <NbSheet visible={visible && !!session} onClose={onClose}>
      <View style={styles.body}>
        {/* Header: avatar + name/type + status chip */}
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
          <NbChip selected={isConfirmed} variant={isConfirmed ? 'default' : 'outline'}>
            {statusLabel(status)}
          </NbChip>
        </View>

        {/* When / Length / Where card */}
        <NbCard style={styles.detailCard}>
          <DetailRow label="When" value={formatWhen(session)} colors={colors} />
          <DetailRow label="Length" value={`${durationMin} min`} colors={colors} />
          <DetailRow label="Where" value={whereLabel(session)} colors={colors} last />
        </NbCard>

        {notes ? (
          <View
            style={[
              styles.notesBox,
              { borderColor: colors.nbBorder, backgroundColor: colors.nbSurfaceChip || colors.nbBackground },
            ]}
          >
            <Text style={[styles.notesLabel, { color: colors.nbMuted }]}>NOTES</Text>
            <Text style={[styles.notesBody, { color: colors.nbInk }]}>{notes}</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <NbButton variant="plain" onPress={() => onMessage?.(session)} style={styles.half}>
            Message
          </NbButton>
          <NbButton variant="fill" onPress={() => onReschedule?.(session)} style={styles.half}>
            Reschedule
          </NbButton>
        </View>

        <NbButton variant="ghost" onPress={() => onDelete?.(session)}>
          Delete Session
        </NbButton>
      </View>
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
