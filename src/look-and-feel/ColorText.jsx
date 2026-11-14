// Gradient text via react-native-svg (no MaskedView — avoids blank flicker in dev builds).
// Flow: solid fallback immediately → hidden Text measures size → swap to SVG gradient fill.
// Used by: home banners, food cards, coach home.
//
// vocab: SvgGradient/Stop = SVG linearGradient stops; textAnchor = SVG align (start/middle/end)
// Manipulate here: DEFAULT_GRADIENT_COLORS, line-height ratios, BASELINE_OFFSET_IN_LINE

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Text as SvgText,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from 'react-native-svg';

import { lightColors } from './colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: default pink → info ramp when caller omits colors
const DEFAULT_GRADIENT_COLORS = ['#E94EAD', lightColors.info];
const FALLBACK_WHEN_NO_COLORS = '#A348D0';
const DEFAULT_FONT_SIZE = 14;
const DEFAULT_FONT_WEIGHT = '400';
const DEFAULT_LETTER_SPACING = 0;
const DEFAULT_TEXT_ALIGN = 'left';
const TEXT_ALIGN_CENTER = 'center';
const TEXT_ALIGN_RIGHT = 'right';
const SVG_ANCHOR_MIDDLE = 'middle';
const SVG_ANCHOR_END = 'end';
const SVG_ANCHOR_START = 'start';
const GRADIENT_AXIS_X = 'x';
const GRADIENT_AXIS_Y = 'y';
const PERCENT_SCALE = 100;
// Manipulate here: 1.12 = measured multiline spacing; 1.25 = pre-measure single-line guess
const LINE_HEIGHT_RATIO_DEFAULT = 1.12;
const LINE_HEIGHT_RATIO_BEFORE_MEASURE = 1.25;
// Manipulate here: 0.35 nudges SVG baseline inside the line box
const BASELINE_OFFSET_IN_LINE = 0.35;
const GRADIENT_ID_PREFIX = 'sgt';
const GRADIENT_START_DEFAULT = { x: 0, y: 0 };
const GRADIENT_END_DEFAULT = { x: 1, y: 0 };

let nextGradientDomId = 0;

// ===== HELPER FUNCTIONS =====

function childValueIsPlainText(children) {
  return typeof children === 'string' || typeof children === 'number';
}

// Solid color shown before the SVG is measured. Middle stop if there are several.
function solidColorWhileMeasuring(gradientColors) {
  if (!gradientColors?.length) {
    return FALLBACK_WHEN_NO_COLORS;
  }
  if (gradientColors.length === 1) {
    return gradientColors[0];
  }
  const middleIndex = Math.floor(gradientColors.length / 2);
  return gradientColors[middleIndex];
}

function defaultFractionWhenGradientPointMissing(axisName) {
  if (axisName === GRADIENT_AXIS_X) {
    return 0;
  }
  if (axisName === GRADIENT_AXIS_Y) {
    return 0;
  }
  return 1;
}

// Turn a 0–1 gradient coordinate into an SVG percent string.
function gradientPointAsPercent(fraction, axisName) {
  let resolvedFraction = fraction;
  if (resolvedFraction == null) {
    resolvedFraction = defaultFractionWhenGradientPointMissing(axisName);
  }
  return `${Math.round(resolvedFraction * PERCENT_SCALE)}%`;
}

function svgTextAnchorFromAlign(textAlign) {
  if (textAlign === TEXT_ALIGN_CENTER) {
    return SVG_ANCHOR_MIDDLE;
  }
  if (textAlign === TEXT_ALIGN_RIGHT) {
    return SVG_ANCHOR_END;
  }
  return SVG_ANCHOR_START;
}

// Stop offset along the gradient. One color sits at 0%; several are spaced evenly.
function offsetForGradientStop(stopIndex, colorCount) {
  if (colorCount === 1) {
    return '0%';
  }
  return `${(stopIndex / (colorCount - 1)) * PERCENT_SCALE}%`;
}

function horizontalPositionForAnchor(textAnchor, measuredWidth) {
  if (textAnchor === SVG_ANCHOR_MIDDLE && measuredWidth) {
    return measuredWidth / 2;
  }
  if (textAnchor === SVG_ANCHOR_END && measuredWidth) {
    return measuredWidth;
  }
  return 0;
}

function textLinesFromPlainText(plainText) {
  return plainText.split('\n');
}

function estimatedSvgHeightBeforeMeasure(lineCount, lineHeightPixels, fontSize) {
  const isMultiLine = lineCount > 1;
  if (isMultiLine) {
    return Math.ceil(lineCount * lineHeightPixels);
  }
  const fallbackLineHeight = lineHeightPixels || fontSize * LINE_HEIGHT_RATIO_BEFORE_MEASURE;
  return Math.ceil(fallbackLineHeight);
}

