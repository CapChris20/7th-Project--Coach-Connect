// Renders a web-search coach reply as markdown, without dropping the answer text.
// Flow: strip tool JSON and citation markers → tidy the layout → render markdown.
// Used by: CoachReplyText when the reply came from an internet lookup.

import React, { useMemo } from 'react';
import Markdown from 'react-native-markdown-display';
import { stripCoachToolJsonFromReply } from '../coach-actions/readActionsFromReply';
import { stripInlineWebCitations } from '../reply-display/copyableReplyText';
import {
  buildCoachMarkdownStyles,
  preprocessWebSearchLayout,
} from '../reply-display/replyTextStyles';

// ===== NAMED CONSTANTS =====

// ===== HELPER FUNCTIONS =====

/**
 * Citations and hidden tool JSON are not part of the answer the person should read.
 * @param {string} replyText
 * @returns {string}
 */
function prepareInternetReply(replyText) {
  const withoutToolJson = stripCoachToolJsonFromReply(String(replyText || ''));
  const withoutCitations = stripInlineWebCitations(withoutToolJson);
  return preprocessWebSearchLayout(withoutCitations);
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ text?: string, isDark?: boolean }} props
 */
export default function InternetAnswerReply({ text, isDark = true }) {
  const replyMarkdown = useMemo(() => prepareInternetReply(text), [text]);
  const markdownStyles = useMemo(() => buildCoachMarkdownStyles(isDark), [isDark]);

  return (
    <Markdown style={markdownStyles} onLinkPress={() => false}>
      {replyMarkdown}
    </Markdown>
  );
}
