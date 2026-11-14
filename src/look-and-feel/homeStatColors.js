// Gradient pairs for home stat labels, plus a solid word with a gradient outline ring.
// Flow: pick a frozen gradient pair → stack eight shifted gradient copies → paint solid fill on top.
// Used by: home stat numbers that need a colored ring around theme-colored type.
//
// vocab: ColorText = masked gradient fill on glyphs (see ColorText.jsx)
// vocab: outline ring = eight absolute copies offset by stroke — fake stroke without Skia
// Manipulate here: DEFAULT_OUTLINE_STROKE_WIDTH; OUTLINE_DIRECTION_STEPS are × stroke

import React from 'react';
import { Text, View } from 'react-native';
import ColorText from './ColorText';

// ===== NAMED CONSTANTS =====
// Stat gradient pairs (export keys frozen)

/** Today workout — gold + pink */
export const HOME_STAT_WORKOUT_GRADIENT = ['#FBBF24', '#FB7185'];
/** Water intake — cyan → deep blue */
export const HOME_STAT_WATER_GRADIENT = ['#22D3EE', '#1D4ED8'];
/** Sleep — dark orange + dark purple */
export const HOME_STAT_SLEEP_GRADIENT = ['#FDA4AF', '#FB7185'];
/** Soreness — dark orange + dark pink */
export const HOME_STAT_SORENESS_GRADIENT = ['#C2410C', '#DB2777'];
/** Energy — cyan + purple */
export const HOME_STAT_ENERGY_GRADIENT = ['#FDA4AF', '#FB923C'];
/** Stress — gold + pink */
export const HOME_STAT_STRESS_GRADIENT = ['#FBBF24', '#FB7185'];
/** Mood — cyan → orange */
export const HOME_STAT_MOOD_GRADIENT = ['#06B6D4', '#F97316'];

// Eight directions, including diagonals. Each pair is one copy of the gradient word behind the fill.
// Manipulate here: these are steps of 1 before they are multiplied by the stroke width.
const OUTLINE_DIRECTION_STEPS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
];

// Manipulate here: higher stroke pushes the ring farther out and makes the outline thicker.
const DEFAULT_OUTLINE_STROKE_WIDTH = 1.25;

// ===== HELPER FUNCTIONS =====

/**
 * Absolute position + translate for one outline copy.
 * pointerEvents none is set on the View so the ring does not steal taps.
 *
 * @param {number} stepX
 * @param {number} stepY
 * @param {number} strokeWidth
 * @returns {object}
 */
function buildOutlineCopyPositionStyle(stepX, stepY, strokeWidth) {
  const shiftX = stepX * strokeWidth;
  const shiftY = stepY * strokeWidth;

  return {
    position: 'absolute',
    transform: [{ translateX: shiftX }, { translateY: shiftY }],
  };
}

/**
 * Thin alias so home stats can import one name; behavior is identical to ColorText.
 *
 * @param {{ children?: import('react').ReactNode, style?: object, colors?: string[], start?: object, end?: object, textProps?: object }} props
 */
export function StatColorText({ children, style, colors, start, end, textProps }) {
  return (
    <ColorText style={style} colors={colors} start={start} end={end} textProps={textProps}>
      {children}
    </ColorText>
  );
}

/**
 * One shifted gradient layer in the eight-direction ring.
 */
function OneGradientOutlineCopy({
  stepX,
  stepY,
  strokeWidth,
  style,
  colors,
  start,
  end,
  textProps,
  children,
}) {
  const copyPositionStyle = buildOutlineCopyPositionStyle(stepX, stepY, strokeWidth);

  return (
    <View style={copyPositionStyle} pointerEvents="none">
      <StatColorText style={style} colors={colors} start={start} end={end} textProps={textProps}>
        {children}
      </StatColorText>
    </View>
  );
}

/**
 * Paint all eight outline copies under the solid fill.
 */
function paintEightOutlineCopies({
  strokeWidth,
  style,
  colors,
  start,
  end,
  textProps,
  children,
}) {
  return OUTLINE_DIRECTION_STEPS.map(([stepX, stepY], ringIndex) => (
    <OneGradientOutlineCopy
      key={`ring-${ringIndex}`}
      stepX={stepX}
      stepY={stepY}
      strokeWidth={strokeWidth}
      style={style}
      colors={colors}
      start={start}
      end={end}
      textProps={textProps}
    >
      {children}
    </OneGradientOutlineCopy>
  ));
}

/**
 * Solid fill glyph on top of the ring. fillColor comes from the active theme.
 */
function SolidFillStatText({ children, style, fillColor, textProps }) {
  const fillStyle = [style, { color: fillColor }];

  return (
    <Text {...textProps} style={fillStyle}>
      {children}
    </Text>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Solid fillColor text with a gradient ring made from shifted copies of the same word.
 *
 * @param {{ children?: import('react').ReactNode, style?: object, colors?: string[], fillColor?: string, stroke?: number, start?: object, end?: object, textProps?: object }} props
 */
export function GradientOutlineText({
  children,
  style,
  colors,
  fillColor,
  stroke = DEFAULT_OUTLINE_STROKE_WIDTH,
  start,
  end,
  textProps,
}) {
  // 1. Center the stack so absolute outline copies share the same anchor as the fill.
  const wrapStyle = { alignItems: 'center', justifyContent: 'center' };

  // 2. Eight gradient copies form the ring behind the solid word.
  const outlineRingCopies = paintEightOutlineCopies({
    strokeWidth: stroke,
    style,
    colors,
    start,
    end,
    textProps,
    children,
  });

  // 3. Solid ink on top; fillColor comes from the active theme.
  return (
    <View style={wrapStyle}>
      {outlineRingCopies}
      <SolidFillStatText style={style} fillColor={fillColor} textProps={textProps}>
        {children}
      </SolidFillStatText>
    </View>
  );
}
