// Design Law segmented control — HardShadow track, one selected cell, solid fill (not a gradient).
// Flow: HardShadow track → equal-width cells → tap → onSelect(id).
// Where used: Plan|Notes|Videos, Add food tabs, New plan type picker.
//
// vocab: segmented = mutually exclusive tabs in one outlined track
//        HardShadow = Design Law offset slab behind the chip (no blur)
// Manipulate here: minHeight = nb.minTouchTarget (44); border = nb.borderWidth; shadow offset small

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { borderRadius, nb } from './colorPalette';
import { useTheme } from './lightDarkMode';
import HardShadow from './HardShadow';

// ===== NAMED CONSTANTS =====
// (track / segment sizes live in StyleSheet plumbing)

// ===== HELPER FUNCTIONS =====

/**
 * Interior dividers sit between cells — first cell has no left border.
 */
function buildDividerStyle(isFirstCell, borderColor) {
  if (isFirstCell) {
    return null;
  }
  return {
    borderLeftWidth: nb.borderWidth,
    borderLeftColor: borderColor,
  };
}

/**
 * Selected cell paints solid nbFill. Unselected stays transparent over the track.
 */
function buildSegmentBackground(isSelected, fillColor) {
  if (!isSelected) {
    return null;
  }
  return { backgroundColor: fillColor };
}

/**
 * Selected label uses on-fill ink; unselected uses normal ink.
 */
function buildLabelColor(isSelected, onFillColor, inkColor) {
  if (isSelected) {
    return onFillColor;
  }
  return inkColor;
}

/**
 * Round only the outer corners so the track’s radius reads through.
 */
function pickCornerStyles(isFirstCell, isLastCell) {
  if (isFirstCell) {
    return styles.firstSegment;
  }
  if (isLastCell) {
    return styles.lastSegment;
  }
  return null;
}

/**
 * Build one Pressable cell per segment. Map lives here so the main stays a recipe.
 */
function buildSegmentCellNodes(segments, selectedId, onSelect, themeColors) {
  const segmentCount = segments.length;
  const cellNodes = [];
  let index = 0;

  while (index < segmentCount) {
    const segment = segments[index];
    cellNodes.push(
      <SegmentCell
        key={segment.id}
        segment={segment}
        index={index}
        segmentCount={segmentCount}
        selectedId={selectedId}
        onSelect={onSelect}
        themeColors={themeColors}
      />,
    );
    index += 1;
  }

  return cellNodes;
}

// ===== SMALL UI PIECES =====

/**
 * One equal-flex tab. Press calls onSelect with this segment’s id.
 */
function SegmentCell({
  segment,
  index,
  segmentCount,
  selectedId,
  onSelect,
  themeColors,
}) {
  const isSelected = selectedId === segment.id;
  const isFirstCell = index === 0;
  const isLastCell = index === segmentCount - 1;

  const dividerStyle = buildDividerStyle(isFirstCell, themeColors.nbBorder);
  const selectedBackground = buildSegmentBackground(isSelected, themeColors.nbFill);
  const labelColor = buildLabelColor(
    isSelected,
    themeColors.nbOnFill,
    themeColors.nbInk,
  );
  const cornerStyle = pickCornerStyles(isFirstCell, isLastCell);

  // vocab: accessibilityState.selected tells VoiceOver this tab is the active one
  return (
    <Pressable
      onPress={() => onSelect(segment.id)}
      style={styles.pressable}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <View style={[styles.segment, cornerStyle, dividerStyle, selectedBackground]}>
        <Text style={[styles.text, { color: labelColor }]} numberOfLines={1}>
          {segment.label}
        </Text>
      </View>
    </Pressable>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Hard-shadow segmented control — solid selected fill, equal flex cells.
 *
 * @param {object} props
 * @param {Array<{id: string, label: string}>} props.segments
 * @param {string} props.selected - id of the active segment
 * @param {Function} props.onSelect - called with the tapped segment id
 * @param {object} [props.style]
 */
export default function NbSegmented({ segments, selected, onSelect, style }) {
  // vocab: useTheme = ThemeProvider hook → light/dark Design Law color bag
  const { colors: themeColors } = useTheme();

  // 1. Theme the track shell (surface + border) once for the whole row.
  const trackBorderColor = themeColors.nbBorder;
  const trackBackground = themeColors.nbSurface;
  const trackThemeStyle = {
    backgroundColor: trackBackground,
    borderColor: trackBorderColor,
  };

  // 2. HardShadow lifts the track; equal-flex cells paint inside.
  const cellNodes = buildSegmentCellNodes(
    segments,
    selected,
    onSelect,
    themeColors,
  );

  return (
    <HardShadow
      offset={nb.shadowOffsetSmall}
      radius={borderRadius.nbChip}
      style={style}
    >
      <View style={[styles.container, trackThemeStyle]}>{cellNodes}</View>
    </HardShadow>
  );
}

// ===== PLUMBING — skip unless debugging =====

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
