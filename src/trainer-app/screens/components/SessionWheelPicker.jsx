import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import WheelPicker from '@quidone/react-native-wheel-picker';

const ITEM_HEIGHT = 40;
const VISIBLE_COUNT = 5;

export default function SessionWheelPicker({
  data,
  value,
  onValueChanged,
  flex = 1,
  activeTextColor = '#FFFFFF',
  inactiveTextColor = '#888888',
  selectedBandColor = 'rgba(255, 107, 157, 0.15)',
}) {
  const renderItem = useCallback(
    ({ item, itemTextStyle }) => {
      const active = item.value === value;
      return (
        <View style={styles.itemHit}>
          <Text
            style={[
              itemTextStyle,
              styles.itemText,
              { color: active ? activeTextColor : inactiveTextColor, fontWeight: active ? '600' : '400' },
            ]}
          >
            {item.label}
          </Text>
        </View>
      );
    },
    [value, activeTextColor, inactiveTextColor],
  );

  const renderOverlay = useCallback(
    () => (
      <View style={styles.overlayWrap} pointerEvents="none">
        <View style={[styles.overlayGradient, { backgroundColor: selectedBandColor }]} />
      </View>
    ),
    [selectedBandColor],
  );

  return (
    <View style={[styles.column, { flex }]}>
      <WheelPicker
        data={data}
        value={value}
        onValueChanged={onValueChanged}
        itemHeight={ITEM_HEIGHT}
        visibleItemCount={VISIBLE_COUNT}
        renderItem={renderItem}
        renderOverlay={renderOverlay}
        overlayItemStyle={styles.overlayItem}
        style={styles.picker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  column: { minWidth: 0 },
  picker: { width: '100%' },
  itemHit: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: { fontSize: 16 },
  overlayWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  overlayGradient: {
    height: ITEM_HEIGHT,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 157, 0.25)',
  },
  overlayItem: { backgroundColor: 'transparent' },
});
