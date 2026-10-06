// Two-column wrap for short lists such as micronutrient rows.
// Flow: map each item into a half-width cell → the row wraps when it runs out of room.
// Used by: nutrition fact grids.

import React from 'react';
import { View } from 'react-native';

// ===== NAMED CONSTANTS =====

const DEFAULT_GAP = 10;
const DEFAULT_ITEM_WIDTH = '48%';

// ===== HELPER FUNCTIONS =====

/**
 * @param {object} item
 * @param {number} index
 * @param {Function|undefined} keyExtractor
 * @returns {string}
 */
function cellKey(item, index, keyExtractor) {
  if (keyExtractor) return keyExtractor(item, index);
  return String(index);
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ items?: Array, renderItem: Function, keyExtractor?: Function, gap?: number, itemWidth?: string }} props
 */
export default function TwoColumnGrid({
  items = [],
  renderItem,
  keyExtractor,
  gap = DEFAULT_GAP,
  itemWidth = DEFAULT_ITEM_WIDTH,
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, justifyContent: 'space-between' }}>
      {items.map((item, index) => (
        <View key={cellKey(item, index, keyExtractor)} style={{ width: itemWidth }}>
          {renderItem(item, index)}
        </View>
      ))}
    </View>
  );
}
