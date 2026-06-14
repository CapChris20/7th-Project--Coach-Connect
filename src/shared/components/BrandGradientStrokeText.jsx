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
  const x = textAnchor === 'end' && svgW ? svgW - pad : pad;

  return (
    <View
      style={[
        styles.wrap,
        textAnchor === 'end' && styles.wrapEnd,
        style,
      ]}
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
      {size && svgW > 0 ? (
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
            textAnchor={textAnchor}
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
            textAnchor={textAnchor}
            fontSize={fontSize}
            fontWeight={fontWeight}
            letterSpacing={letterSpacing}
            fill={fillColor}
          >
            {text}
          </SvgText>
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignSelf: 'flex-start',
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
