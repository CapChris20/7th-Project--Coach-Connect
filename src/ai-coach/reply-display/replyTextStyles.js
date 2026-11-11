// Markdown colors for a coach reply (neobrutalist theme), plus the check for whether a message should use that layout.
// Flow: pick light or dark nb tokens → build the markdown style map → turn [Source] notes into pill links.
// Used by: CoachReplyText and InternetAnswerReply.
//
// vocab: nbInk/nbMuted = neobrutalist text color tokens

import { Platform } from 'react-native';
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';
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

/**
 * Neobrutalist color palette for coach replies.
 * Uses design system tokens for consistent theming.
 * @param {boolean} isDark
 * @returns {object}
 */
function coachReplyColorPalette(isDark) {
  const colors = isDark ? darkColors : lightColors;
  return {
    text: colors.nbInk,
    muted: colors.nbMuted,
    heading: colors.nbInk,
    bullet: '#FF6B9D', // brand gradient start
    link: '#6B3AD9', // ink gradient start
    rule: colors.nbBorder,
    // Tables: use nb border tokens
    tableBorder: colors.nbBorder,
    tableHeaderBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
  };
}

/**
 * @param {object} palette
 * @returns {object}
 */
function paragraphStyleFromPalette(palette) {
  return {
    color: palette.muted,
    fontSize: 15,
    lineHeight: COACH_REPLY_LINE_HEIGHT,
    marginTop: 0,
    marginBottom: 10,
  };
}

/**
 * @param {object} palette
 * @param {number} fontSize
 * @param {number} marginTop
 * @param {number} marginBottom
 * @returns {object}
 */
function headingStyleFromPalette(palette, fontSize, marginTop, marginBottom) {
  return {
    color: palette.heading,
    fontSize,
    fontWeight: '700',
    fontFamily: HEADING_FONT_FAMILY,
    marginTop,
    marginBottom,
  };
}

function replyHasFormattedMarkup(replyText) {
  const hasBold = BOLD_MARKDOWN_PATTERN.test(replyText);
  const hasBullets = BULLET_LINE_PATTERN.test(replyText);
  return hasBold || hasBullets;
}

// ===== MAIN FUNCTION =====

export { preprocessWebSearchLayout };

/**
 * Style map for the markdown renderer. Keys are the renderer’s names (body, heading1, and so on).
 * @param {boolean} isDark
 * @returns {object}
 */
export function buildCoachMarkdownStyles(isDark) {
  const palette = coachReplyColorPalette(isDark);
  const paragraphStyle = paragraphStyleFromPalette(palette);

  return {
    body: { color: palette.text, fontSize: 15, lineHeight: COACH_REPLY_LINE_HEIGHT },
    paragraph: paragraphStyle,
    heading1: headingStyleFromPalette(palette, 18, 14, 8),
    heading2: headingStyleFromPalette(palette, 16, 16, 8),
    heading3: headingStyleFromPalette(palette, 15, 12, 6),
    strong: { color: palette.heading, fontWeight: '700' },
    em: { color: palette.muted, fontStyle: 'italic' },
    bullet_list: { marginBottom: 10, marginTop: 4 },
    ordered_list: { marginBottom: 10, marginTop: 4 },
    list_item: paragraphStyle,
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
    // Markdown tables: themed frame + wrapped sentence cells. The horizontal
    // scrolling itself lives in coachMarkdownRules.jsx (custom table rule);
    // these keys only paint. th/td flex:1 keeps columns equal inside the
    // fixed-width table that rule creates.
    // Manipulate here: cell padding and header tint.
    table: {
      borderWidth: 1,
      borderColor: palette.tableBorder,
      borderRadius: 8,
      marginBottom: 12,
      overflow: 'hidden',
    },
    thead: { backgroundColor: palette.tableHeaderBg },
    tbody: {},
    tr: {
      borderBottomWidth: 1,
      borderColor: palette.tableBorder,
      flexDirection: 'row',
    },
    th: { flex: 1, padding: 8 },
    td: { flex: 1, padding: 8 },
  };
}

/**
 * Turn inline [Source Name] notes into markdown links the reply view styles as pills.
 * @param {string} markdown
 * @returns {string}
 */
export function preprocessCoachCitations(markdown) {
  const markdownString = String(markdown || '');
  return markdownString.replace(CITATION_NAME_PATTERN, CITATION_LINK_REPLACEMENT);
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
