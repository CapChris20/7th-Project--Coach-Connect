// Design Law trainer AI reply — quiet clients list + Ready-to-send draft Review (19/20).
// Flow: parse AI text for quiet-client cues → show rows + Edit/Review draft card.
// Used under CoachConversationScreen AI bubbles when viewerRole is trainer.
// Review reuses the same ConfirmActionPopup path as ToolActionChip (Needs your OK).

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { accentGradients, borderRadius, lightColors, nb, spacing } from '../../look-and-feel/colorPalette';
import NbButton from '../../look-and-feel/NbButton';
import NbAvatar from '../../look-and-feel/NbAvatar';

// ===== NAMED CONSTANTS =====

// Manipulate here: demo rows when the reply mentions quiet clients but has no structured list
const FALLBACK_CLIENTS = [
  { id: 'maya', name: 'Maya Chen', initials: 'MC', detail: 'No log in 3 days', action: 'Check in', tone: 'check' },
  { id: 'sam', name: 'Sam Ortiz', initials: 'SO', detail: 'No log in 4 days', action: 'Check in', tone: 'check' },
  { id: 'dev', name: 'Dev Patel', initials: 'DP', detail: 'Sleep averaging 5.4 h', action: 'Watch', tone: 'watch' },
];

const FALLBACK_DRAFT =
  'Message Maya and Sam: "Hey, how is this week going? Want to log a quick check-in?"';

const QUIET_CUE =
  /gone quiet|not logged|haven'?t logged|have not logged|check in on|quiet clients/i;

// ===== HELPERS =====

/**
 * True when this AI reply should show the trainer quiet-clients card.
 * @param {string} text
 * @param {string} [userMessage]
 */
export function shouldShowTrainerQuietClientsCard(text, userMessage = '') {
  const blob = `${text || ''} ${userMessage || ''}`;
  return QUIET_CUE.test(blob);
}

function initialsFromName(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
}

/**
 * Best-effort extract of "Name — detail" lines from freeform coach text.
 * Falls back to the PNG demo roster when nothing structured is found.
 * @param {string} text
 */
function clientsFromReplyText(text) {
  const lines = String(text || '')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const found = [];
  for (const line of lines) {
    // e.g. "Maya Chen — No log in 3 days" or "• Sam Ortiz: No log in 4 days"
    const m = line.match(
      /^(?:[-•*]?\s*)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*[—\-–:]\s*(.+)$/,
    );
    if (!m) continue;
    const name = m[1].trim();
    const detail = m[2].trim();
    const watch = /sleep|watch/i.test(detail);
    found.push({
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      initials: initialsFromName(name),
      detail,
      action: watch ? 'Watch' : 'Check in',
      tone: watch ? 'watch' : 'check',
    });
  }
  return found.length ? found : FALLBACK_CLIENTS;
}

function draftFromReplyText(text) {
  const quoted = String(text || '').match(/["“]([^"”]{12,})["”]/);
  if (quoted?.[1]) {
    return `Message clients: "${quoted[1].trim()}"`;
  }
  return FALLBACK_DRAFT;
}

// ===== UI PIECES =====

function ClientRow({ row, colors, isLast, onAction }) {
  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.nbBorder },
      ]}
    >
      <NbAvatar initials={row.initials} size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowName, { color: colors.nbInk }]} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={[styles.rowDetail, { color: colors.nbMuted }]} numberOfLines={1}>
          {row.detail}
        </Text>
      </View>
      <NbButton variant="ghost" sm onPress={() => onAction?.(row)}>
        {row.action}
      </NbButton>
    </View>
  );
}

// ===== MAIN =====

/**
 * @param {{
 *   messageText?: string,
 *   userMessage?: string,
 *   palette?: object,
 *   onReview?: Function,
 *   onEdit?: Function,
 *   onClientAction?: Function,
 * }} props
 */
export default function TrainerQuietClientsCard({
  messageText = '',
  userMessage = '',
  palette,
  onReview,
  onEdit,
  onClientAction,
}) {
  // palette from CoachConversationScreen uses textPrimary / cardBg aliases — map to nb tokens
  const colors = useMemo(
    () => ({
      nbInk: palette?.textPrimary || lightColors.nbInk,
      nbMuted: palette?.textSecondary || lightColors.nbMuted,
      nbBorder: palette?.cardBorder || lightColors.nbBorder,
      nbSurface: palette?.cardBg || lightColors.nbSurface,
      nbShadow: palette?.shadow || lightColors.nbShadow,
      nbFill: lightColors.nbFill,
      nbOnFill: lightColors.nbOnFill,
      nbBackground: palette?.bg || lightColors.nbBackground,
    }),
    [palette],
  );

  const clients = useMemo(() => clientsFromReplyText(messageText), [messageText]);
  const draft = useMemo(() => draftFromReplyText(messageText), [messageText]);

  if (!shouldShowTrainerQuietClientsCard(messageText, userMessage)) return null;

  return (
    <View style={{ marginTop: 12, gap: 12 }}>
      <View
        style={[
          styles.listCard,
          {
            backgroundColor: colors.nbSurface,
            borderColor: colors.nbBorder,
            shadowColor: colors.nbShadow,
          },
        ]}
      >
        {clients.map((row, index) => (
          <ClientRow
            key={row.id}
            row={row}
            colors={colors}
            isLast={index === clients.length - 1}
            onAction={onClientAction}
          />
        ))}
      </View>

      <View
        style={[
          styles.draftCard,
          {
            backgroundColor: colors.nbSurface,
            borderColor: colors.nbBorder,
            shadowColor: colors.nbShadow,
          },
        ]}
      >
        <View style={styles.draftHead}>
          <LinearGradient
            colors={accentGradients[0]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.readyPill, { borderColor: colors.nbBorder }]}
          >
            <Text style={[styles.readyText, { color: lightColors.nbInk }]}>Ready to send</Text>
          </LinearGradient>
          <Text style={[styles.needsOk, { color: colors.nbMuted }]}>Needs your OK</Text>
        </View>
        <Text style={[styles.draftBody, { color: colors.nbInk }]}>{draft}</Text>
        <View style={styles.draftActions}>
          <View style={{ flex: 1 }}>
            <NbButton variant="ghost" sm onPress={() => onEdit?.(draft, clients)}>
              Edit
            </NbButton>
          </View>
          <View style={{ flex: 1 }}>
            <NbButton variant="fill" sm onPress={() => onReview?.(draft, clients)}>
              Review
            </NbButton>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    overflow: 'hidden',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rowName: { fontSize: 15, fontWeight: '900' },
  rowDetail: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  draftCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  draftHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  readyPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 2,
  },
  readyText: { fontSize: 11, fontWeight: '900' },
  needsOk: { fontSize: 13, fontWeight: '600' },
  draftBody: { fontSize: 15, fontWeight: '800', lineHeight: 21, marginBottom: 12 },
  draftActions: { flexDirection: 'row', gap: 10 },
});
