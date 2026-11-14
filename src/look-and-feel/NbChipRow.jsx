// Horizontal scrolling row of neobrutalist chips.
// Flow: map items → check selected (single or multi) → NbChip per id → ScrollView with gap spacing.
// Where used: filters, date selection, tag lists.
//
// vocab: single-select = one active id; multi-select = array of active ids
// Manipulate here: spacing.md (row inset), spacing.sm (gap between chips)

import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';

import NbChip from './NbChip';
import { spacing } from './colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: row inset (spacing.md) and gap between chips (spacing.sm) live in styles below.
const FIRST_CHIP_INDEX = 0;

// ===== HELPER FUNCTIONS =====

/**
 * Single-select compares id === selected.
 * Multi-select looks the id up in the selected array (empty list if caller passed a non-array).
 */
function chipIdIsSelected(chipId, selected, multiSelectEnabled) {
  if (multiSelectEnabled) {
    const selectedList = Array.isArray(selected) ? selected : [];
    return selectedList.includes(chipId);
  }
  return selected === chipId;
}

/**
 * One chip in the row: optional left gap + NbChip with Design Law chrome.
 */
function ChipRowItem({ item, index, selected, multiSelectEnabled, onSelect }) {
  // First chip has no left gap; later chips get spacing.sm so the row reads as a strip.
  const gapBeforeChip = index > FIRST_CHIP_INDEX ? styles.gap : null;
  const thisChipSelected = chipIdIsSelected(item.id, selected, multiSelectEnabled);

  function handleChipPress() {
    onSelect(item.id);
  }

  return (
    <View style={gapBeforeChip}>
      <NbChip selected={thisChipSelected} onPress={handleChipPress}>
        {item.label}
      </NbChip>
    </View>
  );
}

/**
 * Build the list of ChipRowItem nodes for the horizontal ScrollView.
 */
function paintChipRowItems(items, selected, multiSelectEnabled, onSelect) {
  return items.map((item, index) => (
    <ChipRowItem
      key={item.id}
      item={item}
      index={index}
      selected={selected}
      multiSelectEnabled={multiSelectEnabled}
      onSelect={onSelect}
    />
  ));
}

// ===== MAIN FUNCTION =====

/**
 * Horizontal chip strip for filters / tags / date pickers.
 *
 * @param {object} props
 * @param {Array<{id: string, label: string}>} props.items - chip data
 * @param {string | Array<string>} props.selected - selected id(s)
 * @param {Function} props.onSelect - called with chip id when user taps
 * @param {boolean} [props.multiSelect] - allow multiple selections
 * @param {object} [props.style] - ScrollView contentContainerStyle overrides
 */
export default function NbChipRow({
  items,
  selected,
  onSelect,
  multiSelect = false,
  style,
}) {
  // 1. Horizontal scroll keeps many filters on one line without wrapping the screen.
  // 2. Each item delegates selected state + press to NbChip (Design Law chip chrome).
  const chipNodes = paintChipRowItems(items, selected, multiSelect, onSelect);
  const rowContentStyle = [styles.row, style];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={rowContentStyle}
    >
      {chipNodes}
    </ScrollView>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // Manipulate here: horizontal inset for the strip
    paddingHorizontal: spacing.md,
  },
  gap: {
    // Manipulate here: space between chips
    marginLeft: spacing.sm,
  },
});
