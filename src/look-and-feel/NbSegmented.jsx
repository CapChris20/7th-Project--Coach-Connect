// Neobrutalist segmented control — multiple segments with one selected
// Flow: renders segments in a row, applies ink gradient to selected segment
// Where used: toggles, mode switches, binary or ternary choices
//
// vocab: segmented control = iOS-style segment picker with one active at a time

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, nb, gradients } from './colorPalette';
import { useTheme } from './lightDarkMode';

/**
 * Segmented control with neobrutalist styling.
 * Selected segment gets ink gradient, unselected are plain surface.
 * 
 * @param {object} props
 * @param {Array<{id: string, label: string}>} props.segments - segment data
 * @param {string} props.selected - selected segment id
 * @param {Function} props.onSelect - (id) => void
 * @param {object} [props.style] - additional container styles
 */
export default function NbSegmented({ segments, selected, onSelect, style }) {
  const { colors } = useTheme();
  
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.nbSurface,
          borderColor: colors.nbBorder,
        },
        style,
      ]}
    >
      {segments.map((segment, index) => {
        const isSelected = selected === segment.id;
        const isFirst = index === 0;
        const isLast = index === segments.length - 1;
        
        const segmentContent = (
          <View
            style={[
              styles.segment,
              isFirst && styles.firstSegment,
              isLast && styles.lastSegment,
              !isFirst && {
                borderLeftWidth: nb.borderWidth,
                borderLeftColor: colors.nbBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.text,
                { color: isSelected ? '#FFFFFF' : colors.nbInk },
              ]}
              numberOfLines={1}
            >
              {segment.label}
            </Text>
          </View>
        );
        
        return (
          <Pressable
            key={segment.id}
            onPress={() => onSelect(segment.id)}
            style={styles.pressable}
          >
            {isSelected ? (
              <LinearGradient
                colors={gradients.ink.colors}
                start={gradients.ink.start}
                end={gradients.ink.end}
                style={[
                  styles.segment,
                  isFirst && styles.firstSegment,
                  isLast && styles.lastSegment,
                ]}
              >
                <Text
                  style={[
                    styles.text,
                    { color: '#FFFFFF' },
                  ]}
                  numberOfLines={1}
                >
                  {segment.label}
                </Text>
              </LinearGradient>
            ) : (
              segmentContent
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  pressable: {
    flex: 1,
  },
  segment: {
    height: 40,
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
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
});
