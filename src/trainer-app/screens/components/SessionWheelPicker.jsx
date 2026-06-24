import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import WheelPicker from '@quidone/react-native-wheel-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { DARK_PINK, SESSION_GRADIENT } from '../../sessions/sessionSchedulingTheme';

const ITEM_HEIGHT = 40;
const VISIBLE_COUNT = 5;

export default function SessionWheelPicker({
  data,
  value,
  onValueChanged,
  flex = 1,
  activeTextColor = DARK_PINK,
  inactiveTextColor = 'rgba(255,255,255,0.5)',
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
        <LinearGradient
          colors={[`${SESSION_GRADIENT[0]}22`, `${SESSION_GRADIENT[1]}18`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.overlayGradient}
        />
      </View>
    ),
    [],
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
    borderColor: `${DARK_PINK}66`,
  },
  overlayItem: { backgroundColor: 'transparent' },
});
