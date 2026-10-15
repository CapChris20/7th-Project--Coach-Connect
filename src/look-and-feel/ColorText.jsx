// Gradient text via react-native-svg (no MaskedView).
// Flow: show a solid fallback immediately → measure with a hidden Text → swap to SVG gradient.
// Used by: home banners, food cards, coach home. Avoids the blank flicker MaskedView had in dev builds.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Text as SvgText, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

// ===== NAMED CONSTANTS =====

const DEFAULT_COLORS = ['#E94EAD', '#6B3AD9'];
const SINGLE_COLOR_FALLBACK = '#A348D0';
const DEFAULT_FONT_SIZE = 14;
const DEFAULT_FONT_WEIGHT = '400';
const DEFAULT_LETTER_SPACING = 0;
const DEFAULT_TEXT_ALIGN = 'left';
const ALIGN_CENTER = 'center';
const ALIGN_RIGHT = 'right';
const ANCHOR_MIDDLE = 'middle';
const ANCHOR_END = 'end';
const ANCHOR_START = 'start';
const AXIS_X = 'x';
const AXIS_Y = 'y';
const PERCENT = 100;
const DEFAULT_LINE_HEIGHT_RATIO = 1.12;
const UNMEASURED_LINE_HEIGHT_RATIO = 1.25;
const BASELINE_OFFSET_RATIO = 0.35;
const GRADIENT_ID_PREFIX = 'sgt';
const DEFAULT_START = { x: 0, y: 0 };
const DEFAULT_END = { x: 1, y: 0 };

let gradientIdCounter = 0;

// ===== HELPER FUNCTIONS =====

/**
 * Solid color shown before the SVG is measured. Middle stop if there are several.
 * @param {string[]} colors
 * @returns {string}
 */
function pickFallbackColor(colors) {
  if (!colors?.length) return SINGLE_COLOR_FALLBACK;
  if (colors.length === 1) return colors[0];
  return colors[Math.floor(colors.length / 2)];
}

/**
 * Turn a 0–1 gradient coordinate into an SVG percent string.
 * Missing x/y default to 0; any other axis defaults to 1 (the original end-stop).
 * @param {number} fraction
 * @param {string} axis
 * @returns {string}
 */
function fractionToPercent(fraction, axis) {
  const axisFraction = fraction ?? (axis === AXIS_X ? 0 : axis === AXIS_Y ? 0 : 1);
  return `${Math.round(axisFraction * PERCENT)}%`;
}

/**
 * SVG textAnchor from CSS textAlign.
 * @param {string} align
 * @returns {string}
 */
function textAnchorFromAlign(align) {
  if (align === ALIGN_CENTER) return ANCHOR_MIDDLE;
  if (align === ALIGN_RIGHT) return ANCHOR_END;
  return ANCHOR_START;
}

/**
 * Stop offset along the gradient. One color sits at 0%; several are spaced evenly.
 * @param {number} stopIndex
 * @param {number} colorCount
 * @returns {string}
 */
function gradientStopOffset(stopIndex, colorCount) {
  if (colorCount === 1) return '0%';
  return `${(stopIndex / (colorCount - 1)) * PERCENT}%`;
}

/**
 * X of the SVG text: 0, centered, or right edge.
 * @param {string} anchor
 * @param {number} svgWidth
 * @returns {number}
 */
function svgTextX(anchor, svgWidth) {
  if (anchor === ANCHOR_MIDDLE && svgWidth) return svgWidth / 2;
  if (anchor === ANCHOR_END && svgWidth) return svgWidth;
  return 0;
}

// ===== MAIN FUNCTION =====

/**
 * Gradient-filled text. Children that are not a string/number skip SVG and render as plain Text.
 * @param {object} props
 */
