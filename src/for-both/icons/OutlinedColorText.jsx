// Headline text with brand gradient stroke — hidden Text measures, then SVG stroke + solid fill.
// Flow: early plain Text when off/empty → measure pass → gradient stroke layer → fill on top.
// Used by food search headlines and weekly-report bars.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Text as SvgText, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { lightColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: stroke gradient stops (pink → orange). Exported for callers that reuse the brand pair.
export const BRAND_GRADIENT = ['#FF6B9D', '#FB923C'];

const DEFAULT_FONT_SIZE = 17;
const DEFAULT_FONT_WEIGHT = '800';
const DEFAULT_FILL_COLOR = lightColors.white;
const DEFAULT_LETTER_SPACING = 0;
const DEFAULT_NUMBER_OF_LINES = 1;

const ANCHOR_START = 'start';
const ANCHOR_MIDDLE = 'middle';
const ANCHOR_END = 'end';
const TEXT_ALIGN_CENTER = 'center';
const WIDTH_FULL = '100%';
const ALIGN_STRETCH = 'stretch';

// Manipulate here: stroke thickness scales with fontSize (ratio × size, floored at min).
const STROKE_WIDTH_RATIO = 0.065;
const MIN_STROKE_WIDTH = 1;
const STROKE_PADDING_MULTIPLIER = 2;
const UNMEASURED_HEIGHT_RATIO = 1.35;
const BASELINE_STROKE_OFFSET = 0.5;
const GRADIENT_ID_PREFIX = 'brandStroke';

// Module counter so two headlines never share the same url(#…) id.
let gradientIdCounter = 0;

// ===== HELPER FUNCTIONS =====

function strokePixelsForFontSize(fontSize, explicitStrokeWidth) {
  if (explicitStrokeWidth != null) {
    return explicitStrokeWidth;
  }
  const scaledStroke = Math.round(fontSize * STROKE_WIDTH_RATIO);
  return Math.max(MIN_STROKE_WIDTH, scaledStroke);
}

function layoutFromTextAnchor(textAnchor, flatStyle) {
  const textAlignIsCenter = flatStyle.textAlign === TEXT_ALIGN_CENTER;
  const anchorAskedForMiddle = textAnchor === ANCHOR_MIDDLE;
  const isCentered = anchorAskedForMiddle || textAlignIsCenter;
  const anchor = isCentered ? ANCHOR_MIDDLE : textAnchor;
  const widthIsFull = flatStyle.width === WIDTH_FULL;
  const alignSelfStretches = flatStyle.alignSelf === ALIGN_STRETCH;
  const isFullWidth = widthIsFull || alignSelfStretches;
  return { isCentered, anchor, isFullWidth };
}

function horizontalSvgTextPosition(anchor, svgWidth, sidePad) {
  if (anchor === ANCHOR_MIDDLE && svgWidth) {
    return svgWidth / 2;
  }
  if (anchor === ANCHOR_END && svgWidth) {
    return svgWidth - sidePad;
  }
  return sidePad;
}

function saveSizeFromLayoutEvent(layoutEvent, setMeasuredSize) {
  const layoutBox = layoutEvent.nativeEvent.layout;
  const measuredWidth = layoutBox.width;
  const measuredHeight = layoutBox.height;
  if (measuredWidth > 0) {
    setMeasuredSize({ width: measuredWidth, height: measuredHeight });
  }
}

function wrapStylesForAnchor({ isCentered, anchor, isFullWidth }, callerStyle) {
  const wrapPieces = [styles.wrap];

  if (isCentered && isFullWidth) {
    wrapPieces.push(styles.wrapCenterFull);
  }
  if (isCentered && !isFullWidth) {
    wrapPieces.push(styles.wrapCenter);
  }
  if (!isCentered && anchor === ANCHOR_END) {
    wrapPieces.push(styles.wrapEnd);
  }

  wrapPieces.push(callerStyle);
  return wrapPieces;
}

function svgBoxSizesFromMeasure(measuredSize, sidePad, strokePixels, fontSize) {
  if (!measuredSize) {
    return {
      svgWidth: 0,
      svgHeight: Math.ceil(fontSize * UNMEASURED_HEIGHT_RATIO),
    };
  }

  const svgWidth =
    Math.ceil(measuredSize.width) + sidePad * STROKE_PADDING_MULTIPLIER;
  const svgHeight =
    Math.ceil(measuredSize.height) + strokePixels * STROKE_PADDING_MULTIPLIER;
  return { svgWidth, svgHeight };
}

function paintHeadlineAfterMeasure({
  hasMeasuredBox,
  displayText,
  baseTextStyle,
  fillColor,
  numberOfLines,
  svgWidth,
  svgHeight,
  gradientId,
  textX,
  baselineY,
  anchor,
  fontSize,
  fontWeight,
  letterSpacing,
  strokePixels,
}) {
  if (!hasMeasuredBox) {
    return (
      <WaitingForMeasureFill
        baseTextStyle={baseTextStyle}
        fillColor={fillColor}
        numberOfLines={numberOfLines}
        text={displayText}
      />
    );
  }

  return (
    <GradientStrokedSvgText
      text={displayText}
      svgWidth={svgWidth}
      svgHeight={svgHeight}
      gradientId={gradientId}
      textX={textX}
      baselineY={baselineY}
      anchor={anchor}
      fontSize={fontSize}
      fontWeight={fontWeight}
      letterSpacing={letterSpacing}
      strokePixels={strokePixels}
      fillColor={fillColor}
    />
  );
}

