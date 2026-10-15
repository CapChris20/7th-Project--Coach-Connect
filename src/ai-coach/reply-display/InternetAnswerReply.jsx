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

// vocab: coachcite links are handled elsewhere; this component ignores taps so the bubble does not open a browser.
const IGNORE_MARKDOWN_LINK_PRESS = () => false;

// ===== HELPER FUNCTIONS =====

/**
 * Tool-call JSON is for the app, not the person reading the answer.
 * @param {string} rawReply
 * @returns {string}
 */
function replyWithoutHiddenToolJson(rawReply) {
  const replyAsString = String(rawReply || '');
  return stripCoachToolJsonFromReply(replyAsString);
}

/**
 * Inline [Source] markers are stripped before layout so they do not clutter the markdown.
 * @param {string} replyAfterToolStrip
 * @returns {string}
 */
function replyWithoutInlineCitations(replyAfterToolStrip) {
  return stripInlineWebCitations(replyAfterToolStrip);
}

/**
 * Citations and hidden tool JSON are not part of the answer the person should read.
 * @param {string} replyText
 * @returns {string}
 */
function prepareInternetReply(replyText) {
  const withoutToolJson = replyWithoutHiddenToolJson(replyText);
  const withoutCitations = replyWithoutInlineCitations(withoutToolJson);
  return preprocessWebSearchLayout(withoutCitations);
}

// ===== MAIN FUNCTION =====

/**
 * Markdown bubble for an internet-search coach answer.
 * @param {{ text?: string, isDark?: boolean }} props
 * @returns {JSX.Element}
 */
export default function InternetAnswerReply({ text, isDark = true }) {
  const replyMarkdown = useMemo(() => prepareInternetReply(text), [text]);
  const markdownStyles = useMemo(() => buildCoachMarkdownStyles(isDark), [isDark]);

  return (
    <Markdown style={markdownStyles} onLinkPress={IGNORE_MARKDOWN_LINK_PRESS}>
      {replyMarkdown}
    </Markdown>
  );
}
