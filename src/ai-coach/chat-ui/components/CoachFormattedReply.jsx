import React, { useMemo } from 'react';
import Markdown from 'react-native-markdown-display';
import { stripCoachToolJsonFromReply } from '../../tools/parseCoachToolCalls';
import { stripInlineWebCitations } from '../lib/formatCoachMessageText';
import { buildCoachMarkdownStyles, preprocessCoachCitations } from '../lib/coachMarkdownStyles';
import CoachWebSearchReply from './CoachWebSearchReply';

export default function CoachFormattedReply({ text, isDark = true, isWebSearch = false }) {
  if (isWebSearch) {
    return <CoachWebSearchReply text={text} isDark={isDark} />;
  }

  const body = useMemo(() => {
    const cleaned = stripInlineWebCitations(stripCoachToolJsonFromReply(String(text || '')));
    return preprocessCoachCitations(cleaned);
  }, [text]);

  const styles = useMemo(() => buildCoachMarkdownStyles(isDark), [isDark]);

  return (
    <Markdown
      style={styles}
      onLinkPress={(url) => {
        if (String(url || '').startsWith('coachcite://')) return false;
        return false;
      }}
    >
      {body}
    </Markdown>
  );
}