// ===== SMALL LAYOUT PIECES =====

function PlainFilledHeadline({ text, baseTextStyle, callerStyle, fillColor, numberOfLines }) {
  const filledStyle = [baseTextStyle, callerStyle, { color: fillColor }];
  return (
    <Text style={filledStyle} numberOfLines={numberOfLines}>
      {text}
    </Text>
  );
}

function HiddenMeasureText({ text, baseTextStyle, numberOfLines, onMeasuredLayout }) {
  const measureStyle = [baseTextStyle, styles.measure];
  return (
    <Text
      style={measureStyle}
      numberOfLines={numberOfLines}
      onLayout={onMeasuredLayout}
    >
      {text}
    </Text>
  );
}

function GradientStrokedSvgText({
  text,
  svgWidth,
  svgHeight,
  gradientId,
  textX,
  baselineY,
  anchor,
  fontSize,
  fontWeight,
  letterSpacing,
  strokePixels,
  fillColor,
}) {
  const strokePaintUrl = `url(#${gradientId})`;
  const pinkStop = BRAND_GRADIENT[0];
  const orangeStop = BRAND_GRADIENT[1];

  return (
    <Svg width={svgWidth} height={svgHeight} style={styles.svg}>
      <Defs>
        <SvgGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={pinkStop} stopOpacity="1" />
          <Stop offset="100%" stopColor={orangeStop} stopOpacity="1" />
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
        stroke={strokePaintUrl}
        strokeWidth={strokePixels}
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
  );
}

function WaitingForMeasureFill({ baseTextStyle, fillColor, numberOfLines, text }) {
  const waitingStyle = [baseTextStyle, { color: fillColor }];
  return (
    <Text style={waitingStyle} numberOfLines={numberOfLines}>
      {text}
    </Text>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Brand-gradient outlined headline. Falls back to plain filled Text when disabled or empty.
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {number} [props.fontSize]
 * @param {string} [props.fontWeight]
 * @param {string} [props.fillColor]
 * @param {number} [props.strokeWidth]
 * @param {number} [props.letterSpacing]
 * @param {number} [props.numberOfLines]
 * @param {object} [props.style]
 * @param {string} [props.textAnchor]
 * @param {boolean} [props.enabled]
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
  // vocab/symbol: ?? = use right side only when left is null/undefined (empty string still wins).
  const displayText = String(children ?? '');
  const strokePixels = strokePixelsForFontSize(fontSize, strokeWidth);

  // vocab: useState holds measured box until hidden Text onLayout runs.
  // Hook order frozen: useState → useMemo(gradientId) → useMemo(baseTextStyle).
  const [measuredSize, setMeasuredSize] = useState(null);

  // vocab: useMemo mints one gradient id per mount so two headlines do not share url(#…).
  const gradientId = useMemo(() => `${GRADIENT_ID_PREFIX}${++gradientIdCounter}`, []);

  const flatStyle = StyleSheet.flatten(style) || {};
  const anchorLayout = layoutFromTextAnchor(textAnchor, flatStyle);

  const baseTextStyle = useMemo(
    () => ({
      fontSize,
      fontWeight,
      letterSpacing,
    }),
    [fontSize, fontWeight, letterSpacing],
  );

  // 1. Off or empty copy → skip SVG work and show plain filled Text.
  const shouldSkipSvg = !enabled || !displayText;
  if (shouldSkipSvg) {
    return (
      <PlainFilledHeadline
        text={displayText}
        baseTextStyle={baseTextStyle}
        callerStyle={style}
        fillColor={fillColor}
        numberOfLines={numberOfLines}
      />
    );
  }

  // 2. Size the SVG from the hidden measure pass (or a tall guess before layout).
  const sidePad = strokePixels * STROKE_PADDING_MULTIPLIER;
  const boxSizes = svgBoxSizesFromMeasure(
    measuredSize,
    sidePad,
    strokePixels,
    fontSize,
  );
  const baselineY = fontSize + strokePixels * BASELINE_STROKE_OFFSET;
  const textX = horizontalSvgTextPosition(anchorLayout.anchor, boxSizes.svgWidth, sidePad);
  const hasMeasuredBox = Boolean(measuredSize) && boxSizes.svgWidth > 0;
  const wrapStyleList = wrapStylesForAnchor(anchorLayout, style);

  const onMeasuredLayout = (layoutEvent) => {
    saveSizeFromLayoutEvent(layoutEvent, setMeasuredSize);
  };

  // Named before JSX — waiting fill until measure, then stroke + fill.
  const paintedHeadline = paintHeadlineAfterMeasure({
    hasMeasuredBox,
    displayText,
    baseTextStyle,
    fillColor,
    numberOfLines,
    svgWidth: boxSizes.svgWidth,
    svgHeight: boxSizes.svgHeight,
    gradientId,
    textX,
    baselineY,
    anchor: anchorLayout.anchor,
    fontSize,
    fontWeight,
    letterSpacing,
    strokePixels,
  });

  // 3. Always run hidden measure; solid fill until box is known, then gradient stroke + fill.
  return (
    <View style={wrapStyleList} collapsable={false}>
      <HiddenMeasureText
        text={displayText}
        baseTextStyle={baseTextStyle}
        numberOfLines={numberOfLines}
        onMeasuredLayout={onMeasuredLayout}
      />
      {paintedHeadline}
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

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
