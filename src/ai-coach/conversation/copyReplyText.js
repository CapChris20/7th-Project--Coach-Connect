// Copy coach reply text to the clipboard (plain prose, no markdown or [1] citation crumbs).
// Flow: strip formatting → write clipboard → on iOS verify pasteboard → else open share sheet.
// Used by CoachConversationScreen via copyableReplyText and reply text views.

import { Alert, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';

// ===== NAMED CONSTANTS =====

// [1] [2] markers from web-search replies are not part of the answer body.
const INLINE_CITATION_PATTERN = /\s*\[\d+\]/g;
const EXTRA_SPACES_PATTERN = /[ \t]{2,}/g;
const IOS_PLATFORM = 'ios';

const NOTHING_TO_COPY_TITLE = 'Nothing to copy';
const NOTHING_TO_COPY_MESSAGE = 'This message has no text to copy.';
const COPIED_TITLE = 'Copied';
const COPIED_MESSAGE = 'Message copied to clipboard.';
const COPY_FAILED_TITLE = 'Copy failed';
const COPY_FAILED_FALLBACK_MESSAGE =
  'Could not copy. Long-press the message text and use the system Copy menu.';

// Order matters: bold (**) before single-asterisk italic, or bold markers get eaten.
// Bullet output uses • so pasted text does not look like broken markdown.
const MARKDOWN_TO_PLAIN_RULES = [
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

// ===== MAIN FUNCTIONS =====

/**
 * Remove [1] [2] without rewriting newlines or other markdown (lighter than full coachPlainText).
 * @param {string} text
 * @returns {string}
 */
export function stripInlineWebCitations(text) {
  const asString = textAsString(text);
  const withoutCitations = asString.replace(INLINE_CITATION_PATTERN, '');
  const withoutExtraSpaces = withoutCitations.replace(EXTRA_SPACES_PATTERN, ' ');
  return withoutExtraSpaces.trim();
}

/**
 * Full markdown → plain for paste / share.
 * @param {string} text
 * @returns {string}
 */
export function coachPlainText(text) {
  return runMarkdownPlainRules(textAsString(text));
}

/**
 * Copy coach reply text. On iOS, verify the pasteboard; fall back to the share sheet if it lies.
 * @param {string} text
 * @param {{ announce?: boolean, presentNotice?: Function }} [options]
 * @returns {Promise<boolean>}
 */
export async function copyCoachText(text, { announce = true, presentNotice } = {}) {
  // 1. Build plain string; abort with notice if empty.
  const textToCopy = pickTextForClipboard(text);
  if (!textToCopy) {
    showNoticeToUser(presentNotice, NOTHING_TO_COPY_TITLE, NOTHING_TO_COPY_MESSAGE);
    return false;
  }

  // 2. Write pasteboard, then verify on iOS (setString can report success while holding old data).
  const wroteToClipboard = await tryWriteClipboardAndVerify(textToCopy);
  if (wroteToClipboard) {
    tellUserCopySucceeded(announce, presentNotice);
    return true;
  }

  // 3. Share sheet backup; surface failure only if that also throws.
  return tryShareSheetOrFail(textToCopy, presentNotice);
}

// ===== PLUMBING — skip unless debugging =====

function textAsString(maybeText) {
  if (!maybeText) {
    return '';
  }
  return String(maybeText);
}

function trimPasteboardReadback(readback) {
  if (!readback) {
    return '';
  }
  return readback.trim();
}

function runMarkdownPlainRules(rawReply) {
  let plain = rawReply;
  for (let ruleIndex = 0; ruleIndex < MARKDOWN_TO_PLAIN_RULES.length; ruleIndex += 1) {
    const rulePair = MARKDOWN_TO_PLAIN_RULES[ruleIndex];
    const searchPattern = rulePair[0];
    const replaceWith = rulePair[1];
    plain = plain.replace(searchPattern, replaceWith);
  }
  return plain.trim();
}

function pickTextForClipboard(replyText) {
  const asString = textAsString(replyText);
  const afterMarkdown = runMarkdownPlainRules(asString);
  if (afterMarkdown) {
    return afterMarkdown;
  }
  return asString.trim();
}

function showNoticeToUser(presentNotice, title, message) {
  if (typeof presentNotice === 'function') {
    presentNotice(title, message);
    return;
  }
  Alert.alert(title, message);
}

function tellUserCopySucceeded(shouldAnnounce, presentNotice) {
  if (!shouldAnnounce) {
    return;
  }
  showNoticeToUser(presentNotice, COPIED_TITLE, COPIED_MESSAGE);
}

function shareSheetErrorMessage(error) {
  if (error && error.message) {
    return error.message;
  }
  return COPY_FAILED_FALLBACK_MESSAGE;
}

async function tryWriteClipboardAndVerify(textToCopy) {
  try {
    // vocab: setStringAsync = Expo clipboard write; getStringAsync reads it back
    await Clipboard.setStringAsync(textToCopy);
    const pasteboardOk = await iosPasteboardMatchesExpected(textToCopy);
    return pasteboardOk;
  } catch (_clipboardWriteFailed) {
    return false;
  }
}

async function iosPasteboardMatchesExpected(expectedText) {
  if (Platform.OS !== IOS_PLATFORM) {
    return true;
  }

  const readback = await Clipboard.getStringAsync();
  const expectedTrimmed = expectedText.trim();
  const readbackTrimmed = trimPasteboardReadback(readback);

  if (!readbackTrimmed) {
    return false;
  }
  return readbackTrimmed === expectedTrimmed;
}

async function tryShareSheetOrFail(textToShare, presentNotice) {
  try {
    // vocab: Share.share opens the system sheet — user can copy from there when pasteboard lies.
    await Share.share({ message: textToShare });
    return true;
  } catch (error) {
    const failureMessage = shareSheetErrorMessage(error);
    showNoticeToUser(presentNotice, COPY_FAILED_TITLE, failureMessage);
    return false;
  }
}
