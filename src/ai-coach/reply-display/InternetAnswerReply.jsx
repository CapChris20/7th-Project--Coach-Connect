// Web-search coach reply as markdown — keeps the answer body, tidies layout for the bubble.
// Flow: strip tool JSON → strip citations → strip honesty opener → layout pass → Markdown.
// Used by CoachReplyText when isWebSearch is true.
//
// vocab: preprocessWebSearchLayout = normalizes headings/spacing so web answers read cleanly

import React, { useMemo } from 'react';
import Markdown from 'react-native-markdown-display';
import { stripCoachToolJsonFromReply } from '../coach-actions/readActionsFromReply';
import { stripInlineWebCitations } from '../reply-display/copyableReplyText';
import {
  buildCoachMarkdownStyles,
  preprocessWebSearchLayout,
} from '../reply-display/replyTextStyles';
import { stripHonestyOpeners } from '../reply-display/stripHonestyOpeners';
import { buildCoachMarkdownRules } from './coachMarkdownRules';

// ===== NAMED CONSTANTS =====

// vocab: onLinkPress returning false = “do not open this URL” (bubble stays in-app)

// ===== HELPER FUNCTIONS =====

/**
 * Full display pipeline for an internet-search answer.
 * Order matters: drop machine crumbs first, then tidy layout for markdown.
 * @param {*} rawReply
 * @returns {string}
 */
function buildDisplayMarkdownForInternetAnswer(rawReply) {
  const replyAsString = String(rawReply || '');
  const withoutToolJson = stripCoachToolJsonFromReply(replyAsString);
  const withoutCitations = stripInlineWebCitations(withoutToolJson);
  const withoutHonestyOpener = stripHonestyOpeners(withoutCitations);
  return preprocessWebSearchLayout(withoutHonestyOpener);
}

/**
 * Link presses from this bubble never open a browser.
 * @returns {false}
 */
function refuseEveryMarkdownLinkPress() {
  return false;
}

/**
 * In-file markdown bubble so the export reads as a short checklist.
 */
function InternetAnswerMarkdownBubble({ replyMarkdown, markdownStyles, markdownRules }) {
  return (
    <Markdown
      style={markdownStyles}
      rules={markdownRules}
      onLinkPress={refuseEveryMarkdownLinkPress}
    >
      {replyMarkdown}
    </Markdown>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Markdown bubble for an internet-search coach answer.
 * Flow: 1. memo cleaned+laid-out markdown  2. memo theme  3. memo rules  4. paint
 * @param {{ text?: string, isDark?: boolean }} props
 * @returns {JSX.Element}
 */
export default function InternetAnswerReply({ text, isDark = true }) {
  // Hook order is frozen — three memos, then paint. No early return before hooks.

  // 1. Strip machine crumbs and run the web-answer layout pass.
  const replyMarkdown = useMemo(
    () => buildDisplayMarkdownForInternetAnswer(text),
    [text],
  );

  // 2. Same Design Law typography tokens as normal coach replies.
  const markdownStyles = useMemo(
    () => buildCoachMarkdownStyles(isDark),
    [isDark],
  );

  // 3. Square bullets + scrollable tables (shared with CoachReplyText).
  const markdownRules = useMemo(
    () => buildCoachMarkdownRules({ isDark }),
    [isDark],
  );

  // 4. Paint the bubble; every link press is refused so we never leave the chat.
  return (
    <InternetAnswerMarkdownBubble
      replyMarkdown={replyMarkdown}
      markdownStyles={markdownStyles}
      markdownRules={markdownRules}
    />
  );
}
