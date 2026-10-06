// Turn a coach reply into plain text and put it on the clipboard.
// Flow: strip citations or markdown → write the clipboard → on iOS, read it back →
// if that fails, open the share sheet so the user can still copy.
// Used by the coach conversation (via copyableReplyText) and the reply text views.

import { Alert, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

// ===== NAMED CONSTANTS =====

// [1] [2] markers the web-search reply leaves in the prose. They are not part of the answer.
const INLINE_CITATION_PATTERN = /\s*\[\d+\]/g;
const EXTRA_SPACES_PATTERN = /[ \t]{2,}/g;

// Order matters. Bold (**) has to go before italic (*), or the bold markers get eaten as italics.
// The bullet character is what the user actually pastes — markdown asterisks would look broken.
const MARKDOWN_TO_PLAIN_TEXT = [
  [/\r\n/g, '\n'],
  [/\*\*(.*?)\*\*/g, '$1'],
  [/__(.*?)__/g, '$1'],
  [/\*(.*?)\*/g, '$1'],
  [/_([^_]+)_/g, '$1'],
  [/`([^`]+)`/g, '$1'],
  [/^#{1,6}\s+/gm, ''],
  [/\[([^\]]+)\]\([^)]+\)/g, '$1'],
  [/^[-*+]\s+/gm, '• '],
  [/^\d+\.\s+/gm, '• '],
  [/(?:\s*\[\d+\])+/g, ''],
];

// ===== HELPER FUNCTIONS =====

// Android and web: a thrown setStringAsync is the only failure we trust.
// iOS can report success while the pasteboard still holds the previous string,
// so we read it back before telling the user the message copied.
async function isClipboardHoldingText(expectedText) {
  if (Platform.OS !== 'ios') return true;
  const pastedBack = await Clipboard.getStringAsync();
  return !!(pastedBack && pastedBack.trim() === expectedText.trim());
}

// ===== MAIN FUNCTION =====

/**
 * Remove [1] [2] citation markers without collapsing newlines or markdown.
 * @param {string} text
 * @returns {string}
 */
export function stripInlineWebCitations(text) {
  return String(text || '')
    .replace(INLINE_CITATION_PATTERN, '')
    .replace(EXTRA_SPACES_PATTERN, ' ')
    .trim();
}

/**
 * Strip lightweight markdown so a coach reply pastes as one plain paragraph.
 * @param {string} text
 * @returns {string}
 */
export function coachPlainText(text) {
  let plainText = String(text || '');
  for (const [pattern, replacement] of MARKDOWN_TO_PLAIN_TEXT) {
    plainText = plainText.replace(pattern, replacement);
  }
  return plainText.trim();
}

/**
 * Copy a coach reply. Falls back to the system share sheet when the clipboard write can't be verified.
 * @param {string} text
 * @param {{ announce?: boolean }} [options] announce: false skips the "Copied" alert. Callers pass this key.
 * @returns {Promise<boolean>} True when the clipboard or the share sheet accepted the text.
 */
export async function copyCoachText(text, { announce = true } = {}) {
  // Plain text first. If markdown stripping removes everything, fall back to the raw trim
  // so a message that is only punctuation still has a chance to copy.
  const textToCopy = coachPlainText(text) || String(text || '').trim();
  if (!textToCopy) {
    Alert.alert('Nothing to copy', 'This message has no text to copy.');
    return false;
  }

  try {
    await Clipboard.setStringAsync(textToCopy);
    const isClipboardVerified = await isClipboardHoldingText(textToCopy);
    if (isClipboardVerified) {
      if (announce) Alert.alert('Copied', 'Message copied to clipboard.');
      return true;
    }
    // Verified false (iOS read-back didn't match) falls through to the share sheet.
  } catch (_error) {
    // Clipboard threw, or the iOS read-back threw. The share sheet is the backup.
  }

  try {
    // vocab: Share.share opens the system sheet. message is the text the user can then copy.
    await Share.share({ message: textToCopy });
    return true;
  } catch (error) {
    Alert.alert(
      'Copy failed',
      error?.message || 'Could not copy. Long-press the message text and use the system Copy menu.',
    );
    return false;
  }
}
