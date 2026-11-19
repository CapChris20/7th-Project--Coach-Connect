// Web-search coach reply as markdown — keeps the answer body, tidies layout for the bubble.
// Flow: strip tool JSON → strip citations → strip honesty opener → layout pass → Research Header + Markdown.
// Used by CoachReplyText when isWebSearch is true.
//
// vocab: preprocessWebSearchLayout = normalizes headings/spacing so web answers read cleanly

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { stripCoachToolJsonFromReply } from '../coach-actions/readActionsFromReply';
import { stripInlineWebCitations } from '../reply-display/copyableReplyText';
import {
  buildCoachMarkdownStyles,
  preprocessWebSearchLayout,
} from '../reply-display/replyTextStyles';
import { stripHonestyOpeners } from '../reply-display/stripHonestyOpeners';
import { buildCoachMarkdownRules } from './coachMarkdownRules';
import { darkColors, lightColors, nb, borderRadius } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const HEADER_TITLE_TEXT = 'LIVE EVIDENCE SEARCH';
const HEADER_SUBTITLE_TEXT = 'Verified sports science, nutrition & PubMed consensus';
const BADGE_TAG_TEXT = 'PEER-REVIEWED';

const ICON_CONTAINER_SIZE = 38;
const ICON_CONTAINER_RADIUS = 10;
const SPARKLES_ICON_SIZE = 18;
const SPARKLES_ICON_COLOR = '#6366F1';

// vocab: onLinkPress returning false = “do not open this URL” (bubble stays in-app)

// ===== HELPER FUNCTIONS =====

/**
 * Top research badge card that anchors a live web-search coach reply.
 */
function ResearchEvidenceHeader({ isDark }) {
  const badgeBorderColor = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  const badgeBg = isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)';
  const textColor = isDark ? darkColors.nbInk : lightColors.nbInk;
  const mutedColor = isDark ? darkColors.nbMuted : lightColors.nbMuted;
  const iconTileBg = isDark ? '#1E1B4B' : '#EEF2FF';
  const tagBg = isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(22, 163, 74, 0.12)';
  const tagTextColor = isDark ? '#4ADE80' : '#15803D';

  const containerStyle = [
    styles.headerContainer,
    {
      borderColor: badgeBorderColor,
      backgroundColor: badgeBg,
    },
  ];

  const iconTileStyle = [
    styles.iconTile,
    {
      borderColor: badgeBorderColor,
      backgroundColor: iconTileBg,
    },
  ];

  const tagStyle = [
    styles.tagContainer,
    {
      backgroundColor: tagBg,
    },
  ];

  return (
    <View style={containerStyle}>
      <View style={iconTileStyle}>
        <Ionicons name="sparkles" size={SPARKLES_ICON_SIZE} color={SPARKLES_ICON_COLOR} />
      </View>
      <View style={styles.textColumn}>
        <View style={styles.titleRow}>
          <Text style={[styles.headerTitle, { color: textColor }]}>
            {HEADER_TITLE_TEXT}
          </Text>
          <View style={tagStyle}>
            <Text style={[styles.tagText, { color: tagTextColor }]}>
              {BADGE_TAG_TEXT}
            </Text>
          </View>
        </View>
        <Text style={[styles.headerSubtitle, { color: mutedColor }]} numberOfLines={1}>
          {HEADER_SUBTITLE_TEXT}
        </Text>
      </View>
    </View>
  );
}

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
 * Flow: 1. memo cleaned+laid-out markdown  2. memo theme  3. memo rules  4. paint header + bubble
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

  // 3. Square bullets + callout quotes + scrollable tables (shared with CoachReplyText).
  const markdownRules = useMemo(
    () => buildCoachMarkdownRules({ isDark }),
    [isDark],
  );

  // 4. Paint the research evidence header and markdown content.
  return (
    <View style={styles.rootWrap}>
      <ResearchEvidenceHeader isDark={isDark} />
      <InternetAnswerMarkdownBubble
        replyMarkdown={replyMarkdown}
        markdownStyles={markdownStyles}
        markdownRules={markdownRules}
      />
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  rootWrap: {
    width: '100%',
  },
  headerContainer: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconTile: {
    width: ICON_CONTAINER_SIZE,
    height: ICON_CONTAINER_SIZE,
    borderRadius: ICON_CONTAINER_RADIUS,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tagContainer: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tagText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
});
