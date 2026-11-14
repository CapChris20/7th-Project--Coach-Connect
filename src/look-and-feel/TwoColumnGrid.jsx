// Two-column wrap grid for short lists (micronutrient rows, fact pairs, etc.).
// Flow: parent passes items → each item becomes a half-width cell → flex row wraps at the edge.
// Used by: nutrition fact grids and any two-up list that is not a FlatList.
//
// vocab: keyExtractor = optional parent helper that turns (item, index) into a stable React key

import React from 'react';
import { View } from 'react-native';

// ===== NAMED CONSTANTS =====

// Manipulate here: gap = space between cells; itemWidth ≈ half row so two fit per line
const DEFAULT_GAP = 10;
const DEFAULT_ITEM_WIDTH = '48%';

// ===== HELPER FUNCTIONS =====

// React needs a stable string key per cell; fall back to the index when the parent skips keyExtractor.
function reactKeyForCell(item, index, keyExtractor) {
  const parentGaveAKeyHelper = typeof keyExtractor === 'function';
  if (parentGaveAKeyHelper) {
    return keyExtractor(item, index);
  }
  return String(index);
}

// Build the wrapping row style once so the main component reads as a short checklist.
function buildWrappingRowStyle(gapBetweenCells) {
  return {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: gapBetweenCells,
    justifyContent: 'space-between',
  };
}

function buildHalfWidthCellStyle(itemWidth) {
  return { width: itemWidth };
}

// One half-width slot — keeps map() in the main from growing nested JSX.
function TwoColumnGridCell({ item, index, renderItem, itemWidth }) {
  const cellStyle = buildHalfWidthCellStyle(itemWidth);
  return (
    <View style={cellStyle}>
      {renderItem(item, index)}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Wrap a short list into two columns (not a virtualized FlatList).
 *
 * @param {{
 *   items?: Array,
 *   renderItem: Function,
 *   keyExtractor?: Function,
 *   gap?: number,
 *   itemWidth?: string,
 * }} props
 */
export default function TwoColumnGrid({
  items = [],
  renderItem,
  keyExtractor,
  gap = DEFAULT_GAP,
  itemWidth = DEFAULT_ITEM_WIDTH,
}) {
  // 1. Row is a wrapping flex row; space-between keeps two cells on each line.
  const rowStyle = buildWrappingRowStyle(gap);

  // 2. Paint one cell per item; keys live on the mapped wrapper so React can reconcile.
  return (
    <View style={rowStyle}>
      {items.map((item, index) => (
        <TwoColumnGridCell
          key={reactKeyForCell(item, index, keyExtractor)}
          item={item}
          index={index}
          renderItem={renderItem}
          itemWidth={itemWidth}
        />
      ))}
    </View>
  );
}
