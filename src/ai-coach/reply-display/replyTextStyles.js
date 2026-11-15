// Design Law typography for coach markdown replies (screens/ai-coach/03).
// Flow: theme palette → paragraph + headings + lists/tables/citations → layout gate for web search.
// Used by CoachReplyText and InternetAnswerReply with react-native-markdown-display.

import { Platform } from 'react-native';
import { lightColors, darkColors, nb } from '../../look-and-feel/colorPalette';
import { preprocessWebSearchLayout } from './splitInternetAnswer';

// ===== NAMED CONSTANTS =====

// Manipulate here: body size / line height (PNG 03 reads ~15px / ~1.45 line height)
const COACH_REPLY_FONT_SIZE = 15;
const COACH_REPLY_LINE_HEIGHT = 22;

// Manipulate here: heading sizes + top/bottom gaps for h1 / h2 / h3
const HEADING1_FONT_SIZE = 22;
const HEADING1_MARGIN_TOP = 2;
const HEADING1_MARGIN_BOTTOM = 10;
const HEADING2_FONT_SIZE = 18;
const HEADING2_MARGIN_TOP = 16;
const HEADING2_MARGIN_BOTTOM = 8;
const HEADING3_FONT_SIZE = 16;
const HEADING3_MARGIN_TOP = 12;
const HEADING3_MARGIN_BOTTOM = 6;

const HEADING_LETTER_SPACING = -0.4;
const PARAGRAPH_MARGIN_BOTTOM = 12;
const LINK_FONT_SIZE = 14;
const LIST_MARGIN_BOTTOM = 14;
const LIST_MARGIN_TOP = 4;
const LIST_ITEM_MARGIN_BOTTOM = 10;
const ORDERED_ICON_MARGIN_RIGHT = 10;
const RULE_MARGIN_VERTICAL = 14;
const TABLE_BORDER_RADIUS = 10;
const TABLE_CELL_PADDING = 10;
const TABLE_MARGIN_BOTTOM = 12;

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

