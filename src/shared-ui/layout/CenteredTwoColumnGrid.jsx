/**
 * Centered Two Column Grid
 *
 * Purpose: Centered Two Column Grid — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: CenteredTwoColumnGrid
 *
 * @file-header
 */
import React from 'react';
import { View } from 'react-native';

/**
 * Simple two-column grid for micronutrient rows and similar compact lists.
 */
export default function CenteredTwoColumnGrid({
  items = [],
  renderItem,
  keyExtractor,
  gap = 10,
  itemWidth = '48%',
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, justifyContent: 'space-between' }}>
      {items.map((item, index) => (
        <View key={keyExtractor ? keyExtractor(item, index) : String(index)} style={{ width: itemWidth }}>
          {renderItem(item, index)}
        </View>
      ))}
    </View>
  );
}
