// Turn a coach reply into plain text and put it on the clipboard.
// Flow: strip citations or markdown → write the clipboard → on iOS, read it back →
// if that fails, open the share sheet so the user can still copy.
// Used by: the coach conversation (via copyableReplyText) and the reply text views.

import { Alert, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

// ===== NAMED CONSTANTS =====

// [1] [2] markers the web-search reply leaves in the prose. They are not part of the answer.
const INLINE_CITATION_PATTERN = /\s*\[\d+\]/g;
const EXTRA_SPACES_PATTERN = /[ \t]{2,}/g;
const PLATFORM_IOS = 'ios';
const NOTHING_TO_COPY_TITLE = 'Nothing to copy';
const NOTHING_TO_COPY_MESSAGE = 'This message has no text to copy.';
const COPIED_TITLE = 'Copied';
const COPIED_MESSAGE = 'Message copied to clipboard.';
const COPY_FAILED_TITLE = 'Copy failed';
const COPY_FAILED_FALLBACK_MESSAGE =
  'Could not copy. Long-press the message text and use the system Copy menu.';

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

/**
 * Android and web: a thrown setStringAsync is the only failure we trust.
 * iOS can report success while the pasteboard still holds the previous string,
 * so we read it back before telling the user the message copied.
 * @param {string} expectedText
 * @returns {Promise<boolean>}
 */
async function isClipboardHoldingText(expectedText) {
  if (Platform.OS !== PLATFORM_IOS) return true;
  const pastedBack = await Clipboard.getStringAsync();
  const trimmedExpected = expectedText.trim();
  const trimmedPasted = trimmedClipboardText(pastedBack);
  return Boolean(trimmedPasted && trimmedPasted === trimmedExpected);
}

function trimmedClipboardText(pastedBack) {
  if (!pastedBack) return '';
  return pastedBack.trim();
}

/**
 * Run each markdown cleanup rule in order.
 * @param {string} rawText
 * @returns {string}
 */
function applyMarkdownToPlainRules(rawText) {
  let plainText = rawText;
  for (let ruleIndex = 0; ruleIndex < MARKDOWN_TO_PLAIN_TEXT.length; ruleIndex += 1) {
    const rulePair = MARKDOWN_TO_PLAIN_TEXT[ruleIndex];
    const pattern = rulePair[0];
    const replacement = rulePair[1];
    plainText = plainText.replace(pattern, replacement);
  }
  return plainText.trim();
}

function announceCopied(shouldAnnounce) {
  if (shouldAnnounce) Alert.alert(COPIED_TITLE, COPIED_MESSAGE);
}

function stringOrBlank(text) {
  if (!text) return '';
  return String(text);
}

function messageFromShareError(error) {
  if (error && error.message) return error.message;
  return COPY_FAILED_FALLBACK_MESSAGE;
}

/**
 * Pick plain text for the clipboard, falling back to a raw trim when markdown stripping empties the string.
 * @param {string} text
 * @returns {string}
 */
function textReadyForClipboard(text) {
  const replyText = stringOrBlank(text);
  const fromMarkdown = applyMarkdownToPlainRules(replyText);
  if (fromMarkdown) return fromMarkdown;
  return replyText.trim();
}

// ===== MAIN FUNCTION =====

/**
 * Remove [1] [2] citation markers without collapsing newlines or markdown.
 * @param {string} text
 * @returns {string}
 */
export function stripInlineWebCitations(text) {
  return stringOrBlank(text)
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
  return applyMarkdownToPlainRules(stringOrBlank(text));
}

/**
 * Copy a coach reply. Falls back to the system share sheet when the clipboard write can't be verified.
 * @param {string} text
 * @param {{ announce?: boolean }} [options] announce: false skips the "Copied" alert. Callers pass this key.
 * @returns {Promise<boolean>} True when the clipboard or the share sheet accepted the text.
 */
export async function copyCoachText(text, { announce = true } = {}) {
  const textToCopy = textReadyForClipboard(text);
  if (!textToCopy) {
    Alert.alert(NOTHING_TO_COPY_TITLE, NOTHING_TO_COPY_MESSAGE);
    return false;
  }

  try {
    await Clipboard.setStringAsync(textToCopy);
    const isClipboardVerified = await isClipboardHoldingText(textToCopy);
    if (isClipboardVerified) {
      announceCopied(announce);
      return true;
    }
  } catch (_clipboardWriteError) {
    // Clipboard threw, or the iOS read-back threw. The share sheet is the backup.
  }

  try {
    // vocab: Share.share opens the system sheet. message is the text the user can then copy.
    await Share.share({ message: textToCopy });
    return true;
  } catch (error) {
    const failureMessage = messageFromShareError(error);
    Alert.alert(COPY_FAILED_TITLE, failureMessage);
    return false;
  }
}
