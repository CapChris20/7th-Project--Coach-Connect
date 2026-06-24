import React from 'react';
import StableGradientText from '../../../shared-ui/StableGradientText';

/**
 * Gradient text — re-exported stable SVG implementation (no MaskedView).
 */
export default function GradientText({ colors: gradientColors, style, children, start, end }) {
  return (
    <StableGradientText colors={gradientColors} style={style} start={start} end={end}>
      {children}
    </StableGradientText>
  );
}
