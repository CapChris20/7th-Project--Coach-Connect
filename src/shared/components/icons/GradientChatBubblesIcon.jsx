/**
 * Gradient Chat Bubbles Icon — SVG gradient (no MaskedView).
 */
import React from 'react';
import BrandGradientIcon from './BrandGradientIcon';

export default function GradientChatBubblesIcon({ size = 32, colors, start, end }) {
  return <BrandGradientIcon name="chatbubbles" size={size} colors={colors} start={start} end={end} />;
}
