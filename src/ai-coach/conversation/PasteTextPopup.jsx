// Sheet for pasting coach-chat text when the simulator clipboard is stale.
// Flow: open → focus the field after a short delay → confirm sends the draft, cancel just closes.
// Used by: CoachConversationScreen. Callers pass the conversation theme as `t`.

import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ===== NAMED CONSTANTS =====

const PLATFORM_IOS = 'ios';
const IOS_KEYBOARD_BEHAVIOR = 'padding';
// Manipulate here: delay before focusing so the slide animation finishes first.
const FOCUS_AFTER_OPEN_MS = 120;
const SHEET_TITLE = 'Paste text';
const SHEET_HINT = 'Copy on your Mac, then paste here (⌘V).';
const DRAFT_PLACEHOLDER = 'Paste your message…';
const CANCEL_LABEL = 'Cancel';
const CONFIRM_LABEL = 'Add to message';
const DARK_TEXT_PRIMARY = '#FFFFFF';
const LIGHT_TEXT_PRIMARY = '#0A0A0F';
const DARK_TEXT_MUTED = 'rgba(255,255,255,0.45)';
const LIGHT_TEXT_MUTED = 'rgba(10,10,15,0.45)';
const DARK_BACKGROUND = '#141418';
const LIGHT_BACKGROUND = '#FFFFFF';
const DARK_BORDER = 'rgba(255,255,255,0.12)';
const LIGHT_BORDER = 'rgba(0,0,0,0.1)';
const SCRIM_COLOR = 'rgba(0,0,0,0.55)';
const DARK_INPUT_BACKGROUND = 'rgba(255,255,255,0.04)';
const LIGHT_INPUT_BACKGROUND = 'rgba(0,0,0,0.03)';
const CONFIRM_BUTTON_COLOR = '#FF6B9D';
const CONFIRM_LABEL_COLOR = '#FFFFFF';
const DISABLED_CONFIRM_OPACITY = 0.45;
const ENABLED_CONFIRM_OPACITY = 1;

// ===== HELPER FUNCTIONS =====

function readThemeField(theme, fieldName) {
  if (!theme) return undefined;
  return theme[fieldName];
}

function themeColorOrFallback(themeColor, isDark, darkColor, lightColor) {
  if (themeColor) return themeColor;
  if (isDark) return darkColor;
  return lightColor;
}

function backgroundForSheet(isDark) {
  if (isDark) return DARK_BACKGROUND;
  return LIGHT_BACKGROUND;
}

function borderForSheet(isDark) {
  if (isDark) return DARK_BORDER;
  return LIGHT_BORDER;
}

function inputBackgroundForSheet(isDark) {
  if (isDark) return DARK_INPUT_BACKGROUND;
  return LIGHT_INPUT_BACKGROUND;
}

/**
 * Theme colors for this sheet. `theme` is the parent `t` object; missing keys fall back by isDark.
 * @param {object} [theme]
 * @param {boolean} isDark
 * @returns {object}
 */
function pasteSheetColors(theme, isDark) {
  const textPrimaryFromTheme = readThemeField(theme, 'textPrimary');
  const textMutedFromTheme = readThemeField(theme, 'textMuted');

  return {
    textPrimary: themeColorOrFallback(textPrimaryFromTheme, isDark, DARK_TEXT_PRIMARY, LIGHT_TEXT_PRIMARY),
    textMuted: themeColorOrFallback(textMutedFromTheme, isDark, DARK_TEXT_MUTED, LIGHT_TEXT_MUTED),
    backgroundColor: backgroundForSheet(isDark),
    borderColor: borderForSheet(isDark),
    inputBackground: inputBackgroundForSheet(isDark),
  };
}

/**
 * Empty or whitespace-only drafts cannot be added.
 * @param {string} draft
 * @returns {boolean}
 */
function hasPasteDraftText(draft) {
  if (!draft) return false;
  return Boolean(String(draft).trim());
}

function confirmButtonOpacity(canConfirmPaste) {
  if (canConfirmPaste) return ENABLED_CONFIRM_OPACITY;
  return DISABLED_CONFIRM_OPACITY;
}

function keyboardAvoidBehaviorForPlatform() {
  if (Platform.OS === PLATFORM_IOS) return IOS_KEYBOARD_BEHAVIOR;
  return undefined;
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
 * Cancel + confirm row at the bottom of the paste sheet.
 * @param {{ sheetColors: object, canConfirmPaste: boolean, onClose: Function, onConfirmDraft: Function }} props
 */
function PasteSheetActions({ sheetColors, canConfirmPaste, onClose, onConfirmDraft }) {
  const confirmOpacity = confirmButtonOpacity(canConfirmPaste);

  return (
    <View style={styles.actionsRow}>
      <TouchableOpacity
        onPress={onClose}
        style={[styles.cancelButton, { borderColor: sheetColors.borderColor }]}
      >
        <Text style={[styles.cancelLabel, { color: sheetColors.textPrimary }]}>{CANCEL_LABEL}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onConfirmDraft}
        disabled={!canConfirmPaste}
        style={[styles.confirmButton, { opacity: confirmOpacity }]}
      >
        <Text style={styles.confirmLabel}>{CONFIRM_LABEL}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Dedicated paste surface — avoids stale Simulator clipboard reads.
 * @param {{ visible: boolean, onClose: Function, onConfirm?: Function, t?: object, isDark?: boolean }} props
 */
export default function PasteTextPopup({ visible, onClose, onConfirm, t, isDark = true }) {
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

  const theme = t;
  const sheetColors = pasteSheetColors(theme, isDark);
  const canConfirmPaste = hasPasteDraftText(draft);
  const keyboardAvoidBehavior = keyboardAvoidBehaviorForPlatform();

  function handleConfirmPaste() {
    sendPastedDraft(onConfirm, draft);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={keyboardAvoidBehavior}
        style={[
          styles.sheet,
          {
            backgroundColor: sheetColors.backgroundColor,
            borderColor: sheetColors.borderColor,
          },
        ]}
      >
        <Text style={[styles.sheetTitle, { color: sheetColors.textPrimary }]}>{SHEET_TITLE}</Text>
        <Text style={[styles.sheetHint, { color: sheetColors.textMuted }]}>
          {SHEET_HINT}
        </Text>
        <TextInput
          ref={inputRef}
          value={draft}
          onChangeText={setDraft}
          multiline
          placeholder={DRAFT_PLACEHOLDER}
          placeholderTextColor={sheetColors.textMuted}
          style={[
            styles.draftInput,
            {
              borderColor: sheetColors.borderColor,
              color: sheetColors.textPrimary,
              backgroundColor: sheetColors.inputBackground,
            },
          ]}
        />
        <PasteSheetActions
          sheetColors={sheetColors}
          canConfirmPaste={canConfirmPaste}
          onClose={onClose}
          onConfirmDraft={handleConfirmPaste}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: SCRIM_COLOR,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderTopWidth: 1,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 6,
  },
  sheetHint: {
    fontSize: 13,
    marginBottom: 14,
  },
  draftInput: {
    minHeight: 100,
    maxHeight: 180,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelLabel: {
    fontWeight: '700',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: CONFIRM_BUTTON_COLOR,
    alignItems: 'center',
  },
  confirmLabel: {
    color: CONFIRM_LABEL_COLOR,
    fontWeight: '800',
  },
});
