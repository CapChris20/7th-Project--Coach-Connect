// Renders coach reply text — full markdown for web answers, simpler strip for normal chat.
// Flow: web-search branch first → else strip tools/citations → Markdown with theme styles.
// Used in the coach conversation message list.

import React, { useMemo } from 'react';
import Markdown from 'react-native-markdown-display';
import { stripCoachToolJsonFromReply } from '../coach-actions/readActionsFromReply';
import { stripInlineWebCitations } from '../reply-display/copyableReplyText';
import { buildCoachMarkdownStyles } from '../reply-display/replyTextStyles';
import InternetAnswerReply from './InternetAnswerReply';

// ===== NAMED CONSTANTS =====

const IN_APP_CITATION_SCHEME = 'coachcite://';

// ===== HELPER FUNCTIONS =====

function cleanedCoachReplyMarkdown(rawReply) {
  const withoutTools = stripCoachToolJsonFromReply(String(rawReply || ''));
  return stripInlineWebCitations(withoutTools);
}

function blockExternalLinkOpen(linkUrl) {
  const urlText = String(linkUrl || '');
  if (urlText.startsWith(IN_APP_CITATION_SCHEME)) return false;
  return false;
}

// ===== MAIN FUNCTION =====

/**
 * One reply bubble. Hook order: early web branch, then useMemo for plain markdown.
 * @param {{ text?: string, isDark?: boolean, isWebSearch?: boolean }} props
 * @returns {import('react').ReactElement}
 */
export default function CoachReplyText({ text, isDark = true, isWebSearch = false }) {
  if (isWebSearch) {
    return <InternetAnswerReply text={text} isDark={isDark} />;
  }

  const displayMarkdown = useMemo(() => cleanedCoachReplyMarkdown(text), [text]);
  const markdownTheme = useMemo(() => buildCoachMarkdownStyles(isDark), [isDark]);

  return (
    <Markdown style={markdownTheme} onLinkPress={blockExternalLinkOpen}>
      {displayMarkdown}
    </Markdown>
  );
}
