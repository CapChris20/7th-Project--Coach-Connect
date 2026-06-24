/**
 * Brand Gradient Stroke Text
 *
 * Purpose: Brand Gradient Stroke Text — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: BRAND_GRADIENT, BrandGradientStrokeText
 *
 * @file-header
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Text as SvgText, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

export const BRAND_GRADIENT = ['#6D28D9', '#C2410C'];

let gradIdCounter = 0;

/**
 * Solid fill + purple→orange gradient stroke (SVG). Measures with hidden Text first.
 */
export default function BrandGradientStrokeText({
  children,
  fontSize = 17,
  fontWeight = '800',
  fillColor = '#FFFFFF',
  strokeWidth,
  letterSpacing = 0,
  numberOfLines = 1,
  style,
  textAnchor = 'start',
  enabled = true,
}) {
  const text = String(children ?? '');
  const stroke = strokeWidth ?? Math.max(1, Math.round(fontSize * 0.065));
  const [size, setSize] = useState(null);
  const gradId = useMemo(() => `brandStroke${++gradIdCounter}`, []);
  const flatStyle = StyleSheet.flatten(style) || {};
  const centered = textAnchor === 'middle' || flatStyle.textAlign === 'center';
  const anchor = centered ? 'middle' : textAnchor;
  const fullWidth = flatStyle.width === '100%' || flatStyle.alignSelf === 'stretch';

  const baseTextStyle = useMemo(
    () => ({
      fontSize,
      fontWeight,
      letterSpacing,
    }),
    [fontSize, fontWeight, letterSpacing],
  );

  if (!enabled || !text) {
    return (
      <Text style={[baseTextStyle, style, { color: fillColor }]} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }

  const pad = stroke * 2;
  const svgW = size ? Math.ceil(size.width) + pad * 2 : 0;
  const svgH = size ? Math.ceil(size.height) + stroke * 2 : Math.ceil(fontSize * 1.35);
  const baselineY = fontSize + stroke * 0.5;
  const x = anchor === 'middle' && svgW ? svgW / 2 : anchor === 'end' && svgW ? svgW - pad : pad;

  return (
    <View
      style={[
        styles.wrap,
        centered && (fullWidth ? styles.wrapCenterFull : styles.wrapCenter),
        !centered && anchor === 'end' && styles.wrapEnd,
        style,
      ]}
      collapsable={false}
    >
      <Text
        style={[baseTextStyle, styles.measure]}
        numberOfLines={numberOfLines}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0) setSize({ width, height });
        }}
      >
        {text}
      </Text>
      {!size || svgW <= 0 ? (
        <Text style={[baseTextStyle, { color: fillColor }]} numberOfLines={numberOfLines}>
          {text}
        </Text>
      ) : (
        <Svg width={svgW} height={svgH} style={styles.svg}>
          <Defs>
            <SvgGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={BRAND_GRADIENT[0]} stopOpacity="1" />
              <Stop offset="100%" stopColor={BRAND_GRADIENT[1]} stopOpacity="1" />
            </SvgGradient>
          </Defs>
          <SvgText
            x={x}
            y={baselineY}
            textAnchor={anchor}
            fontSize={fontSize}
            fontWeight={fontWeight}
            letterSpacing={letterSpacing}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            {text}
          </SvgText>
          <SvgText
            x={x}
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
