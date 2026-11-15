// Coach chat composer draft — text field, clipboard paste, speech transcript fill-in.
// Flow: useState holds draft → paste merges or opens sheet → speech replaces whole draft.
// Used by CoachConversationScreen composer. Hook call order is frozen (value → sheet → ref → callbacks).

import { useCallback, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';

// ===== NAMED CONSTANTS =====

const DEFAULT_INITIAL_TEXT = '';

// ===== HELPER FUNCTIONS =====

/**
 * Merge a pasted chunk into the draft and close the paste sheet.
 * @param {string} incomingText
 * @param {Function} setValue
 * @param {Function} setPasteSheetVisible
 */
function applyPastedChunkToDraft(incomingText, setValue, setPasteSheetVisible) {
  const trimmedAddition = String(incomingText || '').trim();
  if (!trimmedAddition) {
    return;
  }

  setValue((draftBeforePaste) => joinDraftWithPastedChunk(draftBeforePaste, trimmedAddition));
  setPasteSheetVisible(false);
}

/**
 * Replace the whole draft with speech recognition text.
 * @param {string} spokenText
 * @param {Function} setValue
 */
function replaceDraftWithSpeechText(spokenText, setValue) {
  setValue(String(spokenText || ''));
}

/**
 * Join existing draft with pasted text; insert one space only when neither side already has whitespace.
 * Manipulate here: the single space between draft and chunk is the paste join rule.
 * @param {string} draftBeforePaste
 * @param {string} pastedChunk
 * @returns {string}
 */
function joinDraftWithPastedChunk(draftBeforePaste, pastedChunk) {
  const draftText = String(draftBeforePaste || '');
  const chunkText = String(pastedChunk || '');
  if (!draftText) {
    return chunkText;
  }

  const draftEndsWithSpace = /\s$/.test(draftText);
  const chunkStartsWithSpace = /^\s/.test(chunkText);
  if (draftEndsWithSpace || chunkStartsWithSpace) {
    return draftText + chunkText;
  }
  return draftText + ' ' + chunkText;
}

/**
 * Read the system clipboard and either commit it or open the manual paste sheet.
 * @param {(text: string) => void} commitText
 * @param {(visible: boolean) => void} setPasteSheetVisible
 * @returns {Promise<boolean>}
 */
async function tryPasteClipboardIntoDraft(commitText, setPasteSheetVisible) {
  try {
    // vocab: Clipboard.getStringAsync = Expo helper that reads the OS pasteboard as text
    const rawClipboard = await Clipboard.getStringAsync();
    const clipboardText = String(rawClipboard || '');
    const clipboardIsBlank = !clipboardText.trim();
    if (clipboardIsBlank) {
      setPasteSheetVisible(true);
      return false;
    }
    commitText(clipboardText);
    return true;
  } catch (clipboardError) {
    void clipboardError;
    setPasteSheetVisible(true);
    return false;
  }
}

/**
 * Peek the clipboard without mutating the draft — used for empty-composer hints.
 * @returns {Promise<boolean>}
 */
async function clipboardHasNonEmptyText() {
  try {
    const rawClipboard = await Clipboard.getStringAsync();
    const clipboardText = String(rawClipboard || '');
    return Boolean(clipboardText.trim());
  } catch (clipboardError) {
    void clipboardError;
    return false;
  }
}

// ===== MAIN FUNCTION =====

/**
 * Composer hook for the AI Coach message field.
 * vocab: useRef inputRef = native TextInput handle for focus after paste.
 * Hook order (freeze): value → pasteSheetVisible → inputRef → callbacks below.
 * @param {string} [initial]
 * @returns {object}
 */
export function typingBox(initial = DEFAULT_INITIAL_TEXT) {
  // 1. Draft string and paste-sheet visibility — order must not change (freeze list).
  const [value, setValue] = useState(initial);
  const [pasteSheetVisible, setPasteSheetVisible] = useState(false);
  const inputRef = useRef(null);

  // 2. Typing and clear — thin wrappers so parents do not own setState.
  const onChangeText = useCallback((nextText) => {
    setValue(nextText);
  }, []);

  const clear = useCallback(() => {
    setValue('');
  }, []);

  // 3. Paste or manual commit — merges into existing draft with a space when needed.
  const commitText = useCallback((incomingText) => {
    applyPastedChunkToDraft(incomingText, setValue, setPasteSheetVisible);
  }, []);

  // 4. Voice path replaces the whole draft (recognition already merged on device).
  const applySpeechTranscript = useCallback((spokenText) => {
    replaceDraftWithSpeechText(spokenText, setValue);
  }, []);

  const openPasteSheet = useCallback(() => {
    setPasteSheetVisible(true);
  }, []);

  const closePasteSheet = useCallback(() => {
    setPasteSheetVisible(false);
  }, []);

  // 5. System clipboard — empty / failed clipboard opens the manual paste sheet instead of failing silent.
  const pasteFromClipboard = useCallback(async () => {
    const pasteResult = await tryPasteClipboardIntoDraft(commitText, setPasteSheetVisible);
    return pasteResult;
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
 * True when the clipboard has non-whitespace text (empty-draft UX hints).
 * @returns {Promise<boolean>}
 */
export async function pasteHintForEmptyClipboard() {
  const hasText = await clipboardHasNonEmptyText();
  return hasText;
}
