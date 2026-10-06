// Markdown colors for a coach reply, plus the check for whether a message should use that layout.
// Flow: pick light or dark ink → build the markdown style map → turn [Source] notes into pill links.
// Used by CoachReplyText and InternetAnswerReply.

import { Platform } from 'react-native';
import { AI_COACH_UI } from '../coachColors';
import { preprocessWebSearchLayout } from './splitInternetAnswer';

// ===== NAMED CONSTANTS =====

// Manipulate here: 24 is the body line height shared by paragraphs, lists, and bullets.
const COACH_REPLY_LINE_HEIGHT = 24;

const HEADING_FONT_FAMILY = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

// A bracketed source name, 2 to 41 letters, becomes a coachcite link the reply view draws as a pill.
const CITATION_NAME_PATTERN = /\s\[([A-Za-z][A-Za-z0-9 .&'\u2019\-]{1,40})\]/g;
const CITATION_LINK_REPLACEMENT = ' [$1](coachcite://$1)';

const BOLD_MARKDOWN_PATTERN = /\*\*[^*]+\*\*/;
const BULLET_LINE_PATTERN = /^[-*•]\s+/m;

const FOOD_SEARCH_ROUTE = 'food-search';
const WEB_SEARCH_ROUTE = 'web-search';

const USER_ROLE = 'user';

// ===== HELPER FUNCTIONS =====

function replyPalette(isDark) {
  if (isDark) {
    return {
      text: 'rgba(255,255,255,0.92)',
      muted: 'rgba(255,255,255,0.72)',
      heading: '#FFFFFF',
      bullet: AI_COACH_UI.pink,
      link: AI_COACH_UI.purple,
      rule: 'rgba(255,255,255,0.08)',
    };
  }
  return {
    text: '#0A0A0F',
    muted: 'rgba(10,10,15,0.72)',
    heading: '#0A0A0F',
    bullet: '#BE185D',
    link: '#9333EA',
    rule: 'rgba(0,0,0,0.08)',
  };
}

function replyHasFormattedMarkup(replyText) {
  return BOLD_MARKDOWN_PATTERN.test(replyText) || BULLET_LINE_PATTERN.test(replyText);
}

// ===== MAIN FUNCTION =====

export { preprocessWebSearchLayout };

/**
 * Style map for the markdown renderer. Keys are the renderer’s names (body, heading1, and so on).
 * @param {boolean} isDark
 * @returns {object}
 */
export function buildCoachMarkdownStyles(isDark) {
  const palette = replyPalette(isDark);

  return {
    body: { color: palette.text, fontSize: 15, lineHeight: COACH_REPLY_LINE_HEIGHT },
    paragraph: {
      color: palette.muted,
      fontSize: 15,
      lineHeight: COACH_REPLY_LINE_HEIGHT,
      marginTop: 0,
      marginBottom: 10,
    },
    heading1: {
      color: palette.heading,
      fontSize: 18,
      fontWeight: '700',
      fontFamily: HEADING_FONT_FAMILY,
      marginTop: 14,
      marginBottom: 8,
    },
    heading2: {
      color: palette.heading,
      fontSize: 16,
      fontWeight: '700',
      fontFamily: HEADING_FONT_FAMILY,
      marginTop: 16,
      marginBottom: 8,
    },
    heading3: {
      color: palette.heading,
      fontSize: 15,
      fontWeight: '700',
      fontFamily: HEADING_FONT_FAMILY,
      marginTop: 12,
      marginBottom: 6,
    },
    strong: { color: palette.heading, fontWeight: '700' },
    em: { color: palette.muted, fontStyle: 'italic' },
    bullet_list: { marginBottom: 10, marginTop: 4 },
    ordered_list: { marginBottom: 10, marginTop: 4 },
    list_item: {
      color: palette.muted,
      fontSize: 15,
      lineHeight: COACH_REPLY_LINE_HEIGHT,
      marginBottom: 8,
    },
    bullet_list_icon: {
      color: palette.bullet,
      fontSize: 15,
      lineHeight: COACH_REPLY_LINE_HEIGHT,
    },
    link: {
      color: palette.link,
      fontSize: 14,
      fontWeight: '600',
      textDecorationLine: 'underline',
    },
    hr: {
      backgroundColor: palette.rule,
      height: 1,
      marginVertical: 12,
    },
  };
}

/**
 * Turn inline [Source Name] notes into markdown links the reply view styles as pills.
 * @param {string} markdown
 * @returns {string}
 */
export function preprocessCoachCitations(markdown) {
  return String(markdown || '').replace(CITATION_NAME_PATTERN, CITATION_LINK_REPLACEMENT);
}

/**
 * True when this coach message should use the formatted layout instead of plain text.
 * @param {{ role?: string, searchedWeb?: boolean, route?: string, text?: string }} message
 * @returns {boolean}
 */
export function coachReplyUsesFormattedLayout(message) {
  if (!message || message.role === USER_ROLE) return false;
  if (message.searchedWeb === true) return true;
  if (message.route === FOOD_SEARCH_ROUTE || message.route === WEB_SEARCH_ROUTE) return true;
  const replyText = String(message.text || '');
  return replyHasFormattedMarkup(replyText);
}
