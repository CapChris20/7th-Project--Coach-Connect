// One spinning "wheel" column (iOS date-picker style) used by the trainer's session scheduler.
// Flow: parent passes a data list + current value → the library handles scroll/snap physics →
// our renderItem styles each row and renderOverlay draws the pink highlight band.
// Used side-by-side (hour / minute / AM-PM) inside the schedule-a-session form.
import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
// vocab: @quidone/react-native-wheel-picker = third-party wheel/spinner control. We supply the
// data and the row rendering; it owns the snapping, momentum, and haptic feel.
import WheelPicker from '@quidone/react-native-wheel-picker';

// Manipulate here: ITEM_HEIGHT is the pixel height of one row — the library uses it to compute
// snap positions, so the styles below MUST reuse this constant rather than hardcode a number, or
// the highlight band will drift out of alignment with the selected row.
// VISIBLE_COUNT is how many rows are on screen at once; keep it odd so there's a true center row.
const ITEM_HEIGHT = 40;
const VISIBLE_COUNT = 5;

export default function SessionTimePicker({
  data,
  value,
  onValueChanged,
  // Manipulate here: these are the per-instance look knobs. flex controls how much horizontal
  // space this column takes next to its siblings; the colors default to the session-scheduling
  // pink theme, and callers override them for a different accent.
  flex = 1,
  activeTextColor = '#FFFFFF',
  inactiveTextColor = '#888888',
  selectedBandColor = 'rgba(255, 107, 157, 0.15)',
}) {
  // Renders one row of the wheel. Wrapped in useCallback because the picker re-renders many rows
  // during a scroll — a fresh function identity each render would defeat the library's own
  // memoization and make the spin feel sluggish.
  // vocab: useCallback = React hook that reuses the same function instance until a dependency changes
  const renderItem = useCallback(
    ({ item, itemTextStyle }) => {
      // The selected row is the only one drawn bright and semibold — that contrast is what
      // communicates "this is your pick" alongside the highlight band.
      const active = item.value === value;
      return (
        // itemHit is a fixed-height box so every row occupies exactly one snap slot, even when
        // the label text is short or the font scales.
        <View style={styles.itemHit}>
          {/* itemTextStyle comes FROM the library and must be spread first, so our own styles
              (and the active/inactive colors) win where they overlap. */}
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
    // Not depending on the color props' identity beyond value is fine — they're plain strings.
    [value, activeTextColor, inactiveTextColor],
  );

  // The tinted band sitting behind the center row. It's a separate overlay (not row styling) so
  // it stays perfectly still while the rows scroll underneath it.
  const renderOverlay = useCallback(
    () => (
      // pointerEvents="none" is essential: without it this full-size overlay would swallow the
      // drag gestures and the wheel would refuse to spin.
      <View style={styles.overlayWrap} pointerEvents="none">
        <View style={[styles.overlayGradient, { backgroundColor: selectedBandColor }]} />
      </View>
    ),
    [selectedBandColor],
  );

  return (
    // flex is applied inline (not in the stylesheet) because it's a per-instance prop — this is
    // how three wheels share a row in different proportions.
    <View style={[styles.column, { flex }]}>
      <WheelPicker
        data={data}
        value={value}
        onValueChanged={onValueChanged}
        itemHeight={ITEM_HEIGHT}
        visibleItemCount={VISIBLE_COUNT}
        renderItem={renderItem}
        renderOverlay={renderOverlay}
        // overlayItemStyle is the library's OWN default highlight; we blank it out because
        // renderOverlay above already draws ours, and two would stack into a muddy double tint.
        overlayItemStyle={styles.overlayItem}
        style={styles.picker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // minWidth: 0 lets a flex column actually shrink. Without it, long labels force the column
  // wider than its flex share and push the sibling wheels off screen.
  column: { minWidth: 0 },
  picker: { width: '100%' },
  itemHit: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Manipulate here: row font size. Raising it much past ITEM_HEIGHT will clip the text.
  itemText: { fontSize: 16 },
  overlayWrap: {
    // vocab: StyleSheet.absoluteFillObject = shorthand for position:absolute + all four edges 0,
    // i.e. "cover the parent completely". Spread so the properties below can add to it.
    ...StyleSheet.absoluteFillObject,
    // stretch + center = the band spans the full width and sits vertically dead-center, which is
    // exactly where the picker snaps the selected row.
    alignItems: 'stretch',
    justifyContent: 'center',
    // Manipulate here: small inset so the band doesn't touch the column edges.
    paddingHorizontal: 4,
  },
  overlayGradient: {
    // Matching ITEM_HEIGHT is what keeps the band exactly one row tall.
    height: ITEM_HEIGHT,
    // Manipulate here: band corner rounding and its border tint (a stronger version of the
    // translucent fill passed in via selectedBandColor).
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 157, 0.25)',
  },
  overlayItem: { backgroundColor: 'transparent' },
});
