// Sheet for pasting coach-chat text (neobrutalist design).
// Flow: open → try clipboard prefill → focus field → confirm sends the draft, cancel just closes.
// Used by: CoachConversationScreen. Uses NbSheet and NbButton components.
//
// vocab: NbSheet = neobrutalist bottom sheet with thick border
// vocab: NbButton = neobrutalist button with hard shadow

import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { spacing, borderRadius, nb } from '../../look-and-feel/colorPalette';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';

// ===== NAMED CONSTANTS =====

// Manipulate here: delay before focusing so the slide animation finishes first.
const FOCUS_AFTER_OPEN_MS = 120;
const SHEET_TITLE = 'Paste text';
// Design Law PNG 11: full hint sentence + TEXT label + Cancel (not “Not now”).
const SHEET_HINT = 'Add a workout, a nutrition label or a message. The coach reads it with your question.';
const DRAFT_LABEL = 'TEXT';
const DRAFT_PLACEHOLDER = 'Paste your text…';
const CANCEL_LABEL = 'Cancel';
const CONFIRM_LABEL = 'Add to message';
// Manipulate here: hard cap so a huge clipboard dump cannot blow the composer
const PASTE_MAX_CHARS = 4000;

// ===== HELPER FUNCTIONS =====

/**
 * Empty or whitespace-only drafts cannot be added.
 * @param {string} draft
 * @returns {boolean}
 */
function hasPasteDraftText(draft) {
  if (!draft) return false;
  return Boolean(String(draft).trim());
}

/**
 * Soft-trim clipboard so we never prefill noise or overflow the field.
 * @param {string} raw
 * @returns {string}
 */
function clipboardPrefillText(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= PASTE_MAX_CHARS) return trimmed;
  return trimmed.slice(0, PASTE_MAX_CHARS);
}

function focusPasteField(inputRef) {
  const input = inputRef.current;
  if (!input) return;
  if (typeof input.focus !== 'function') return;
  input.focus();
}

function sendPastedDraft(onConfirm, draft) {
  if (!onConfirm) return;
  onConfirm(draft);
}

/**
 * Cancel + confirm row using NbButton components.
 * @param {{ canConfirmPaste: boolean, onClose: Function, onConfirmDraft: Function }} props
 */
function PasteSheetActions({ canConfirmPaste, onClose, onConfirmDraft }) {
  return (
    <View style={styles.actionsRow}>
      <View style={{ flex: 1 }}>
        <NbButton variant="ghost" onPress={onClose}>
          {CANCEL_LABEL}
        </NbButton>
      </View>
      <View style={{ flex: 1 }}>
        <NbButton
          variant="fill"
          onPress={onConfirmDraft}
          disabled={!canConfirmPaste}
        >
          {CONFIRM_LABEL}
        </NbButton>
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Dedicated paste surface using NbSheet — prefers clipboard prefill, then manual edit.
 * @param {{ visible: boolean, onClose: Function, onConfirm?: Function, t?: object, isDark?: boolean }} props
 */
export default function PasteTextPopup({ visible, onClose, onConfirm, t, isDark: isDarkProp }) {
  // Prefer app theme (Design Law light/dark), not the OS scheme alone.
  const { colors: themeColors, isDark: themeIsDark } = useTheme();
  const colors = themeColors;
  void isDarkProp;
  void themeIsDark;
  void t;
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      setDraft('');
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        // vocab: getStringAsync = Expo clipboard read (Simulator may still return empty)
        const fromClipboard = clipboardPrefillText(await Clipboard.getStringAsync());
        if (!cancelled && fromClipboard) setDraft(fromClipboard);
      } catch (_) {
        /* clipboard optional — user can still type */
      }
    })();

    const focusTimeoutId = setTimeout(() => focusPasteField(inputRef), FOCUS_AFTER_OPEN_MS);
    return () => {
      cancelled = true;
      clearTimeout(focusTimeoutId);
    };
  }, [visible]);

  const canConfirmPaste = hasPasteDraftText(draft);
  const overLimit = String(draft || '').length >= PASTE_MAX_CHARS;

  function handleConfirmPaste() {
    sendPastedDraft(onConfirm, draft);
  }

  return (
    <NbSheet
      visible={visible}
      onClose={onClose}
      title={SHEET_TITLE}
    >
      <Text
        style={[
          styles.sheetHint,
          { color: colors.nbMuted, fontFamily: 'Inter_400Regular' },
        ]}
      >
        {SHEET_HINT}
      </Text>
      <Text
        style={[
          styles.draftLabel,
          { color: colors.nbMuted, fontFamily: 'SpaceGrotesk_700Bold' },
        ]}
      >
        {DRAFT_LABEL}
      </Text>
      <TextInput
        ref={inputRef}
        value={draft}
        onChangeText={(next) => setDraft(String(next || '').slice(0, PASTE_MAX_CHARS))}
        multiline
        maxLength={PASTE_MAX_CHARS}
        placeholder={DRAFT_PLACEHOLDER}
        placeholderTextColor={colors.nbMuted}
        style={[
          styles.draftInput,
          {
            borderColor: colors.nbBorder,
            borderWidth: nb.borderWidth,
            color: colors.nbInk,
            backgroundColor: colors.nbSurface,
            shadowColor: colors.nbShadow,
            fontFamily: 'SpaceGrotesk_700Bold',
          },
        ]}
      />
      {overLimit ? (
        <Text style={[styles.limitHint, { color: colors.nbMuted }]}>
          Max {PASTE_MAX_CHARS.toLocaleString()} characters
        </Text>
      ) : null}
      <PasteSheetActions
        canConfirmPaste={canConfirmPaste}
        onClose={onClose}
        onConfirmDraft={handleConfirmPaste}
      />
    </NbSheet>
  );
}

const styles = StyleSheet.create({
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
    // Design Law: hard offset shadow on the TEXT field (same as meal food input)
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
