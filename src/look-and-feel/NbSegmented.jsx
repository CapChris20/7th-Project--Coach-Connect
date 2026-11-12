// Design Law segmented control — HardShadow track, one selected cell, solid fill (not a gradient).
// Flow: row of equal segments → tap → onSelect(id). Used by Plan|Notes|Videos, Add food tabs, New plan.
// vocab: segmented = mutually exclusive tabs in one outlined track
// Manipulate here: segment height (44), border (nb.borderWidth), shadow offset

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { borderRadius, nb } from './colorPalette';
import { useTheme } from './lightDarkMode';
import HardShadow from './HardShadow';

/**
 * @param {object} props
 * @param {Array<{id: string, label: string}>} props.segments
 * @param {string} props.selected
 * @param {Function} props.onSelect
 * @param {object} [props.style]
 */
export default function NbSegmented({ segments, selected, onSelect, style }) {
  const { colors } = useTheme();

  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbChip} style={style}>
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.nbSurface,
            borderColor: colors.nbBorder,
          },
        ]}
      >
        {segments.map((segment, index) => {
          const isSelected = selected === segment.id;
          const isFirst = index === 0;
          const isLast = index === segments.length - 1;

          return (
            <Pressable
              key={segment.id}
              onPress={() => onSelect(segment.id)}
              style={styles.pressable}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <View
                style={[
                  styles.segment,
                  isFirst && styles.firstSegment,
                  isLast && styles.lastSegment,
                  !isFirst && {
                    borderLeftWidth: nb.borderWidth,
                    borderLeftColor: colors.nbBorder,
                  },
                  isSelected && { backgroundColor: colors.nbFill },
                ]}
              >
                <Text
                  style={[
                    styles.text,
                    { color: isSelected ? colors.nbOnFill : colors.nbInk },
                  ]}
                  numberOfLines={1}
                >
                  {segment.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
    minHeight: nb.minTouchTarget,
  },
  pressable: {
    flex: 1,
  },
  segment: {
    minHeight: nb.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  firstSegment: {
    borderTopLeftRadius: borderRadius.nbChip - nb.borderWidth,
    borderBottomLeftRadius: borderRadius.nbChip - nb.borderWidth,
  },
  lastSegment: {
    borderTopRightRadius: borderRadius.nbChip - nb.borderWidth,
    borderBottomRightRadius: borderRadius.nbChip - nb.borderWidth,
  },
  text: {
    fontSize: 14,
    fontWeight: '800',
  },
});
