/**
 * use Coach Composer Input
 *
 * Purpose: React hook: use Coach Composer Input. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: pasteHintForEmptyClipboard, useCoachComposerInput
 *
 * @file-header
 */
import { useCallback, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';

export async function pasteHintForEmptyClipboard() {
  try {
    const clip = await Clipboard.getStringAsync();
    return Boolean(String(clip || '').trim());
  } catch (_) {
    return false;
  }
}

export function useCoachComposerInput(initial = '') {
  const [value, setValue] = useState(initial);
  const [pasteSheetVisible, setPasteSheetVisible] = useState(false);
  const inputRef = useRef(null);

  const onChangeText = useCallback((text) => setValue(text), []);
  const clear = useCallback(() => setValue(''), []);
  const commitText = useCallback((text) => {
    const next = String(text || '').trim();
    if (!next) return;
    setValue((prev) => {
      const base = String(prev || '');
      if (!base) return next;
      const needsSpace = !/\s$/.test(base) && !/^\s/.test(next);
      return needsSpace ? `${base} ${next}` : `${base}${next}`;
    });
    setPasteSheetVisible(false);
  }, []);

  const applySpeechTranscript = useCallback((text) => {
    setValue(String(text || ''));
  }, []);

  const openPasteSheet = useCallback(() => setPasteSheetVisible(true), []);
  const closePasteSheet = useCallback(() => setPasteSheetVisible(false), []);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const clip = await Clipboard.getStringAsync();
      const text = String(clip || '');
      if (!text.trim()) {
        setPasteSheetVisible(true);
        return false;
      }
      commitText(text);
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