function resolveSvgHeight(measuredHeight, textLines, lineHeightPixels, fontSize) {
  if (measuredHeight) {
    return Math.ceil(measuredHeight);
  }
  return estimatedSvgHeightBeforeMeasure(textLines.length, lineHeightPixels, fontSize);
}

function resolveSvgWidth(measuredWidth) {
  if (measuredWidth) {
    return Math.ceil(measuredWidth);
  }
  return 0;
}

function baselineYForFirstLine(fontSize, lineHeightPixels) {
  return fontSize + (lineHeightPixels - fontSize) * BASELINE_OFFSET_IN_LINE;
}

function readFontBitsFromFlatStyle(flatStyle) {
  return {
    fontSize: flatStyle.fontSize ?? DEFAULT_FONT_SIZE,
    fontWeight: flatStyle.fontWeight ?? DEFAULT_FONT_WEIGHT,
    letterSpacing: flatStyle.letterSpacing ?? DEFAULT_LETTER_SPACING,
    lineHeightFromStyle: flatStyle.lineHeight,
    fontFamily: flatStyle.fontFamily,
    textAlign: flatStyle.textAlign ?? DEFAULT_TEXT_ALIGN,
  };
}

function buildWrapperStyleList(isCenteredLayout, flatStyle) {
  const alignSelfOverride = flatStyle.alignSelf
    ? { alignSelf: flatStyle.alignSelf }
    : null;
  const widthOverride = flatStyle.width ? { width: flatStyle.width } : null;
  return [
    styles.wrap,
    isCenteredLayout ? styles.wrapCenter : null,
    alignSelfOverride,
    widthOverride,
  ];
}

function mintUniqueGradientDomId() {
  nextGradientDomId += 1;
  return `${GRADIENT_ID_PREFIX}${nextGradientDomId}`;
}

function GradientStopList({ gradientDomId, gradientColors, gradientStart, gradientEnd }) {
  return (
    <Defs>
      <SvgGradient
        id={gradientDomId}
        x1={gradientPointAsPercent(gradientStart.x, GRADIENT_AXIS_X)}
        y1={gradientPointAsPercent(gradientStart.y, GRADIENT_AXIS_Y)}
        x2={gradientPointAsPercent(gradientEnd.x, GRADIENT_AXIS_X)}
        y2={gradientPointAsPercent(gradientEnd.y, GRADIENT_AXIS_Y)}
      >
        {gradientColors.map((stopColor, stopIndex) => (
          <Stop
            key={`${stopColor}-${stopIndex}`}
            offset={offsetForGradientStop(stopIndex, gradientColors.length)}
            stopColor={stopColor}
          />
        ))}
      </SvgGradient>
    </Defs>
  );
}

function GradientSvgLines({
  plainText,
  gradientDomId,
  gradientColors,
  gradientStart,
  gradientEnd,
  textAnchor,
  fontSize,
  fontWeight,
  letterSpacing,
  fontFamily,
  lineHeightPixels,
  measuredWidth,
  measuredHeight,
}) {
  const textLines = textLinesFromPlainText(plainText);
  const svgHeight = resolveSvgHeight(measuredHeight, textLines, lineHeightPixels, fontSize);
  const svgWidth = resolveSvgWidth(measuredWidth);
  const baselineY = baselineYForFirstLine(fontSize, lineHeightPixels);
  const textX = horizontalPositionForAnchor(textAnchor, svgWidth);
  const fillUrl = `url(#${gradientDomId})`;

  return (
    <Svg width={svgWidth} height={svgHeight} style={styles.svgOverlay}>
      <GradientStopList
        gradientDomId={gradientDomId}
        gradientColors={gradientColors}
        gradientStart={gradientStart}
        gradientEnd={gradientEnd}
      />
      {textLines.map((lineText, lineIndex) => (
        <SvgText
          key={`${lineText}-${lineIndex}`}
          x={textX}
          y={baselineY + lineIndex * lineHeightPixels}
          textAnchor={textAnchor}
          fontSize={fontSize}
          fontWeight={fontWeight}
          letterSpacing={letterSpacing}
          fontFamily={fontFamily}
          fill={fillUrl}
        >
          {lineText}
        </SvgText>
      ))}
    </Svg>
  );
}

function SolidFallbackText({ textProps, sharedTextStyle, flatStyle, solidFallback, maxLines, plainText }) {
  const solidStyle = [sharedTextStyle, flatStyle, { color: solidFallback }];
  return (
    <Text {...textProps} style={solidStyle} numberOfLines={maxLines}>
      {plainText}
    </Text>
  );
}

