// Horizontal scrolling row of neobrutalist chips
// Flow: renders chips in a horizontal ScrollView with consistent spacing
// Where used: filters, date selection, tag lists
//
// vocab: single-select = only one chip active at a time, multi-select = multiple chips can be active

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import NbChip from './NbChip';
import { spacing } from './colorPalette';

/**
 * Horizontal scrolling chip row.
 * 
 * @param {object} props
 * @param {Array<{id: string, label: string}>} props.items - chip data
 * @param {string | Array<string>} props.selected - selected id(s)
 * @param {Function} props.onSelect - (id) => void for single-select, or (id) => void for multi-select toggle
 * @param {boolean} [props.multiSelect] - allow multiple selections
 * @param {object} [props.style] - additional container styles
 */
export default function NbChipRow({ items, selected, onSelect, multiSelect = false, style }) {
  const isSelected = (id) => {
    if (multiSelect) {
      return Array.isArray(selected) && selected.includes(id);
    }
    return selected === id;
  };
  
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, style]}
    >
      {items.map((item, index) => (
        <View key={item.id} style={index > 0 && styles.gap}>
          <NbChip
            selected={isSelected(item.id)}
            onPress={() => onSelect(item.id)}
          >
            {item.label}
          </NbChip>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
  },
  gap: {
    marginLeft: spacing.sm,
  },
});
