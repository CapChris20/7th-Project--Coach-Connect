import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

const SCREEN_W = Dimensions.get('window').width;
/** Matches `ExerciseLibrarySection` horizontal padding (20 + 20). */
const SECTION_PAD_X2 = 40;
const DEFAULT_GAP = 8;

/**
 * Responsive flex grid for library tiles (VideoTile).
 */
export function ExerciseGrid({
  data,
  columns = 2,
  gap = DEFAULT_GAP,
  renderItem,
  style,
}) {
  const n = Math.max(1, Math.min(4, Number(columns) || 2));
  const innerW = SCREEN_W - SECTION_PAD_X2;
  const cellW = (innerW - gap * (n - 1)) / n;

  return (
    <View style={[styles.row, { gap }, style]}>
      {(data || []).map((item, idx) => (
        <View key={item?.id ?? item?.videoId ?? String(idx)} style={{ width: cellW }}>
          {renderItem ? renderItem(item, idx) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
