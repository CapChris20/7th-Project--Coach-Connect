// Design Law chapter progress — thick outlined segments (prior solid, current partial).
// Flow: sanitize counts → one segment per chapter → solid / clipped fill / empty.
// Where used: client and trainer onboarding headers (chapter bars, not thin % bars).
//
// vocab: chapter = 1-indexed step; fraction = how far through the active chapter (0–1)
// Manipulate here: SEGMENT_HEIGHT 10, gap = spacing.xs (match onboarding PNGs)

import React from 'react';
import { View, StyleSheet } from 'react-native';

import { nb, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: height + gap must match Design Law onboarding chapter bars
const SEGMENT_HEIGHT = 10;
const MIN_CHAPTER_TOTAL = 1;

// ===== HELPER FUNCTIONS =====

/**
 * Clamp total / current / fraction so a bad caller cannot break the segment list.
 */
function sanitizeChapterProgressInputs(total, current, fraction) {
  const totalAsNumber = Number(total) || MIN_CHAPTER_TOTAL;
  const safeTotal = Math.max(MIN_CHAPTER_TOTAL, totalAsNumber);
  const safeCurrent = Math.max(0, Number(current) || 0);
  const fractionAsNumber = Number(fraction) || 0;
  const fractionNotBelowZero = Math.max(0, fractionAsNumber);
  const safeFraction = Math.min(1, fractionNotBelowZero);
  return { safeTotal, safeCurrent, safeFraction };
}

/**
 * Prior chapters (and a finished active chapter at fraction >= 1) paint solid fill.
 */
function chapterSegmentIsFullyFilled(stepNumber, safeCurrent, safeFraction) {
  const chapterIsBehindActive = stepNumber < safeCurrent;
  const activeChapterIsComplete =
    stepNumber === safeCurrent && safeFraction >= 1;
  return chapterIsBehindActive || activeChapterIsComplete;
}

/**
 * Active chapter with 0 < fraction < 1 gets a clipped fill from the left.
 */
function chapterSegmentIsPartiallyFilled(stepNumber, safeCurrent, safeFraction) {
  const isActiveChapter = stepNumber === safeCurrent;
  const fractionIsBetweenEnds = safeFraction > 0 && safeFraction < 1;
  return isActiveChapter && fractionIsBetweenEnds;
}

function partialFillWidthPercent(safeFraction) {
  return `${Math.round(safeFraction * 100)}%`;
}

function pickSegmentShellBackground(fullyFilled, themeColors) {
  if (fullyFilled) {
    return themeColors.nbFill;
  }
  return themeColors.nbSurface;
}

/**
 * Build one React node per chapter for the row.
 * Map lives here so the main stays a short recipe (no .map in the numbered body).
 */
function buildChapterSegmentNodes(safeTotal, safeCurrent, safeFraction, themeColors) {
  const segmentNodes = [];
  let segmentIndex = 0;

  while (segmentIndex < safeTotal) {
    const stepNumber = segmentIndex + 1;
    segmentNodes.push(
      <ChapterProgressSegment
        key={stepNumber}
        stepNumber={stepNumber}
        segmentIndex={segmentIndex}
        safeCurrent={safeCurrent}
        safeFraction={safeFraction}
        themeColors={themeColors}
      />,
    );
    segmentIndex += 1;
  }

  return segmentNodes;
}

// ===== SMALL UI PIECES =====

/**
 * One outlined pill. Empty / solid / partial fill decided by chapter math above.
 */
function ChapterProgressSegment({
  stepNumber,
  segmentIndex,
  safeCurrent,
  safeFraction,
  themeColors,
}) {
  const fullyFilled = chapterSegmentIsFullyFilled(
    stepNumber,
    safeCurrent,
    safeFraction,
  );
  const showPartialFill = chapterSegmentIsPartiallyFilled(
    stepNumber,
    safeCurrent,
    safeFraction,
  );

  const shellBackground = pickSegmentShellBackground(fullyFilled, themeColors);
  const needsGapBeforeThisSegment = segmentIndex > 0;
  const shellThemeStyle = {
    backgroundColor: shellBackground,
    borderColor: themeColors.nbBorder,
  };

  let partialFillNode = null;
  if (showPartialFill) {
    const partialFillStyle = {
      width: partialFillWidthPercent(safeFraction),
      backgroundColor: themeColors.nbFill,
    };
    partialFillNode = (
      <View style={[styles.partialFill, partialFillStyle]} />
    );
  }

  return (
    <View
      style={[
        styles.segment,
        shellThemeStyle,
        needsGapBeforeThisSegment && styles.gap,
      ]}
    >
      {partialFillNode}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Segmented chapter progress for multi-step onboarding headers.
 *
 * @param {object} props
 * @param {number} props.total - total chapters (Design Law client = 3)
 * @param {number} props.current - current chapter (1-indexed)
 * @param {number} [props.fraction=1] - 0–1 fill of the current chapter segment
 * @param {object} [props.style]
 */
export default function NbProgressSteps({ total, current, fraction = 1, style }) {
  // vocab: useTheme = ThemeProvider hook → light/dark Design Law color bag
  const { colors: themeColors } = useTheme();

  // 1. Clamp so bad caller values cannot break the segment list.
  const { safeTotal, safeCurrent, safeFraction } = sanitizeChapterProgressInputs(
    total,
    current,
    fraction,
  );

  // 2. One outlined segment per chapter; active chapter can show a clipped fill.
  const segmentNodes = buildChapterSegmentNodes(
    safeTotal,
    safeCurrent,
    safeFraction,
    themeColors,
  );

  return <View style={[styles.container, style]}>{segmentNodes}</View>;
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
  },
  segment: {
    flex: 1,
    height: SEGMENT_HEIGHT,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  partialFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  gap: {
    marginLeft: spacing.xs,
  },
});
