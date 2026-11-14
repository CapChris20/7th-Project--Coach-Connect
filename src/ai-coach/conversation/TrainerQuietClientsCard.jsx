// Trainer-only AI reply card — quiet client rows plus a ready-to-send draft (Design Law 19/20).
// Flow: cue check → parse names from prose (or demo roster) → Edit / Review via parent callbacks.
// Used under CoachConversationScreen when viewerRole is trainer. Review uses ConfirmActionPopup like ToolActionChip.

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { accentGradients, borderRadius, lightColors, nb } from '../../look-and-feel/colorPalette';
import NbButton from '../../look-and-feel/NbButton';
import NbAvatar from '../../look-and-feel/NbAvatar';

// ===== NAMED CONSTANTS =====

// Manipulate here: fallback roster when the model mentions quiet clients but lists no structured lines.
const DEMO_QUIET_CLIENTS = [
  { id: 'maya', name: 'Maya Chen', initials: 'MC', detail: 'No log in 3 days', action: 'Check in', tone: 'check' },
  { id: 'sam', name: 'Sam Ortiz', initials: 'SO', detail: 'No log in 4 days', action: 'Check in', tone: 'check' },
  { id: 'dev', name: 'Dev Patel', initials: 'DP', detail: 'Sleep averaging 5.4 h', action: 'Watch', tone: 'watch' },
];

const DEMO_READY_TO_SEND_DRAFT =
  'Message Maya and Sam: "Hey, how is this week going? Want to log a quick check-in?"';

// Matches coach or trainer prose that means “show the quiet-client brief.”
const QUIET_CLIENT_CUE_PATTERN =
  /gone quiet|not logged|haven'?t logged|have not logged|check in on|quiet clients/i;

// e.g. "Maya Chen — No log in 3 days" or "• Sam Ortiz: No log in 4 days"
const NAME_AND_DETAIL_LINE_PATTERN =
  /^(?:[-•*]?\s*)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*[—\-–:]\s*(.+)$/;

const QUOTED_MESSAGE_PATTERN = /["“]([^"”]{12,})["”]/;
const WATCH_TONE_PATTERN = /sleep|watch/i;

const ACTION_LABEL_WATCH = 'Watch';
const ACTION_LABEL_CHECK_IN = 'Check in';
const TONE_WATCH = 'watch';
const TONE_CHECK = 'check';
const UNKNOWN_INITIALS = '?';
const SINGLE_NAME_INITIAL_CHARS = 2;
const AVATAR_SIZE = 40;
const READY_PILL_LABEL = 'Ready to send';
const NEEDS_OK_LABEL = 'Needs your OK';
const EDIT_BUTTON_LABEL = 'Edit';
const REVIEW_BUTTON_LABEL = 'Review';

// ===== HELPER FUNCTIONS =====

/**
 * “Maya Chen” → “MC”. Single-token names take the first two letters.
 * @param {string} displayName
 * @returns {string}
 */
function initialsForDisplayName(displayName) {
  const trimmedName = String(displayName || '').trim();
  const nameParts = nonEmptyNameParts(trimmedName);

  if (!nameParts.length) return UNKNOWN_INITIALS;

  if (nameParts.length === 1) {
    return nameParts[0].slice(0, SINGLE_NAME_INITIAL_CHARS).toUpperCase();
  }

  const firstInitial = nameParts[0][0] || '';
  const secondInitial = nameParts[1][0] || '';
  return `${firstInitial}${secondInitial}`.toUpperCase();
}

function nonEmptyNameParts(trimmedName) {
  const splitParts = trimmedName.split(/\s+/);
  const nameParts = [];
  for (let index = 0; index < splitParts.length; index += 1) {
    const part = splitParts[index];
    if (!part) continue;
    nameParts.push(part);
  }
  return nameParts;
}

/**
 * One quiet-client row object. Sleep / “watch” detail → Watch tone; else Check in.
 * @param {string} clientName
 * @param {string} statusDetail
 */
function buildQuietClientRow(clientName, statusDetail) {
  const isWatchTone = WATCH_TONE_PATTERN.test(statusDetail);

  let rowActionLabel = ACTION_LABEL_CHECK_IN;
  let rowToneKey = TONE_CHECK;
  if (isWatchTone) {
    rowActionLabel = ACTION_LABEL_WATCH;
    rowToneKey = TONE_WATCH;
  }

  const rowId = clientName.toLowerCase().replace(/\s+/g, '-');

  return {
    id: rowId,
    name: clientName,
    initials: initialsForDisplayName(clientName),
    detail: statusDetail,
    action: rowActionLabel,
    tone: rowToneKey,
  };
}

function nonEmptyLinesFromCoachText(coachReplyText) {
  const rawText = String(coachReplyText || '');
  const splitLines = rawText.split(/\n+/);
  const lines = [];
  for (let index = 0; index < splitLines.length; index += 1) {
    const trimmedLine = splitLines[index].trim();
    if (!trimmedLine) continue;
    lines.push(trimmedLine);
  }
  return lines;
}

/**
 * Pull structured quiet-client lines from coach prose; fall back to DEMO_QUIET_CLIENTS.
 * Row keys stay id / name / initials / detail / action / tone (parent + confirm popup read them).
 * @param {string} coachReplyText
 * @returns {Array<{id: string, name: string, initials: string, detail: string, action: string, tone: string}>}
 */
function parseQuietClientRowsFromCoachText(coachReplyText) {
  const lines = nonEmptyLinesFromCoachText(coachReplyText);
  const parsedRows = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const nameAndDetail = line.match(NAME_AND_DETAIL_LINE_PATTERN);
    if (!nameAndDetail) continue;

    const clientName = nameAndDetail[1].trim();
    const statusDetail = nameAndDetail[2].trim();
    const row = buildQuietClientRow(clientName, statusDetail);
    parsedRows.push(row);
  }

  if (parsedRows.length) return parsedRows;
  return DEMO_QUIET_CLIENTS;
}

