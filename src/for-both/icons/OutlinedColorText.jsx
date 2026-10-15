// Brand gradient stroke around solid-fill text, drawn with SVG after a hidden Text measures size.
// Flow: measure the string with an invisible Text → size the SVG → stroke then fill on top.
// Used by: food search headlines and weekly-report bars. Falls back to plain Text before measure.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Text as SvgText, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

// ===== NAMED CONSTANTS =====

export const BRAND_GRADIENT = ['#6D28D9', '#C2410C'];

const DEFAULT_FONT_SIZE = 17;
const DEFAULT_FONT_WEIGHT = '800';
const DEFAULT_FILL_COLOR = '#FFFFFF';
const DEFAULT_LETTER_SPACING = 0;
const DEFAULT_NUMBER_OF_LINES = 1;
const ANCHOR_START = 'start';
const ANCHOR_MIDDLE = 'middle';
const ANCHOR_END = 'end';
const TEXT_ALIGN_CENTER = 'center';
const WIDTH_FULL = '100%';
const ALIGN_STRETCH = 'stretch';
const STROKE_WIDTH_RATIO = 0.065;
const MIN_STROKE_WIDTH = 1;
const STROKE_PADDING_MULTIPLIER = 2;
const UNMEASURED_HEIGHT_RATIO = 1.35;
const BASELINE_STROKE_OFFSET = 0.5;
const GRADIENT_ID_PREFIX = 'brandStroke';

let gradientIdCounter = 0;

// ===== HELPER FUNCTIONS =====

/**
 * Outline thickness scales with font size so a 32px title is not using a 1px hairline.
 * @param {number} fontSize
 * @param {number} [strokeWidth]
 * @returns {number}
 */
function resolveStrokeWidth(fontSize, strokeWidth) {
  return strokeWidth ?? Math.max(MIN_STROKE_WIDTH, Math.round(fontSize * STROKE_WIDTH_RATIO));
}

/**
 * SVG textAnchor from the prop or a centered textAlign in style.
 * @param {string} textAnchor
 * @param {object} flatStyle
 * @returns {{ isCentered: boolean, anchor: string, isFullWidth: boolean }}
 */
function resolveTextAnchor(textAnchor, flatStyle) {
  const isCentered = textAnchor === ANCHOR_MIDDLE || flatStyle.textAlign === TEXT_ALIGN_CENTER;
  const anchor = isCentered ? ANCHOR_MIDDLE : textAnchor;
  const isFullWidth = flatStyle.width === WIDTH_FULL || flatStyle.alignSelf === ALIGN_STRETCH;
  return { isCentered, anchor, isFullWidth };
}

/**
 * X position of the SVG text: padded on the left, centered, or right-aligned.
 * @param {string} anchor
 * @param {number} svgWidth
 * @param {number} pad
 * @returns {number}
 */
function svgTextX(anchor, svgWidth, pad) {
  if (anchor === ANCHOR_MIDDLE && svgWidth) return svgWidth / 2;
  if (anchor === ANCHOR_END && svgWidth) return svgWidth - pad;
  return pad;
}

function textFromChildren(children) {
  return String(children ?? '');
}

function rememberMeasuredSize(layoutEvent, setSize) {
  const { width, height } = layoutEvent.nativeEvent.layout;
  if (width > 0) setSize({ width, height });
}

// ===== MAIN FUNCTION =====

/**
 * Solid fill + purple→orange gradient stroke (SVG). Measures with hidden Text first.
 * @param {object} props
 */
export default function OutlinedColorText({
  children,
  fontSize = DEFAULT_FONT_SIZE,
  fontWeight = DEFAULT_FONT_WEIGHT,
  fillColor = DEFAULT_FILL_COLOR,
  strokeWidth,
  letterSpacing = DEFAULT_LETTER_SPACING,
  numberOfLines = DEFAULT_NUMBER_OF_LINES,
  style,
  textAnchor = ANCHOR_START,
  enabled = true,
}) {
  const text = textFromChildren(children);
  const stroke = resolveStrokeWidth(fontSize, strokeWidth);
  // vocab: useState = remember the measured width/height. Starts null until onLayout fires.
  const [size, setSize] = useState(null);
  // vocab: useMemo = mint one gradient id per mount so two headlines do not share a stroke.
  const gradientId = useMemo(() => `${GRADIENT_ID_PREFIX}${++gradientIdCounter}`, []);
  const flatStyle = StyleSheet.flatten(style) || {};
  const { isCentered, anchor, isFullWidth } = resolveTextAnchor(textAnchor, flatStyle);

  const baseTextStyle = useMemo(
    () => ({
      fontSize,
      fontWeight,
      letterSpacing,
    }),
    [fontSize, fontWeight, letterSpacing],
  );

  // 1. Disabled or empty → plain Text, no SVG outline.
  if (!enabled || !text) {
    return (
      <Text style={[baseTextStyle, style, { color: fillColor }]} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  // 2. Before we know the width, show solid fill so the headline is not blank.
  // 3. After measure, stroke the gradient then fill on top.
  const pad = stroke * STROKE_PADDING_MULTIPLIER;
  const svgWidth = size ? Math.ceil(size.width) + pad * STROKE_PADDING_MULTIPLIER : 0;
  const svgHeight = size ? Math.ceil(size.height) + stroke * STROKE_PADDING_MULTIPLIER : Math.ceil(fontSize * UNMEASURED_HEIGHT_RATIO);
  const baselineY = fontSize + stroke * BASELINE_STROKE_OFFSET;
  const textX = svgTextX(anchor, svgWidth, pad);
  const isMeasured = Boolean(size) && svgWidth > 0;

  return (
    <View
      style={[
        styles.wrap,
        isCentered && (isFullWidth ? styles.wrapCenterFull : styles.wrapCenter),
        !isCentered && anchor === ANCHOR_END && styles.wrapEnd,
        style,
      ]}
      collapsable={false}
    >
      <Text
        style={[baseTextStyle, styles.measure]}
        numberOfLines={numberOfLines}
        onLayout={(layoutEvent) => rememberMeasuredSize(layoutEvent, setSize)}
      >
        {text}
      </Text>
      {!isMeasured ? (
        <Text style={[baseTextStyle, { color: fillColor }]} numberOfLines={numberOfLines}>
          {text}
        </Text>
      ) : (
        <Svg width={svgWidth} height={svgHeight} style={styles.svg}>
          <Defs>
            <SvgGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={BRAND_GRADIENT[0]} stopOpacity="1" />
              <Stop offset="100%" stopColor={BRAND_GRADIENT[1]} stopOpacity="1" />
            </SvgGradient>
          </Defs>
          <SvgText
            x={textX}
            y={baselineY}
            textAnchor={anchor}
            fontSize={fontSize}
            fontWeight={fontWeight}
            letterSpacing={letterSpacing}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={stroke}
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            {text}
          </SvgText>
          <SvgText
            x={textX}
            y={baselineY}
            textAnchor={anchor}
            fontSize={fontSize}
            fontWeight={fontWeight}
            letterSpacing={letterSpacing}
            fill={fillColor}
          >
            {text}
          </SvgText>
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
  wrapCenterFull: {
    alignSelf: 'stretch',
    alignItems: 'center',
    width: '100%',
  },
  wrapEnd: {
    alignSelf: 'flex-end',
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
