// Custom markdown render rules for Design Law coach replies (PNG screen 03).
// Flow: pick ink for theme → square bullet icons + horizontally scrollable tables.
// Used by CoachReplyText and InternetAnswerReply with react-native-markdown-display.

import React from 'react';
import { ScrollView, View } from 'react-native';
import { lightColors, darkColors, nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: column min width — wider columns mean more sideways scroll
const TABLE_COLUMN_MIN_WIDTH = 168;
const DEFAULT_TABLE_COLUMN_COUNT = 2;
// Design Law checklist marker is a solid square, not a • glyph
const BULLET_SQUARE_SIDE = 8;
// Manipulate here: marginTop lines the square up with the first text line (PNG 03)
const BULLET_SQUARE_MARGIN_TOP = 7;
const BULLET_SQUARE_MARGIN_RIGHT = 12;
const BULLET_SQUARE_CORNER_RADIUS = 1;
const TABLE_SCROLL_MARGIN_BOTTOM = 12;

// ===== HELPER FUNCTIONS =====

function inkColorForTheme(isDark) {
  if (isDark) {
    return darkColors.nbInk;
  }
  return lightColors.nbInk;
}

function headerCellsFromTableNode(tableNode) {
  if (!tableNode) {
    return null;
  }
  const headerGroup = tableNode.children && tableNode.children[0];
  if (!headerGroup) {
    return null;
  }
  const firstHeaderRow = headerGroup.children && headerGroup.children[0];
  if (!firstHeaderRow) {
    return null;
  }
  const headerCells = firstHeaderRow.children;
  return headerCells;
}

function countColumnsInMarkdownTable(tableNode) {
  const headerCells = headerCellsFromTableNode(tableNode);
  if (!Array.isArray(headerCells)) {
    return DEFAULT_TABLE_COLUMN_COUNT;
  }
  if (headerCells.length === 0) {
    return DEFAULT_TABLE_COLUMN_COUNT;
  }
  return headerCells.length;
}

function renderSquareBulletIcon(node, inkColor) {
  const bulletKey = node.key;
  const squareStyle = {
    width: BULLET_SQUARE_SIDE,
    height: BULLET_SQUARE_SIDE,
    backgroundColor: inkColor,
    marginTop: BULLET_SQUARE_MARGIN_TOP,
    marginRight: BULLET_SQUARE_MARGIN_RIGHT,
    borderRadius: BULLET_SQUARE_CORNER_RADIUS,
  };

  return <View key={bulletKey} style={squareStyle} />;
}

function renderHorizontalScrollTable(node, children, styles) {
  const columnCount = countColumnsInMarkdownTable(node);
  const totalTableWidth = columnCount * TABLE_COLUMN_MIN_WIDTH;
  const tableKey = node.key;

  const scrollStyle = { marginBottom: TABLE_SCROLL_MARGIN_BOTTOM };
  const tableBodyStyle = [
    styles._VIEW_SAFE_table,
    {
      width: totalTableWidth,
      marginBottom: 0,
      borderWidth: nb.borderWidth,
    },
  ];

  return (
    <ScrollView
      key={tableKey}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={scrollStyle}
    >
      <View style={tableBodyStyle}>{children}</View>
    </ScrollView>
  );
}

function bulletListIconRule(inkColor) {
  return function renderBulletListIcon(node) {
    return renderSquareBulletIcon(node, inkColor);
  };
}

function tableRule() {
  return function renderTable(node, children, parent, styles) {
    void parent;
    return renderHorizontalScrollTable(node, children, styles);
  };
}

// ===== MAIN FUNCTION =====

/**
 * Build the small set of markdown node overrides Design Law needs.
 * Flow: 1. pick ink  2. return bullet + table rules (everything else = library default)
 * @param {{ isDark?: boolean }} [options]
 * @returns {object} rules for react-native-markdown-display
 */
export function buildCoachMarkdownRules({ isDark = false } = {}) {
  // 1. Theme ink drives bullet fill (same token as body text in PNG 03).
  const inkColor = inkColorForTheme(isDark);

  // 2. Only override the node types we care about — leave headings/paragraphs alone.
  const markdownRules = {
    bullet_list_icon: bulletListIconRule(inkColor),
    table: tableRule(),
  };

  return markdownRules;
}

// ===== PLUMBING — skip unless debugging =====
// headerCellsFromTableNode walks the markdown AST (children[0] = header group).