// vocab: coachcite:// = in-app citation scheme tapped in the reply — not a real web URL
const CITATION_BRACKET_PATTERN = /\s\[([A-Za-z][A-Za-z0-9 .&'\u2019\-]{1,40})\]/g;
const CITATION_MARKDOWN_REPLACEMENT = ' [$1](coachcite://$1)';

const BOLD_MARKDOWN_SNIPPET = /\*\*[^*]+\*\*/;
const BULLET_LINE_START = /^[-*•]\s+/m;

const FOOD_SEARCH_ROUTE = 'food-search';
const WEB_SEARCH_ROUTE = 'web-search';
const USER_ROLE = 'user';

// Re-export so callers can import layout preprocess from this styles module.
export { preprocessWebSearchLayout };

// ===== HELPER FUNCTIONS =====

function themeColorsForMode(isDark) {
  if (isDark) {
    return darkColors;
  }
  return lightColors;
}

function tableHeaderBackgroundForMode(isDark) {
  if (isDark) {
    return darkColors.nbSurfaceChip;
  }
  return lightColors.nbSurfaceChip;
}

function replyColorTokens(isDark) {
  const theme = themeColorsForMode(isDark);
  const tableHeaderBackground = tableHeaderBackgroundForMode(isDark);

  return {
    text: theme.nbInk,
    muted: theme.nbMuted,
    heading: theme.nbInk,
    bullet: theme.nbInk,
    link: theme.nbInk,
    rule: theme.nbBorder,
    tableBorder: theme.nbBorder,
    tableHeaderBg: tableHeaderBackground,
  };
}

function baseParagraphStyle(tokens) {
  return {
    color: tokens.text,
    fontSize: COACH_REPLY_FONT_SIZE,
    fontFamily: BODY_FONT_FAMILY,
    // Manipulate here: 400 keeps body readable, not a heavy wall (PNG 03)
    fontWeight: '400',
    lineHeight: COACH_REPLY_LINE_HEIGHT,
    marginTop: 0,
    marginBottom: PARAGRAPH_MARGIN_BOTTOM,
  };
}

function headingBlockStyle(tokens, fontSize, marginTop, marginBottom) {
  return {
    color: tokens.heading,
    fontSize,
    fontWeight: '900',
    fontFamily: HEADING_FONT_FAMILY,
    letterSpacing: HEADING_LETTER_SPACING,
    marginTop,
    marginBottom,
  };
}

function headingOneStyle(tokens) {
  return headingBlockStyle(
    tokens,
    HEADING1_FONT_SIZE,
    HEADING1_MARGIN_TOP,
    HEADING1_MARGIN_BOTTOM,
  );
}

function headingTwoStyle(tokens) {
  return headingBlockStyle(
    tokens,
    HEADING2_FONT_SIZE,
    HEADING2_MARGIN_TOP,
    HEADING2_MARGIN_BOTTOM,
  );
}

function headingThreeStyle(tokens) {
  return headingBlockStyle(
    tokens,
    HEADING3_FONT_SIZE,
    HEADING3_MARGIN_TOP,
    HEADING3_MARGIN_BOTTOM,
  );
}

function strongTextStyle(tokens) {
  return {
    color: tokens.heading,
    fontWeight: '900',
    fontFamily: HEADING_FONT_FAMILY,
  };
}

function emphasisTextStyle(tokens) {
  return {
    color: tokens.text,
    fontStyle: 'italic',
    fontWeight: '500',
  };
}

function bodyRootStyle(tokens) {
  return {
    color: tokens.text,
    fontSize: COACH_REPLY_FONT_SIZE,
    fontFamily: BODY_FONT_FAMILY,
    fontWeight: '400',
    lineHeight: COACH_REPLY_LINE_HEIGHT,
  };
}

function listAndLinkStyles(tokens, paragraphStyle) {
  return {
    bullet_list: {
      marginBottom: LIST_MARGIN_BOTTOM,
      marginTop: LIST_MARGIN_TOP,
    },
    ordered_list: {
      marginBottom: LIST_MARGIN_BOTTOM,
      marginTop: LIST_MARGIN_TOP,
    },
    list_item: Object.assign({}, paragraphStyle, {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: LIST_ITEM_MARGIN_BOTTOM,
    }),
    // Custom rule paints the square — hide the default bullet glyph.
    bullet_list_icon: {
      color: 'transparent',
      fontSize: 1,
      width: 0,
      height: 0,
      marginLeft: 0,
      marginRight: 0,
    },
    ordered_list_icon: {
      color: tokens.text,
      fontSize: COACH_REPLY_FONT_SIZE,
      fontWeight: '900',
      lineHeight: COACH_REPLY_LINE_HEIGHT,
      marginRight: ORDERED_ICON_MARGIN_RIGHT,
    },
    link: {
      color: tokens.link,
      fontSize: LINK_FONT_SIZE,
      fontWeight: '800',
      textDecorationLine: 'underline',
    },
    hr: {
      backgroundColor: tokens.rule,
      height: nb.borderWidth,
      marginVertical: RULE_MARGIN_VERTICAL,
    },
  };
}

function tableStyles(tokens) {
  return {
    table: {
      borderWidth: nb.borderWidth,
      borderColor: tokens.tableBorder,
      borderRadius: TABLE_BORDER_RADIUS,
      marginBottom: TABLE_MARGIN_BOTTOM,
      overflow: 'hidden',
    },
    thead: { backgroundColor: tokens.tableHeaderBg },
    tbody: {},
    tr: {
      borderBottomWidth: nb.borderWidth,
      borderColor: tokens.tableBorder,
      flexDirection: 'row',
    },
    th: { flex: 1, padding: TABLE_CELL_PADDING },
    td: { flex: 1, padding: TABLE_CELL_PADDING },
  };
}

function textLooksFormatted(replyText) {
  const hasBold = BOLD_MARKDOWN_SNIPPET.test(replyText);
  if (hasBold) {
    return true;
  }
  const hasBullets = BULLET_LINE_START.test(replyText);
  return hasBullets;
}

// ===== MAIN FUNCTION =====

/**
 * Style object keys that react-native-markdown-display reads for one theme.
 * Flow: 1. tokens  2. paragraph  3. stack body / headings / lists / tables
 * @param {boolean} isDark
 * @returns {object}
 */
export function buildCoachMarkdownStyles(isDark) {
  // 1. Pull ink + border tokens for this theme.
  const tokens = replyColorTokens(isDark);
  const paragraphStyle = baseParagraphStyle(tokens);

  // 2. Named blocks first so the return below stays a short checklist.
  const bodyStyle = bodyRootStyle(tokens);
  const heading1Style = headingOneStyle(tokens);
  const heading2Style = headingTwoStyle(tokens);
  const heading3Style = headingThreeStyle(tokens);
  const strongStyle = strongTextStyle(tokens);
  const emphasisStyle = emphasisTextStyle(tokens);
  const listAndLinkStyleBlock = listAndLinkStyles(tokens, paragraphStyle);
  const tableStyleBlock = tableStyles(tokens);

  // 3. Stack typography blocks the markdown library reads by key.
  return Object.assign(
    {
      body: bodyStyle,
      paragraph: paragraphStyle,
      heading1: heading1Style,
      heading2: heading2Style,
      heading3: heading3Style,
      strong: strongStyle,
      em: emphasisStyle,
    },
    listAndLinkStyleBlock,
    tableStyleBlock,
  );
}

/**
 * Turn bare [Source Name] brackets into tappable coachcite:// markdown links.
 * @param {string} markdown
 * @returns {string}
 */
export function preprocessCoachCitations(markdown) {
  const rawMarkdown = String(markdown || '');
  return rawMarkdown.replace(CITATION_BRACKET_PATTERN, CITATION_MARKDOWN_REPLACEMENT);
}

/**
 * Whether this chat message should render with rich markdown chrome.
 * Flow: 1. skip user / empty  2. web / tool routes always  3. else need bold or bullets
 * @param {{ role?: string, searchedWeb?: boolean, route?: string, text?: string }|null|undefined} message
 * @returns {boolean}
 */
export function coachReplyUsesFormattedLayout(message) {
  if (!message) {
    return false;
  }
  if (message.role === USER_ROLE) {
    return false;
  }

  if (message.searchedWeb === true) {
    return true;
  }

  const route = message.route;
  if (route === FOOD_SEARCH_ROUTE) {
    return true;
  }
  if (route === WEB_SEARCH_ROUTE) {
    return true;
  }

  const replyText = String(message.text || '');
  return textLooksFormatted(replyText);
}
