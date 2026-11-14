// Design Law delete-chat confirm — “Cannot be undone” pill + Keep it / Delete chat.
// Flow: open with session title + count → Keep closes → Delete runs onConfirm then closes.
// Used by CoachConversationScreen and CoachHomeScreen (replaces Alert.alert).
// PNG: screens/ai-coach/15–16.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, spacing, nb } from '../../look-and-feel/colorPalette';
import { formatSessionDisplayTitle } from './chatHistoryList';

// ===== NAMED CONSTANTS =====

// Manipulate here: first accent gradient slot is the warn pill fill when theme provides it.
const WARN_GRADIENT_FALLBACK = ['#FB7185', '#EF4444'];
const WARN_GRADIENT = accentGradients[1] || WARN_GRADIENT_FALLBACK;

const KEEP_IT_LABEL = 'Keep it';
const DELETE_CHAT_LABEL = 'Delete chat';
const SHEET_TITLE = 'Delete chat?';
const CANNOT_BE_UNDONE_LABEL = 'Cannot be undone';
const EMPTY_COUNT_COPY = 'its messages';
const WARN_TEXT_COLOR = '#0A0A0A';

// ===== HELPER FUNCTIONS =====

function rawMessageCountFromSession(session) {
  if (!session) return 0;
  if (session.messageCount != null) return session.messageCount;
  if (session.messages && session.messages.length != null) return session.messages.length;
  return 0;
}

function messageCountLabel(session) {
  const rawCount = rawMessageCountFromSession(session);
  const messageCount = Number(rawCount);

  if (!Number.isFinite(messageCount)) return EMPTY_COUNT_COPY;
  if (messageCount <= 0) return EMPTY_COUNT_COPY;

  if (messageCount === 1) {
    return '1 message';
  }
  return `${messageCount} messages`;
}

function sessionTitleForBody(session) {
  if (!session) return formatSessionDisplayTitle(undefined);
  return formatSessionDisplayTitle(session.title);
}

function buildDeleteBodyCopy(session) {
  const title = sessionTitleForBody(session);
  const countCopy = messageCountLabel(session);
  return `“${title}” and ${countCopy} will be removed from this phone.`;
}

/**
 * User tapped Delete — run the parent's delete hook, then dismiss the sheet.
 * @param {object|null|undefined} session
 * @param {Function|undefined} onConfirm
 * @param {Function|undefined} onClose
 */
function confirmDeleteAndDismiss(session, onConfirm, onClose) {
  // 1. Parent removes the session from Firestore / local list.
  if (typeof onConfirm === 'function') onConfirm(session);
  // 2. Always close so the sheet does not linger over a stale row.
  if (typeof onClose === 'function') onClose();
}

// vocab: LinearGradient = expo helper that paints a left-to-right color strip inside the warn pill.
function CannotBeUndonePill({ borderColor }) {
  const pillBorder = { borderColor };
  const warnTextColor = { color: WARN_TEXT_COLOR };

  return (
    <View style={[styles.warnPill, pillBorder]}>
      <LinearGradient
        colors={WARN_GRADIENT}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={styles.warnFill}
      >
        <Text style={[styles.warnText, warnTextColor]}>{CANNOT_BE_UNDONE_LABEL}</Text>
      </LinearGradient>
    </View>
  );
}

function DeleteChatActions({ onClose, onConfirmPress }) {
  const actionSlot = { flex: 1 };

  return (
    <View style={styles.actions}>
      <View style={actionSlot}>
        <NbButton variant="ghost" onPress={onClose}>
          {KEEP_IT_LABEL}
        </NbButton>
      </View>
      <View style={actionSlot}>
        <NbButton variant="fill" onPress={onConfirmPress}>
          {DELETE_CHAT_LABEL}
        </NbButton>
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Confirm sheet before deleting a past coach chat.
 * Flow: 1. theme colors  2. body copy from session  3. Keep closes / Delete confirms then closes
 * @param {{ visible: boolean, session?: object|null, onClose: Function, onConfirm: Function }} props
 */
export default function DeleteChatSheet({ visible, session, onClose, onConfirm }) {
  // vocab: useTheme = Design Law light/dark palette hook (nbInk / nbMuted / nbBorder)
  const { colors } = useTheme();

  // 1. Body line: “Title” and N messages will be removed from this phone.
  const bodyCopy = buildDeleteBodyCopy(session);
  const titleColor = { color: colors.nbInk };
  const bodyColor = { color: colors.nbMuted };

  // 2. Delete — parent removes the session, then we always dismiss.
  function handleConfirmDelete() {
    confirmDeleteAndDismiss(session, onConfirm, onClose);
  }

  return (
    <NbSheet visible={visible} onClose={onClose}>
      <CannotBeUndonePill borderColor={colors.nbBorder} />

      <Text style={[styles.title, titleColor]}>{SHEET_TITLE}</Text>
      <Text style={[styles.body, bodyColor]}>{bodyCopy}</Text>

      <DeleteChatActions onClose={onClose} onConfirmPress={handleConfirmDelete} />
    </NbSheet>
  );
}

const styles = StyleSheet.create({
  warnPill: {
    alignSelf: 'flex-start',
    borderWidth: nb.borderWidthPill,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  warnFill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  warnText: {
    fontSize: 12,
    fontWeight: '900',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  body: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
