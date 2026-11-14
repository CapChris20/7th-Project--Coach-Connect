// Draft state for the coach chat composer (text, paste sheet, speech fill-in).
// Flow: useState draft → clipboard paste merges in → empty clipboard opens paste sheet.
// Used by the coach conversation screen composer.

import { useCallback, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';

// ===== NAMED CONSTANTS =====

// ===== MAIN FUNCTION =====

/**
 * Composer hook — hook call order must stay: value, paste sheet, ref, then callbacks.
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
    const trimmedAddition = String(text || '').trim();
    if (!trimmedAddition) return;
    setValue((previousDraft) => mergedDraftText(previousDraft, trimmedAddition));
    setPasteSheetVisible(false);
  }, []);

  const applySpeechTranscript = useCallback((text) => {
    setValue(String(text || ''));
  }, []);

  const openPasteSheet = useCallback(() => setPasteSheetVisible(true), []);
  const closePasteSheet = useCallback(() => setPasteSheetVisible(false), []);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const rawClipboard = await Clipboard.getStringAsync();
      const clipboardText = String(rawClipboard || '');
      if (!clipboardText.trim()) {
        setPasteSheetVisible(true);
        return false;
      }
      commitText(clipboardText);
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

/**
 * True when the clipboard has pasteable text (for empty-draft UX hints).
 * @returns {Promise<boolean>}
 */
export async function pasteHintForEmptyClipboard() {
  return clipboardHasNonEmptyText();
}

// ===== HELPER FUNCTIONS =====

function mergedDraftText(draftBeforePaste, pastedChunk) {
  const draft = String(draftBeforePaste || '');
  const chunk = String(pastedChunk || '');
  if (!draft) return chunk;
  const draftEndsWithSpace = /\s$/.test(draft);
  const chunkStartsWithSpace = /^\s/.test(chunk);
  if (draftEndsWithSpace || chunkStartsWithSpace) return `${draft}${chunk}`;
  return `${draft} ${chunk}`;
}

async function clipboardHasNonEmptyText() {
  try {
    const rawClipboard = await Clipboard.getStringAsync();
    return Boolean(String(rawClipboard || '').trim());
  } catch (_) {
    return false;
  }
}
