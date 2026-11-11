// Sheet for pasting coach-chat text (neobrutalist design).
// Flow: open → focus the field after a short delay → confirm sends the draft, cancel just closes.
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
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, spacing, borderRadius, nb } from '../../look-and-feel/colorPalette';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';

// ===== NAMED CONSTANTS =====

// Manipulate here: delay before focusing so the slide animation finishes first.
const FOCUS_AFTER_OPEN_MS = 120;
const SHEET_TITLE = 'Paste text';
const SHEET_HINT = 'Copy on your Mac, then paste here (⌘V).';
const DRAFT_PLACEHOLDER = 'Paste your message…';
const CANCEL_LABEL = 'Cancel';
const CONFIRM_LABEL = 'Add to message';

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
        <NbButton variant="plain" onPress={onClose}>
          {CANCEL_LABEL}
        </NbButton>
      </View>
      <View style={{ flex: 1 }}>
        <NbButton
          variant="brand"
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
 * Dedicated paste surface using NbSheet — avoids stale Simulator clipboard reads.
 * @param {{ visible: boolean, onClose: Function, onConfirm?: Function, t?: object, isDark?: boolean }} props
 */
export default function PasteTextPopup({ visible, onClose, onConfirm, t, isDark = true }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      setDraft('');
      return undefined;
    }
    const focusTimeoutId = setTimeout(() => focusPasteField(inputRef), FOCUS_AFTER_OPEN_MS);
    return () => clearTimeout(focusTimeoutId);
  }, [visible]);

  const canConfirmPaste = hasPasteDraftText(draft);

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
      <TextInput
        ref={inputRef}
        value={draft}
        onChangeText={setDraft}
        multiline
        placeholder={DRAFT_PLACEHOLDER}
        placeholderTextColor={colors.nbMuted}
        style={[
          styles.draftInput,
          {
            borderColor: colors.nbBorder,
            borderWidth: nb.borderWidth,
            color: colors.nbInk,
            backgroundColor: colors.nbSurface,
          },
        ]}
      />
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
  },
  draftInput: {
    minHeight: 100,
    maxHeight: 180,
    borderRadius: borderRadius.nbCard,
    padding: spacing.md,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginTop: spacing.md + 4,
  },
});
