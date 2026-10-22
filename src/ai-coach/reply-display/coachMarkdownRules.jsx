// Custom markdown render rules for coach replies — currently just tables.
// Flow: count the table's columns from its header row → give the table a
// fixed width (columns × min column width) → wrap it in a horizontal
// ScrollView so full-sentence cells scroll sideways on a phone instead of
// crushing into narrow slivers or cutting text off.
// Used by CoachReplyText and InternetAnswerReply (both markdown bubbles).

import React from 'react';
import { ScrollView, View } from 'react-native';

// Manipulate here: minimum width per table column. Wider = more scrolling
// but easier-to-read sentences; narrower = more of the table fits at once.
const TABLE_COLUMN_MIN_WIDTH = 168;
// Fallback when the header row can't be read (malformed markdown table).
const DEFAULT_TABLE_COLUMN_COUNT = 2;

// ===== HELPER FUNCTIONS =====

/**
 * Column count = number of cells in the first header row.
 * vocab: the markdown AST nests table → thead → tr → th, one th per column.
 * @param {object} tableNode markdown-it AST node for the table
 * @returns {number}
 */
function countTableColumns(tableNode) {
  const headerSection = tableNode?.children?.[0];
  const headerRow = headerSection?.children?.[0];
  const headerCells = headerRow?.children;
  if (Array.isArray(headerCells) && headerCells.length > 0) return headerCells.length;
  return DEFAULT_TABLE_COLUMN_COUNT;
}

// ===== MAIN FUNCTION =====

/**
 * Render rules to hand to react-native-markdown-display's `rules` prop.
 * Only `table` is overridden; every other node keeps the library default.
 * @returns {object}
 */
export function buildCoachMarkdownRules() {
  return {
    // vocab: (node, children, parent, styles) is the library's rule signature;
    // styles._VIEW_SAFE_table is our themed table style with text-only
    // properties stripped (it lands on a View, not a Text).
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
          <View style={[styles._VIEW_SAFE_table, { width: tableWidth, marginBottom: 0 }]}>
            {children}
          </View>
        </ScrollView>
      );
    },
  };
}
