// Custom markdown rules for Design Law coach replies.
// Flow: square black bullets (PNG 03) + horizontally scrollable tables.
// Used by CoachReplyText and InternetAnswerReply.

import React from 'react';
import { ScrollView, View } from 'react-native';
import { lightColors, darkColors, nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: table column min width (wider = more sideways scroll, easier sentences)
const TABLE_COLUMN_MIN_WIDTH = 168;
const DEFAULT_TABLE_COLUMN_COUNT = 2;
// Design Law checklist marker — solid square, not a • glyph
const BULLET_SQUARE = 8;

// ===== HELPERS =====

function countTableColumns(tableNode) {
  const headerSection = tableNode?.children?.[0];
  const headerRow = headerSection?.children?.[0];
  const headerCells = headerRow?.children;
  if (Array.isArray(headerCells) && headerCells.length > 0) return headerCells.length;
  return DEFAULT_TABLE_COLUMN_COUNT;
}

function inkForTheme(isDark) {
  return isDark ? darkColors.nbInk : lightColors.nbInk;
}

// ===== MAIN =====

/**
 * @param {{ isDark?: boolean }} [options]
 * @returns {object} rules for react-native-markdown-display
 */
export function buildCoachMarkdownRules({ isDark = false } = {}) {
  const ink = inkForTheme(isDark);

  return {
    // PNG 03: solid black square before each bullet line
    // Manipulate here: marginTop aligns the square with the first text line (PNG 03)
    bullet_list_icon: (node) => (
      <View
        key={node.key}
        style={{
          width: BULLET_SQUARE,
          height: BULLET_SQUARE,
          backgroundColor: ink,
          marginTop: 7,
          marginRight: 12,
          borderRadius: 1,
        }}
      />
    ),

    table: (node, children, parent, styles) => {
      const columnCount = countTableColumns(node);
      const tableWidth = columnCount * TABLE_COLUMN_MIN_WIDTH;
      return (
        <ScrollView
          key={node.key}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12 }}
        >
          <View
            style={[
              styles._VIEW_SAFE_table,
              {
                width: tableWidth,
                marginBottom: 0,
                borderWidth: nb.borderWidth,
              },
            ]}
          >
            {children}
          </View>
        </ScrollView>
      );
    },
  };
}