/**
 * Prefer a quoted message inside the coach reply; otherwise the demo draft.
 * @param {string} coachReplyText
 * @returns {string}
 */
function readyToSendDraftFromCoachText(coachReplyText) {
  const quotedMessage = String(coachReplyText || '').match(QUOTED_MESSAGE_PATTERN);
  if (!quotedMessage) return DEMO_READY_TO_SEND_DRAFT;

  const quotedBody = quotedMessage[1];
  if (!quotedBody) return DEMO_READY_TO_SEND_DRAFT;

  return `Message clients: "${quotedBody.trim()}"`;
}

/**
 * Map CoachConversationScreen palette aliases onto Nb token names used in this card.
 * @param {object|undefined} paletteFromScreen
 */
function mapScreenPaletteToNbColors(paletteFromScreen) {
  let inkColor = lightColors.nbInk;
  let mutedColor = lightColors.nbMuted;
  let borderColor = lightColors.nbBorder;
  let surfaceColor = lightColors.nbSurface;
  let shadowColor = lightColors.nbShadow;
  let backgroundColor = lightColors.nbBackground;

  if (paletteFromScreen) {
    if (paletteFromScreen.textPrimary) inkColor = paletteFromScreen.textPrimary;
    if (paletteFromScreen.textSecondary) mutedColor = paletteFromScreen.textSecondary;
    if (paletteFromScreen.cardBorder) borderColor = paletteFromScreen.cardBorder;
    if (paletteFromScreen.cardBg) surfaceColor = paletteFromScreen.cardBg;
    if (paletteFromScreen.shadow) shadowColor = paletteFromScreen.shadow;
    if (paletteFromScreen.bg) backgroundColor = paletteFromScreen.bg;
  }

  return {
    nbInk: inkColor,
    nbMuted: mutedColor,
    nbBorder: borderColor,
    nbSurface: surfaceColor,
    nbShadow: shadowColor,
    nbFill: lightColors.nbFill,
    nbOnFill: lightColors.nbOnFill,
    nbBackground: backgroundColor,
  };
}

function QuietClientRow({ row, colors, isLastRow, onClientAction }) {
  let dividerStyle = null;
  if (!isLastRow) {
    dividerStyle = {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.nbBorder,
    };
  }

  const nameColor = { color: colors.nbInk };
  const detailColor = { color: colors.nbMuted };

  function handleActionPress() {
    if (!onClientAction) return;
    onClientAction(row);
  }

  return (
    <View style={[styles.row, dividerStyle]}>
      <NbAvatar initials={row.initials} size={AVATAR_SIZE} />
      <View style={styles.rowTextColumn}>
        <Text style={[styles.rowName, nameColor]} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={[styles.rowDetail, detailColor]} numberOfLines={1}>
          {row.detail}
        </Text>
      </View>
      <NbButton variant="ghost" sm onPress={handleActionPress}>
        {row.action}
      </NbButton>
    </View>
  );
}

