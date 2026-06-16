import { Platform } from 'react-native';
import { AI_COACH_UI } from '../aiCoachUiTokens';

const headingFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

export function buildCoachMarkdownStyles(isDark) {
  const text = isDark ? 'rgba(255,255,255,0.92)' : '#0A0A0F';
  const muted = isDark ? 'rgba(255,255,255,0.72)' : 'rgba(10,10,15,0.72)';
  const heading = isDark ? '#FFFFFF' : '#0A0A0F';
  const citeBg = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';
  const citeBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)';

  return {
    body: { color: text, fontSize: 15, lineHeight: 24 },
    paragraph: { color: muted, fontSize: 15, lineHeight: 24, marginTop: 0, marginBottom: 10 },
    heading1: {
      color: heading,
      fontSize: 18,
      fontWeight: '700',
      fontFamily: headingFont,
      marginTop: 14,
      marginBottom: 8,
    },
    heading2: {
      color: heading,
      fontSize: 16,
      fontWeight: '700',
      fontFamily: headingFont,
      marginTop: 12,
      marginBottom: 6,
    },
    strong: { color: heading, fontWeight: '700' },
    em: { color: muted, fontStyle: 'italic' },
    bullet_list: { marginBottom: 8, marginTop: 2 },
    ordered_list: { marginBottom: 8, marginTop: 2 },
    list_item: { color: muted, fontSize: 15, lineHeight: 24, marginBottom: 6 },
    bullet_list_icon: { color: AI_COACH_UI.cyan, fontSize: 15, lineHeight: 24 },
    link: {
      color: isDark ? 'rgba(255,255,255,0.88)' : '#334155',
      fontSize: 11,
      fontWeight: '700',
      backgroundColor: citeBg,
      borderColor: citeBorder,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 2,
      overflow: 'hidden',
    },
    hr: { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', height: 1, marginVertical: 12 },
  };
}

/** Turn inline [Source Name] citations into pill-styled markdown links. */
export function preprocessCoachCitations(markdown) {
  return String(markdown || '').replace(
    /\s\[([A-Za-z][A-Za-z0-9 .&'’\-]{1,40})\]/g,
    ' [$1](coachcite://$1)',
  );
}

export function coachReplyUsesFormattedLayout(message) {
  if (!message || message.role === 'user') return false;
  if (message.searchedWeb === true) return true;
  if (message.route === 'food-search' || message.route === 'web-search') return true;
  const t = String(message.text || '');
  return /\*\*[^*]+\*\*/.test(t) || /^[-*•]\s+/m.test(t);
}
