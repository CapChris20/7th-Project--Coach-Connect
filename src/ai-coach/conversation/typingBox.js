// The text box at the bottom of the coach chat.
// Flow: hold the draft → paste or speech can add to it → a sheet opens when the clipboard is empty.
// Used by: the coach conversation composer.

import { useCallback, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';

// ===== NAMED CONSTANTS =====

// ===== HELPER FUNCTIONS =====

/**
 * True when the clipboard has something worth pasting. A read error counts as empty.
 * @returns {Promise<boolean>}
 */
export async function pasteHintForEmptyClipboard() {
  try {
    const clipboardText = await Clipboard.getStringAsync();
    return Boolean(String(clipboardText || '').trim());
  } catch (_) {
    return false;
  }
}

/**
 * Join pasted words onto the draft, with one space when the draft does not already end in whitespace.
 * @param {string} currentDraft
 * @param {string} addedText
 * @returns {string}
 */
function joinDraftAndPaste(currentDraft, addedText) {
  if (!currentDraft) return addedText;
  const needsSpace = !/\s$/.test(currentDraft) && !/^\s/.test(addedText);
  if (needsSpace) return `${currentDraft} ${addedText}`;
  return `${currentDraft}${addedText}`;
}

// ===== MAIN FUNCTION =====

/**
 * Hooks stay in this order: draft, paste sheet, input ref, then the callbacks.
 * @param {string} [initial]
 * @returns {object}
 */
export function typingBox(initial = '') {
  const [value, setValue] = useState(initial);
  const [pasteSheetVisible, setPasteSheetVisible] = useState(false);
  const inputRef = useRef(null);

  const onChangeText = useCallback((text) => setValue(text), []);
  const clear = useCallback(() => setValue(''), []);
  const commitText = useCallback((text) => {
    const addedText = String(text || '').trim();
    if (!addedText) return;
    setValue((currentDraft) => joinDraftAndPaste(String(currentDraft || ''), addedText));
    setPasteSheetVisible(false);
  }, []);

  const applySpeechTranscript = useCallback((text) => {
    setValue(String(text || ''));
  }, []);

  const openPasteSheet = useCallback(() => setPasteSheetVisible(true), []);
  const closePasteSheet = useCallback(() => setPasteSheetVisible(false), []);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync();
      const pastedText = String(clipboardText || '');
      if (!pastedText.trim()) {
        setPasteSheetVisible(true);
        return false;
      }
      commitText(pastedText);
      return true;
    } catch (_) {
      setPasteSheetVisible(true);
      return false;
    }
  }, [commitText]);

  return {
    value,
    onChangeText,
    setValue,
    clear,
    commitText,
    applySpeechTranscript,
    pasteFromClipboard,
    openPasteSheet,
    closePasteSheet,
    pasteSheetVisible,
    inputRef,
  };
}