function buildQuietClientRowViews(clientRows, colors, onClientAction) {
  const quietClientRowViews = [];
  for (let rowIndex = 0; rowIndex < clientRows.length; rowIndex += 1) {
    const row = clientRows[rowIndex];
    const isLastRow = rowIndex === clientRows.length - 1;
    quietClientRowViews.push(
      <QuietClientRow
        key={row.id}
        row={row}
        colors={colors}
        isLastRow={isLastRow}
        onClientAction={onClientAction}
      />,
    );
  }
  return quietClientRowViews;
}

// ===== MAIN FUNCTION =====

/**
 * Gate: only render when the coach reply (or the trainer’s question) sounds like a quiet-client brief.
 * @param {string} coachReplyText
 * @param {string} [trainerQuestionText]
 * @returns {boolean}
 */
export function shouldShowTrainerQuietClientsCard(coachReplyText, trainerQuestionText = '') {
  // 1. Join both sides so either “quiet clients” or “haven’t logged” can open the card.
  const combinedText = `${coachReplyText || ''} ${trainerQuestionText || ''}`;

  // 2. Cue regex — tweak QUIET_CLIENT_CUE_PATTERN if the model invents new phrasing.
  return QUIET_CLIENT_CUE_PATTERN.test(combinedText);
}

/**
 * Quiet-client list + ready-to-send draft under a coach bubble (trainer role only).
 * Flow: 1. map palette  2. parse rows + draft  3. hide if no cue  4. Edit / Review
 * @param {{ messageText?: string, userMessage?: string, palette?: object, onReview?: Function, onEdit?: Function, onClientAction?: Function }} props
 */
export default function TrainerQuietClientsCard({
  messageText = '',
  userMessage = '',
  palette,
  onReview,
  onEdit,
  onClientAction,
}) {
  // vocab: useMemo = React hook that recomputes only when its dependency changes
  const colors = useMemo(() => mapScreenPaletteToNbColors(palette), [palette]);
  const clientRows = useMemo(() => parseQuietClientRowsFromCoachText(messageText), [messageText]);
  const outboundDraft = useMemo(() => readyToSendDraftFromCoachText(messageText), [messageText]);

  if (!shouldShowTrainerQuietClientsCard(messageText, userMessage)) return null;

  const listSurfaceColor = colors.nbSurface;
  const listBorderColor = colors.nbBorder;
  const listShadowColor = colors.nbShadow;
  const listCardChrome = {
    backgroundColor: listSurfaceColor,
    borderColor: listBorderColor,
    shadowColor: listShadowColor,
  };
  const draftCardChrome = {
    backgroundColor: listSurfaceColor,
    borderColor: listBorderColor,
    shadowColor: listShadowColor,
  };
  const readyPillBorder = { borderColor: listBorderColor };
  const readyLabelColor = { color: lightColors.nbInk };
  const needsOkColor = { color: colors.nbMuted };
  const draftBodyColor = { color: colors.nbInk };

  // 1. Edit — parent opens the draft editor with this text + the quiet rows.
  function handleEditDraft() {
    if (!onEdit) return;
    onEdit(outboundDraft, clientRows);
  }

  // 2. Review — parent opens ConfirmActionPopup (same path as ToolActionChip).
  function handleReviewDraft() {
    if (!onReview) return;
    onReview(outboundDraft, clientRows);
  }

  // 3. One QuietClientRow per parsed (or demo) client.
  const quietClientRowViews = buildQuietClientRowViews(clientRows, colors, onClientAction);

  return (
    <View style={styles.outerStack}>
      <View style={[styles.listCard, listCardChrome]}>{quietClientRowViews}</View>

      <View style={[styles.draftCard, draftCardChrome]}>
        <View style={styles.draftHead}>
          <LinearGradient
            colors={accentGradients[0]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.readyPill, readyPillBorder]}
          >
            <Text style={[styles.readyText, readyLabelColor]}>{READY_PILL_LABEL}</Text>
          </LinearGradient>
          <Text style={[styles.needsOk, needsOkColor]}>{NEEDS_OK_LABEL}</Text>
        </View>
        <Text style={[styles.draftBody, draftBodyColor]}>{outboundDraft}</Text>
        <View style={styles.draftActions}>
          <View style={styles.draftActionFlex}>
            <NbButton variant="ghost" sm onPress={handleEditDraft}>
              {EDIT_BUTTON_LABEL}
            </NbButton>
          </View>
          <View style={styles.draftActionFlex}>
            <NbButton variant="fill" sm onPress={handleReviewDraft}>
              {REVIEW_BUTTON_LABEL}
            </NbButton>
          </View>
        </View>
      </View>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  outerStack: { marginTop: 12, gap: 12 },
  rowTextColumn: { flex: 1, minWidth: 0 },
  draftActionFlex: { flex: 1 },
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
