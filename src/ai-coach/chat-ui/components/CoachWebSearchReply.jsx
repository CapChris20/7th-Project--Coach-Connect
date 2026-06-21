/**
 * Web-search replies — full markdown render, structure without dropping content.
 */
import React, { useMemo } from 'react';
import Markdown from 'react-native-markdown-display';
import { stripCoachToolJsonFromReply } from '../../tools/parseCoachToolCalls';
import { stripInlineWebCitations } from '../lib/formatCoachMessageText';
import {
  buildCoachMarkdownStyles,
  preprocessCoachCitations,
  preprocessWebSearchLayout,
} from '../lib/coachMarkdownStyles';

export default function CoachWebSearchReply({ text, isDark = true }) {
  const body = useMemo(() => {
    const cleaned = stripInlineWebCitations(stripCoachToolJsonFromReply(String(text || '')));
    return preprocessCoachCitations(preprocessWebSearchLayout(cleaned));
  }, [text]);

  const styles = useMemo(() => buildCoachMarkdownStyles(isDark), [isDark]);

  return (
    <Markdown style={styles} onLinkPress={() => false}>
      {body}
    </Markdown>
  );
}
