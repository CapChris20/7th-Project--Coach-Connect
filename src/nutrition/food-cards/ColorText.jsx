import React from 'react';
import BaseColorText from '../../look-and-feel/ColorText';

/**
 * Gradient text — re-exported stable SVG implementation (no MaskedView).
 */
export default function ColorText({ colors: gradientColors, style, children, start, end }) {
  return (
    <BaseColorText colors={gradientColors} style={style} start={start} end={end}>
      {children}
    </BaseColorText>
  );
}
