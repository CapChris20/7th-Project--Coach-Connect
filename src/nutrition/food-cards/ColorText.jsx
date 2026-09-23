import React from 'react';
import ColorText from '../../look-and-feel/ColorText';

/**
 * Gradient text — re-exported stable SVG implementation (no MaskedView).
 */
export default function ColorText({ colors: gradientColors, style, children, start, end }) {
  return (
    <ColorText colors={gradientColors} style={style} start={start} end={end}>
      {children}
    </ColorText>
  );
}
