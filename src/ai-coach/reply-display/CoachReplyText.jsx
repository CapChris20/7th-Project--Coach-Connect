// Renders one coach reply. Internet answers use a fuller markdown layout.
// Flow: if this reply is a web search, hand it off → otherwise strip tool JSON and citations, then render.
// Used by: the coach conversation message list.

import React, { useMemo } from 'react';
import Markdown from 'react-native-markdown-display';
import { stripCoachToolJsonFromReply } from '../coach-actions/readActionsFromReply';
import { stripInlineWebCitations } from '../reply-display/copyableReplyText';
import { buildCoachMarkdownStyles, preprocessWebSearchLayout } from '../reply-display/replyTextStyles';
import InternetAnswerReply from './InternetAnswerReply';

// ===== NAMED CONSTANTS =====

const COACH_CITE_PREFIX = 'coachcite://';

// ===== HELPER FUNCTIONS =====

/**
 * Citation links stay inside the app. Every press returns false so Markdown does not open a browser.
 * @param {string} url
 * @returns {boolean}
 */
function ignoreMarkdownLinkPress(url) {
  if (String(url || '').startsWith(COACH_CITE_PREFIX)) return false;
  return false;
}

/**
 * @param {string} replyText
 * @returns {string}
 */
function preparePlainCoachReply(replyText) {
  return stripInlineWebCitations(stripCoachToolJsonFromReply(String(replyText || '')));
}

// ===== MAIN FUNCTION =====

/**
 * Hook order matches the original: the web-search branch returns before the memos.
 * @param {{ text?: string, isDark?: boolean, isWebSearch?: boolean }} props
 */
export default function CoachReplyText({ text, isDark = true, isWebSearch = false }) {
  if (isWebSearch) {
    return <InternetAnswerReply text={text} isDark={isDark} />;
  }

  const replyMarkdown = useMemo(() => preparePlainCoachReply(text), [text]);
  const markdownStyles = useMemo(() => buildCoachMarkdownStyles(isDark), [isDark]);

  return (
    <Markdown style={markdownStyles} onLinkPress={ignoreMarkdownLinkPress}>
      {replyMarkdown}
    </Markdown>
  );
}
