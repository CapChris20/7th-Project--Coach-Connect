import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

const ITEM_W = 200;
const ITEM_GAP = 12;

/**
 * Horizontal carousel for ExerciseCard-sized items.
 */
export function ExerciseCarousel({ data, keyExtractor, renderItem, style }) {
  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={data || []}
      keyExtractor={keyExtractor}
      contentContainerStyle={[styles.content, style]}
      ItemSeparatorComponent={() => <View style={{ width: ITEM_GAP }} />}
      renderItem={({ item, index }) => <View style={{ width: ITEM_W }}>{renderItem(item, index)}</View>}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 4,
    paddingRight: 20,
  },
});
