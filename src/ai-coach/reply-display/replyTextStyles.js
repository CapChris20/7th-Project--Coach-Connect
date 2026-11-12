// Design Law markdown styles for coach replies (screens/ai-coach/03).
// Flow: nb tokens → bold sans headline + ink body + hard square bullets → citation pills.
// Used by: CoachReplyText and InternetAnswerReply.
//
// vocab: nbInk = primary text; never soft “muted wall of text” for the whole reply

import { Platform } from 'react-native';
import { lightColors, darkColors, nb } from '../../look-and-feel/colorPalette';
import { preprocessWebSearchLayout } from './splitInternetAnswer';

// ===== NAMED CONSTANTS =====

// Manipulate here: body size / line height (PNG 03: ~15 / ~1.45)
const COACH_REPLY_FONT_SIZE = 15;
const COACH_REPLY_LINE_HEIGHT = 22;
// Design Law uses heavy grotesque — not Georgia/serif
const HEADING_FONT_FAMILY = Platform.select({
  ios: 'System',
  android: 'sans-serif-medium',
  default: 'System',
});
const BODY_FONT_FAMILY = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

const CITATION_NAME_PATTERN = /\s\[([A-Za-z][A-Za-z0-9 .&'\u2019\-]{1,40})\]/g;
const CITATION_LINK_REPLACEMENT = ' [$1](coachcite://$1)';

const BOLD_MARKDOWN_PATTERN = /\*\*[^*]+\*\*/;
const BULLET_LINE_PATTERN = /^[-*•]\s+/m;

const FOOD_SEARCH_ROUTE = 'food-search';
const WEB_SEARCH_ROUTE = 'web-search';
const USER_ROLE = 'user';

// ===== HELPERS =====

function coachReplyColorPalette(isDark) {
  const colors = isDark ? darkColors : lightColors;
  return {
    text: colors.nbInk,
    muted: colors.nbMuted,
    heading: colors.nbInk,
    // Design Law PNG 03: solid black square bullets — not brand pink dots
    bullet: colors.nbInk,
    link: colors.nbInk,
    rule: colors.nbBorder,
    tableBorder: colors.nbBorder,
    tableHeaderBg: isDark ? darkColors.nbSurfaceChip : lightColors.nbSurfaceChip,
  };
}

function paragraphStyleFromPalette(palette) {
  return {
    color: palette.text,
    fontSize: COACH_REPLY_FONT_SIZE,
    fontFamily: BODY_FONT_FAMILY,
    // Manipulate here: body weight — PNG reads medium, not heavy wall
    fontWeight: '400',
    lineHeight: COACH_REPLY_LINE_HEIGHT,
    marginTop: 0,
    marginBottom: 12,
  };
}

function headingStyleFromPalette(palette, fontSize, marginTop, marginBottom) {
  return {
    color: palette.heading,
    fontSize,
    fontWeight: '900',
    fontFamily: HEADING_FONT_FAMILY,
    letterSpacing: -0.4,
    marginTop,
    marginBottom,
  };
}

function replyHasFormattedMarkup(replyText) {
  return BOLD_MARKDOWN_PATTERN.test(replyText) || BULLET_LINE_PATTERN.test(replyText);
}

// ===== MAIN =====

export { preprocessWebSearchLayout };

/**
 * Style map for react-native-markdown-display — Design Law coach typography.
 * @param {boolean} isDark
 */
export function buildCoachMarkdownStyles(isDark) {
  const palette = coachReplyColorPalette(isDark);
  const paragraphStyle = paragraphStyleFromPalette(palette);

  return {
    body: {
      color: palette.text,
      fontSize: COACH_REPLY_FONT_SIZE,
      fontFamily: BODY_FONT_FAMILY,
      fontWeight: '400',
      lineHeight: COACH_REPLY_LINE_HEIGHT,
    },
    paragraph: paragraphStyle,
    // Lead / section titles — heavy, sans, ink (PNG 03 headline ~20–22)
    heading1: headingStyleFromPalette(palette, 22, 2, 10),
    heading2: headingStyleFromPalette(palette, 18, 16, 8),
    heading3: headingStyleFromPalette(palette, 16, 12, 6),
    // Bold lead + **Label:** in bullets — PNG 03 punch
    strong: {
      color: palette.heading,
      fontWeight: '900',
      fontFamily: HEADING_FONT_FAMILY,
    },
    em: { color: palette.text, fontStyle: 'italic', fontWeight: '500' },
    bullet_list: { marginBottom: 14, marginTop: 4 },
    ordered_list: { marginBottom: 14, marginTop: 4 },
    list_item: {
      ...paragraphStyle,
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    // Hidden — custom square bullet rule paints the marker
    bullet_list_icon: {
      color: 'transparent',
      fontSize: 1,
      width: 0,
      height: 0,
      marginLeft: 0,
      marginRight: 0,
    },
    ordered_list_icon: {
      color: palette.text,
      fontSize: COACH_REPLY_FONT_SIZE,
      fontWeight: '900',
      lineHeight: COACH_REPLY_LINE_HEIGHT,
      marginRight: 10,
    },
    link: {
      color: palette.link,
      fontSize: 14,
      fontWeight: '800',
      textDecorationLine: 'underline',
    },
    hr: {
      backgroundColor: palette.rule,
      height: nb.borderWidth,
      marginVertical: 14,
    },
    table: {
      borderWidth: nb.borderWidth,
      borderColor: palette.tableBorder,
      borderRadius: 10,
      marginBottom: 12,
      overflow: 'hidden',
    },
    thead: { backgroundColor: palette.tableHeaderBg },
    tbody: {},
    tr: {
      borderBottomWidth: nb.borderWidth,
      borderColor: palette.tableBorder,
      flexDirection: 'row',
    },
    th: { flex: 1, padding: 10 },
    td: { flex: 1, padding: 10 },
  };
}

export function preprocessCoachCitations(markdown) {
  return String(markdown || '').replace(CITATION_NAME_PATTERN, CITATION_LINK_REPLACEMENT);
}

export function coachReplyUsesFormattedLayout(message) {
  if (!message || message.role === USER_ROLE) return false;
  if (message.searchedWeb === true) return true;
  if (message.route === FOOD_SEARCH_ROUTE || message.route === WEB_SEARCH_ROUTE) return true;
  return replyHasFormattedMarkup(String(message.text || ''));
}
