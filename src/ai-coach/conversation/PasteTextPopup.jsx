// Bottom sheet where the coach-chat user pastes workout notes, labels, or messages.
// Flow: sheet opens → read clipboard when possible → focus the TEXT field → Add sends draft, Cancel closes.
// Used by CoachConversationScreen / CoachHomeScreen. Chrome: NbSheet + NbButton (Design Law paste PNG 11).

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { spacing, borderRadius, nb } from '../../look-and-feel/colorPalette';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';

// ===== NAMED CONSTANTS =====

// Manipulate here: wait for slide-in before focus so the keyboard does not fight the animation.
const FOCUS_AFTER_OPEN_MS = 120;
const SHEET_TITLE = 'Paste text';
// Design Law PNG 11: full hint, TEXT label, Cancel (not “Not now”).
const SHEET_HINT =
  'Add a workout, a nutrition label or a message. The coach reads it with your question.';
const DRAFT_LABEL = 'TEXT';
const DRAFT_PLACEHOLDER = 'Paste your text…';
const CANCEL_LABEL = 'Cancel';
const CONFIRM_LABEL = 'Add to message';
// Manipulate here: cap pasted length so a huge clipboard dump cannot blow the composer.
const PASTE_MAX_CHARS = 4000;

// ===== HELPER FUNCTIONS =====

function pasteDraftHasVisibleText(draftText) {
  const asString = String(draftText || '');
  if (!asString) return false;
  const trimmedText = asString.trim();
  if (!trimmedText) return false;
  return true;
}

function clipboardTextTrimmedAndCapped(rawClipboard) {
  const trimmed = String(rawClipboard || '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= PASTE_MAX_CHARS) return trimmed;
  return trimmed.slice(0, PASTE_MAX_CHARS);
}

function keepDraftUnderMaxLength(nextText) {
  const asString = String(nextText || '');
  return asString.slice(0, PASTE_MAX_CHARS);
}

function focusTextInputWhenReady(inputRef) {
  const field = inputRef.current;
  if (!field) return;
  if (typeof field.focus !== 'function') return;
  field.focus();
}

async function readClipboardPrefillForSheet() {
  try {
    // vocab: getStringAsync = Expo read of the system pasteboard (may be empty on Simulator).
    const clipboardRaw = await Clipboard.getStringAsync();
    return clipboardTextTrimmedAndCapped(clipboardRaw);
  } catch (clipboardUnavailable) {
    void clipboardUnavailable;
    return '';
  }
}

async function applyClipboardPrefillIfStillOpen(effectCancelled, setDraft) {
  const prefillFromClipboard = await readClipboardPrefillForSheet();
  if (effectCancelled()) return;
  if (!prefillFromClipboard) return;
  setDraft(prefillFromClipboard);
}

function PasteSheetFooter({ canConfirmPaste, onClose, onConfirmDraft }) {
  return (
    <View style={styles.actionsRow}>
      <View style={styles.actionFlex}>
        <NbButton variant="ghost" onPress={onClose}>
          {CANCEL_LABEL}
        </NbButton>
      </View>
      <View style={styles.actionFlex}>
        <NbButton variant="fill" onPress={onConfirmDraft} disabled={!canConfirmPaste}>
          {CONFIRM_LABEL}
        </NbButton>
      </View>
    </View>
  );
}

function characterCapHintOrNull(draftAtCharacterCap, hintColor) {
  if (!draftAtCharacterCap) return null;
  return (
    <Text style={[styles.limitHint, { color: hintColor }]}>
      Max {PASTE_MAX_CHARS.toLocaleString()} characters
    </Text>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Paste-text NbSheet for coach chat — clipboard prefill, capped draft, Add / Cancel.
 * Hook order frozen: useTheme → useState → useRef → useEffect.
 */
export default function PasteTextPopup({
  visible,
  onClose,
  onConfirm,
  t: unusedTranslations,
  isDark: isDarkProp,
}) {
  // 1. Theme colors for ink, border, and shadow.
  // vocab: useTheme = app light/dark palette provider
  const { colors: themeColors, isDark: themeIsDark } = useTheme();
  const colors = themeColors;
  void isDarkProp;
  void themeIsDark;
  void unusedTranslations;

  // vocab: useState = React local state; draft is what the TEXT field shows
  const [draft, setDraft] = useState('');
  // vocab: useRef = stable box for the TextInput instance so we can .focus() after open
  const inputRef = useRef(null);

  // 2. On open: clipboard prefill + delayed focus. On close: clear draft.
  useEffect(() => {
    if (!visible) {
      setDraft('');
      return undefined;
    }

    let effectWasCancelled = false;
    function effectCancelled() {
      return effectWasCancelled;
    }

    applyClipboardPrefillIfStillOpen(effectCancelled, setDraft);

    const focusTimerId = setTimeout(() => {
      focusTextInputWhenReady(inputRef);
    }, FOCUS_AFTER_OPEN_MS);

    return () => {
      effectWasCancelled = true;
      clearTimeout(focusTimerId);
    };
  }, [visible]);

  // 3. Name decisions before JSX.
  const userCanConfirm = pasteDraftHasVisibleText(draft);
  const draftLength = String(draft || '').length;
  const draftAtCharacterCap = draftLength >= PASTE_MAX_CHARS;

  const hintColor = colors.nbMuted;
  const hintFont = 'Inter_400Regular';
  const labelFont = 'SpaceGrotesk_700Bold';
  const fieldBorderColor = colors.nbBorder;
  const fieldTextColor = colors.nbInk;
  const fieldBackgroundColor = colors.nbSurface;
  const fieldShadowColor = colors.nbShadow;
  const characterCapHint = characterCapHintOrNull(draftAtCharacterCap, hintColor);

  function handleDraftTextChange(nextValue) {
    setDraft(keepDraftUnderMaxLength(nextValue));
  }

  function handleConfirmPressed() {
    if (!onConfirm) return;
    onConfirm(draft);
  }

  return (
    <NbSheet visible={visible} onClose={onClose} title={SHEET_TITLE}>
      <Text style={[styles.sheetHint, { color: hintColor, fontFamily: hintFont }]}>{SHEET_HINT}</Text>
      <Text style={[styles.draftLabel, { color: hintColor, fontFamily: labelFont }]}>{DRAFT_LABEL}</Text>
      <TextInput
        ref={inputRef}
        value={draft}
        onChangeText={handleDraftTextChange}
        multiline
        maxLength={PASTE_MAX_CHARS}
        placeholder={DRAFT_PLACEHOLDER}
        placeholderTextColor={hintColor}
        style={[
          styles.draftInput,
          {
            borderColor: fieldBorderColor,
            borderWidth: nb.borderWidth,
            color: fieldTextColor,
            backgroundColor: fieldBackgroundColor,
            shadowColor: fieldShadowColor,
            fontFamily: labelFont,
          },
        ]}
      />
      {characterCapHint}
      <PasteSheetFooter
        canConfirmPaste={userCanConfirm}
        onClose={onClose}
        onConfirmDraft={handleConfirmPressed}
      />
    </NbSheet>
  );
}

// ===== PLUMBING — skip unless debugging layout tokens below =====

const styles = StyleSheet.create({
  actionFlex: { flex: 1 },
  sheetHint: {
    fontSize: 13,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  draftLabel: {
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  draftInput: {
    minHeight: 100,
    maxHeight: 180,
    borderRadius: borderRadius.nbCard,
    padding: spacing.md,
    fontSize: 15,
    // Design Law: hard offset shadow on the TEXT field (same as meal food input).
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  limitHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginTop: spacing.md + 4,
  },
});
