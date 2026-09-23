import React, { useMemo } from 'react';
import Markdown from 'react-native-markdown-display';
import { stripCoachToolJsonFromReply } from '../coach-actions/readActionsFromReply';
import { stripInlineWebCitations } from '../reply-display/copyableReplyText';
import { buildCoachMarkdownStyles, preprocessWebSearchLayout } from '../reply-display/replyTextStyles';
import InternetAnswerReply from './InternetAnswerReply';

export default function CoachReplyText({ text, isDark = true, isWebSearch = false }) {
  if (isWebSearch) {
    return <InternetAnswerReply text={text} isDark={isDark} />;
  }

  const body = useMemo(() => {
    const cleaned = stripInlineWebCitations(stripCoachToolJsonFromReply(String(text || '')));
    return cleaned;
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
