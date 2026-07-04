/**
 * Gradient text via react-native-svg (no MaskedView).
 * Shows a solid fallback immediately, then swaps to SVG gradient once measured —
 * avoids blank/flickering text/icons common with MaskedView in dev builds.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Text as SvgText, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

let gradIdCounter = 0;

function pickFallbackColor(colors) {
  if (!colors?.length) return '#A348D0';
  if (colors.length === 1) return colors[0];
  return colors[Math.floor(colors.length / 2)];
}

function pct(fraction, axis) {
  const v = fraction ?? (axis === 'x' ? 0 : axis === 'y' ? 0 : 1);
  return `${Math.round(v * 100)}%`;
}

export default function StableGradientText({
  children,
  style,
  colors = ['#E94EAD', '#6B3AD9'],
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0 },
  textProps,
  numberOfLines,
  fallbackColor,
}) {
  const text =
    typeof children === 'string' || typeof children === 'number' ? String(children) : null;
  const flatStyle = StyleSheet.flatten(style) || {};
  const fontSize = flatStyle.fontSize ?? 14;
  const fontWeight = flatStyle.fontWeight ?? '400';
  const letterSpacing = flatStyle.letterSpacing ?? 0;
  const lineHeight = flatStyle.lineHeight;
  const fontFamily = flatStyle.fontFamily;
  const align = flatStyle.textAlign ?? 'left';
  const fallback = fallbackColor ?? pickFallbackColor(colors);
  const lines = numberOfLines ?? flatStyle.numberOfLines;

  const [size, setSize] = useState(null);
  const gradId = useMemo(() => `sgt${++gradIdCounter}`, []);

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

  const centered = align === 'center';
  const anchor = centered ? 'middle' : align === 'right' ? 'end' : 'start';
  const lineHeightPx = lineHeight || fontSize * 1.12;
  const svgH = size
    ? Math.ceil(size.height)
    : Math.ceil(isMultiline ? textLines.length * lineHeightPx : lineHeight || fontSize * 1.25);
  const svgW = size ? Math.ceil(size.width) : 0;
  const baselineY = fontSize + (lineHeightPx - fontSize) * 0.35;
  const x = anchor === 'middle' && svgW ? svgW / 2 : anchor === 'end' && svgW ? svgW : 0;
  const ready = size && svgW > 0;

  return (
    <View
      style={[
        styles.wrap,
        centered ? styles.wrapCenter : null,
        flatStyle.alignSelf ? { alignSelf: flatStyle.alignSelf } : null,
        flatStyle.width ? { width: flatStyle.width } : null,
      ]}
      collapsable={false}
    >
      <Text
        {...textProps}
        style={[baseTextStyle, styles.measure, flatStyle]}
        numberOfLines={lines}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) setSize({ width, height });
        }}
      >
        {text}
      </Text>
      {!ready ? (
        <Text {...textProps} style={[baseTextStyle, flatStyle, { color: fallback }]} numberOfLines={lines}>
          {text}
        </Text>
      ) : (
        <Svg width={svgW} height={svgH} style={styles.svg}>
          <Defs>
            <SvgGradient
              id={gradId}
              x1={pct(start.x, 'x')}
              y1={pct(start.y, 'y')}
              x2={pct(end.x, 'x')}
              y2={pct(end.y, 'y')}
            >
              {colors.map((color, i) => (
                <Stop
                  key={`${color}-${i}`}
                  offset={colors.length === 1 ? '0%' : `${(i / (colors.length - 1)) * 100}%`}
                  stopColor={color}
                />
              ))}
            </SvgGradient>
          </Defs>
          {textLines.map((line, index) => (
            <SvgText
              key={`${line}-${index}`}
              x={x}
              y={baselineY + index * lineHeightPx}
              textAnchor={anchor}
              fontSize={fontSize}
              fontWeight={fontWeight}
              letterSpacing={letterSpacing}
              fontFamily={fontFamily}
              fill={`url(#${gradId})`}
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
