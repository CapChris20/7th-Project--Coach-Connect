import React, { useMemo } from 'react';
import Markdown from 'react-native-markdown-display';
import { stripCoachToolJsonFromReply } from '../../shared/coach-tools/parseCoachToolCalls';
import { stripInlineWebCitations } from '../lib/coachClipboard';
import {
  buildCoachMarkdownStyles,
  preprocessCoachCitations,
} from '../lib/coachMarkdownStyles';

export default function CoachFormattedReply({ text, isDark = true }) {
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