export default function ColorText({
  children,
  style,
  colors = DEFAULT_COLORS,
  start = DEFAULT_START,
  end = DEFAULT_END,
  textProps,
  numberOfLines,
  fallbackColor,
}) {
  const text =
    typeof children === 'string' || typeof children === 'number' ? String(children) : null;
  const flatStyle = StyleSheet.flatten(style) || {};
  const fontSize = flatStyle.fontSize ?? DEFAULT_FONT_SIZE;
  const fontWeight = flatStyle.fontWeight ?? DEFAULT_FONT_WEIGHT;
  const letterSpacing = flatStyle.letterSpacing ?? DEFAULT_LETTER_SPACING;
  const lineHeight = flatStyle.lineHeight;
  const fontFamily = flatStyle.fontFamily;
  const align = flatStyle.textAlign ?? DEFAULT_TEXT_ALIGN;
  const fallback = fallbackColor ?? pickFallbackColor(colors);
  const lines = numberOfLines ?? flatStyle.numberOfLines;

  const [size, setSize] = useState(null);
  const gradientId = useMemo(() => `${GRADIENT_ID_PREFIX}${++gradientIdCounter}`, []);

  const baseTextStyle = useMemo(
    () => ({
      fontSize,
      fontWeight,
      letterSpacing,
      lineHeight,
      fontFamily,
      textAlign: align,
    }),
    [fontSize, fontWeight, letterSpacing, lineHeight, fontFamily, align],
  );

  if (!text) {
    return (
      <Text {...textProps} style={[style, { color: fallback }]} numberOfLines={lines}>
        {children}
      </Text>
    );
  }

  const textLines = text.split('\n');
  const isMultiline = textLines.length > 1;
  const isCentered = align === ALIGN_CENTER;
  const anchor = textAnchorFromAlign(align);
  const lineHeightPx = lineHeight || fontSize * DEFAULT_LINE_HEIGHT_RATIO;
  const svgHeight = size
    ? Math.ceil(size.height)
    : Math.ceil(isMultiline ? textLines.length * lineHeightPx : lineHeight || fontSize * UNMEASURED_LINE_HEIGHT_RATIO);
  const svgWidth = size ? Math.ceil(size.width) : 0;
  const baselineY = fontSize + (lineHeightPx - fontSize) * BASELINE_OFFSET_RATIO;
  const textX = svgTextX(anchor, svgWidth);
  const isReady = size && svgWidth > 0;

  return (
    <View
      style={[
        styles.wrap,
        isCentered ? styles.wrapCenter : null,
        flatStyle.alignSelf ? { alignSelf: flatStyle.alignSelf } : null,
        flatStyle.width ? { width: flatStyle.width } : null,
      ]}
      collapsable={false}
    >
      <Text
        {...textProps}
        style={[baseTextStyle, styles.measure, flatStyle]}
        numberOfLines={lines}
        onLayout={(layoutEvent) => {
          const { width, height } = layoutEvent.nativeEvent.layout;
          if (width > 0 && height > 0) setSize({ width, height });
        }}
      >
        {text}
      </Text>
      {!isReady ? (
        <Text {...textProps} style={[baseTextStyle, flatStyle, { color: fallback }]} numberOfLines={lines}>
          {text}
        </Text>
      ) : (
        <Svg width={svgWidth} height={svgHeight} style={styles.svg}>
          <Defs>
            <SvgGradient
              id={gradientId}
              x1={fractionToPercent(start.x, AXIS_X)}
              y1={fractionToPercent(start.y, AXIS_Y)}
              x2={fractionToPercent(end.x, AXIS_X)}
              y2={fractionToPercent(end.y, AXIS_Y)}
            >
              {colors.map((color, stopIndex) => (
                <Stop
                  key={`${color}-${stopIndex}`}
                  offset={gradientStopOffset(stopIndex, colors.length)}
                  stopColor={color}
                />
              ))}
            </SvgGradient>
          </Defs>
          {textLines.map((line, lineIndex) => (
            <SvgText
              key={`${line}-${lineIndex}`}
              x={textX}
              y={baselineY + lineIndex * lineHeightPx}
              textAnchor={anchor}
              fontSize={fontSize}
              fontWeight={fontWeight}
              letterSpacing={letterSpacing}
              fontFamily={fontFamily}
              fill={`url(#${gradientId})`}
            >
              {line}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  wrapCenter: {
    alignSelf: 'center',
  },
  measure: {
    opacity: 0,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  svg: {
    overflow: 'visible',
  },
});
