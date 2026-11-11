// Segmented control: one outlined bar split into equal choices, the chosen one filled solid black (white in dark mode).
// Flow: draw the outlined bar → one equal-width segment per choice → selected segment gets the ink fill.
// Used for short single-choice sets such as AM/PM, minutes, tabs, In person/Video.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lightDarkMode';
import {
  MINIMUM_TOUCH_SIZE,
  NB_BORDER_WIDTH,
  NB_RADIUS,
  NB_SPACING,
  getNbColors,
} from './nbTokens';

// ===== NAMED CONSTANTS =====

const SEGMENT_FONT_SIZE = 14;

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * @param {object} props
 * @param {Array<{value: *, label: string}>} props.choices
 * @param {*} props.value The value of the chosen segment.
 * @param {Function} props.onChange Called with the new value.
 * @param {object} [props.style]
 * @returns {JSX.Element}
 */
export function NbSegmented({ choices, value, onChange, style }) {
  // 1. Colors for the current theme.
  const { isDark } = useTheme();
  const colors = getNbColors(isDark);

  // 2. The bar is outlined once. Segments are separated by a thin line, not their own outlines.
  const barStyle = { borderColor: colors.border, backgroundColor: colors.chip };

  // 3. One segment per choice.
  return (
    <View style={[styles.bar, barStyle, style]} accessibilityRole="radiogroup">
      {choices.map((choice, position) => {
        const isSelected = choice.value === value;
        const dividerStyle = position > 0 ? { borderLeftWidth: NB_BORDER_WIDTH, borderLeftColor: colors.border } : null;
        const fillStyle = isSelected ? { backgroundColor: colors.ink } : null;
        return (
          <Pressable
            key={String(choice.value)}
            onPress={() => onChange(choice.value)}
            accessibilityRole="radio"
            accessibilityLabel={choice.label}
            accessibilityState={{ selected: isSelected }}
            style={[styles.segment, dividerStyle, fillStyle]}
          >
            <Text numberOfLines={1} style={[styles.segmentLabel, { color: isSelected ? colors.onInk : colors.ink }]}>
              {choice.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default NbSegmented;

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderWidth: NB_BORDER_WIDTH,
    borderRadius: NB_RADIUS.chip,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    minHeight: MINIMUM_TOUCH_SIZE,
    paddingHorizontal: NB_SPACING.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: { fontSize: SEGMENT_FONT_SIZE, fontWeight: '700' },
});
