// Tap-to-select chip. Selected chips fill solid black (white in dark mode) and lift on a hard shadow.
// Flow: draw a plain chip → when selected, swap to the ink fill and shadow → optional small label above the main text.
// Used for dates, hours, durations, filters and any single-choice or multi-choice row.

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../lightDarkMode';
import { NbSurface } from './NbSurface';
import { MINIMUM_TOUCH_SIZE, NB_RADIUS, NB_SPACING, getNbColors } from './nbTokens';

// ===== NAMED CONSTANTS =====

const CHIP_FONT_SIZE = 15;
const CHIP_SMALL_FONT_SIZE = 12;

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * @param {object} props
 * @param {string} props.label Main text. Always one line.
 * @param {string} [props.smallLabel] Tiny text above the main one, such as a weekday.
 * @param {boolean} props.isSelected
 * @param {Function} props.onPress
 * @param {number} [props.width] Fixed width for date-style chips. Leave empty to size to the text.
 * @param {object} [props.style]
 * @returns {JSX.Element}
 */
export function NbChip({ label, smallLabel, isSelected, onPress, width, style }) {
  // 1. Colors for the current theme.
  const { isDark } = useTheme();
  const colors = getNbColors(isDark);
  const textColor = isSelected ? colors.onInk : colors.ink;
  const smallColor = isSelected ? colors.onInk : colors.muted;

  // 2. Selected chips get the ink fill and the shadow. Unselected chips stay flat.
  const sizeStyle = width ? { width } : null;

  // 3. Draw the chip with its label or labels.
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={smallLabel ? `${smallLabel} ${label}` : label}
      accessibilityState={{ selected: isSelected }}
    >
      <NbSurface
        fillColor={isSelected ? colors.ink : colors.chip}
        radius={NB_RADIUS.chip}
        hasShadow={isSelected}
        style={[sizeStyle, style]}
        innerStyle={styles.chipInner}
      >
        {smallLabel ? (
          <Text numberOfLines={1} style={[styles.smallLabel, { color: smallColor }]}>
            {smallLabel}
          </Text>
        ) : null}
        <Text numberOfLines={1} style={[styles.label, { color: textColor }]}>
          {label}
        </Text>
      </NbSurface>
    </Pressable>
  );
}

export default NbChip;

const styles = StyleSheet.create({
  chipInner: {
    minHeight: MINIMUM_TOUCH_SIZE,
    minWidth: MINIMUM_TOUCH_SIZE,
    paddingHorizontal: NB_SPACING.large,
    paddingVertical: NB_SPACING.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: CHIP_FONT_SIZE, fontWeight: '700' },
  smallLabel: { fontSize: CHIP_SMALL_FONT_SIZE, fontWeight: '600', textTransform: 'uppercase' },
});