function HiddenMeasureText({
  textProps,
  sharedTextStyle,
  flatStyle,
  maxLines,
  plainText,
  onMeasuredSize,
}) {
  // vocab: onLayout = RN fires after layout with nativeEvent.layout width/height
  const measureStyle = [sharedTextStyle, styles.hiddenMeasureText, flatStyle];

  function rememberLayoutSize(layoutEvent) {
    const { width, height } = layoutEvent.nativeEvent.layout;
    if (width > 0 && height > 0) {
      onMeasuredSize({ width, height });
    }
  }

  return (
    <Text
      {...textProps}
      style={measureStyle}
      numberOfLines={maxLines}
      onLayout={rememberLayoutSize}
    >
      {plainText}
    </Text>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Gradient-filled text. Children that are not a string/number skip SVG and render as plain Text.
 * @param {object} props
 */
export default function ColorText({
  children,
  style,
  colors = DEFAULT_GRADIENT_COLORS,
  start = GRADIENT_START_DEFAULT,
  end = GRADIENT_END_DEFAULT,
  textProps,
  numberOfLines,
  fallbackColor,
}) {
  const childIsPlainText = childValueIsPlainText(children);
  const plainText = childIsPlainText ? String(children) : null;

  const flatStyle = StyleSheet.flatten(style) || {};
  const {
    fontSize,
    fontWeight,
    letterSpacing,
    lineHeightFromStyle,
    fontFamily,
    textAlign,
  } = readFontBitsFromFlatStyle(flatStyle);
  const solidFallback = fallbackColor ?? solidColorWhileMeasuring(colors);
  const maxLines = numberOfLines ?? flatStyle.numberOfLines;

  // Hook order frozen: measuredSize → gradientDomId → sharedTextStyle
  // vocab: useState = measured box from the hidden Text; null until first onLayout
  const [measuredSize, setMeasuredSize] = useState(null);
  // vocab: useMemo = mint one SVG gradient id for this mount (Defs id must stay unique)
  const gradientDomId = useMemo(() => mintUniqueGradientDomId(), []);
  const sharedTextStyle = useMemo(
    () => ({
      fontSize,
      fontWeight,
      letterSpacing,
      lineHeight: lineHeightFromStyle,
      fontFamily,
      textAlign,
    }),
    [fontSize, fontWeight, letterSpacing, lineHeightFromStyle, fontFamily, textAlign],
  );

  // Non-string children: skip SVG entirely (same door as before).
  if (!plainText) {
    const plainChildStyle = [style, { color: solidFallback }];
    return (
      <Text {...textProps} style={plainChildStyle} numberOfLines={maxLines}>
        {children}
      </Text>
    );
  }

  // 1. Resolve SVG align + line height from flattened style.
  const textAnchor = svgTextAnchorFromAlign(textAlign);
  const lineHeightPixels = lineHeightFromStyle || fontSize * LINE_HEIGHT_RATIO_DEFAULT;
  const isCenteredLayout = textAlign === TEXT_ALIGN_CENTER;
  const measuredWidth = measuredSize ? measuredSize.width : 0;
  const measuredHeight = measuredSize ? measuredSize.height : 0;
  const gradientReady = Boolean(measuredSize && measuredWidth > 0);
  const wrapperStyle = buildWrapperStyleList(isCenteredLayout, flatStyle);

  // 2. Until measure lands, show solid fallback; then paint SVG gradient lines.
  let visibleTextNode = (
    <SolidFallbackText
      textProps={textProps}
      sharedTextStyle={sharedTextStyle}
      flatStyle={flatStyle}
      solidFallback={solidFallback}
      maxLines={maxLines}
      plainText={plainText}
    />
  );
  if (gradientReady) {
    visibleTextNode = (
      <GradientSvgLines
        plainText={plainText}
        gradientDomId={gradientDomId}
        gradientColors={colors}
        gradientStart={start}
        gradientEnd={end}
        textAnchor={textAnchor}
        fontSize={fontSize}
        fontWeight={fontWeight}
        letterSpacing={letterSpacing}
        fontFamily={fontFamily}
        lineHeightPixels={lineHeightPixels}
        measuredWidth={measuredWidth}
        measuredHeight={measuredHeight}
      />
    );
  }

  return (
    <View style={wrapperStyle} collapsable={false}>
      <HiddenMeasureText
        textProps={textProps}
        sharedTextStyle={sharedTextStyle}
        flatStyle={flatStyle}
        maxLines={maxLines}
        plainText={plainText}
        onMeasuredSize={setMeasuredSize}
      />
      {visibleTextNode}
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
  hiddenMeasureText: {
    opacity: 0,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  svgOverlay: {
    overflow: 'visible',
  },
});
