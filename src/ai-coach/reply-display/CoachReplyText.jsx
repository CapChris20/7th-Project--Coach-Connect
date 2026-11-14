// One coach reply bubble: either a normal chat markdown strip or an internet-answer bubble.
// Flow: memo clean text + theme + rules → if web search, hand off → else paint Markdown.
// Used by CoachConversationScreen in the message list.
//
// vocab: Markdown = react-native-markdown-display — turns markdown string into RN views

import React, { useMemo } from 'react';
import Markdown from 'react-native-markdown-display';
import { stripCoachToolJsonFromReply } from '../coach-actions/readActionsFromReply';
import { stripInlineWebCitations } from '../reply-display/copyableReplyText';
import { buildCoachMarkdownStyles } from '../reply-display/replyTextStyles';
import { stripHonestyOpeners } from '../reply-display/stripHonestyOpeners';
import { buildCoachMarkdownRules } from './coachMarkdownRules';
import InternetAnswerReply from './InternetAnswerReply';

// ===== NAMED CONSTANTS =====

// In-app citation taps use this scheme. We still refuse to open any link from this bubble.
const IN_APP_CITATION_SCHEME = 'coachcite://';

// ===== HELPER FUNCTIONS =====

/**
 * Normal (non-web) replies: string → drop tools → drop citations → drop honesty opener.
 * Internet answers use InternetAnswerReply’s own pipeline (extra layout pass).
 * @param {*} rawReply
 * @returns {string}
 */
function cleanedMarkdownForNormalCoachReply(rawReply) {
  const replyAsString = String(rawReply || '');
  const withoutToolJson = stripCoachToolJsonFromReply(replyAsString);
  const withoutCitations = stripInlineWebCitations(withoutToolJson);
  return stripHonestyOpeners(withoutCitations);
}

/**
 * Markdown link presses always stay in-app. Both citation and http URLs return false
 * so the library does not open a browser from this bubble.
 * @param {string} linkUrl
 * @returns {false}
 */
function refuseToOpenMarkdownLink(linkUrl) {
  const linkText = String(linkUrl || '');
  const looksLikeInAppCitation = linkText.startsWith(IN_APP_CITATION_SCHEME);
  // Behavior freeze: every link is blocked, including coachcite:// (handled elsewhere).
  if (looksLikeInAppCitation) return false;
  return false;
}

/**
 * Plain coach chat bubble — theme styles + Design Law rules + cleaned markdown.
 */
function NormalCoachReplyMarkdown({ displayMarkdown, markdownTheme, markdownRules }) {
  return (
    <Markdown
      style={markdownTheme}
      rules={markdownRules}
      onLinkPress={refuseToOpenMarkdownLink}
    >
      {displayMarkdown}
    </Markdown>
  );
}

// ===== MAIN FUNCTION =====

/**
 * One reply bubble.
 * Flow: 1. memo cleaned markdown  2. memo theme  3. memo rules  4. web branch or normal Markdown
 * @param {{ text?: string, isDark?: boolean, isWebSearch?: boolean }} props
 * @returns {import('react').ReactElement}
 */
export default function CoachReplyText({ text, isDark = true, isWebSearch = false }) {
  // Hook order is frozen — always run these three before any early return / branch.

  // 1. Clean the reply for a normal (non-web) markdown bubble.
  const displayMarkdown = useMemo(
    () => cleanedMarkdownForNormalCoachReply(text),
    [text],
  );

  // 2. Theme tokens for light/dark body text, headings, tables.
  const markdownTheme = useMemo(
    () => buildCoachMarkdownStyles(isDark),
    [isDark],
  );

  // 3. Design Law overrides: square bullets + horizontally scrollable tables (PNG 03).
  const markdownRules = useMemo(
    () => buildCoachMarkdownRules({ isDark }),
    [isDark],
  );

  // 4. Web-search replies need a different strip + layout pass — hand off.
  if (isWebSearch) {
    return <InternetAnswerReply text={text} isDark={isDark} />;
  }

  // 5. Normal chat reply: paint cleaned markdown with theme + rules.
  return (
    <NormalCoachReplyMarkdown
      displayMarkdown={displayMarkdown}
      markdownTheme={markdownTheme}
      markdownRules={markdownRules}
    />
  );
}
